//! IP Blocklist persistence tests
//!
//! Tests for IP blocklist database persistence, loading on startup, and periodic sync.

use flm_core::domain::proxy::{ProxyConfig, ProxyMode};
use flm_core::domain::security::SecurityPolicy;
use flm_core::ports::ProxyController;
use flm_core::services::SecurityService;
use flm_proxy::adapters::SqliteSecurityRepository;
use flm_proxy::AxumProxyController;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

fn unique_db_path(tag: &str) -> std::path::PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock drifted before UNIX_EPOCH")
        .as_nanos();
    std::env::temp_dir().join(format!("{tag}-{nanos}.db"))
}

fn bearer_header(token: &str) -> String {
    format!("Bearer {token}")
}

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_blocklist_persistence_on_restart() {
    let security_db = unique_db_path("flm-test-blocklist-persistence");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo.clone()));

    let api_key = security_service.create_api_key("test-key").await.unwrap();

    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"]
    });

    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    security_service.set_policy(policy).await.unwrap();

    // Start proxy
    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18130,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        trusted_proxy_ips: vec!["127.0.0.1".to_string()],
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let test_ip = "192.168.1.300";

    // Make multiple failed authentication attempts to block the IP
    for i in 0..6 {
        let response = client
            .get("http://localhost:18130/v1/models")
            .header("Authorization", "Bearer invalid-key")
            .header("X-Forwarded-For", test_ip)
            .send()
            .await
            .unwrap();

        if i < 5 {
            assert_eq!(response.status(), reqwest::StatusCode::UNAUTHORIZED);
        } else {
            // After 5 failures, IP should be blocked
            assert_eq!(response.status(), reqwest::StatusCode::FORBIDDEN);
        }
    }

    // Verify IP is blocked
    let response = client
        .get("http://localhost:18130/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", test_ip)
        .send()
        .await
        .unwrap();
    assert_eq!(
        response.status(),
        reqwest::StatusCode::FORBIDDEN,
        "IP should be blocked before restart"
    );

    // Wait for database sync (IP blocklist syncs every 5 minutes, but we can wait a bit)
    // Note: In production, sync happens every 5 minutes, but for testing we wait a bit
    sleep(Duration::from_secs(2)).await;

    // Stop proxy
    controller.stop(handle).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Restart proxy - blocked IP should be loaded from database
    let controller2 = AxumProxyController::new();
    let config2 = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18130,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        trusted_proxy_ips: vec!["127.0.0.1".to_string()],
        ..Default::default()
    };

    let handle2 = controller2.start(config2).await.unwrap();
    sleep(Duration::from_secs(2)).await; // Wait for database load (async operation)

    // Verify IP is still blocked after restart
    // Note: Database load is async, so we may need to retry
    let mut retries = 0;
    let mut blocked = false;
    while retries < 5 {
        let response = client
            .get("http://localhost:18130/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .header("X-Forwarded-For", test_ip)
            .send()
            .await
            .unwrap();
        
        if response.status() == reqwest::StatusCode::FORBIDDEN {
            blocked = true;
            break;
        }
        
        retries += 1;
        sleep(Duration::from_millis(500)).await;
    }
    
    assert!(
        blocked,
        "IP should still be blocked after restart (loaded from database)"
    );

    controller2.stop(handle2).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_blocklist_multiple_ips_persistence() {
    let security_db = unique_db_path("flm-test-blocklist-multiple");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo.clone()));

    let api_key = security_service.create_api_key("test-key").await.unwrap();

    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"]
    });

    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    security_service.set_policy(policy).await.unwrap();

    // Start proxy
    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18131,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        trusted_proxy_ips: vec!["127.0.0.1".to_string()],
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let test_ips = vec!["192.168.1.301", "192.168.1.302", "192.168.1.303"];

    // Block multiple IPs
    // Note: IP blocklist blocks after 5 failures (0-4 are failures, 5th triggers block)
    for test_ip in &test_ips {
        for i in 0..6 {
            let response = client
                .get("http://localhost:18131/v1/models")
                .header("Authorization", "Bearer invalid-key")
                .header("X-Forwarded-For", *test_ip)
                .send()
                .await
                .unwrap();

            if i < 5 {
                // First 5 requests should be UNAUTHORIZED (failures recorded)
                assert_eq!(
                    response.status(),
                    reqwest::StatusCode::UNAUTHORIZED,
                    "IP {} request {} should be UNAUTHORIZED (failure recorded)",
                    test_ip,
                    i
                );
            } else {
                // 6th request (after 5 failures) should be FORBIDDEN (IP blocked)
                assert_eq!(
                    response.status(),
                    reqwest::StatusCode::FORBIDDEN,
                    "IP {} request {} should be FORBIDDEN (IP blocked after 5 failures)",
                    test_ip,
                    i
                );
            }
        }
    }

    // Wait for database sync
    sleep(Duration::from_secs(2)).await;

    // Stop proxy
    controller.stop(handle).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Restart proxy
    let controller2 = AxumProxyController::new();
    let config2 = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18131,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        trusted_proxy_ips: vec!["127.0.0.1".to_string()],
        ..Default::default()
    };

    let handle2 = controller2.start(config2).await.unwrap();
    sleep(Duration::from_secs(2)).await; // Wait for database load (async operation)

    // Verify all IPs are still blocked after restart
    // Note: Database load is async, so we may need to retry
    for test_ip in &test_ips {
        let mut retries = 0;
        let mut blocked = false;
        while retries < 5 {
            let response = client
                .get("http://localhost:18131/v1/models")
                .header("Authorization", bearer_header(&api_key.plain))
                .header("X-Forwarded-For", *test_ip)
                .send()
                .await
                .unwrap();
            
            if response.status() == reqwest::StatusCode::FORBIDDEN {
                blocked = true;
                break;
            }
            
            retries += 1;
            sleep(Duration::from_millis(500)).await;
        }
        
        assert!(
            blocked,
            "IP {} should still be blocked after restart",
            test_ip
        );
    }

    controller2.stop(handle2).await.unwrap();
}

