//! CLI command tests
//!
//! These tests verify that CLI commands work correctly end-to-end by executing
//! the actual CLI binary and checking the output.

use std::path::PathBuf;
use std::process::Command;
use tempfile::TempDir;

/// Helper to create a temporary database directory
fn create_temp_db_dir() -> (TempDir, PathBuf, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");
    let security_db = temp_dir.path().join("security.db");
    (temp_dir, config_db, security_db)
}

/// Get the path to the flm CLI binary
fn get_flm_binary() -> PathBuf {
    // In tests, the binary is built in target/debug or target/release
    let target_dir = std::env::var("CARGO_TARGET_DIR")
        .unwrap_or_else(|_| "target".to_string());
    let profile = std::env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    PathBuf::from(target_dir).join(profile).join("flm")
}

#[test]
fn test_config_set_and_get() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();
    let binary = get_flm_binary();
    
    // Test config set
    let output = Command::new(&binary)
        .args([
            "config",
            "set",
            "test_key",
            "test_value",
            "--db-path-config",
            config_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm config set");
    
    assert!(
        output.status.success(),
        "flm config set should succeed. stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    
    // Test config get
    let output = Command::new(&binary)
        .args([
            "config",
            "get",
            "test_key",
            "--db-path-config",
            config_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm config get");
    
    assert!(
        output.status.success(),
        "flm config get should succeed. stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.trim() == "test_value",
        "Expected 'test_value', got '{}'",
        stdout.trim()
    );
}

#[test]
fn test_config_list() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();
    let binary = get_flm_binary();
    
    // Set a few values
    Command::new(&binary)
        .args([
            "config",
            "set",
            "key1",
            "value1",
            "--db-path-config",
            config_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm config set");
    
    Command::new(&binary)
        .args([
            "config",
            "set",
            "key2",
            "value2",
            "--db-path-config",
            config_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm config set");
    
    // Test config list
    let output = Command::new(&binary)
        .args([
            "config",
            "list",
            "--db-path-config",
            config_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm config list");
    
    assert!(
        output.status.success(),
        "flm config list should succeed. stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("key1 = value1") && stdout.contains("key2 = value2"),
        "List output should contain both keys. Got: {}",
        stdout
    );
}

#[test]
fn test_api_keys_create_and_list() {
    let (_temp_dir, _config_db, security_db) = create_temp_db_dir();
    let binary = get_flm_binary();
    
    // Test api-keys create
    let output = Command::new(&binary)
        .args([
            "api-keys",
            "create",
            "--label",
            "test_key",
            "--db-path-security",
            security_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm api-keys create");
    
    assert!(
        output.status.success(),
        "flm api-keys create should succeed. stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("API Key created"),
        "Output should indicate key creation. Got: {}",
        stdout
    );
    assert!(
        stdout.contains("test_key"),
        "Output should contain label. Got: {}",
        stdout
    );
    
    // Test api-keys list
    let output = Command::new(&binary)
        .args([
            "api-keys",
            "list",
            "--db-path-security",
            security_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm api-keys list");
    
    assert!(
        output.status.success(),
        "flm api-keys list should succeed. stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("test_key"),
        "List output should contain the key. Got: {}",
        stdout
    );
}
