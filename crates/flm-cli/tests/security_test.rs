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
    assert!(
        policy.is_some(),
        "Default policy should exist after migrations run"
    );
    let policy = policy.unwrap();
    assert_eq!(policy.id, "default");
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
async fn test_security_policy_acme_domain_validation() {
    let (_temp_dir, security_db) = create_temp_db_dir();

    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);

    // Test valid domain
    let valid_policy_json = r#"{
        "acme_domain": "example.com"
    }"#;

    let valid_policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: valid_policy_json.to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let result = service.set_policy(valid_policy).await;
    assert!(result.is_ok(), "Valid domain should be accepted");

    // Test invalid domain (no TLD)
    let invalid_policy_json = r#"{
        "acme_domain": "invalid"
    }"#;

    let invalid_policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: invalid_policy_json.to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let result = service.set_policy(invalid_policy).await;
    assert!(
        result.is_err(),
        "Invalid domain (no TLD) should be rejected"
    );

    // Test invalid domain (starts with hyphen)
    let invalid_policy_json2 = r#"{
        "acme_domain": "-example.com"
    }"#;

    let invalid_policy2 = SecurityPolicy {
        id: "default".to_string(),
        policy_json: invalid_policy_json2.to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let result = service.set_policy(invalid_policy2).await;
    assert!(
        result.is_err(),
        "Invalid domain (starts with hyphen) should be rejected"
    );

    // Test valid subdomain
    let valid_subdomain_json = r#"{
        "acme_domain": "api.example.com"
    }"#;

    let valid_subdomain_policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: valid_subdomain_json.to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let result = service.set_policy(valid_subdomain_policy).await;
    assert!(result.is_ok(), "Valid subdomain should be accepted");
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

#[tokio::test(flavor = "multi_thread")]
async fn test_security_policy_file_not_found() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    // Test policy set with non-existent file
    let subcommand = SecuritySubcommand::Policy {
        subcommand: flm_cli::cli::security::PolicySubcommand::Set {
            json: None,
            file: Some("/nonexistent/path/to/policy.json".to_string()),
        },
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should fail because file doesn't exist
    assert!(
        result.is_err(),
        "Policy set with non-existent file should fail"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_policy_invalid_json_string() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    // Test policy set with invalid JSON string
    let subcommand = SecuritySubcommand::Policy {
        subcommand: flm_cli::cli::security::PolicySubcommand::Set {
            json: Some("{ invalid json }".to_string()),
            file: None,
        },
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should fail because JSON is invalid
    assert!(result.is_err(), "Policy set with invalid JSON should fail");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_ip_blocklist_list_empty() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    let subcommand = SecuritySubcommand::IpBlocklist {
        subcommand: flm_cli::cli::security::IpBlocklistSubcommand::List,
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        result.is_ok(),
        "IP blocklist list should succeed even when empty"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_ip_blocklist_unblock() {
    use flm_cli::adapters::SqliteSecurityRepository;
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    // First, add an IP to the blocklist using direct SQL
    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO ip_blocklist (ip, failure_count, first_failure_at, blocked_until, permanent_block, last_attempt, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    )
    .bind("127.0.0.1")
    .bind(5i64)
    .bind(&now)
    .bind(Some(&now))
    .bind(0i64)
    .bind(&now)
    .execute(repo.pool())
    .await
    .unwrap();

    // Then unblock it
    let subcommand = SecuritySubcommand::IpBlocklist {
        subcommand: flm_cli::cli::security::IpBlocklistSubcommand::Unblock {
            ip: "127.0.0.1".to_string(),
        },
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "IP blocklist unblock should succeed");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_ip_blocklist_unblock_invalid_ip() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    let subcommand = SecuritySubcommand::IpBlocklist {
        subcommand: flm_cli::cli::security::IpBlocklistSubcommand::Unblock {
            ip: "invalid-ip".to_string(),
        },
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        result.is_err(),
        "IP blocklist unblock with invalid IP should fail"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_ip_blocklist_clear() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    let subcommand = SecuritySubcommand::IpBlocklist {
        subcommand: flm_cli::cli::security::IpBlocklistSubcommand::Clear,
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "IP blocklist clear should succeed");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_audit_logs_list() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    let subcommand = SecuritySubcommand::AuditLogs {
        event_type: None,
        severity: None,
        ip: None,
        limit: 10,
        offset: 0,
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "Audit logs list should succeed");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_audit_logs_with_filters() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    let subcommand = SecuritySubcommand::AuditLogs {
        event_type: Some("auth_failure".to_string()),
        severity: Some("high".to_string()),
        ip: Some("127.0.0.1".to_string()),
        limit: 20,
        offset: 0,
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        result.is_ok(),
        "Audit logs list with filters should succeed"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_intrusion_list() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    let subcommand = SecuritySubcommand::Intrusion {
        ip: None,
        min_score: None,
        limit: 10,
        offset: 0,
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "Intrusion list should succeed");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_intrusion_with_filters() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    let subcommand = SecuritySubcommand::Intrusion {
        ip: Some("127.0.0.1".to_string()),
        min_score: Some(50),
        limit: 20,
        offset: 0,
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "Intrusion list with filters should succeed");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_anomaly_list() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    let subcommand = SecuritySubcommand::Anomaly {
        ip: None,
        anomaly_type: None,
        limit: 10,
        offset: 0,
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "Anomaly list should succeed");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_anomaly_with_filters() {
    use flm_cli::cli::security::SecuritySubcommand;
    use flm_cli::commands::security;

    let (_temp_dir, security_db) = create_temp_db_dir();

    let subcommand = SecuritySubcommand::Anomaly {
        ip: Some("127.0.0.1".to_string()),
        anomaly_type: Some("high_request_rate_1s".to_string()),
        limit: 20,
        offset: 0,
    };

    let result = security::execute(
        subcommand,
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok(), "Anomaly list with filters should succeed");
}
