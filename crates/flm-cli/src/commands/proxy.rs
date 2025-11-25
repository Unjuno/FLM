//! Proxy command implementation

use crate::adapters::{SqliteProxyRepository, SqliteSecurityRepository};
use crate::cli::proxy::ProxySubcommand;
use crate::utils::{get_config_db_path, get_security_db_path};
use flm_core::domain::proxy::{
    AcmeChallengeKind, ProxyConfig, ProxyEgressConfig, ProxyEgressMode, ProxyHandle, ProxyMode,
};
use flm_core::services::ProxyService;
use flm_proxy::AxumProxyController;
use local_ip_address::local_ip;
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

/// Execute proxy command
pub async fn execute(
    subcommand: ProxySubcommand,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
    format: String,
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
            no_daemon: _,
        } => {
            execute_start(
                port,
                mode,
                egress_mode,
                socks5_endpoint,
                egress_fail_open,
                bind,
                acme_email,
                acme_domain,
                db_path_config,
                db_path_security,
            )
            .await
        }
        ProxySubcommand::Stop { port, handle_id } => {
            execute_stop(port, handle_id, db_path_config, db_path_security).await
        }
        ProxySubcommand::Status => execute_status(db_path_config, db_path_security, format).await,
    }
}

/// Execute proxy start command
async fn execute_start(
    port: u16,
    mode_str: String,
    egress_mode_str: String,
    socks5_endpoint: Option<String>,
    egress_fail_open: bool,
    bind: String,
    acme_email: Option<String>,
    acme_domain: Option<String>,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
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

    // Parse mode
    let mode = match mode_str.as_str() {
        "local-http" => ProxyMode::LocalHttp,
        "dev-selfsigned" => ProxyMode::DevSelfSigned,
        "https-acme" => ProxyMode::HttpsAcme,
        "packaged-ca" => ProxyMode::PackagedCa,
        _ => {
            return Err(format!("Invalid mode: '{mode_str}'. Valid modes: local-http, dev-selfsigned, https-acme, packaged-ca").into());
        }
    };

    // Create configuration
    let config = ProxyConfig {
        mode: mode.clone(),
        egress: parse_egress_config(egress_mode_str, socks5_endpoint, egress_fail_open)?,
        port,
        listen_addr: bind,
        trusted_proxy_ips: Vec::new(), // Empty by default - X-Forwarded-For headers ignored
        acme_email: acme_email.clone(),
        acme_domain: acme_domain.clone(),
        acme_challenge: if mode == ProxyMode::HttpsAcme {
            Some(AcmeChallengeKind::Http01)
        } else {
            None
        },
        acme_dns_profile_id: None,
        config_db_path: Some(config_db_path.to_str().unwrap().to_string()),
        security_db_path: Some(security_db_path.to_str().unwrap().to_string()),
    };

    // Initialize repositories
    let proxy_repo = SqliteProxyRepository::new(&config_db_path).await?;
    let _security_repo = SqliteSecurityRepository::new(&security_db_path).await?;

    // Create controller and service
    let controller = Arc::new(AxumProxyController::new());
    let repository = Arc::new(proxy_repo);
    let service = ProxyService::new(controller, repository);

    // Start proxy
    let listen_addr = config.listen_addr.clone();
    let handle = service.start(config).await?;

    // Output result in JSON format (CLI_SPEC.md format)
    let endpoints = build_endpoint_map(&handle);

    let output = json!({
        "version": "1.0",
        "data": {
            "status": "running",
            "mode": mode_str,
            "listen_addr": listen_addr,
            "endpoints": endpoints,
            "pid": handle.pid,
            "id": handle.id,
            "port": handle.port,
            "https_port": handle.https_port,
            "acme_domain": handle.acme_domain,
            "egress": handle.egress
        }
    });

    println!("{}", serde_json::to_string_pretty(&output)?);

    Ok(())
}

fn build_endpoint_map(handle: &ProxyHandle) -> serde_json::Value {
    let (scheme, primary_port) = if let Some(https_port) = handle.https_port {
        ("https", https_port)
    } else {
        ("http", handle.port)
    };

    let mut endpoints = serde_json::Map::new();
    endpoints.insert(
        "localhost".to_string(),
        serde_json::Value::String(format!("{scheme}://localhost:{primary_port}")),
    );

    if let Ok(ip) = local_ip() {
        endpoints.insert(
            "local_network".to_string(),
            serde_json::Value::String(format!("{scheme}://{ip}:{primary_port}")),
        );
    }

    if let Some(domain) = &handle.acme_domain {
        let https_port = handle.https_port.unwrap_or(handle.port);
        endpoints.insert(
            "external".to_string(),
            serde_json::Value::String(format!("https://{domain}:{https_port}")),
        );
    }

    serde_json::Value::Object(endpoints)
}

fn parse_egress_config(
    mode: String,
    socks5_endpoint: Option<String>,
    fail_open: bool,
) -> Result<ProxyEgressConfig, Box<dyn std::error::Error>> {
    match mode.as_str() {
        "direct" => Ok(ProxyEgressConfig::direct()),
        "tor" => Ok(ProxyEgressConfig {
            mode: ProxyEgressMode::Tor,
            socks5_endpoint,
            fail_open,
        }),
        "socks5" => {
            if socks5_endpoint.is_none() {
                return Err("socks5 endpoint is required when --egress-mode socks5".into());
            }
            Ok(ProxyEgressConfig {
                mode: ProxyEgressMode::CustomSocks5,
                socks5_endpoint,
                fail_open,
            })
        }
        _ => Err(format!(
            "Invalid egress mode: '{mode}'. Valid modes: direct, tor, socks5"
        )
        .into()),
    }
}

/// Execute proxy stop command
async fn execute_stop(
    port: Option<u16>,
    handle_id: Option<String>,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let config_db_path = db_path_config
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);
    let _security_db_path = db_path_security
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Initialize repositories
    let proxy_repo = SqliteProxyRepository::new(&config_db_path).await?;

    // Create controller and service
    let controller = Arc::new(AxumProxyController::new());
    let repository = Arc::new(proxy_repo);
    let service = ProxyService::new(controller, repository);

    // Get handle to stop
    let handle = if let Some(port) = port {
        // Find handle by port
        let handles = service.status().await?;
        handles
            .into_iter()
            .find(|h| h.port == port)
            .ok_or_else(|| format!("No proxy running on port {port}. Use 'flm proxy status' to see running proxies"))?
    } else if let Some(id) = handle_id {
        // Find handle by ID
        let handles = service.status().await?;
        handles.into_iter().find(|h| h.id == id).ok_or_else(|| {
            format!("No proxy with ID '{id}'. Use 'flm proxy status' to see running proxies")
        })?
    } else {
        return Err("Either --port or --handle-id must be specified to stop a proxy".into());
    };

    // Stop proxy
    service.stop(handle.clone()).await?;

    println!("Proxy stopped: {}", handle.id);

    Ok(())
}

/// Execute proxy status command
async fn execute_status(
    db_path_config: Option<String>,
    db_path_security: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let config_db_path = db_path_config
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);
    let _security_db_path = db_path_security
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Initialize repositories
    let proxy_repo = SqliteProxyRepository::new(&config_db_path).await?;

    // Create controller and service
    let controller = Arc::new(AxumProxyController::new());
    let repository = Arc::new(proxy_repo);
    let service = ProxyService::new(controller, repository);

    // Get status
    let handles = service.status().await?;

    if format == "json" {
        let output = serde_json::json!({
            "version": "1.0",
            "data": handles
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        // Text format
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
    }

    Ok(())
}
