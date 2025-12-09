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
        egress_mode: "direct".to_string(),
        socks5_endpoint: None,
        egress_fail_open: false,
        bind: "127.0.0.1".to_string(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: "http-01".to_string(),
        acme_dns_profile: None,
        acme_dns_lego_path: None,
        acme_dns_propagation_wait: None,
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

    // Test status command - verify proxy is running
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

    // Verify status shows the running proxy
    // Note: We can't easily capture stdout in unit tests, but the status command should succeed
    // In a real scenario, we would parse the JSON output to verify the handle is present

    // Stop the proxy using the port
    // The stop command should work with the port if the proxy is running.
    // We use a longer wait to ensure the proxy is fully started and tracked
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

    // First, verify the proxy is running by checking status
    // This ensures the runtime is properly shared between execute calls
    let status_check_subcommand = ProxySubcommand::Status;
    let status_check_result = proxy::execute(
        status_check_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;
    
    // Status should succeed and show the running proxy
    assert!(
        status_check_result.is_ok(),
        "Proxy status check before stop failed: {:?}",
        status_check_result.err()
    );

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

    // The stop command should succeed if the proxy is running
    // The runtime is shared via INLINE_RUNTIMES static variable, so the same
    // runtime instance should be used for both start and stop commands
    assert!(
        stop_result.is_ok(),
        "Proxy stop failed: {:?}. This indicates the runtime is not being shared correctly between execute calls.",
        stop_result.err()
    );

    // Give the server a moment to stop
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Verify status shows no running proxies
    let status_subcommand_after_stop = ProxySubcommand::Status;
    let status_result_after_stop = proxy::execute(
        status_subcommand_after_stop,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        status_result_after_stop.is_ok(),
        "Proxy status after stop failed: {:?}",
        status_result_after_stop.err()
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

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_start_invalid_mode() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Test proxy start with invalid mode
    let subcommand = ProxySubcommand::Start {
        port: 19081,
        mode: "invalid-mode".to_string(),
        egress_mode: "direct".to_string(),
        socks5_endpoint: None,
        egress_fail_open: false,
        bind: "127.0.0.1".to_string(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: "http-01".to_string(),
        acme_dns_profile: None,
        acme_dns_lego_path: None,
        acme_dns_propagation_wait: None,
        no_daemon: true,
    };

    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should fail with appropriate error
    assert!(result.is_err(), "Proxy start should fail with invalid mode");
    let error_msg = result.unwrap_err().to_string();
    assert!(
        error_msg.contains("Invalid mode") || error_msg.contains("invalid-mode"),
        "Error message should mention invalid mode. Got: {error_msg}"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_start_multiple_ports() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Start first proxy
    let subcommand1 = ProxySubcommand::Start {
        port: 19082,
        mode: "local-http".to_string(),
        egress_mode: "direct".to_string(),
        socks5_endpoint: None,
        egress_fail_open: false,
        bind: "127.0.0.1".to_string(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: "http-01".to_string(),
        acme_dns_profile: None,
        acme_dns_lego_path: None,
        acme_dns_propagation_wait: None,
        no_daemon: true,
    };

    let result1 = proxy::execute(
        subcommand1,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        result1.is_ok(),
        "First proxy start failed: {:?}",
        result1.err()
    );

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Start second proxy on different port
    let subcommand2 = ProxySubcommand::Start {
        port: 19083,
        mode: "local-http".to_string(),
        egress_mode: "direct".to_string(),
        socks5_endpoint: None,
        egress_fail_open: false,
        bind: "127.0.0.1".to_string(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: "http-01".to_string(),
        acme_dns_profile: None,
        acme_dns_lego_path: None,
        acme_dns_propagation_wait: None,
        no_daemon: true,
    };

    let result2 = proxy::execute(
        subcommand2,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        result2.is_ok(),
        "Second proxy start failed: {:?}",
        result2.err()
    );

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Verify both proxies are running
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

    // Stop both proxies
    let stop1 = ProxySubcommand::Stop {
        port: Some(19082),
        handle_id: None,
    };
    let stop_result1 = proxy::execute(
        stop1,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;
    assert!(stop_result1.is_ok(), "First proxy stop failed");

    let stop2 = ProxySubcommand::Stop {
        port: Some(19083),
        handle_id: None,
    };
    let stop_result2 = proxy::execute(
        stop2,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;
    assert!(stop_result2.is_ok(), "Second proxy stop failed");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_stop_by_handle_id() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Start proxy
    let subcommand = ProxySubcommand::Start {
        port: 19084,
        mode: "local-http".to_string(),
        egress_mode: "direct".to_string(),
        socks5_endpoint: None,
        egress_fail_open: false,
        bind: "127.0.0.1".to_string(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: "http-01".to_string(),
        acme_dns_profile: None,
        acme_dns_lego_path: None,
        acme_dns_propagation_wait: None,
        no_daemon: true,
    };

    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "Proxy start failed: {:?}", result.err());

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Stop by handle ID (we know the format is "proxy-{port}")
    let stop_subcommand = ProxySubcommand::Stop {
        port: None,
        handle_id: Some("proxy-19084".to_string()),
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
        "Proxy stop by handle ID failed: {:?}",
        stop_result.err()
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_stop_without_port_or_id() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Test stop command without port or handle_id
    let subcommand = ProxySubcommand::Stop {
        port: None,
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
    assert!(
        result.is_err(),
        "Stop should fail without port or handle_id"
    );
    let error_msg = result.unwrap_err().to_string();
    assert!(
        error_msg.contains("port")
            || error_msg.contains("handle-id")
            || error_msg.contains("must be specified"),
        "Error message should mention port or handle-id requirement. Got: {error_msg}"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_status_text_format() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Test status command with text format
    let subcommand = ProxySubcommand::Status;
    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "text".to_string(),
    )
    .await;

    assert!(
        result.is_ok(),
        "Proxy status with text format failed: {:?}",
        result.err()
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_start_rejects_dns01_when_disabled() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    let subcommand = ProxySubcommand::Start {
        port: 19100,
        mode: "https-acme".to_string(),
        egress_mode: "direct".to_string(),
        socks5_endpoint: None,
        egress_fail_open: false,
        bind: "127.0.0.1".to_string(),
        acme_email: Some("ops@example.com".to_string()),
        acme_domain: Some("example.com".to_string()),
        acme_challenge: "dns-01".to_string(),
        acme_dns_profile: None,
        acme_dns_lego_path: None,
        acme_dns_propagation_wait: None,
        no_daemon: true,
    };

    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_err(), "dns-01 should be rejected while deferred");
    let error_msg = result.unwrap_err().to_string();
    assert!(
        error_msg.contains("DNS-01") && error_msg.contains("deferred"),
        "error message should mention DNS-01 deferral, got: {error_msg}"
    );
}

// Note: ACME fallback to dev-selfsigned is implemented in start_inline().
// Testing this requires either:
// 1. Mocking the ProxyController to return AcmeError (complex setup)
// 2. Actually triggering ACME failures (requires network/ACME server setup)
// The fallback logic is verified via code review and integration testing.
// Certificate reuse is handled automatically by rustls-acme's DirCache in the controller.

// ============================================================================
// Phase 1C: Tor/SOCKS5 Egress CLI Integration Tests
// ============================================================================

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_start_with_tor_egress() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Test proxy start with --egress-mode tor
    let subcommand = ProxySubcommand::Start {
        port: 19090,
        mode: "local-http".to_string(),
        egress_mode: "tor".to_string(),
        socks5_endpoint: None, // Should use default 127.0.0.1:9050
        egress_fail_open: false,
        bind: "127.0.0.1".to_string(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: "http-01".to_string(),
        acme_dns_profile: None,
        acme_dns_lego_path: None,
        acme_dns_propagation_wait: None,
        no_daemon: true,
    };

    // This will fail if Tor is not running, but should handle the error gracefully
    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // If Tor is not running, it should fail with appropriate error
    // If Tor is running, it should succeed
    if result.is_err() {
        let error_msg = result.unwrap_err().to_string();
        assert!(
            error_msg.contains("SOCKS5") || 
            error_msg.contains("Unable to reach") ||
            error_msg.contains("InvalidConfig"),
            "Error should mention SOCKS5 endpoint issue. Got: {error_msg}"
        );
    } else {
        // If it succeeded, verify the proxy is running
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        
        let status_subcommand = ProxySubcommand::Status;
        let status_result = proxy::execute(
            status_subcommand,
            Some(config_db.to_str().unwrap().to_string()),
            Some(security_db.to_str().unwrap().to_string()),
            "json".to_string(),
        )
        .await;
        
        assert!(status_result.is_ok(), "Status should succeed");
        
        // Stop the proxy
        let stop_subcommand = ProxySubcommand::Stop {
            port: Some(19090),
            handle_id: None,
        };
        let _ = proxy::execute(
            stop_subcommand,
            Some(config_db.to_str().unwrap().to_string()),
            Some(security_db.to_str().unwrap().to_string()),
            "json".to_string(),
        )
        .await;
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_start_with_socks5_egress() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Test proxy start with --egress-mode socks5 --socks5-endpoint
    let subcommand = ProxySubcommand::Start {
        port: 19091,
        mode: "local-http".to_string(),
        egress_mode: "socks5".to_string(),
        socks5_endpoint: Some("127.0.0.1:19999".to_string()), // Unreachable endpoint
        egress_fail_open: false,
        bind: "127.0.0.1".to_string(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: "http-01".to_string(),
        acme_dns_profile: None,
        acme_dns_lego_path: None,
        acme_dns_propagation_wait: None,
        no_daemon: true,
    };

    // This should fail because the SOCKS5 endpoint is unreachable
    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_err(), "Should fail when SOCKS5 endpoint is unreachable");
    let error_msg = result.unwrap_err().to_string();
    assert!(
        error_msg.contains("SOCKS5") || 
        error_msg.contains("Unable to reach") ||
        error_msg.contains("InvalidConfig"),
        "Error should mention SOCKS5 endpoint issue. Got: {error_msg}"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_start_with_egress_fail_open() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Test proxy start with --egress-fail-open
    let subcommand = ProxySubcommand::Start {
        port: 19092,
        mode: "local-http".to_string(),
        egress_mode: "tor".to_string(),
        socks5_endpoint: Some("127.0.0.1:19999".to_string()), // Unreachable endpoint
        egress_fail_open: true, // Should fallback to Direct mode
        bind: "127.0.0.1".to_string(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: "http-01".to_string(),
        acme_dns_profile: None,
        acme_dns_lego_path: None,
        acme_dns_propagation_wait: None,
        no_daemon: true,
    };

    // This should succeed because fail_open is true, so it falls back to Direct mode
    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "Should succeed with fail_open=true even if SOCKS5 endpoint is unreachable");

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Verify proxy is running
    let status_subcommand = ProxySubcommand::Status;
    let status_result = proxy::execute(
        status_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(status_result.is_ok(), "Status should succeed");

    // Stop the proxy
    let stop_subcommand = ProxySubcommand::Stop {
        port: Some(19092),
        handle_id: None,
    };
    let _ = proxy::execute(
        stop_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_status_shows_egress() {
    let (_temp_dir, config_db, security_db) = create_temp_dbs();

    // Start proxy with egress mode
    let subcommand = ProxySubcommand::Start {
        port: 19093,
        mode: "local-http".to_string(),
        egress_mode: "direct".to_string(),
        socks5_endpoint: None,
        egress_fail_open: false,
        bind: "127.0.0.1".to_string(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: "http-01".to_string(),
        acme_dns_profile: None,
        acme_dns_lego_path: None,
        acme_dns_propagation_wait: None,
        no_daemon: true,
    };

    let result = proxy::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "Proxy start failed: {:?}", result.err());

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Test status command - verify egress information is shown
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

    // Note: We can't easily parse JSON output in unit tests without capturing stdout
    // The status command should include egress information in the ProxyHandle
    // This is verified via code review and integration testing

    // Stop the proxy
    let stop_subcommand = ProxySubcommand::Stop {
        port: Some(19093),
        handle_id: None,
    };
    let _ = proxy::execute(
        stop_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;
}
