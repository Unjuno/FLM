//! Proxy command implementation

mod daemon;

use crate::adapters::{SqliteProxyRepository, SqliteSecurityRepository};
use crate::cli::proxy::ProxySubcommand;
use crate::utils::secrets::load_dns_token;
use crate::utils::{get_config_db_path, get_security_db_path};
use daemon::ensure_daemon_client;
use flm_core::domain::proxy::{
    AcmeChallengeKind, ProxyConfig, ProxyEgressConfig, ProxyEgressMode, ProxyHandle, ProxyMode,
    ResolvedDnsCredential, DEFAULT_TOR_SOCKS_ENDPOINT,
};
use flm_core::ports::ProxyRepository;
use flm_core::services::ProxyService;
use flm_proxy::AxumProxyController;
use once_cell::sync::Lazy;
use serde_json::json;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;

const DNS01_DISABLED_REASON: &str =
    "DNS-01 automation is currently deferred (see docs/planning/PLAN.md#dns-automation).";

/// Check if DNS-01 feature is enabled
fn dns01_feature_enabled() -> bool {
    // DNS-01 feature is currently disabled (deferred)
    false
}

/// Execute proxy command
pub async fn execute(
    subcommand: ProxySubcommand,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
    output_format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        ProxySubcommand::Start {
            port,
            mode,
            egress_mode,
            socks5_endpoint,
            egress_fail_open,
            bind,
            acme_email,
            acme_domain,
            acme_challenge,
            acme_dns_profile,
            acme_dns_lego_path,
            acme_dns_propagation_wait,
            no_daemon,
        } => {
            let options = StartCommandOptions {
                port,
                mode,
                egress_mode,
                socks5_endpoint,
                egress_fail_open,
                bind,
                acme_email,
                acme_domain,
                acme_challenge,
                acme_dns_profile,
                acme_dns_lego_path,
                acme_dns_propagation_wait,
                db_path_config,
                db_path_security,
                no_daemon,
                output_format,
            };
            execute_start(options).await
        }
        ProxySubcommand::Stop { port, handle_id } => {
            execute_stop(port, handle_id, db_path_config, db_path_security).await
        }
        ProxySubcommand::Status => {
            execute_status(db_path_config, db_path_security, output_format).await
        }
        ProxySubcommand::Reload {
            port,
            handle_id,
            all,
        } => {
            execute_reload(
                port,
                handle_id,
                all,
                db_path_config,
                db_path_security,
                output_format,
            )
            .await
        }
    }
}

/// Aggregates CLI inputs for the proxy start command.
struct StartCommandOptions {
    port: u16,
    mode: String,
    egress_mode: String,
    socks5_endpoint: Option<String>,
    egress_fail_open: bool,
    bind: String,
    acme_email: Option<String>,
    acme_domain: Option<String>,
    acme_challenge: String,
    acme_dns_profile: Option<String>,
    acme_dns_lego_path: Option<String>,
    acme_dns_propagation_wait: Option<u64>,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
    no_daemon: bool,
    output_format: String,
}

struct InlineRuntime {
    service: Arc<ProxyService<AxumProxyController, SqliteProxyRepository>>,
}

static INLINE_RUNTIMES: Lazy<Mutex<HashMap<String, Arc<InlineRuntime>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Execute proxy start command
async fn execute_start(options: StartCommandOptions) -> Result<(), Box<dyn std::error::Error>> {
    let StartCommandOptions {
        port,
        mode,
        egress_mode,
        socks5_endpoint,
        egress_fail_open,
        bind,
        acme_email,
        acme_domain,
        acme_challenge,
        acme_dns_profile,
        acme_dns_lego_path,
        acme_dns_propagation_wait,
        db_path_config,
        db_path_security,
        no_daemon,
        output_format,
    } = options;

    let config_db_path = db_path_config
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);
    let security_db_path = db_path_security
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Validate port range (u16 is 0-65535, but 0 is invalid)
    if port == 0 {
        return Err("Invalid port: 0. Port must be between 1 and 65535"
            .to_string()
            .into());
    }

    if !dns01_feature_enabled() {
        if acme_challenge.trim().eq_ignore_ascii_case("dns-01") {
            return Err(DNS01_DISABLED_REASON.into());
        }
        if acme_dns_profile.is_some()
            || acme_dns_lego_path.is_some()
            || acme_dns_propagation_wait.is_some()
        {
            return Err(
                "DNS automation flags (--dns-profile/--lego-path/--dns-propagation-wait) are disabled while DNS-01 is deferred."
                    .into(),
            );
        }
    }

    // Parse mode
    let proxy_mode = match mode.as_str() {
        "local-http" => ProxyMode::LocalHttp,
        "dev-selfsigned" => ProxyMode::DevSelfSigned,
        "https-acme" => ProxyMode::HttpsAcme,
        "packaged-ca" => ProxyMode::PackagedCa,
        _ => {
            return Err(format!(
                "Invalid mode: {mode}. Must be one of: local-http, dev-selfsigned, https-acme, packaged-ca"
            )
            .into());
        }
    };

    // Parse egress mode
    let egress_mode_parsed = match egress_mode.as_str() {
        "direct" => ProxyEgressMode::Direct,
        "tor" => ProxyEgressMode::Tor,
        "socks5" => ProxyEgressMode::CustomSocks5,
        _ => {
            return Err(format!(
                "Invalid egress mode: {egress_mode}. Must be one of: direct, tor, socks5"
            )
            .into());
        }
    };

    // Validate ACME requirements
    if proxy_mode == ProxyMode::HttpsAcme {
        if acme_email.is_none() {
            return Err("ACME email is required for https-acme mode (--acme-email)".into());
        }
        if acme_domain.is_none() {
            return Err("ACME domain is required for https-acme mode (--acme-domain)".into());
        }
    }

    // Check if wildcard domain is specified
    let is_wildcard = acme_domain
        .as_ref()
        .map(|d| d.starts_with("*."))
        .unwrap_or(false);

    // Parse ACME challenge kind
    // If wildcard domain is specified, force DNS-01 challenge
    let acme_challenge_kind = if is_wildcard {
        if !dns01_feature_enabled() {
            return Err("Wildcard domain (*.example.com) requires DNS-01 feature which is currently disabled".into());
        }
        if acme_dns_profile.is_none() {
            return Err(
                "Wildcard domain requires --dns-profile to be set for DNS-01 challenge".into(),
            );
        }
        AcmeChallengeKind::Dns01
    } else {
        match acme_challenge.trim().to_lowercase().as_str() {
            "http-01" => AcmeChallengeKind::Http01,
            "dns-01" if dns01_feature_enabled() => {
                if acme_dns_profile.is_none() {
                    return Err("DNS-01 challenge requires --dns-profile to be set".into());
                }
                AcmeChallengeKind::Dns01
            }
            "dns-01" => return Err(DNS01_DISABLED_REASON.into()),
            _ => {
                return Err(format!(
                    "Invalid ACME challenge: {acme_challenge}. Must be one of: http-01, dns-01"
                )
                .into());
            }
        }
    };

    // Resolve DNS credential if DNS-01 is used
    // Note: DNS-01 feature is currently disabled, so this will always be None
    let resolved_dns_credential: Option<ResolvedDnsCredential> =
        if acme_challenge_kind == AcmeChallengeKind::Dns01 {
            if let Some(profile_id) = &acme_dns_profile {
                // DNS-01 feature is disabled, but we need to handle the case where it's requested
                // For now, return None since the feature is disabled
                // In the future, this would load the token and construct ResolvedDnsCredential
                match load_dns_token(profile_id) {
                    Ok(_token) => {
                        // TODO: Parse token and construct ResolvedDnsCredential when DNS-01 is enabled
                        // For now, return None since DNS-01 is disabled
                        None
                    }
                    Err(e) => {
                        return Err(format!(
                            "Failed to load DNS credential for profile {}: {}",
                            profile_id, e
                        )
                        .into());
                    }
                }
            } else {
                return Err("DNS-01 challenge requires --dns-profile to be set".into());
            }
        } else {
            None
        };

    // Build proxy config
    let config = ProxyConfig {
        port,
        mode: proxy_mode,
        listen_addr: bind,
        acme_email,
        acme_domain,
        acme_challenge: Some(acme_challenge_kind),
        acme_dns_profile_id: acme_dns_profile,
        acme_dns_lego_path,
        acme_dns_propagation_secs: acme_dns_propagation_wait,
        resolved_dns_credential,
        egress: ProxyEgressConfig {
            mode: egress_mode_parsed.clone(),
            socks5_endpoint: match &egress_mode_parsed {
                ProxyEgressMode::Tor => Some(DEFAULT_TOR_SOCKS_ENDPOINT.to_string()),
                ProxyEgressMode::CustomSocks5 => {
                    socks5_endpoint.or(Some(DEFAULT_TOR_SOCKS_ENDPOINT.to_string()))
                }
                ProxyEgressMode::Direct => None,
            },
            fail_open: egress_fail_open,
        },
        security_db_path: Some(security_db_path.to_string_lossy().to_string()),
        config_db_path: Some(config_db_path.to_string_lossy().to_string()),
        trusted_proxy_ips: Vec::new(),
    };

    // Handle daemon mode
    if !no_daemon {
        let client = ensure_daemon_client(&config_db_path, &security_db_path).await?;
        let handle = client.start_proxy(&config).await?;
        if output_format == "json" {
            let output = json!({
                "version": "1.0",
                "data": handle
            });
            println!("{}", serde_json::to_string_pretty(&output)?);
        } else {
            println!("Proxy started: {}", handle.id);
            println!("  Port: {}", handle.port);
            println!("  Mode: {:?}", handle.mode);
            println!("  Listen: {}", handle.listen_addr);
            if let Some(https_port) = handle.https_port {
                println!("  HTTPS Port: {https_port}");
            }
            if let Some(domain) = handle.acme_domain {
                println!("  ACME Domain: {domain}");
            }
        }
        Ok(())
    } else {
        // Inline mode: start proxy in this process
        let (runtime, _key) =
            get_or_create_inline_runtime(config_db_path.clone(), security_db_path.clone()).await?;

        // Clone config for mode check before ownership is moved
        let config_clone = config.clone();

        // Check for existing certificate in database for ACME mode
        // Note: Certificate reuse logic is currently simplified
        // rustls-acme will automatically handle certificate caching
        if config_clone.mode == ProxyMode::HttpsAcme {
            // Certificate management is handled by rustls-acme automatically
            // No need to manually check for existing certificates
        }

        let handle = runtime.service.start(config).await?;

        if output_format == "json" {
            let output = json!({
                "version": "1.0",
                "data": handle
            });
            println!("{}", serde_json::to_string_pretty(&output)?);
        } else {
            println!("Proxy started: {}", handle.id);
            println!("  Port: {}", handle.port);
            println!("  Mode: {:?}", handle.mode);
            println!("  Listen: {}", handle.listen_addr);
            if let Some(https_port) = handle.https_port {
                println!("  HTTPS Port: {https_port}");
            }
            if let Some(domain) = handle.acme_domain {
                println!("  ACME Domain: {domain}");
            }
            println!("\nProxy is running in foreground. Press Ctrl+C to stop.");
        }

        // Wait for the server task to complete (inline mode)
        // Note: Server is already running after start() call
        // In inline mode, the server runs in the background
        // The process will continue until interrupted
        cleanup_inline_runtime_if_idle(
            inline_runtime_key(&config_db_path, &security_db_path),
            runtime,
        )
        .await;

        Ok(())
    }
}

async fn execute_stop(
    port: Option<u16>,
    handle_id: Option<String>,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let config_db_path = db_path_config
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);
    let security_db_path = db_path_security
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let selector = if let Some(port) = port {
        StopSelector::Port(port)
    } else if let Some(id) = handle_id {
        StopSelector::HandleId(id)
    } else {
        return Err("Either --port or --handle-id must be specified to stop a proxy".into());
    };

    let key = inline_runtime_key(&config_db_path, &security_db_path);
    let runtime = match load_inline_runtime(&config_db_path, &security_db_path).await {
        Some(runtime) => runtime,
        None => return Err(selector.missing_error().into()),
    };

    let handles = runtime.service.status().await?;
    let target = selector
        .find_handle(&handles)
        .ok_or_else(|| selector.missing_error())?;

    runtime.service.stop(target.clone()).await?;
    println!("Proxy stopped: {}", target.id);
    cleanup_inline_runtime_if_idle(key, runtime).await;

    Ok(())
}

async fn execute_status(
    db_path_config: Option<String>,
    db_path_security: Option<String>,
    output_format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let config_db_path = db_path_config
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);
    let security_db_path = db_path_security
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let handles = status_inline(config_db_path, security_db_path).await?;
    render_status(handles, output_format)
}

async fn status_inline(
    config_db_path: PathBuf,
    security_db_path: PathBuf,
) -> Result<Vec<ProxyHandle>, Box<dyn std::error::Error>> {
    if let Some(runtime) = load_inline_runtime(&config_db_path, &security_db_path).await {
        return Ok(runtime.service.status().await?);
    }

    let proxy_repo = SqliteProxyRepository::new(&config_db_path).await?;
    let handles = proxy_repo.list_active_handles().await?;
    Ok(handles)
}

impl InlineRuntime {
    async fn new(
        config_db_path: PathBuf,
        security_db_path: PathBuf,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let proxy_repo = Arc::new(SqliteProxyRepository::new(&config_db_path).await?);
        let _security_repo = SqliteSecurityRepository::new(&security_db_path).await?;
        let controller = Arc::new(AxumProxyController::new());
        let service = Arc::new(ProxyService::new(controller, proxy_repo));
        Ok(Self { service })
    }
}

fn inline_runtime_key(config_db_path: &Path, security_db_path: &Path) -> String {
    format!(
        "{}::{}",
        config_db_path.to_string_lossy(),
        security_db_path.to_string_lossy()
    )
}

async fn get_or_create_inline_runtime(
    config_db_path: PathBuf,
    security_db_path: PathBuf,
) -> Result<(Arc<InlineRuntime>, String), Box<dyn std::error::Error>> {
    let key = inline_runtime_key(&config_db_path, &security_db_path);
    {
        let runtimes = INLINE_RUNTIMES.lock().await;
        if let Some(runtime) = runtimes.get(&key) {
            return Ok((runtime.clone(), key));
        }
    }

    let runtime = Arc::new(InlineRuntime::new(config_db_path, security_db_path).await?);
    let mut runtimes = INLINE_RUNTIMES.lock().await;
    let entry = runtimes
        .entry(key.clone())
        .or_insert_with(|| runtime.clone());
    Ok((entry.clone(), key))
}

async fn load_inline_runtime(
    config_db_path: &Path,
    security_db_path: &Path,
) -> Option<Arc<InlineRuntime>> {
    let key = inline_runtime_key(config_db_path, security_db_path);
    let runtimes = INLINE_RUNTIMES.lock().await;
    runtimes.get(&key).cloned()
}

async fn cleanup_inline_runtime_if_idle(key: String, runtime: Arc<InlineRuntime>) {
    match runtime.service.status().await {
        Ok(handles) if handles.is_empty() => {
            let mut runtimes = INLINE_RUNTIMES.lock().await;
            if let Some(existing) = runtimes.get(&key) {
                if Arc::ptr_eq(existing, &runtime) {
                    runtimes.remove(&key);
                }
            }
        }
        _ => {}
    }
}

enum StopSelector {
    Port(u16),
    HandleId(String),
}

impl StopSelector {
    fn missing_error(&self) -> String {
        match self {
            StopSelector::Port(port) => format!(
                "No proxy running on port {port}. Use 'flm proxy status' to see running proxies"
            ),
            StopSelector::HandleId(id) => {
                format!("No proxy with ID '{id}'. Use 'flm proxy status' to see running proxies")
            }
        }
    }

    fn find_handle(&self, handles: &[ProxyHandle]) -> Option<ProxyHandle> {
        match self {
            StopSelector::Port(port) => handles.iter().find(|h| h.port == *port).cloned(),
            StopSelector::HandleId(id) => handles.iter().find(|h| h.id == *id).cloned(),
        }
    }
}

fn render_status(
    handles: Vec<ProxyHandle>,
    output_format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    if output_format == "json" {
        let output = serde_json::json!({
            "version": "1.0",
            "data": handles
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
        return Ok(());
    }

    if handles.is_empty() {
        println!("No running proxies");
    } else {
        println!("Running proxies:");
        for handle in handles {
            println!("  ID: {}", handle.id);
            println!("    Port: {}", handle.port);
            println!("    Mode: {:?}", handle.mode);
            println!("    Listen: {}", handle.listen_addr);
            if let Some(https_port) = handle.https_port {
                println!("    HTTPS Port: {https_port}");
            }
            if let Some(domain) = handle.acme_domain {
                println!("    ACME Domain: {domain}");
            }
            println!("    Running: {}", handle.running);
            if let Some(error) = handle.last_error {
                println!("    Last Error: {error}");
            }
            println!("    Egress Mode: {:?}", handle.egress.mode);
            if let Some(endpoint) = handle.egress.display_endpoint() {
                println!("    Egress Endpoint: {endpoint}");
            }
            if handle.egress.fail_open {
                println!("    Egress Fail-Open: enabled");
            }
            println!();
        }
    }

    Ok(())
}

/// Execute proxy reload command
async fn execute_reload(
    port: Option<u16>,
    handle_id: Option<String>,
    all: bool,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
    output_format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let config_db_path = db_path_config
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);
    let security_db_path = db_path_security
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Load or create inline runtime
    let (runtime, _key) = get_or_create_inline_runtime(config_db_path, security_db_path).await?;

    // Get current status
    let handles = runtime.service.status().await?;

    if handles.is_empty() {
        return Err("No running proxies found".to_string().into());
    }

    if all {
        // Reload all running proxies
        let mut reloaded = 0;
        let mut errors = Vec::new();

        for handle in &handles {
            if handle.running {
                match runtime.service.reload_config(&handle.id).await {
                    Ok(()) => {
                        reloaded += 1;
                        if output_format != "json" {
                            println!("Reloaded proxy {} (port {})", handle.id, handle.port);
                        }
                    }
                    Err(e) => {
                        errors.push((handle.id.clone(), e.to_string()));
                        if output_format != "json" {
                            eprintln!("Failed to reload proxy {}: {}", handle.id, e);
                        }
                    }
                }
            }
        }

        if output_format == "json" {
            let output = json!({
                "version": "1.0",
                "data": {
                    "reloaded": reloaded,
                    "total": handles.len(),
                    "errors": errors.iter().map(|(id, msg)| json!({
                        "handle_id": id,
                        "error": msg
                    })).collect::<Vec<_>>()
                }
            });
            println!("{}", serde_json::to_string_pretty(&output)?);
        } else {
            println!("Reloaded {reloaded} of {} proxy/proxies", handles.len());
            if !errors.is_empty() {
                eprintln!("Errors occurred during reload:");
                for (id, msg) in &errors {
                    eprintln!("  {}: {}", id, msg);
                }
            }
        }

        Ok(())
    } else {
        // Reload specific proxy
        let selector = if let Some(p) = port {
            StopSelector::Port(p)
        } else if let Some(id) = handle_id {
            StopSelector::HandleId(id)
        } else {
            return Err("Either --port or --handle-id must be specified, or use --all to reload all proxies".to_string().into());
        };

        let handle = selector
            .find_handle(&handles)
            .ok_or_else(|| selector.missing_error())?;

        if !handle.running {
            return Err(format!("Proxy {} is not running", handle.id).into());
        }

        match runtime.service.reload_config(&handle.id).await {
            Ok(()) => {
                if output_format == "json" {
                    let output = json!({
                        "version": "1.0",
                        "data": {
                            "handle_id": handle.id,
                            "status": "reloaded"
                        }
                    });
                    println!("{}", serde_json::to_string_pretty(&output)?);
                } else {
                    println!(
                        "Configuration reloaded for proxy {} (port {})",
                        handle.id, handle.port
                    );
                }
                Ok(())
            }
            Err(e) => Err(format!("Failed to reload proxy: {}", e).into()),
        }
    }
}
