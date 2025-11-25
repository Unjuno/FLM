//! Integration tests for security backup commands
//!
//! These tests verify that backup and restore operations work correctly.

use flm_cli::adapters::SqliteSecurityRepository;
use flm_core::services::SecurityService;
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

/// Helper to create a temporary database directory
fn create_temp_db_dir() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let security_db = temp_dir.path().join("security.db");
    (temp_dir, security_db)
}

#[tokio::test(flavor = "multi_thread")]
async fn test_backup_create() {
    let (_temp_dir, security_db) = create_temp_db_dir();

    // Create a security database with some data
    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);
    service.create_api_key("test-key").await.unwrap();

    // Create backup directory
    let backup_dir = _temp_dir.path().join("backups");
    fs::create_dir_all(&backup_dir).unwrap();

    // Execute backup create
    let result = flm_cli::commands::security::execute_backup_create(
        Some(backup_dir.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok());

    // Verify backup file exists
    let backup_files: Vec<PathBuf> = fs::read_dir(&backup_dir)
        .unwrap()
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file() && path.file_name()?.to_str()?.starts_with("security.db.bak.") {
                Some(path)
            } else {
                None
            }
        })
        .collect();

    assert_eq!(backup_files.len(), 1);
    assert!(backup_files[0].exists());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_backup_restore() {
    let (temp_dir, security_db) = create_temp_db_dir();

    // Create a security database with some data
    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);
    let key_result = service.create_api_key("test-key").await.unwrap();
    let original_key_id = key_result.record.id.clone();
    drop(service); // release SQLite handle so the file can be removed on Windows

    // Create backup
    let backup_dir = temp_dir.path().join("backups");
    fs::create_dir_all(&backup_dir).unwrap();

    flm_cli::commands::security::execute_backup_create(
        Some(backup_dir.to_str().unwrap().to_string()),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await
    .unwrap();

    // Find backup file
    let backup_file = fs::read_dir(&backup_dir)
        .unwrap()
        .find_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file() && path.file_name()?.to_str()?.starts_with("security.db.bak.") {
                Some(path)
            } else {
                None
            }
        })
        .unwrap();

    // Remove original database
    fs::remove_file(&security_db).unwrap();

    // Restore from backup
    let result = flm_cli::commands::security::execute_backup_restore(
        backup_file.to_str().unwrap().to_string(),
        Some(security_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(result.is_ok());

    // Verify restored database
    let restored_repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let restored_service = SecurityService::new(restored_repo);
    let keys = restored_service.list_api_keys().await.unwrap();

    assert_eq!(keys.len(), 1);
    assert_eq!(keys[0].id, original_key_id);
}

#[tokio::test(flavor = "multi_thread")]
async fn test_backup_generation_management() {
    let (_temp_dir, security_db) = create_temp_db_dir();

    // Create a security database
    let _repo = SqliteSecurityRepository::new(&security_db).await.unwrap();

    // Create backup directory
    let backup_dir = _temp_dir.path().join("backups");
    fs::create_dir_all(&backup_dir).unwrap();

    // Create 5 backups
    for i in 0..5 {
        // Modify the database slightly to ensure different timestamps
        let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
        let service = SecurityService::new(repo);
        service
            .create_api_key(&format!("test-key-{}", i))
            .await
            .unwrap();

        flm_cli::commands::security::execute_backup_create(
            Some(backup_dir.to_str().unwrap().to_string()),
            Some(security_db.to_str().unwrap().to_string()),
            "json".to_string(),
        )
        .await
        .unwrap();

        // Small delay to ensure different timestamps
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    // Verify only 3 backups remain
    let backup_files: Vec<PathBuf> = fs::read_dir(&backup_dir)
        .unwrap()
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file() && path.file_name()?.to_str()?.starts_with("security.db.bak.") {
                Some(path)
            } else {
                None
            }
        })
        .collect();

    assert_eq!(
        backup_files.len(),
        3,
        "Should keep only 3 most recent backups"
    );
}
