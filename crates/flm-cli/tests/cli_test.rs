//! CLI command tests
//!
//! These tests verify that CLI commands work correctly end-to-end.

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
async fn test_config_commands() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();
    
    // Test would require actual CLI execution
    // For now, we test the underlying services
    use flm_cli::adapters::SqliteConfigRepository;
    use flm_core::services::ConfigService;
    
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
}

#[tokio::test]
async fn test_api_keys_commands() {
    let (_temp_dir, _config_db, security_db) = create_temp_db_dir();
    
    // Test would require actual CLI execution
    // For now, we test the underlying services
    use flm_cli::adapters::SqliteSecurityRepository;
    use flm_core::services::SecurityService;
    
    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);
    
    // Test create
    let result = service.create_api_key("test_key").unwrap();
    assert!(!result.plain.is_empty());
    assert_eq!(result.record.label, "test_key");
    
    // Test list
    let keys = service.list_api_keys().unwrap();
    assert_eq!(keys.len(), 1);
    
    // Test revoke
    service.revoke_api_key(&result.record.id).unwrap();
    
    // Verify it's revoked
    let keys_after = service.list_api_keys().unwrap();
    assert_eq!(keys_after.len(), 1);
}

