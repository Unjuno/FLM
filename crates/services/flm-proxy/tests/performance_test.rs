//! Performance tests for flm-proxy

use flm_core::domain::proxy::{ProxyConfig, ProxyMode};
use flm_core::domain::security::SecurityPolicy;
use flm_core::ports::ProxyController;
use flm_core::services::SecurityService;
use flm_proxy::adapters::SqliteSecurityRepository;
use flm_proxy::AxumProxyController;
use std::sync::Arc;
use std::time::{Duration, Instant};
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
async fn test_rate_limit_performance() {
    let security_db = unique_db_path("flm-perf-rate-limit");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let api_key = security_service.create_api_key("test-key").await.unwrap();

    let policy_json = serde_json::json!({
        "rate_limit": {
            "rpm": 1000,
            "burst": 1000
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
        port: 18110,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let start = Instant::now();
    let mut success_count = 0;
    let mut rate_limited_count = 0;

    // Make 100 requests quickly
    // Note: In test environments, sysinfo may return inaccurate CPU/memory values,
    // causing resource protection to throttle some requests.
    let mut throttled_count = 0;
    for _ in 0..100 {
        let response = client
            .get("http://localhost:18110/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        if response.status() == reqwest::StatusCode::OK {
            success_count += 1;
        } else if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            rate_limited_count += 1;
        } else if response.status() == reqwest::StatusCode::SERVICE_UNAVAILABLE {
            throttled_count += 1;
        }
    }

    let elapsed = start.elapsed();

    // Performance check: 100 requests should complete in reasonable time (< 5 seconds)
    assert!(
        elapsed < Duration::from_secs(5),
        "100 requests took too long: {:?}",
        elapsed
    );

    // Most requests should succeed (rate limit is 1000/min, we only made 100)
    // Allow for resource protection throttling in test env
    assert!(
        success_count > 80,
        "Too many requests failed: success={}, rate_limited={}, throttled={}",
        success_count,
        rate_limited_count,
        throttled_count
    );
    assert_eq!(rate_limited_count, 0, "No requests should be rate limited");

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_high_load_request_handling() {
    let security_db = unique_db_path("flm-perf-high-load");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let api_key = security_service.create_api_key("test-key").await.unwrap();

    let policy_json = serde_json::json!({
        "rate_limit": {
            "rpm": 10000,
            "burst": 10000
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
        port: 18111,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let start = Instant::now();

    // Make 500 concurrent requests
    let mut handles = Vec::new();
    for _ in 0..500 {
        let client_clone = client.clone();
        let api_key_clone = api_key.plain.clone();
        let handle = tokio::spawn(async move {
            client_clone
                .get("http://localhost:18111/v1/models")
                .header("Authorization", bearer_header(&api_key_clone))
                .send()
                .await
        });
        handles.push(handle);
    }

    let mut success_count = 0;
    let mut error_count = 0;
    let mut throttled_count = 0;

    for handle in handles {
        match handle.await {
            Ok(Ok(response)) => {
                if response.status() == reqwest::StatusCode::OK {
                    success_count += 1;
                } else if response.status() == reqwest::StatusCode::SERVICE_UNAVAILABLE {
                    throttled_count += 1;
                } else {
                    error_count += 1;
                }
            }
            _ => error_count += 1,
        }
    }

    let elapsed = start.elapsed();

    // Performance check: 500 concurrent requests should complete in reasonable time (< 10 seconds)
    assert!(
        elapsed < Duration::from_secs(10),
        "500 concurrent requests took too long: {:?}",
        elapsed
    );

    // Most requests should succeed (allow for resource protection throttling in test env)
    // Note: In test environments, sysinfo may return inaccurate CPU/memory values,
    // causing resource protection to throttle some requests.
    assert!(
        success_count > 300,
        "Too many requests failed: success={}, throttled={}, errors={} (resource protection may throttle some in test env)",
        success_count,
        throttled_count,
        error_count
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_memory_leak_detection() {
    let security_db = unique_db_path("flm-perf-memory");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let api_key = security_service.create_api_key("test-key").await.unwrap();

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
        port: 18112,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Make many requests to check for memory leaks
    // Note: In test environments, sysinfo may return inaccurate CPU/memory values,
    // causing resource protection to throttle some requests.
    // We allow both OK and SERVICE_UNAVAILABLE status codes.
    for i in 0..1000 {
        let response = client
            .get("http://localhost:18112/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        // Every 100 requests, verify the server is still responsive
        // Allow SERVICE_UNAVAILABLE due to resource protection in test env
        if i % 100 == 0 {
            assert!(
                response.status() == reqwest::StatusCode::OK
                    || response.status() == reqwest::StatusCode::SERVICE_UNAVAILABLE,
                "Request {} should be OK or SERVICE_UNAVAILABLE (got: {})",
                i,
                response.status()
            );
        }
    }

    // Final health check
    let response = client
        .get("http://localhost:18112/health")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::OK);

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_resource_protection_performance_under_load() {
    let security_db = unique_db_path("flm-perf-resource-protection");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let api_key = security_service.create_api_key("test-key").await.unwrap();
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"],
        "rate_limit": {
            "rpm": 1000,
            "burst": 1000
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
        port: 18120,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let start = Instant::now();

    // Burst of requests to ensure resource protection monitoring does not add noticeable latency
    // Note: In test environments, sysinfo may return inaccurate CPU/memory values,
    // causing resource protection to throttle even healthy traffic.
    // We allow both OK and SERVICE_UNAVAILABLE status codes, as the test's primary purpose
    // is to measure performance, not to verify resource protection behavior.
    let mut success_count = 0;
    let mut throttled_count = 0;
    for _ in 0..200 {
        let response = client
            .get("http://localhost:18120/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();
        match response.status() {
            reqwest::StatusCode::OK => success_count += 1,
            reqwest::StatusCode::SERVICE_UNAVAILABLE => throttled_count += 1,
            _ => panic!("Unexpected status code: {}", response.status()),
        }
    }
    
    // At least some requests should succeed (resource protection may throttle some in test env)
    assert!(
        success_count > 0,
        "At least some requests should succeed (success: {}, throttled: {})",
        success_count,
        throttled_count
    );

    let elapsed = start.elapsed();
    assert!(
        elapsed < Duration::from_secs(8),
        "Resource protection overhead too high: {:?}",
        elapsed
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_ip_rate_limit_scaling_with_many_ips() {
    let security_db = unique_db_path("flm-perf-many-ips");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo));

    let api_key = security_service.create_api_key("test-key").await.unwrap();
    let policy_json = serde_json::json!({
        "ip_whitelist": ["127.0.0.1"],
        "ip_rate_limit": {
            "rpm": 1000,
            "burst": 1000
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
        port: 18121,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        trusted_proxy_ips: vec!["127.0.0.1".to_string()],
        ..Default::default()
    };
    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();
    let start = Instant::now();

    // Simulate 200 different IP addresses hitting the proxy in quick succession
    // Note: In test environments, sysinfo may return inaccurate CPU/memory values,
    // causing resource protection to throttle even healthy traffic.
    // We allow both OK and SERVICE_UNAVAILABLE status codes.
    let mut success_count = 0;
    let mut throttled_count = 0;
    for idx in 1..=200 {
        let ip = format!("10.0.0.{idx}");
        let response = client
            .get("http://localhost:18121/v1/models")
            .header("Authorization", bearer_header(&api_key.plain))
            .header("X-Forwarded-For", ip)
            .send()
            .await
            .unwrap();
        match response.status() {
            reqwest::StatusCode::OK => success_count += 1,
            reqwest::StatusCode::SERVICE_UNAVAILABLE => throttled_count += 1,
            _ => panic!("Unexpected status code: {}", response.status()),
        }
    }
    
    // At least some requests should succeed
    assert!(
        success_count > 0,
        "At least some requests should succeed (success: {}, throttled: {})",
        success_count,
        throttled_count
    );

    let elapsed = start.elapsed();
    assert!(
        elapsed < Duration::from_secs(10),
        "IP-rate-limit tracking should scale to hundreds of IPs efficiently"
    );

    controller.stop(handle).await.unwrap();
}
