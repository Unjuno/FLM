//! Tests for engines CLI commands

use flm_cli::cli::engines::EnginesSubcommand;
use flm_cli::commands::{engines, CliUserError};
use std::path::PathBuf;
use tempfile::TempDir;

fn create_temp_db() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");
    (temp_dir, config_db)
}

#[tokio::test(flavor = "multi_thread")]
async fn test_engines_detect_invalid_engine() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test engines detect with invalid engine name
    let subcommand = EnginesSubcommand::Detect {
        engine: Some("invalid-engine".to_string()),
        fresh: false,
    };

    // This should fail with exit code 1, but we can't easily test exit codes in unit tests
    // Instead, we'll test that the command returns an error or exits
    // Note: The current implementation uses std::process::exit(1), which makes it hard to test
    // For now, we'll just verify the command structure is correct
    let result = engines::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    let err = result.expect_err("Invalid engine should return an error");
    let user_err = err
        .downcast::<CliUserError>()
        .expect("Error should be classified as a user error");
    let message = user_err
        .message()
        .expect("User error should provide a message");
    assert!(
        message.contains("Unknown engine: invalid-engine"),
        "Unexpected error message: {message}"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_engines_detect_all() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test engines detect without specifying an engine (detect all)
    let subcommand = EnginesSubcommand::Detect {
        engine: None,
        fresh: false,
    };

    let result = engines::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should succeed even if no engines are detected
    assert!(
        result.is_ok(),
        "Engines detect should succeed: {:?}",
        result.err()
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_engines_detect_specific_engine() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test engines detect with a specific engine (ollama)
    let subcommand = EnginesSubcommand::Detect {
        engine: Some("ollama".to_string()),
        fresh: false,
    };

    let result = engines::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should succeed even if Ollama is not installed
    assert!(
        result.is_ok(),
        "Engines detect should succeed: {:?}",
        result.err()
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_engines_detect_text_format() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test engines detect with text format
    let subcommand = EnginesSubcommand::Detect {
        engine: None,
        fresh: false,
    };

    let result = engines::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "text".to_string(),
    )
    .await;

    assert!(
        result.is_ok(),
        "Engines detect with text format should succeed: {:?}",
        result.err()
    );
}
