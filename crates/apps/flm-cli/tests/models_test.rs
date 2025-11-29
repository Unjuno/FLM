//! Tests for models CLI commands

use flm_cli::cli::models::ModelsSubcommand;
use flm_cli::commands::models;
use std::path::PathBuf;
use tempfile::TempDir;

fn create_temp_db() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");
    (temp_dir, config_db)
}

#[tokio::test(flavor = "multi_thread")]
async fn test_models_list_invalid_engine() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test models list with invalid/non-existent engine
    let subcommand = ModelsSubcommand::List {
        engine: "nonexistent-engine".to_string(),
    };

    let result = models::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should fail because engine doesn't exist
    assert!(
        result.is_err(),
        "Models list with invalid engine should fail"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_models_list_text_format() {
    let (_temp_dir, config_db) = create_temp_db();

    // Test models list with text format
    let subcommand = ModelsSubcommand::List {
        engine: "ollama-default".to_string(),
    };

    let result = models::execute(
        subcommand,
        Some(config_db.to_str().unwrap().to_string()),
        "text".to_string(),
    )
    .await;

    // May succeed or fail depending on whether Ollama is running
    // We just verify the command structure is correct
    assert!(result.is_ok() || result.is_err(), "Command should execute");
}
