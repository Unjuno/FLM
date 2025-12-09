//! Security tests for flm-proxy

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
async fn test_sql_injection_protection() {
    let security_db = unique_db_path("flm-security-sql");

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
        port: 18120,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Test various SQL injection attempts
    let sql_injection_payloads = vec![
        "1' OR '1'='1",
        "1'; DROP TABLE users; --",
        "1' UNION SELECT * FROM users --",
        "admin'--",
        "1' OR 1=1--",
    ];

    for payload in sql_injection_payloads {
        // Test in query parameters
        let response = client
            .get(format!("http://localhost:18120/v1/models?id={}", payload))
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        // Should be rejected or sanitized (not cause SQL errors)
        assert!(
            response.status() != reqwest::StatusCode::INTERNAL_SERVER_ERROR,
            "SQL injection in query parameter should not cause server error: {}",
            payload
        );

        // Test in path
        let response = client
            .get(format!("http://localhost:18120/v1/models/{}", payload))
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        assert!(
            response.status() != reqwest::StatusCode::INTERNAL_SERVER_ERROR,
            "SQL injection in path should not cause server error: {}",
            payload
        );
    }

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_xss_protection() {
    let security_db = unique_db_path("flm-security-xss");

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
        port: 18121,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Test XSS payloads
    let xss_payloads = vec![
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "javascript:alert('XSS')",
        "<svg onload=alert('XSS')>",
    ];

    for payload in xss_payloads {
        // Test in query parameters
        let response = client
            .get(format!(
                "http://localhost:18121/v1/models?q={}",
                urlencoding::encode(payload)
            ))
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        // Response should not contain the XSS payload in a dangerous way
        let body = response.text().await.unwrap();
        assert!(
            !body.contains("<script>") || body.contains("&lt;script&gt;"),
            "XSS payload should be escaped in response: {}",
            payload
        );
    }

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_csrf_protection() {
    let security_db = unique_db_path("flm-security-csrf");

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
        port: 18122,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Test that API requires authentication (CSRF protection)
    // Requests without proper authentication should be rejected
    let response = client
        .post("http://localhost:18122/v1/chat/completions")
        .header("Origin", "http://evil.com")
        .header("Referer", "http://evil.com")
        .json(&serde_json::json!({
            "model": "test",
            "messages": [{"role": "user", "content": "test"}]
        }))
        .send()
        .await
        .unwrap();

    // Should be rejected due to missing authentication
    assert_eq!(
        response.status(),
        reqwest::StatusCode::UNAUTHORIZED,
        "CSRF: Request without authentication should be rejected"
    );

    // Test with authentication but suspicious headers
    let response = client
        .post("http://localhost:18122/v1/chat/completions")
        .header("Authorization", bearer_header(&api_key.plain))
        .header("Origin", "http://evil.com")
        .header("Referer", "http://evil.com")
        .json(&serde_json::json!({
            "model": "test",
            "messages": [{"role": "user", "content": "test"}]
        }))
        .send()
        .await
        .unwrap();

    // With valid authentication, request should proceed (API key is the CSRF protection)
    // Status might be 200, 400, or 404 depending on model availability, but not 403 CSRF
    assert_ne!(
        response.status(),
        reqwest::StatusCode::FORBIDDEN,
        "CSRF: Request with valid authentication should not be rejected as CSRF"
    );

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_authentication_bypass_protection() {
    let security_db = unique_db_path("flm-security-auth-bypass");

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo.clone()));

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
        port: 18123,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };
    let config_clone = config.clone();

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // First, test with valid authentication to ensure it works
    // This ensures the proxy is working correctly before testing bypass attempts
    let response = client
        .get("http://localhost:18123/v1/models")
        .header("Authorization", bearer_header(&api_key.plain))
        .send()
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        reqwest::StatusCode::OK,
        "Valid authentication should be accepted before bypass attempts"
    );

    // Test various authentication bypass attempts
    // Note: These attempts will record failures to IP blocklist, which is expected behavior
    let long_key = format!("Bearer {}", "a".repeat(1000));
    let bypass_attempts = vec![
        ("", "Empty authorization header"),
        ("Bearer ", "Bearer with empty token"),
        ("Basic dGVzdDp0ZXN0", "Basic auth instead of Bearer"),
        ("Bearer invalid-key-12345", "Invalid API key"),
        (&long_key, "Very long invalid key"),
    ];

    for (auth_header, description) in bypass_attempts {
        let response = client
            .get("http://localhost:18123/v1/models")
            .header("Authorization", auth_header)
            .send()
            .await
            .unwrap();

        // All should be rejected
        assert_eq!(
            response.status(),
            reqwest::StatusCode::UNAUTHORIZED,
            "Authentication bypass attempt should be rejected: {}",
            description
        );
    }

    // Note: The bypass attempts may have recorded failures to IP blocklist, which is expected
    // The initial valid authentication test confirms the proxy works correctly
    // Testing valid auth after bypass attempts would require clearing the blocklist and
    // restarting the proxy, which is beyond the scope of this test
    // The test's primary purpose is to verify that bypass attempts are rejected

    controller.stop(handle).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_path_traversal_protection() {
    let security_db = unique_db_path("flm-security-path-traversal");

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
        port: 18124,
        security_db_path: Some(security_db.to_str().unwrap().to_string()),
        ..Default::default()
    };

    let handle = controller.start(config).await.unwrap();
    sleep(Duration::from_millis(500)).await;

    let client = reqwest::Client::new();

    // Test path traversal attempts
    let path_traversal_payloads = vec![
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "....//....//....//etc/passwd",
    ];

    for payload in path_traversal_payloads {
        let response = client
            .get(format!("http://localhost:18124/{}", payload))
            .header("Authorization", bearer_header(&api_key.plain))
            .send()
            .await
            .unwrap();

        // Should be rejected (404 or 403, not 200 with file contents)
        assert!(
            response.status() == reqwest::StatusCode::NOT_FOUND
                || response.status() == reqwest::StatusCode::FORBIDDEN,
            "Path traversal attempt should be rejected: {}",
            payload
        );
    }

    controller.stop(handle).await.unwrap();
}
