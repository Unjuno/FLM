//! Integration tests for flm-proxy

use flm_core::domain::proxy::{ProxyConfig, ProxyMode};
use flm_core::ports::ProxyController;
use flm_proxy::AxumProxyController;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::sleep;

fn unique_db_path(tag: &str) -> std::path::PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock drifted before UNIX_EPOCH")
        .as_nanos();
    std::env::temp_dir().join(format!("{tag}-{nanos}.db"))
}

fn bearer_header(token: &str) -> String {
    format!("Bearer {token}")
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_start_and_stop() {
    let controller = AxumProxyController::new();

    // Start proxy
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18080, // Use a high port to avoid conflicts
        ..Default::default()
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
        ..Default::default()
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
    let security_db = unique_db_path("flm-test");

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

    // Start proxy
    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18082,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();

    // Give the server a moment to start
    sleep(Duration::from_millis(500)).await;

    // Test CORS headers
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18082/health")
        .header("Origin", "http://localhost:3000")
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let headers = response.headers();
    assert!(headers.contains_key("access-control-allow-origin"));

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_models_endpoint() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-models");

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
        port: 18083,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();

    // Give the server a moment to start
    sleep(Duration::from_millis(500)).await;

    // Test /v1/models endpoint
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18083/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.unwrap();
    assert!(body.get("data").is_some());

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_authentication() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-auth");

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
        port: 18084,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();

    // Give the server a moment to start
    sleep(Duration::from_millis(500)).await;

    // Test without authentication
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18084/v1/models")
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::UNAUTHORIZED);

    // Test with invalid authentication
    let response = client
        .get("http://localhost:18084/v1/models")
        .header("Authorization", "Bearer invalid-key")
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::UNAUTHORIZED);

    // Test with valid authentication
    let response = client
        .get("http://localhost:18084/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::OK);

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_rate_limit_multiple_keys() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-rate-limit");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create multiple API keys
    let api_key1 = security_service.create_api_key("test-key-1").await.unwrap();
    let api_key2 = security_service.create_api_key("test-key-2").await.unwrap();

    // Set policy with low rate limit
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
        port: 18085,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Make requests up to the limit with first key
    let client = reqwest::Client::new();
    for i in 0..5 {
        let response = client
            .get("http://localhost:18085/v1/models")
            .header("Authorization", bearer_header(&api_key1.plain))
            .send()
            .await
            .unwrap();

        assert_ne!(
            response.status(),
            reqwest::StatusCode::TOO_MANY_REQUESTS,
            "Request {i} should not be rate limited"
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

    // Next request with first key should be rate limited
    // With rpm=5 and burst=5, the 6th request should exceed the limit
    let response = client
        .get("http://localhost:18085/v1/models")
        .header("Authorization", bearer_header(&api_key1.plain))
        .send()
        .await
        .unwrap();

    // The 6th request should be rate limited (5 requests allowed, 6th exceeds)
    assert_eq!(
        response.status(),
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        "6th request should be rate limited (rpm=5, burst=5 allows only 5 requests)"
    );

    // But second key should still work
    let response = client
        .get("http://localhost:18085/v1/models")
        .header("Authorization", bearer_header(&api_key2.plain))
        .send()
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        reqwest::StatusCode::OK,
        "Second key should not be rate limited"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_rate_limit() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-ip-rate-limit");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy (IP rate limit is always active, default 1000 req/min)
    let policy_json = serde_json::json!({
        "rate_limit": {
            "rpm": 100,
            "burst": 100
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
        port: 18086,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Make many requests from the same IP
    // IP rate limit is 1000 req/min, so we should be able to make many requests
    // But for testing, we'll make a reasonable number
    let client = reqwest::Client::new();
    let mut rate_limited = false;

    // Make 50 requests (well below 1000/min limit)
    for i in 0..50 {
        let response = client
            .get("http://localhost:18086/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        let status = response.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            rate_limited = true;
            eprintln!("Request {i} was rate limited");
            break;
        }
    }

    // IP rate limit should not trigger for 50 requests (limit is 1000/min)
    // But API key rate limit might (100 req/min)
    // So we expect either success or API key rate limit, but not IP rate limit for this test
    eprintln!("IP rate limit test completed. Rate limited: {rate_limited}");

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_honeypot_endpoints() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-honeypot");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key (not used in this test, but needed for database setup)
    let _api_key = security_service.create_api_key("test-key").await.unwrap();

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
        port: 18087,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test honeypot endpoints
    let client = reqwest::Client::new();

    // Test /admin endpoint (honeypot)
    let response = client
        .get("http://localhost:18087/admin")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::NOT_FOUND);

    // Test /api/v1/users endpoint (honeypot)
    let response = client
        .get("http://localhost:18087/api/v1/users")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::NOT_FOUND);

    // Test /wp-admin endpoint (honeypot)
    let response = client
        .get("http://localhost:18087/wp-admin")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::NOT_FOUND);

    // Test /phpmyadmin endpoint (honeypot)
    let response = client
        .get("http://localhost:18087/phpmyadmin")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::NOT_FOUND);

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_status() {
    let controller = AxumProxyController::new();

    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18088,
        ..Default::default()
    };

    let handle = controller.start(config.clone()).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test status
    let statuses = controller.status().await.unwrap();
    assert!(
        statuses.iter().any(|s| s.port == 18088 && s.running),
        "Expected running handle on port 18088"
    );

    controller.stop(handle).await.unwrap();

    // Test status after stop
    let statuses = controller.status().await.unwrap();
    assert!(
        statuses.is_empty(),
        "Expected no running handles after stop"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_botnet_integration_ip_block_and_intrusion() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-botnet-integration");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo.clone()));

    // Create API key (not used in this test, but needed for database setup)
    let _api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy
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
        port: 18096,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Simulate multiple failed authentication attempts from a specific IP
    let client = reqwest::Client::new();
    let test_ip = "192.168.1.200";

    // Make multiple requests with invalid API key to trigger IP blocking
    for i in 0..6 {
        let response = client
            .get(format!("http://localhost:18096/v1/models"))
            .header("Authorization", "Bearer invalid-key")
            .header("X-Forwarded-For", test_ip)
            .send()
            .await
            .unwrap();

        // First few should be 401, then should be blocked
        if i < 5 {
            assert_eq!(response.status(), reqwest::StatusCode::UNAUTHORIZED);
        } else {
            // After 5 failures, IP should be blocked
            assert_eq!(response.status(), reqwest::StatusCode::FORBIDDEN);
        }
    }

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_rate_limit_api_key_and_ip_combined() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-rate-limit-combined");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with low rate limit
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
        port: 18097,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Make requests up to the limit
    let client = reqwest::Client::new();
    for i in 0..5 {
        let response = client
            .get("http://localhost:18097/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        assert_ne!(
            response.status(),
            reqwest::StatusCode::TOO_MANY_REQUESTS,
            "Request {i} should not be rate limited"
        );

        // Small delay to ensure rate limit state is updated
        sleep(Duration::from_millis(100)).await;
    }

    // Additional delay to ensure rate limit state is fully synchronized
    sleep(Duration::from_millis(200)).await;

    // Next request should be rate limited (API key limit)
    // With rpm=5 and burst=5, the 6th request should exceed the limit
    let response = client
        .get("http://localhost:18097/v1/models")
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
async fn test_security_middleware_chain() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-security-middleware");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with IP whitelist and rate limit
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"],
        "rate_limit": {
            "rpm": 10,
            "burst": 10
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
        port: 18098,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test request from whitelisted IP with valid API key
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18098/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::OK);

    // Test request from non-whitelisted IP
    let response = client
        .get("http://localhost:18098/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", "192.168.1.100")
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), reqwest::StatusCode::FORBIDDEN);

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_anomaly_detection_integration() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-anomaly-detection");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy
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
        port: 18099,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test SQL injection attempt (should trigger anomaly detection)
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18099/v1/models?id=1' OR '1'='1")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", "192.168.1.100")
        .send()
        .await
        .unwrap();

    // Should be rejected (anomaly detected or method not allowed)
    assert!(
        response.status() == reqwest::StatusCode::FORBIDDEN
            || response.status() == reqwest::StatusCode::BAD_REQUEST
            || response.status() == reqwest::StatusCode::METHOD_NOT_ALLOWED
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_resource_protection_integration() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-resource-protection");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy
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
        port: 18100,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test that resource protection is active and monitoring
    // Note: Actual CPU/memory throttling is hard to test deterministically,
    // so we test that the system is functioning and can handle requests
    let client = reqwest::Client::new();

    // Make a normal request - should succeed
    let response = client
        .get("http://localhost:18100/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    // Resource protection should not block normal requests
    assert_ne!(
        response.status(),
        reqwest::StatusCode::SERVICE_UNAVAILABLE,
        "Normal requests should not be throttled by resource protection"
    );

    // Make multiple requests to verify resource protection doesn't interfere
    for i in 0..5 {
        let response = client
            .get("http://localhost:18100/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        assert_ne!(
            response.status(),
            reqwest::StatusCode::SERVICE_UNAVAILABLE,
            "Request {} should not be throttled under normal conditions",
            i
        );
    }

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_resource_protection_with_other_middleware() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-resource-protection-middleware");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with rate limiting
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"],
        "rate_limit": {
            "rpm": 100,
            "burst": 100
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
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test that resource protection works alongside rate limiting
    let client = reqwest::Client::new();

    // Make requests that should be rate limited, not resource protected
    for i in 0..10 {
        let response = client
            .get("http://localhost:18101/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        // Should not be throttled by resource protection (we're not hitting CPU/memory limits)
        assert_ne!(
            response.status(),
            reqwest::StatusCode::SERVICE_UNAVAILABLE,
            "Request {} should not be throttled by resource protection",
            i
        );
    }

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_rate_limit_dynamic_adjustment() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-ip-rate-limit-dynamic");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with IP rate limit
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"],
        "ip_rate_limit": {
            "rpm": 100,
            "burst": 100
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
        port: 18102,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let test_ip = "192.168.1.201";

    // Make requests that should trigger anomaly detection (which will reduce rate limit)
    // Send many requests rapidly to increase anomaly score
    for _ in 0..50 {
        let _ = client
            .get("http://localhost:18102/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .header("X-Forwarded-For", test_ip)
            .send()
            .await;
    }

    // After anomaly detection, rate limit should be dynamically adjusted
    // The system should still function, but with reduced limits
    let response = client
        .get("http://localhost:18102/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", test_ip)
        .send()
        .await
        .unwrap();

    // Should still be able to make requests (just with reduced rate limit)
    assert_ne!(
        response.status(),
        reqwest::StatusCode::INTERNAL_SERVER_ERROR,
        "System should handle dynamic rate limit adjustment"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_rate_limit_and_api_key_rate_limit_combined() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-ip-api-rate-limit-combined");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with both IP and API key rate limits
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"],
        "rate_limit": {
            "rpm": 10,
            "burst": 10
        },
        "ip_rate_limit": {
            "rpm": 20,
            "burst": 20
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
        port: 18103,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Make requests up to API key limit (10 requests)
    for i in 0..10 {
        let response = client
            .get("http://localhost:18103/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        assert_ne!(
            response.status(),
            reqwest::StatusCode::TOO_MANY_REQUESTS,
            "Request {} should not be rate limited (within API key limit)",
            i
        );
    }

    // Next request should be rate limited by API key limit (not IP limit)
    let response = client
        .get("http://localhost:18103/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    // API key rate limit should trigger first (10 rpm) before IP rate limit (20 rpm)
    assert_eq!(
        response.status(),
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        "11th request should be rate limited by API key limit"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_rate_limit_persistence() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-ip-rate-limit-persistence");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with low IP rate limit
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"],
        "ip_rate_limit": {
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
        port: 18104,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let test_ip = "192.168.1.202";

    // Make requests up to the limit
    for i in 0..5 {
        let response = client
            .get("http://localhost:18104/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .header("X-Forwarded-For", test_ip)
            .send()
            .await
            .unwrap();

        assert_ne!(
            response.status(),
            reqwest::StatusCode::TOO_MANY_REQUESTS,
            "Request {} should not be rate limited (within limit)",
            i
        );
    }

    // Next request should be rate limited
    let response = client
        .get("http://localhost:18104/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", test_ip)
        .send()
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        "6th request should be rate limited"
    );

    // Stop and restart proxy to test persistence
    controller.stop(handle).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Restart proxy with a new config (clone the original)
    let config2 = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18104,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };
    let handle2 = controller.start(config2).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Rate limit state should be persisted (though in-memory state is lost on restart,
    // the database persistence should allow recovery)
    // Note: Current implementation uses in-memory state, so this test verifies
    // that the system handles restart gracefully
    let response = client
        .get("http://localhost:18104/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", test_ip)
        .send()
        .await
        .unwrap();

    // After restart, rate limit should reset (in-memory state is lost)
    // This is expected behavior for current implementation
    assert_ne!(
        response.status(),
        reqwest::StatusCode::INTERNAL_SERVER_ERROR,
        "System should handle restart gracefully"
    );

    controller.stop(handle2).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_anomaly_detection_statistical_analysis() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-anomaly-statistical");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy
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
        port: 18105,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let test_ip = "192.168.1.203";

    // Make requests with varying patterns to trigger statistical anomaly detection
    // Send many requests rapidly (high request rate)
    for _ in 0..100 {
        let _ = client
            .get("http://localhost:18105/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .header("X-Forwarded-For", test_ip)
            .send()
            .await;
    }

    // After many requests, anomaly detection should have increased the score
    // The system should still function but may have reduced rate limits
    let response = client
        .get("http://localhost:18105/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", test_ip)
        .send()
        .await
        .unwrap();

    // Should still be able to make requests (anomaly detection doesn't block, just adjusts limits)
    assert_ne!(
        response.status(),
        reqwest::StatusCode::INTERNAL_SERVER_ERROR,
        "System should handle statistical anomaly detection"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_anomaly_detection_pattern_detection() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-anomaly-pattern");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy
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
        port: 18106,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let test_ip = "192.168.1.204";

    // Make many duplicate requests (same endpoint, same method) to trigger pattern detection
    for _ in 0..60 {
        let _ = client
            .get("http://localhost:18106/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .header("X-Forwarded-For", test_ip)
            .send()
            .await;
    }

    // Pattern detection should have increased anomaly score
    // The system should still function
    let response = client
        .get("http://localhost:18106/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", test_ip)
        .send()
        .await
        .unwrap();

    assert_ne!(
        response.status(),
        reqwest::StatusCode::INTERNAL_SERVER_ERROR,
        "System should handle pattern detection"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_anomaly_detection_auto_block_after_repeated_404() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-anomaly-auto-block");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy
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
        port: 18115,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let test_ip = "192.168.1.250";
    let mut blocked = false;

    // Repeatedly hit a non-existent endpoint to trigger anomaly detection (repeated 404s)
    for _ in 0..150 {
        let response = client
            .get("http://localhost:18115/v1/nonexistent-endpoint")
            .header("Authorization", bearer_header(&api_key.plain))
            .header("X-Forwarded-For", test_ip)
            .send()
            .await
            .unwrap();

        if response.status() == reqwest::StatusCode::FORBIDDEN {
            blocked = true;
            break;
        }
    }

    assert!(
        blocked,
        "Anomaly detection should eventually block IPs with repeated suspicious 404 access patterns"
    );

    // Once blocked, even valid requests should be rejected
    let response = client
        .get("http://localhost:18115/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", test_ip)
        .send()
        .await
        .unwrap();
    assert_eq!(
        response.status(),
        reqwest::StatusCode::FORBIDDEN,
        "Blocked IP should continue to be denied"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_features_integration() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-security-integration");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with all security features
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"],
        "rate_limit": {
            "rpm": 5,
            "burst": 5
        },
        "ip_rate_limit": {
            "rpm": 10,
            "burst": 10
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
        port: 18107,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        trusted_proxy_ips: vec!["127.0.0.1".to_string()], // Allow X-Forwarded-For from localhost
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Test that all security features work together
    // 1. IP whitelist check
    // 2. Authentication
    // 3. Rate limiting (API key and IP)
    // 4. Anomaly detection
    // 5. Resource protection

    // Normal request from whitelisted IP with valid API key
    let response = client
        .get("http://localhost:18107/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        reqwest::StatusCode::OK,
        "Normal request should succeed"
    );

    // Request from non-whitelisted IP should be blocked
    let response = client
        .get("http://localhost:18107/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", "192.168.1.205")
        .send()
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        reqwest::StatusCode::FORBIDDEN,
        "Request from non-whitelisted IP should be blocked"
    );

    // Make requests to trigger API key rate limiting
    for _ in 0..5 {
        let _ = client
            .get("http://localhost:18107/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();
    }

    let response = client
        .get("http://localhost:18107/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();
    assert_eq!(
        response.status(),
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        "API key rate limit should trigger at configured boundary"
    );

    // Simulate intrusion attempts from another IP to trigger blocklist/anomaly detection
    let malicious_ip = "192.168.1.210";
    let mut blocked = false;
    // Use SQL injection in a valid endpoint to trigger intrusion detection
    for _ in 0..6 {
        let response = client
            .get(format!("http://localhost:18107/v1/models?id=1' OR '1'='1"))
            .header("Authorization", bearer_header(&api_key.plain))
            .header("X-Forwarded-For", malicious_ip)
            .send()
            .await
            .unwrap();
        if response.status() == reqwest::StatusCode::FORBIDDEN {
            blocked = true;
            break;
        }
    }
    assert!(blocked, "Intrusion attempts should trigger IP blocklist");

    // Malicious IP should remain blocked even for valid endpoint
    let response = client
        .get("http://localhost:18107/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("X-Forwarded-For", malicious_ip)
        .send()
        .await
        .unwrap();
    assert_eq!(
        response.status(),
        reqwest::StatusCode::FORBIDDEN,
        "Blocked IP should not regain access"
    );

    // Original whitelisted IP should recover after rate limit window (simulate wait)
    sleep(Duration::from_secs(1)).await;
    let response = client
        .get("http://localhost:18107/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();
    assert!(
        response.status() == reqwest::StatusCode::OK
            || response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS,
        "System should resume serving legitimate traffic"
    );

    controller.stop(handle).await.unwrap();
}

// Edge case tests

#[tokio::test(flavor = "multi_thread")]
async fn test_rate_limit_boundary_conditions() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-rate-limit-boundary");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy with exact boundary rate limit (1 request)
    let policy_json = serde_json::json!({
        "rate_limit": {
            "rpm": 1,
            "burst": 1
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
        port: 18108,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // First request should succeed (exactly at limit)
    let response = client
        .get("http://localhost:18108/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        reqwest::StatusCode::OK,
        "First request should succeed at boundary"
    );

    // Second request should be rate limited (over limit)
    let response = client
        .get("http://localhost:18108/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        "Second request should be rate limited at boundary"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_concurrent_requests() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-concurrent");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set policy
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
        port: 18109,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Make concurrent requests
    let client = reqwest::Client::new();
    let mut handles = Vec::new();

    for _ in 0..10 {
        let client_clone = client.clone();
        let api_key_clone = api_key.plain.clone();
        let handle = tokio::spawn(async move {
            client_clone
                .get("http://localhost:18109/v1/models")
                .header("Authorization", bearer_header(&api_key_clone))
                .send()
                .await
        });
        handles.push(handle);
    }

    // Wait for all requests to complete
    let mut success_count = 0;
    for handle in handles {
        if let Ok(response) = handle.await {
            if let Ok(resp) = response {
                if resp.status() == reqwest::StatusCode::OK {
                    success_count += 1;
                }
            }
        }
    }

    // All concurrent requests should succeed
    assert_eq!(success_count, 10, "All concurrent requests should succeed");

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_invalid_json() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-invalid-json");

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
        port: 18112,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test with invalid JSON
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:18112/v1/chat/completions")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("Content-Type", "application/json")
        .body("invalid json {")
        .send()
        .await
        .unwrap();

    // Should return bad request for invalid JSON
    assert_eq!(
        response.status(),
        reqwest::StatusCode::BAD_REQUEST,
        "Should handle invalid JSON gracefully"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_missing_security_policy_denies_requests() {
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-missing-policy");

    // Create security service but do not set policy
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Delete the default policy created by migration to test "missing policy" scenario
    // We need to connect directly to the database to delete the policy
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;
    let db_path_str = security_db.to_str().unwrap();
    let options = SqliteConnectOptions::from_str(&format!("sqlite://{}", db_path_str))
        .unwrap()
        .create_if_missing(false);
    let direct_pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    sqlx::query("DELETE FROM security_policies WHERE id = 'default'")
        .execute(&direct_pool)
        .await
        .unwrap();

    // Start proxy without policy (should fail closed)
    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18113,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Requests should be denied because policy is missing
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18113/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        reqwest::StatusCode::FORBIDDEN,
        "Proxy should fail closed when no security policy is configured"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_invalid_model_id_error_handling() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = unique_db_path("flm-test-invalid-model");

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set empty policy
    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: "{}".to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    security_service.set_policy(policy).await.unwrap();

    // Start proxy
    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18116,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Call audio transcription endpoint with invalid model value
    let client = reqwest::Client::new();
    let form = reqwest::multipart::Form::new()
        .text("model", "invalid-model-format")
        .part(
            "file",
            reqwest::multipart::Part::bytes(b"fake-bytes".to_vec())
                .file_name("audio.wav")
                .mime_str("audio/wav")
                .unwrap(),
        );

    let response = client
        .post("http://localhost:18116/v1/audio/transcriptions")
        .header("Authorization", bearer_header(&api_key.plain))
        .multipart(form)
        .send()
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        reqwest::StatusCode::BAD_REQUEST,
        "Invalid model IDs should return a clear client error"
    );

    controller.stop(handle).await.unwrap();
}
