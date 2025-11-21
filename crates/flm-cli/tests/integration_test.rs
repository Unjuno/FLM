//! Integration tests for flm-cli
//!
//! These tests verify that CLI commands work correctly with actual database operations.

use flm_cli::adapters::{SqliteConfigRepository, SqliteSecurityRepository};
use flm_core::services::{ConfigService, SecurityService};
use std::path::PathBuf;
use tempfile::TempDir;

/// Helper to create a temporary database directory
fn create_temp_db_dir() -> (TempDir, PathBuf, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");
    let security_db = temp_dir.path().join("security.db");
    (temp_dir, config_db, security_db)
}

#[tokio::test]
async fn test_config_service_integration() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();

    // Create repository and service (migrations run automatically in new())
    let repo = SqliteConfigRepository::new(&config_db).await.unwrap();
    let service = ConfigService::new(repo);

    // Test set
    service.set("test_key", "test_value").unwrap();

    // Test get
    let value = service.get("test_key").unwrap();
    assert_eq!(value, Some("test_value".to_string()));

    // Test list
    let items = service.list().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].0, "test_key");
    assert_eq!(items[0].1, "test_value");
}

#[tokio::test]
async fn test_security_service_integration() {
    let (_temp_dir, _config_db, security_db) = create_temp_db_dir();

    // Create repository and service (migrations run automatically in new())
    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);

    // Test create API key
    let result = service.create_api_key("test_key").unwrap();
    assert!(!result.plain.is_empty());
    assert!(!result.record.hash.is_empty());
    assert_eq!(result.record.label, "test_key");

    // Test list API keys
    let keys = service.list_api_keys().unwrap();
    assert_eq!(keys.len(), 1);
    assert_eq!(keys[0].id, result.record.id);
    assert_eq!(keys[0].label, "test_key");

    // Test revoke API key
    service.revoke_api_key(&result.record.id).unwrap();

    // Verify it's revoked
    let keys_after_revoke = service.list_api_keys().unwrap();
    assert_eq!(keys_after_revoke.len(), 1);
    assert!(
        keys_after_revoke[0].revoked_at.is_some(),
        "Key should be revoked"
    );
}

#[tokio::test]
async fn test_security_service_rotate() {
    let (_temp_dir, _config_db, security_db) = create_temp_db_dir();

    // Create repository and service (migrations run automatically in new())
    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);

    // Create initial key
    let initial = service.create_api_key("original").unwrap();
    let initial_id = initial.record.id.clone();

    // Rotate the key
    let rotated = service.rotate_api_key(&initial_id, None).unwrap();

    // Verify new key is different
    assert_ne!(rotated.record.id, initial_id);
    assert_eq!(rotated.record.label, "original");

    // Verify old key is revoked and new key exists
    let all_keys = service.list_api_keys().unwrap();
    assert_eq!(
        all_keys.len(),
        2,
        "Should have both old (revoked) and new keys"
    );

    // Find old and new keys
    let old_key_meta = all_keys.iter().find(|k| k.id == initial_id).unwrap();
    let new_key_meta = all_keys.iter().find(|k| k.id == rotated.record.id).unwrap();

    // Verify old key is revoked
    assert!(
        old_key_meta.revoked_at.is_some(),
        "Old key should be revoked"
    );

    // Verify new key is not revoked
    assert!(
        new_key_meta.revoked_at.is_none(),
        "New key should not be revoked"
    );
}
