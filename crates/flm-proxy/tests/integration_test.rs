//! Integration tests for flm-proxy

use flm_core::domain::proxy::{ProxyConfig, ProxyMode};
use flm_core::ports::ProxyController;
use flm_proxy::AxumProxyController;
use std::time::Duration;
use tokio::time::sleep;

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_start_and_stop() {
    let controller = AxumProxyController::new();

    // Start proxy
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18080, // Use a high port to avoid conflicts
        trusted_proxy_ips: Vec::new(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: None,
        acme_dns_profile_id: None,
        config_db_path: None,
        security_db_path: None,
    };

    let handle = controller.start(config.clone()).await.unwrap();
    assert_eq!(handle.port, 18080);
    assert!(handle.running);

    // Give the server a moment to start
    sleep(Duration::from_millis(500)).await;

    // Stop proxy
    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_health_endpoint() {
    let controller = AxumProxyController::new();

    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18081,
        trusted_proxy_ips: Vec::new(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: None,
        acme_dns_profile_id: None,
        config_db_path: None,
        security_db_path: None,
    };

    let handle = controller.start(config).await.unwrap();

    // Give the server a moment to start
    sleep(Duration::from_millis(500)).await;

    // Test health endpoint
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18081/health")
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.unwrap();
    assert_eq!(body["status"], "ok");

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_cors_headers() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

    // Create security service with policy that has CORS
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Set a policy with CORS headers
    let policy_json = serde_json::json!({
        "cors": {
            "allowed_origins": ["http://localhost:3000"],
            "allowed_methods": ["GET", "POST"],
            "allowed_headers": ["Authorization", "Content-Type"]
        }
    });

    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    security_service.set_policy(policy).await.unwrap();

    // Note: This is a basic test structure. Full integration test would require
    // setting up the full proxy server with the security service.
    // For now, we verify the policy can be set and retrieved.
    let retrieved = security_service.get_policy("default").await.unwrap();
    assert!(retrieved.is_some());
    let policy_json_retrieved: serde_json::Value =
        serde_json::from_str(&retrieved.unwrap().policy_json).unwrap();
    assert_eq!(
        policy_json_retrieved["cors"]["allowed_origins"][0],
        "http://localhost:3000"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_whitelist_allowed() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-ip-whitelist-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with IP whitelist
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1", "::1"]
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
        port: 18082,
        trusted_proxy_ips: Vec::new(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: None,
        acme_dns_profile_id: None,
        config_db_path: None,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test request from localhost (should be allowed)
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18082/v1/models")
        .header("Authorization", format!("Bearer {}", api_key.plain))
        .send()
        .await
        .unwrap();

    // Should succeed (200 or 401 if no engines, but not 403)
    assert_ne!(response.status(), reqwest::StatusCode::FORBIDDEN);

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_whitelist_cidr() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-ip-whitelist-cidr-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with CIDR whitelist
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.0/8", "::1/128"]
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
        port: 18083,
        trusted_proxy_ips: Vec::new(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: None,
        acme_dns_profile_id: None,
        config_db_path: None,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test request from localhost (should be allowed via CIDR)
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18083/v1/models")
        .header("Authorization", format!("Bearer {}", api_key.plain))
        .send()
        .await
        .unwrap();

    // Should succeed (200 or 401 if no engines, but not 403)
    assert_ne!(response.status(), reqwest::StatusCode::FORBIDDEN);

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_rate_limit_basic() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-rate-limit-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with rate limit (low limit for testing)
    let policy_json = serde_json::json!({
        "rate_limit": {
            "rpm": 5,
            "burst": 5
        }
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
        port: 18084,
        trusted_proxy_ips: Vec::new(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: None,
        acme_dns_profile_id: None,
        config_db_path: None,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Make requests up to the limit
    // Use /v1/models endpoint which requires authentication
    let client = reqwest::Client::new();
    for i in 0..5 {
        let response = client
            .get("http://localhost:18084/v1/models")
            .header("Authorization", format!("Bearer {}", api_key.plain))
            .send()
            .await
            .unwrap();

        // First 5 requests should succeed (200 OK or 404 if no engines, but not 429)
        let status = response.status();
        assert_ne!(
            status,
            reqwest::StatusCode::TOO_MANY_REQUESTS,
            "Request {} should not be rate limited, got status: {:?}",
            i,
            status
        );
        
        // Check rate limit headers
        if let Some(remaining) = response.headers().get("x-ratelimit-remaining") {
            let remaining_str = remaining.to_str().unwrap();
            eprintln!("Request {}: X-RateLimit-Remaining = {}", i, remaining_str);
        }
    }

    // Next request should be rate limited
    let response = client
        .get("http://localhost:18084/v1/models")
        .header("Authorization", format!("Bearer {}", api_key.plain))
        .send()
        .await
        .unwrap();

    let status = response.status();
    eprintln!("6th request status: {:?}", status);
    assert_eq!(
        status,
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        "6th request should be rate limited, got status: {:?}",
        status
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_rate_limit_multiple_keys() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-rate-limit-multi-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create two API keys
    let api_key1 = security_service.create_api_key("test-key-1").await.unwrap();
    let api_key2 = security_service.create_api_key("test-key-2").await.unwrap();

    // Set policy with rate limit
    let policy_json = serde_json::json!({
        "rate_limit": {
            "rpm": 3,
            "burst": 3
        }
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
        port: 18085,
        trusted_proxy_ips: Vec::new(),
        acme_email: None,
        acme_domain: None,
        acme_challenge: None,
        acme_dns_profile_id: None,
        config_db_path: None,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Exhaust rate limit for key1
    // Use /v1/models endpoint which requires authentication
    let client = reqwest::Client::new();
    for _ in 0..3 {
        let response = client
            .get("http://localhost:18085/v1/models")
            .header("Authorization", format!("Bearer {}", api_key1.plain))
            .send()
            .await
            .unwrap();
        assert_ne!(response.status(), reqwest::StatusCode::TOO_MANY_REQUESTS);
    }

    // Key1 should be rate limited
    let response = client
        .get("http://localhost:18085/v1/models")
        .header("Authorization", format!("Bearer {}", api_key1.plain))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::TOO_MANY_REQUESTS);

    // Key2 should still work (separate rate limit)
    let response = client
        .get("http://localhost:18085/v1/models")
        .header("Authorization", format!("Bearer {}", api_key2.plain))
        .send()
        .await
        .unwrap();
    assert_ne!(response.status(), reqwest::StatusCode::TOO_MANY_REQUESTS);

    controller.stop(handle).await.unwrap();
}
