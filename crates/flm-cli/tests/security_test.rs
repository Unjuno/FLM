//! Integration tests for security commands
//!
//! These tests verify that security policy commands work correctly with actual database operations.

use flm_cli::adapters::SqliteSecurityRepository;
use flm_core::domain::security::SecurityPolicy;
use flm_core::services::SecurityService;
use std::path::PathBuf;
use tempfile::TempDir;

/// Helper to create a temporary database directory
fn create_temp_db_dir() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let security_db = temp_dir.path().join("security.db");
    (temp_dir, security_db)
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_policy_show_empty() {
    let (_temp_dir, security_db) = create_temp_db_dir();

    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);

    let policy = service.get_policy("default").await.unwrap();
    assert!(policy.is_none());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_policy_set_and_get() {
    let (_temp_dir, security_db) = create_temp_db_dir();

    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);

    let policy_json = r#"{
        "ip_whitelist": ["127.0.0.1", "192.168.1.0/24"],
        "cors": {
            "allowed_origins": ["https://example.com"]
        },
        "rate_limit": {
            "rpm": 60,
            "burst": 10
        }
    }"#;

    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: policy_json.to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    service.set_policy(policy.clone()).await.unwrap();

    let retrieved = service.get_policy("default").await.unwrap();
    assert!(retrieved.is_some());
    let retrieved_policy = retrieved.unwrap();
    assert_eq!(retrieved_policy.id, "default");
    assert_eq!(retrieved_policy.policy_json, policy_json);
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_policy_set_invalid_json() {
    let (_temp_dir, security_db) = create_temp_db_dir();

    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);

    let invalid_policy_json = r#"{
        "ip_whitelist": ["invalid-ip"]
    }"#;

    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: invalid_policy_json.to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let result = service.set_policy(policy).await;
    assert!(result.is_err());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_policy_update() {
    let (_temp_dir, security_db) = create_temp_db_dir();

    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);

    let policy_json_1 = r#"{
        "ip_whitelist": ["127.0.0.1"]
    }"#;

    let policy_1 = SecurityPolicy {
        id: "default".to_string(),
        policy_json: policy_json_1.to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    service.set_policy(policy_1).await.unwrap();

    let policy_json_2 = r#"{
        "ip_whitelist": ["127.0.0.1", "192.168.1.0/24"]
    }"#;

    let policy_2 = SecurityPolicy {
        id: "default".to_string(),
        policy_json: policy_json_2.to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    service.set_policy(policy_2.clone()).await.unwrap();

    let retrieved = service.get_policy("default").await.unwrap();
    assert!(retrieved.is_some());
    let retrieved_policy = retrieved.unwrap();
    assert_eq!(retrieved_policy.policy_json, policy_json_2);
}

