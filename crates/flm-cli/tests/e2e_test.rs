//! End-to-end tests for CLI commands
//!
//! These tests verify complete workflows across multiple commands.

use flm_cli::cli::{
    api_keys::ApiKeysSubcommand, config::ConfigSubcommand, engines::EnginesSubcommand,
    proxy::ProxySubcommand,
};
use flm_cli::commands;
use std::path::PathBuf;
use tempfile::TempDir;

fn create_temp_dbs() -> (TempDir, PathBuf, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");
    let security_db = temp_dir.path().join("security.db");
    (temp_dir, config_db, security_db)
}

#[tokio::test(flavor = "multi_thread")]
async fn test_full_workflow() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Step 1: Detect engines
    let engines_subcommand = flm_cli::cli::Commands::Engines {
        subcommand: EnginesSubcommand::Detect {
            engine: None,
            fresh: false,
        },
    };

    let engines_result = match engines_subcommand {
        flm_cli::cli::Commands::Engines { subcommand } => {
            commands::engines::execute(
                subcommand,
                Some(config_db.to_str().unwrap().to_string()),
                "json".to_string(),
            )
            .await
        }
        _ => unreachable!(),
    };

    // Should succeed even if no engines are detected
    assert!(engines_result.is_ok(), "Engine detection should succeed");

    // Step 2: Create API key
    let api_keys_subcommand = flm_cli::cli::Commands::ApiKeys {
        subcommand: ApiKeysSubcommand::Create {
            label: "test-key".to_string(),
        },
    };

    let api_keys_result = match api_keys_subcommand {
        flm_cli::cli::Commands::ApiKeys { subcommand } => {
            commands::api_keys::execute(
                subcommand,
                Some(security_db.to_str().unwrap().to_string()),
                "json".to_string(),
            )
            .await
        }
        _ => unreachable!(),
    };

    assert!(api_keys_result.is_ok(), "API key creation should succeed");

    // Step 3: Set configuration
    let config_subcommand = flm_cli::cli::Commands::Config {
        subcommand: ConfigSubcommand::Set {
            key: "test.setting".to_string(),
            value: "test_value".to_string(),
        },
    };

    let config_result = match config_subcommand {
        flm_cli::cli::Commands::Config { subcommand } => {
            commands::config::execute(
                subcommand,
                Some(config_db.to_str().unwrap().to_string()),
                "json".to_string(),
            )
            .await
        }
        _ => unreachable!(),
    };

    assert!(config_result.is_ok(), "Config set should succeed");

    // Step 4: Start proxy
    let proxy_start_subcommand = flm_cli::cli::Commands::Proxy {
        subcommand: ProxySubcommand::Start {
            port: 19090,
            mode: "local-http".to_string(),
            bind: "127.0.0.1".to_string(),
            acme_email: None,
            acme_domain: None,
            no_daemon: true,
        },
    };

    let proxy_start_result = match proxy_start_subcommand {
        flm_cli::cli::Commands::Proxy { subcommand } => {
            commands::proxy::execute(
                subcommand,
                Some(config_db.to_str().unwrap().to_string()),
                Some(security_db.to_str().unwrap().to_string()),
                "json".to_string(),
            )
            .await
        }
        _ => unreachable!(),
    };

    assert!(proxy_start_result.is_ok(), "Proxy start should succeed");

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Step 5: Check proxy status
    let proxy_status_subcommand = flm_cli::cli::Commands::Proxy {
        subcommand: ProxySubcommand::Status,
    };

    let proxy_status_result = match proxy_status_subcommand {
        flm_cli::cli::Commands::Proxy { subcommand } => {
            commands::proxy::execute(
                subcommand,
                Some(config_db.to_str().unwrap().to_string()),
                Some(security_db.to_str().unwrap().to_string()),
                "json".to_string(),
            )
            .await
        }
        _ => unreachable!(),
    };

    assert!(proxy_status_result.is_ok(), "Proxy status should succeed");

    // Step 6: Stop proxy
    let proxy_stop_subcommand = flm_cli::cli::Commands::Proxy {
        subcommand: ProxySubcommand::Stop {
            port: Some(19090),
            handle_id: None,
        },
    };

    let proxy_stop_result = match proxy_stop_subcommand {
        flm_cli::cli::Commands::Proxy { subcommand } => {
            commands::proxy::execute(
                subcommand,
                Some(config_db.to_str().unwrap().to_string()),
                Some(security_db.to_str().unwrap().to_string()),
                "json".to_string(),
            )
            .await
        }
        _ => unreachable!(),
    };

    assert!(proxy_stop_result.is_ok(), "Proxy stop should succeed");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_error_recovery() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Try to stop a non-existent proxy (should fail gracefully)
    let proxy_stop_subcommand = flm_cli::cli::Commands::Proxy {
        subcommand: ProxySubcommand::Stop {
            port: Some(19998),
            handle_id: None,
        },
    };

    let proxy_stop_result = match proxy_stop_subcommand {
        flm_cli::cli::Commands::Proxy { subcommand } => {
            commands::proxy::execute(
                subcommand,
                Some(config_db.to_str().unwrap().to_string()),
                Some(security_db.to_str().unwrap().to_string()),
                "json".to_string(),
            )
            .await
        }
        _ => unreachable!(),
    };

    // Should fail with appropriate error
    assert!(
        proxy_stop_result.is_err(),
        "Stopping non-existent proxy should fail"
    );
    let error_msg = proxy_stop_result.unwrap_err().to_string();
    assert!(
        error_msg.contains("No proxy running") || error_msg.contains("port"),
        "Error message should be informative. Got: {error_msg}"
    );

    // After error, other commands should still work
    let proxy_status_subcommand = flm_cli::cli::Commands::Proxy {
        subcommand: ProxySubcommand::Status,
    };

    let proxy_status_result = match proxy_status_subcommand {
        flm_cli::cli::Commands::Proxy { subcommand } => {
            commands::proxy::execute(
                subcommand,
                Some(config_db.to_str().unwrap().to_string()),
                Some(security_db.to_str().unwrap().to_string()),
                "json".to_string(),
            )
            .await
        }
        _ => unreachable!(),
    };

    // Status should still work after error
    assert!(
        proxy_status_result.is_ok(),
        "Proxy status should work after error"
    );
}
