//! End-to-end tests for flm-cli

use flm_core::domain::proxy::{ProxyConfig, ProxyMode};
use flm_core::ports::ProxyController;
use flm_proxy::AxumProxyController;
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
async fn test_proxy_start_stop_flow() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-e2e-proxy-flow");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy
    let policy_json = serde_json::json!({});
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
        port: 18100,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config.clone()).await.unwrap();
    assert!(handle.running);
    assert_eq!(handle.port, 18100);

    // Give the server a moment to start
    sleep(Duration::from_millis(500)).await;

    // Verify proxy is running by checking health endpoint
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18100/health")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::OK);

    // Verify /v1/models endpoint works
    let response = client
        .get("http://localhost:18100/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::OK);

    // Stop proxy
    controller.stop(handle).await.unwrap();

    // Verify proxy is stopped (health endpoint should fail)
    let response = client.get("http://localhost:18100/health").send().await;
    assert!(response.is_err() || response.unwrap().status() != reqwest::StatusCode::OK);
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_features_e2e() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-e2e-security");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with IP whitelist and rate limit
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"],
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
        port: 18101,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        trusted_proxy_ips: vec!["127.0.0.1".to_string()], // Allow X-Forwarded-For from localhost
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Test 1: Valid request from whitelisted IP
    let response = client
        .get("http://localhost:18101/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::OK);

    // Test 2: Request from non-whitelisted IP should be blocked
    let response = client
        .get("http://localhost:18101/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", "192.168.1.100")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::FORBIDDEN);

    // Test 3: Rate limiting
    // Send 5 requests (within limit: rpm=5, burst=5)
    // Note: Rate limit uses both minute_count (RPM) and token bucket (burst)
    // Both limits must be respected: (minute_count + 1) > rpm OR tokens_available < 1.0
    for i in 0..5 {
        let response = client
            .get("http://localhost:18101/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();
        assert_ne!(
            response.status(),
            reqwest::StatusCode::TOO_MANY_REQUESTS,
            "Request {} should not be rate limited (within limit)",
            i + 1
        );
        // Small delay to ensure rate limit state is updated
        // Rate limit uses token bucket with 1-minute window, so we need to ensure
        // state is properly synchronized between requests
        sleep(Duration::from_millis(100)).await;
    }

    // Additional delay to ensure rate limit state is fully persisted and synchronized
    // The rate limit check happens synchronously in memory, but we want to ensure
    // the state is consistent before the next request
    sleep(Duration::from_millis(200)).await;

    // 6th request should be rate limited (exceeds rpm=5)
    // With rpm=5 and burst=5, the 6th request should exceed the limit
    let response = client
        .get("http://localhost:18101/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();
    assert_eq!(
        response.status(),
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        "6th request should be rate limited (rpm=5, burst=5 allows only 5 requests)"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_engine_detection_to_model_list_flow() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-e2e-engine-flow");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy
    let policy_json = serde_json::json!({});
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
        port: 18102,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test /v1/models endpoint (engine detection happens automatically)
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18102/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    // Should return 200 OK with models list (even if empty)
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.unwrap();
    assert_eq!(body["object"], "list");
    assert!(body["data"].is_array());

    controller.stop(handle).await.unwrap();
}
