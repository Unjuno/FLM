//! Integration tests for check command
//!
//! These tests verify that database integrity checks work correctly.

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

#[tokio::test(flavor = "multi_thread")]
async fn test_check_empty_databases() {
    let (_temp_dir, config_db, security_db) = create_temp_db_dir();

    // Create empty databases by initializing repositories
    let _config_repo = SqliteConfigRepository::new(&config_db).await.unwrap();
    let _security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();

    // Run check command
    let result = flm_cli::commands::check::execute(
        false,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_check_with_data() {
    let (_temp_dir, config_db, security_db) = create_temp_db_dir();

    // Initialize repositories and add some data
    let config_repo = SqliteConfigRepository::new(&config_db).await.unwrap();
    let config_service = ConfigService::new(config_repo);
    config_service.set("test_key", "test_value").await.unwrap();

    let security_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let security_service = SecurityService::new(security_repo);
    security_service.create_api_key("test-key").await.unwrap();

    // Run check command
    let result = flm_cli::commands::check::execute(
        true,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_check_nonexistent_databases() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("nonexistent_config.db");
    let security_db = temp_dir.path().join("nonexistent_security.db");

    // Run check command on non-existent databases
    let result = flm_cli::commands::check::execute(
        false,
        Some(config_db.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should succeed but with warnings
    assert!(result.is_ok());
}
