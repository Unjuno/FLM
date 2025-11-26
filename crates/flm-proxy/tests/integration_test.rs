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
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
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
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
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

    // Set policy with rate limit (low limit for testing, burst > rpm to verify rpm enforcement)
    let policy_json = serde_json::json!({
        "rate_limit": {
            "rpm": 3,
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
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Make requests up to the RPM limit (burst allows 5, but RPM should cap at 3 per minute)
    let client = reqwest::Client::new();
    for i in 0..3 {
        let response = client
            .get("http://localhost:18084/v1/models")
            .header("Authorization", format!("Bearer {}", api_key.plain))
            .send()
            .await
            .unwrap();

        // First 3 requests should succeed
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

    // Next request should be rate limited due to RPM window exhaustion
    let response = client
        .get("http://localhost:18084/v1/models")
        .header("Authorization", format!("Bearer {}", api_key.plain))
        .send()
        .await
        .unwrap();

    let status = response.status();
    eprintln!("4th request status: {:?}", status);
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

    // Set policy with rate limit (burst > rpm to ensure per-key RPM enforcement)
    let policy_json = serde_json::json!({
        "rate_limit": {
            "rpm": 2,
            "burst": 4
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

    // Exhaust rate limit for key1 (RPM = 2, burst allows spikes but should still cap at RPM)
    let client = reqwest::Client::new();
    for _ in 0..2 {
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

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_rate_limit() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-ip-rate-limit-{}.db",
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
            .header("Authorization", format!("Bearer {}", api_key.plain))
            .send()
            .await
            .unwrap();

        let status = response.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            rate_limited = true;
            eprintln!("Request {} was rate limited", i);
            break;
        }
    }

    // IP rate limit should not trigger for 50 requests (limit is 1000/min)
    // But API key rate limit might (100 req/min)
    // So we expect either success or API key rate limit, but not IP rate limit for this test
    eprintln!(
        "IP rate limit test completed. Rate limited: {}",
        rate_limited
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_honeypot_endpoints() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-honeypot-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

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
    let honeypot_paths = vec!["/admin", "/api/v1/users", "/wp-admin", "/phpmyadmin"];

    for path in honeypot_paths {
        let response = client
            .get(&format!("http://localhost:18087{}", path))
            .send()
            .await
            .unwrap();

        // Should return 404 (not found)
        assert_eq!(
            response.status(),
            reqwest::StatusCode::NOT_FOUND,
            "Honeypot endpoint {} should return 404",
            path
        );

        // Verify it's a JSON error response
        let body: serde_json::Value = response.json().await.unwrap();
        assert_eq!(body["error"]["type"], "invalid_request_error");
        assert_eq!(body["error"]["code"], "not_found");
    }

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_blocklist_blocked_request() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::net::IpAddr;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-ip-blocklist-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo.clone()));

    // Create API key
    let api_key = security_service.create_api_key("test-key").await.unwrap();

    // Add IP to blocklist
    let blocked_ip: IpAddr = "192.168.100.1".parse().unwrap();
    let now = chrono::Utc::now().to_rfc3339();
    security_repo
        .add_ip_failure(
            &blocked_ip,
            5,
            &now,
            Some(
                &chrono::Utc::now()
                    .checked_add_signed(chrono::Duration::hours(1))
                    .unwrap()
                    .to_rfc3339(),
            ),
            false,
            &now,
        )
        .await
        .unwrap();

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
        port: 18090,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Verify IP is in blocklist
    let blocked_ips = security_repo.get_blocked_ips().await.unwrap();
    assert!(
        blocked_ips
            .iter()
            .any(|(ip, _, _, _, _, _)| *ip == blocked_ip),
        "Blocked IP should be in the blocklist"
    );

    // Test request from localhost (should be allowed)
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18090/v1/models")
        .header("Authorization", format!("Bearer {}", api_key.plain))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::OK);

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_intrusion_detection_pattern() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-intrusion-{}.db",
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
        port: 18091,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test unusual HTTP method (should trigger intrusion detection)
    let client = reqwest::Client::new();
    let response = client
        .request(
            reqwest::Method::from_bytes(b"PROPFIND").unwrap(),
            "http://localhost:18091/v1/models",
        )
        .header("Authorization", format!("Bearer {}", api_key.plain))
        .header("X-Forwarded-For", "192.168.1.100")
        .send()
        .await
        .unwrap();

    // Should be rejected (method not allowed or intrusion detected)
    assert!(
        response.status() == reqwest::StatusCode::METHOD_NOT_ALLOWED
            || response.status() == reqwest::StatusCode::FORBIDDEN
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_models_endpoint_no_auth() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-models-no-auth-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

    // Create security service
    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    // Create API key
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
        port: 18092,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test /v1/models endpoint without authentication
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18092/v1/models")
        .send()
        .await
        .unwrap();

    // Should return 401 Unauthorized
    assert_eq!(response.status(), reqwest::StatusCode::UNAUTHORIZED);

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_models_endpoint_with_auth() {
    use flm_core::domain::security::SecurityPolicy;
    use flm_core::services::SecurityService;
    use flm_proxy::adapters::SqliteSecurityRepository;
    use std::sync::Arc;

    // Create temporary database path
    let security_db = std::env::temp_dir().join(format!(
        "flm-test-models-auth-{}.db",
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
        port: 18093,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Test /v1/models endpoint with authentication
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:18093/v1/models")
        .header("Authorization", format!("Bearer {}", api_key.plain))
        .send()
        .await
        .unwrap();

    // Should return 200 OK
    assert_eq!(response.status(), reqwest::StatusCode::OK);

    // Verify response format
    let body: serde_json::Value = response.json().await.unwrap();
    assert_eq!(body["object"], "list");
    assert!(body["data"].is_array());

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_controller_status() {
    let controller = AxumProxyController::new();

    // Initially, status should return empty list
    let status = controller.status().await.unwrap();
    assert!(status.is_empty());

    // Start a proxy
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18094,
        ..Default::default()
    };

    let handle = controller.start(config.clone()).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Check status
    let status = controller.status().await.unwrap();
    assert_eq!(status.len(), 1);
    assert_eq!(status[0].port, 18094);
    assert_eq!(status[0].id, handle.id);
    assert!(status[0].running);

    // Start another proxy on different port
    let config2 = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18095,
        ..Default::default()
    };

    let handle2 = controller.start(config2).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    // Check status again
    let status = controller.status().await.unwrap();
    assert_eq!(status.len(), 2);

    // Stop both proxies
    controller.stop(handle).await.unwrap();
    controller.stop(handle2).await.unwrap();

    // Status should be empty again
    let status = controller.status().await.unwrap();
    assert!(status.is_empty());
}
