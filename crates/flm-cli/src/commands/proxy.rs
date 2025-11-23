//! Proxy command implementation

use crate::adapters::{SqliteProxyRepository, SqliteSecurityRepository};
use crate::cli::proxy::ProxySubcommand;
use crate::utils::{get_config_db_path, get_security_db_path};
use flm_core::domain::proxy::{AcmeChallengeKind, ProxyConfig, ProxyMode};
use flm_core::services::ProxyService;
use flm_proxy::AxumProxyController;
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
            bind,
            acme_email,
            acme_domain,
            no_daemon: _,
        } => {
            execute_start(
                port,
                mode,
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

    // Parse mode
    let mode = match mode_str.as_str() {
        "local-http" => ProxyMode::LocalHttp,
        "dev-selfsigned" => ProxyMode::DevSelfSigned,
        "https-acme" => ProxyMode::HttpsAcme,
        "packaged-ca" => ProxyMode::PackagedCa,
        _ => {
            return Err(format!("Invalid mode: {mode_str}. Valid modes: local-http, dev-selfsigned, https-acme, packaged-ca").into());
        }
    };

    // Create configuration
    let config = ProxyConfig {
        mode: mode.clone(),
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
    let output = serde_json::json!({
        "version": "1.0",
        "data": {
            "status": "running",
            "mode": mode_str,
            "endpoint": format!("http://{}:{}", listen_addr, port),
            "pid": handle.pid,
            "id": handle.id,
            "port": handle.port,
            "listen_addr": handle.listen_addr
        }
    });

    println!("{}", serde_json::to_string_pretty(&output)?);

    Ok(())
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
            .ok_or_else(|| format!("No proxy running on port {port}"))?
    } else if let Some(id) = handle_id {
        // Find handle by ID
        let handles = service.status().await?;
        handles
            .into_iter()
            .find(|h| h.id == id)
            .ok_or_else(|| format!("No proxy with ID {id}"))?
    } else {
        return Err("Either --port or --handle-id must be specified".into());
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
                println!();
            }
        }
    }

    Ok(())
}
