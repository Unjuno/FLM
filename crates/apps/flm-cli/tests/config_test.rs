//! Tests for config CLI commands

use flm_cli::cli::config::ConfigSubcommand;
use flm_cli::commands::{config, CliUserError};
use std::path::PathBuf;
use tempfile::TempDir;

fn create_temp_db() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");
    (temp_dir, config_db)
}

#[tokio::test(flavor = "multi_thread")]
async fn test_config_get_nonexistent() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test config get with non-existent key (JSON format returns null but exits 1)
    let json_subcommand = ConfigSubcommand::Get {
        key: "nonexistent_key".to_string(),
    };

    let json_result = config::execute(
        json_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    let json_err = json_result.expect_err("JSON get should report an error for missing key");
    let json_user_err = json_err
        .downcast::<CliUserError>()
        .expect("Missing key should be classified as user error");
    assert!(
        json_user_err.message().is_none(),
        "JSON format should not emit additional stderr output"
    );

    // Text format should include a helpful error message
    let text_subcommand = ConfigSubcommand::Get {
        key: "nonexistent_key".to_string(),
    };

    let text_result = config::execute(
        text_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "text".to_string(),
    )
    .await;

    let text_err = text_result.expect_err("Text get should report an error for missing key");
    let text_user_err = text_err
        .downcast::<CliUserError>()
        .expect("Missing key should be classified as user error");
    assert_eq!(
        text_user_err.message(),
        Some("Key 'nonexistent_key' not found"),
        "Text format should provide a readable message"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_config_list_empty() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test config list with empty database
    let subcommand = ConfigSubcommand::List;

    let result = config::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        result.is_ok(),
        "Config list should succeed: {:?}",
        result.err()
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_config_set_and_get() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test config set
    let set_subcommand = ConfigSubcommand::Set {
        key: "test_key".to_string(),
        value: "test_value".to_string(),
    };

    let set_result = config::execute(
        set_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        set_result.is_ok(),
        "Config set should succeed: {:?}",
        set_result.err()
    );

    // Test config get
    let get_subcommand = ConfigSubcommand::Get {
        key: "test_key".to_string(),
    };

    let get_result = config::execute(
        get_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    assert!(
        get_result.is_ok(),
        "Config get should succeed: {:?}",
        get_result.err()
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_config_text_format() {
    let (_temp_dir, config_db) = create_temp_db();

    // Set a value
    let set_subcommand = ConfigSubcommand::Set {
        key: "test_key2".to_string(),
        value: "test_value2".to_string(),
    };

    let _ = config::execute(
        set_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "text".to_string(),
    )
    .await;

    // Test config list with text format
    let list_subcommand = ConfigSubcommand::List;

    let result = config::execute(
        list_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "text".to_string(),
    )
    .await;

    assert!(
        result.is_ok(),
        "Config list with text format should succeed: {:?}",
        result.err()
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_config_set_invalid_db_path() {
    // Test config set with invalid database path
    let set_subcommand = ConfigSubcommand::Set {
        key: "test_key".to_string(),
        value: "test_value".to_string(),
    };

    let result = config::execute(
        set_subcommand,
        Some("/nonexistent/path/config.db".to_string()),
        "json".to_string(),
    )
    .await;

    // Should fail with an error
    assert!(result.is_err());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_config_get_invalid_db_path() {
    // Test config get with invalid database path
    let get_subcommand = ConfigSubcommand::Get {
        key: "test_key".to_string(),
    };

    let result = config::execute(
        get_subcommand,
        Some("/nonexistent/path/config.db".to_string()),
        "json".to_string(),
    )
    .await;

    // Should fail with an error
    assert!(result.is_err());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_config_set_empty_key() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test config set with empty key
    let set_subcommand = ConfigSubcommand::Set {
        key: "".to_string(),
        value: "test_value".to_string(),
    };

    let result = config::execute(
        set_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should succeed (empty key is allowed)
    assert!(result.is_ok());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_config_set_empty_value() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test config set with empty value
    let set_subcommand = ConfigSubcommand::Set {
        key: "test_key".to_string(),
        value: "".to_string(),
    };

    let result = config::execute(
        set_subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should succeed (empty value is allowed)
    assert!(result.is_ok());
}
