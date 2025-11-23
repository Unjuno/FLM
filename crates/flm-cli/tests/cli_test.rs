//! CLI command tests
//!
//! These tests verify that CLI commands work correctly end-to-end by executing
//! the actual CLI binary and checking the output.

use serde_json::Value;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread;
use std::time::Duration;
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
    use std::env;

    // Prefer Cargo-provided binary path if available
    if let Some(bin_path) = env::var_os("CARGO_BIN_EXE_flm") {
        return PathBuf::from(bin_path);
    }

    let target_dir = env::var_os("CARGO_TARGET_DIR")
        .map(PathBuf::from)
        .or_else(|| {
            let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            manifest_dir.ancestors().find_map(|ancestor| {
                let candidate = ancestor.join("target");
                candidate.exists().then_some(candidate)
            })
        })
        .unwrap_or_else(|| PathBuf::from("target"));

    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    let binary_name = if cfg!(windows) { "flm.exe" } else { "flm" };
    target_dir.join(profile).join(binary_name)
}

fn start_mock_ollama_server() -> (Arc<AtomicBool>, thread::JoinHandle<()>, u16) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock server");
    let port = listener.local_addr().unwrap().port();
    listener
        .set_nonblocking(true)
        .expect("set mock server non-blocking");

    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();
    let handle = thread::spawn(move || {
        while running_clone.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((mut stream, _addr)) => {
                    let mut buf = [0u8; 1024];
                    let _ = stream.read(&mut buf);
                    let body = r#"{"models":[{"name":"test-model"}]}"#;
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = stream.write_all(response.as_bytes());
                }
                Err(ref err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(10));
                }
                Err(_) => break,
            }
        }
    });

    (running, handle, port)
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

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm config set should succeed. stderr: {stderr}",
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

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm config get should succeed. stderr: {stderr}",
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

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm config list should succeed. stderr: {stderr}",
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("key1 = value1") && stdout.contains("key2 = value2"),
        "List output should contain both keys. Got: {stdout}",
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

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm api-keys create should succeed. stderr: {stderr}",
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("API Key created"),
        "Output should indicate key creation. Got: {stdout}",
    );
    assert!(
        stdout.contains("test_key"),
        "Output should contain label. Got: {stdout}",
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

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm api-keys list should succeed. stderr: {stderr}",
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("test_key"),
        "List output should contain the key. Got: {stdout}",
    );
}

#[test]
fn test_api_keys_revoke() {
    let (_temp_dir, _config_db, security_db) = create_temp_db_dir();
    let binary = get_flm_binary();

    // Create an API key first
    let create_output = Command::new(&binary)
        .args([
            "api-keys",
            "create",
            "--label",
            "test_key_to_revoke",
            "--db-path-security",
            security_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm api-keys create");

    let stderr = String::from_utf8_lossy(&create_output.stderr);
    assert!(
        create_output.status.success(),
        "flm api-keys create should succeed. stderr: {stderr}",
    );

    // Extract the key ID from the output
    let create_stdout = String::from_utf8_lossy(&create_output.stdout);
    let key_id = create_stdout
        .lines()
        .find_map(|line| {
            if line.contains("ID:") {
                line.split("ID:").nth(1).map(|s| s.trim().to_string())
            } else {
                None
            }
        })
        .expect("Should find key ID in create output");

    // Test api-keys revoke
    let output = Command::new(&binary)
        .args([
            "api-keys",
            "revoke",
            &key_id,
            "--db-path-security",
            security_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm api-keys revoke");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm api-keys revoke should succeed. stderr: {stderr}",
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains(&key_id),
        "Output should contain the revoked key ID. Got: {stdout}",
    );
    assert!(
        stdout.contains("revoked"),
        "Output should indicate revocation. Got: {stdout}",
    );

    // Verify the key is still in the list but marked as revoked
    let list_output = Command::new(&binary)
        .args([
            "api-keys",
            "list",
            "--db-path-security",
            security_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm api-keys list");

    assert!(
        list_output.status.success(),
        "flm api-keys list should succeed after revoke"
    );

    let list_stdout = String::from_utf8_lossy(&list_output.stdout);
    assert!(
        list_stdout.contains(&key_id),
        "Revoked key should still appear in list. Got: {list_stdout}",
    );
}

#[test]
fn test_api_keys_rotate() {
    let (_temp_dir, _config_db, security_db) = create_temp_db_dir();
    let binary = get_flm_binary();

    // Create an API key first
    let create_output = Command::new(&binary)
        .args([
            "api-keys",
            "create",
            "--label",
            "original_key",
            "--db-path-security",
            security_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm api-keys create");

    let stderr = String::from_utf8_lossy(&create_output.stderr);
    assert!(
        create_output.status.success(),
        "flm api-keys create should succeed. stderr: {stderr}",
    );

    // Extract the key ID from the output
    let create_stdout = String::from_utf8_lossy(&create_output.stdout);
    let original_key_id = create_stdout
        .lines()
        .find_map(|line| {
            if line.contains("ID:") {
                line.split("ID:").nth(1).map(|s| s.trim().to_string())
            } else {
                None
            }
        })
        .expect("Should find key ID in create output");

    // Test api-keys rotate
    let output = Command::new(&binary)
        .args([
            "api-keys",
            "rotate",
            &original_key_id,
            "--db-path-security",
            security_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm api-keys rotate");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm api-keys rotate should succeed. stderr: {stderr}",
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("API Key rotated") || stdout.contains("rotated"),
        "Output should indicate rotation. Got: {stdout}",
    );
    assert!(
        stdout.contains(&original_key_id),
        "Output should mention the old key ID. Got: {stdout}",
    );
    assert!(
        stdout.contains("revoked"),
        "Output should indicate old key is revoked. Got: {stdout}",
    );

    // Extract the new key ID from the output
    let new_key_id = stdout
        .lines()
        .find_map(|line| {
            if line.contains("ID:") {
                line.split("ID:").nth(1).map(|s| s.trim().to_string())
            } else {
                None
            }
        })
        .expect("Should find new key ID in rotate output");

    assert_ne!(
        new_key_id, original_key_id,
        "New key ID should be different from original"
    );

    // Verify both keys are in the list
    let list_output = Command::new(&binary)
        .args([
            "api-keys",
            "list",
            "--db-path-security",
            security_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm api-keys list");

    assert!(
        list_output.status.success(),
        "flm api-keys list should succeed after rotate"
    );

    let list_stdout = String::from_utf8_lossy(&list_output.stdout);
    assert!(
        list_stdout.contains(&original_key_id),
        "Old key should still appear in list. Got: {list_stdout}",
    );
    assert!(
        list_stdout.contains(&new_key_id),
        "New key should appear in list. Got: {list_stdout}",
    );
}

#[test]
fn test_engines_detect() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();
    let binary = get_flm_binary();

    // Test engines detect
    let output = Command::new(&binary)
        .args([
            "engines",
            "detect",
            "--db-path-config",
            config_db.to_str().unwrap(),
            "--format",
            "json",
        ])
        .output()
        .expect("Failed to execute flm engines detect");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm engines detect should succeed. stderr: {stderr}",
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Verify JSON output structure
    assert!(
        stdout.contains("\"version\""),
        "Output should contain version field. Got: {stdout}",
    );
    assert!(
        stdout.contains("\"data\""),
        "Output should contain data field. Got: {stdout}",
    );
    assert!(
        stdout.contains("\"engines\""),
        "Output should contain engines field. Got: {stdout}",
    );
}

#[test]
fn test_engines_detect_text_format() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();
    let binary = get_flm_binary();

    // Test engines detect with text format
    let output = Command::new(&binary)
        .args([
            "engines",
            "detect",
            "--db-path-config",
            config_db.to_str().unwrap(),
            "--format",
            "text",
        ])
        .output()
        .expect("Failed to execute flm engines detect");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm engines detect should succeed. stderr: {stderr}",
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Text format should be human-readable
    // Even if no engines are detected, it should output something
    assert!(
        !stdout.is_empty(),
        "Output should not be empty. Got: {stdout}",
    );
}

#[test]
fn test_engines_detect_specific_engine() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();
    let binary = get_flm_binary();

    // Test engines detect with specific engine filter
    let output = Command::new(&binary)
        .args([
            "engines",
            "detect",
            "--engine",
            "ollama",
            "--db-path-config",
            config_db.to_str().unwrap(),
            "--format",
            "json",
        ])
        .output()
        .expect("Failed to execute flm engines detect");

    // Should succeed even if Ollama is not installed
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm engines detect should succeed even if engine not found. stderr: {stderr}",
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Verify JSON output structure
    assert!(
        stdout.contains("\"engines\""),
        "Output should contain engines field. Got: {stdout}",
    );
}

#[test]
fn test_engines_detect_invalid_engine() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();
    let binary = get_flm_binary();

    // Test engines detect with invalid engine name
    let output = Command::new(&binary)
        .args([
            "engines",
            "detect",
            "--engine",
            "invalid-engine",
            "--db-path-config",
            config_db.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to execute flm engines detect");

    // Should fail with error message
    assert!(
        !output.status.success(),
        "flm engines detect should fail for invalid engine name"
    );

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("Unknown engine") || stderr.contains("invalid-engine"),
        "Error message should mention unknown engine. Got: {stderr}",
    );
}

#[test]
fn test_models_list() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();
    let binary = get_flm_binary();
    let (running, server_handle, port) = start_mock_ollama_server();
    let base_url = format!("http://127.0.0.1:{port}");

    let detect_output = Command::new(&binary)
        .args([
            "engines",
            "detect",
            "--db-path-config",
            config_db.to_str().unwrap(),
            "--format",
            "json",
        ])
        .env("OLLAMA_BASE_URL", &base_url)
        .output()
        .expect("Failed to execute flm engines detect");
    let stderr = String::from_utf8_lossy(&detect_output.stderr);
    assert!(
        detect_output.status.success(),
        "Engine detection should succeed against mock server. stderr: {stderr}",
    );

    let output = Command::new(&binary)
        .args([
            "models",
            "list",
            "--engine",
            "ollama-default",
            "--db-path-config",
            config_db.to_str().unwrap(),
            "--format",
            "json",
        ])
        .env("OLLAMA_BASE_URL", &base_url)
        .output()
        .expect("Failed to execute flm models list");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "flm models list should succeed. stderr: {stderr}",
    );

    let parsed: Value = serde_json::from_str(stdout.trim()).expect("models list output JSON");
    assert_eq!(parsed["data"]["engine_id"], "ollama-default");
    assert!(
        parsed["data"]["models"]
            .as_array()
            .map(|arr| !arr.is_empty())
            .unwrap_or(false),
        "Expected at least one model entry. Output: {parsed:?}",
    );

    running.store(false, Ordering::SeqCst);
    server_handle.join().expect("join mock server");
}
