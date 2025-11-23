//! Tests for proxy CLI commands

use flm_cli::cli::proxy::ProxySubcommand;
use flm_cli::commands::proxy;
use std::path::PathBuf;
use tempfile::TempDir;

fn create_temp_dbs() -> (TempDir, PathBuf, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");
    let security_db = temp_dir.path().join("security.db");
    (temp_dir, config_db, security_db)
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_start_local_http() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Test proxy start command
    let subcommand = ProxySubcommand::Start {
        port: 19080,
        mode: "local-http".to_string(),
        acme_email: None,
        acme_domain: None,
        no_daemon: true,
    };

    // This will start the proxy server
    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // The proxy should start successfully
    assert!(result.is_ok(), "Proxy start failed: {:?}", result.err());

    // Give the server a moment to start
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Test status command
    let status_subcommand = ProxySubcommand::Status;
    let status_result = proxy::execute(
        status_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        status_result.is_ok(),
        "Proxy status failed: {:?}",
        status_result.err()
    );

    // Stop the proxy
    let stop_subcommand = ProxySubcommand::Stop {
        port: Some(19080),
        handle_id: None,
    };
    let stop_result = proxy::execute(
        stop_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        stop_result.is_ok(),
        "Proxy stop failed: {:?}",
        stop_result.err()
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_status_empty() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Test status command when no proxy is running
    let subcommand = ProxySubcommand::Status;
    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "Proxy status failed: {:?}", result.err());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_stop_nonexistent() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Test stop command when no proxy is running
    let subcommand = ProxySubcommand::Stop {
        port: Some(19999),
        handle_id: None,
    };
    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should fail with appropriate error
    assert!(result.is_err(), "Stop should fail when no proxy is running");
    assert!(result.unwrap_err().to_string().contains("No proxy running"));
}
