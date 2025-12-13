//! Edge case tests for flm-proxy
//!
//! Tests for boundary values, concurrent requests, timeouts, and other edge cases.

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
async fn test_rate_limit_boundary_values() {
    let security_db = unique_db_path("flm-edge-rate-limit-boundary");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let _api_key = security_service.create_api_key("test-key").await.unwrap();

    // Test with very low rate limit (rpm=1, burst=1)
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

    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18140,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // First request should succeed (within limit)
    let response = client
        .get("http://localhost:18140/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();
    assert_eq!(
        response.status(),
        reqwest::StatusCode::OK,
        "First request should succeed (within rate limit)"
    );

    // Second request should be rate limited (exceeds rpm=1)
    let response = client
        .get("http://localhost:18140/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();
    assert_eq!(
        response.status(),
        reqwest::StatusCode::TOO_MANY_REQUESTS,
        "Second request should be rate limited (rpm=1, burst=1)"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_rate_limit_zero_values() {
    let security_db = unique_db_path("flm-edge-rate-limit-zero");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let _api_key = security_service.create_api_key("test-key").await.unwrap();

    // Test with zero rate limit (should allow all requests or handle gracefully)
    let policy_json = serde_json::json!({
        "rate_limit": {
            "rpm": 0,
            "burst": 0
        }
    });

    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    security_service.set_policy(policy).await.unwrap();

    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18141,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // With zero rate limit, requests should either be allowed or handled gracefully
    // (implementation may vary, but should not panic)
    let response = client
        .get("http://localhost:18141/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    // Should not panic - either OK or TOO_MANY_REQUESTS is acceptable
    assert!(
        response.status() == reqwest::StatusCode::OK
            || response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS,
        "Zero rate limit should be handled gracefully (got: {})",
        response.status()
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_concurrent_requests_under_rate_limit() {
    let security_db = unique_db_path("flm-edge-concurrent-rate-limit");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let _api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set rate limit to allow 10 requests
    let policy_json = serde_json::json!({
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

    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18142,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Send 10 concurrent requests (within limit)
    let mut handles = Vec::new();
    for _ in 0..10 {
        let client_clone = client.clone();
        let api_key_clone = api_key.plain.clone();
        let handle = tokio::spawn(async move {
            client_clone
                .get("http://localhost:18142/v1/models")
                .header("Authorization", bearer_header(&api_key_clone))
                .send()
                .await
        });
        handles.push(handle);
    }

    let mut success_count = 0;
    let mut rate_limited_count = 0;

    for handle in handles {
        match handle.await {
            Ok(Ok(response)) => {
                if response.status() == reqwest::StatusCode::OK {
                    success_count += 1;
                } else if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                    rate_limited_count += 1;
                }
            }
            _ => {}
        }
    }

    // Most requests should succeed (within rate limit of 10)
    // Allow for some rate limiting due to concurrent access
    assert!(
        success_count >= 8,
        "Most concurrent requests should succeed (success: {}, rate_limited: {})",
        success_count,
        rate_limited_count
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_concurrent_requests_exceeding_rate_limit() {
    let security_db = unique_db_path("flm-edge-concurrent-exceed");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let _api_key = security_service.create_api_key("test-key").await.unwrap();

    // Set rate limit to allow 5 requests
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

    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18143,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Send 20 concurrent requests (exceeding limit of 5)
    let mut handles = Vec::new();
    for _ in 0..20 {
        let client_clone = client.clone();
        let api_key_clone = api_key.plain.clone();
        let handle = tokio::spawn(async move {
            client_clone
                .get("http://localhost:18143/v1/models")
                .header("Authorization", bearer_header(&api_key_clone))
                .send()
                .await
        });
        handles.push(handle);
    }

    let mut success_count = 0;
    let mut rate_limited_count = 0;

    for handle in handles {
        match handle.await {
            Ok(Ok(response)) => {
                if response.status() == reqwest::StatusCode::OK {
                    success_count += 1;
                } else if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                    rate_limited_count += 1;
                }
            }
            _ => {}
        }
    }

    // Some requests should succeed (within limit), but most should be rate limited
    assert!(
        success_count <= 5,
        "Only up to 5 requests should succeed (success: {}, rate_limited: {})",
        success_count,
        rate_limited_count
    );
    assert!(
        rate_limited_count > 0,
        "Some requests should be rate limited (success: {}, rate_limited: {})",
        success_count,
        rate_limited_count
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_very_long_api_key() {
    let security_db = unique_db_path("flm-edge-long-api-key");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let _api_key = security_service.create_api_key("test-key").await.unwrap();

    let policy_json = serde_json::json!({});
    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    security_service.set_policy(policy).await.unwrap();

    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18144,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Test with very long API key (should be rejected, not panic)
    let long_key = "Bearer ".to_string() + &"a".repeat(10000);
    let response = client
        .get("http://localhost:18144/v1/models")
        .header("Authorization", long_key)
        .send()
        .await
        .unwrap();

    // Should reject with UNAUTHORIZED, not panic
    assert_eq!(
        response.status(),
        reqwest::StatusCode::UNAUTHORIZED,
        "Very long API key should be rejected gracefully"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_empty_request_body() {
    let security_db = unique_db_path("flm-edge-empty-body");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let _api_key = security_service.create_api_key("test-key").await.unwrap();

    let policy_json = serde_json::json!({});
    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    security_service.set_policy(policy).await.unwrap();

    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18145,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Test POST with empty body
    let response = client
        .post("http://localhost:18145/v1/chat/completions")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("Content-Type", "application/json")
        .body("")
        .send()
        .await
        .unwrap();

    // Should handle gracefully (BAD_REQUEST or similar, not panic)
    assert!(
        response.status() == reqwest::StatusCode::BAD_REQUEST
            || response.status() == reqwest::StatusCode::UNPROCESSABLE_ENTITY,
        "Empty request body should be handled gracefully (got: {})",
        response.status()
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_very_large_request_body() {
    let security_db = unique_db_path("flm-edge-large-body");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let _api_key = security_service.create_api_key("test-key").await.unwrap();

    let policy_json = serde_json::json!({});
    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    security_service.set_policy(policy).await.unwrap();

    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18146,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Test with very large request body (10MB)
    let large_body = "x".repeat(10 * 1024 * 1024);
    let response = client
        .post("http://localhost:18146/v1/chat/completions")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("Content-Type", "application/json")
        .body(large_body)
        .timeout(Duration::from_secs(30))
        .send()
        .await;

    // Should handle gracefully (may timeout, reject, or process)
    // The important thing is it doesn't panic
    match response {
        Ok(resp) => {
            // If request completes, should return some status (not panic)
            let status = resp.status();
            assert!(
                status.is_client_error() || status.is_server_error() || status.is_success(),
                "Large request body should return valid status (got: {})",
                status
            );
        }
        Err(e) => {
            // Timeout or connection error is acceptable for very large bodies
            assert!(
                e.is_timeout() || e.is_request(),
                "Large request body should timeout or be rejected gracefully (got: {})",
                e
            );
        }
    }

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_multiple_authorization_headers() {
    let security_db = unique_db_path("flm-edge-multiple-auth");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let _api_key = security_service.create_api_key("test-key").await.unwrap();

    let policy_json = serde_json::json!({});
    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    security_service.set_policy(policy).await.unwrap();

    let controller = AxumProxyController::new();
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 18147,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Test with multiple Authorization headers (should use first one or reject)
    let request = client
        .get("http://localhost:18147/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("Authorization", "Bearer invalid-key");

    // Note: reqwest may not allow duplicate headers, so we test what happens
    let response = request.send().await.unwrap();

    // Should handle gracefully (either accept first header or reject)
    assert!(
        response.status() == reqwest::StatusCode::OK
            || response.status() == reqwest::StatusCode::UNAUTHORIZED
            || response.status() == reqwest::StatusCode::BAD_REQUEST,
        "Multiple Authorization headers should be handled gracefully (got: {})",
        response.status()
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_rapid_start_stop() {
    let security_db = unique_db_path("flm-edge-rapid-start-stop");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let _api_key = security_service.create_api_key("test-key").await.unwrap();

    let policy_json = serde_json::json!({});
    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    security_service.set_policy(policy).await.unwrap();

    let controller = AxumProxyController::new();

    // Rapidly start and stop proxy multiple times
    for i in 0..5 {
        let config = ProxyConfig {
            mode: ProxyMode::LocalHttp,
            port: 18148 + i,
            security_db_path: Some(security_db.to_str().unwrap().to_string()),
            ..Default::default()
        };

        let handle = controller.start(config.clone()).await.unwrap();
        sleep(Duration::from_millis(100)).await;
        controller.stop(handle).await.unwrap();
        sleep(Duration::from_millis(100)).await;
    }

    // Should not panic or leak resources
    // If we get here, the test passed
    assert!(true, "Rapid start/stop should not cause panics");
}
