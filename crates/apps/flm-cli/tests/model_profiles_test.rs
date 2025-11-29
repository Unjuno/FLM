//! Tests for `flm model-profiles` command

use flm_cli::adapters::ModelProfileStore;
use flm_cli::cli::model_profiles::{ModelProfileSaveArgs, ModelProfilesSubcommand};
use flm_cli::commands::model_profiles;
use tempfile::TempDir;

fn create_temp_db() -> (TempDir, String) {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("config.db");
    (temp_dir, db_path.to_str().unwrap().to_string())
}

fn write_params(dir: &TempDir, filename: &str, contents: &str) -> String {
    let path = dir.path().join(filename);
    std::fs::write(&path, contents).unwrap();
    path.to_str().unwrap().to_string()
}

#[tokio::test(flavor = "multi_thread")]
async fn test_model_profiles_save_and_list() {
    let (temp_dir, db_path) = create_temp_db();
    let params_path = write_params(
        &temp_dir,
        "profile.json",
        r#"{"temperature":0.4,"max_tokens":512}"#,
    );

    let save_args = ModelProfileSaveArgs {
        engine: "ollama".to_string(),
        model: "llama3".to_string(),
        label: "default".to_string(),
        params: params_path.clone(),
    };

    model_profiles::execute(
        ModelProfilesSubcommand::Save(save_args),
        Some(db_path.clone()),
        "json".to_string(),
    )
    .await
    .expect("save command works");

    let store = ModelProfileStore::new(&db_path).await.expect("open store");
    let profiles = store.list(None, None).await.expect("list profiles");
    assert_eq!(profiles.len(), 1);
    assert_eq!(profiles[0].engine_id, "ollama");
    assert_eq!(profiles[0].model_id, "flm://ollama/llama3");
    assert_eq!(profiles[0].label, "default");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_model_profiles_update_and_delete() {
    let (temp_dir, db_path) = create_temp_db();
    let params_path = write_params(&temp_dir, "profile.json", r#"{"temperature":0.7}"#);
    let save_args = ModelProfileSaveArgs {
        engine: "vllm".to_string(),
        model: "flm://vllm/mixtral".to_string(),
        label: "prod".to_string(),
        params: params_path.clone(),
    };

    model_profiles::execute(
        ModelProfilesSubcommand::Save(save_args.clone()),
        Some(db_path.clone()),
        "json".to_string(),
    )
    .await
    .expect("initial save");

    // Update same profile with new params
    let params_path_updated = write_params(
        &temp_dir,
        "profile.json",
        r#"{"temperature":0.9,"top_p":0.8}"#,
    );
    let mut updated_args = save_args.clone();
    updated_args.params = params_path_updated;
    model_profiles::execute(
        ModelProfilesSubcommand::Save(updated_args),
        Some(db_path.clone()),
        "json".to_string(),
    )
    .await
    .expect("update save");

    let store = ModelProfileStore::new(&db_path).await.expect("open store");
    let profiles = store
        .list(Some("vllm"), Some("flm://vllm/mixtral"))
        .await
        .expect("filtered list");
    assert_eq!(profiles.len(), 1);
    assert_eq!(profiles[0].version, 2);

    // Delete
    let profile_id = profiles[0].id.clone();
    model_profiles::execute(
        ModelProfilesSubcommand::Delete {
            id: profile_id.clone(),
        },
        Some(db_path.clone()),
        "json".to_string(),
    )
    .await
    .expect("delete profile");

    let remaining = store.list(None, None).await.expect("list all");
    assert!(
        remaining.is_empty(),
        "Profile should be removed after delete command"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_model_profiles_invalid_json() {
    let (temp_dir, db_path) = create_temp_db();
    let params_path = write_params(&temp_dir, "invalid.json", r#"{"temperature":0.4,}"#);

    let save_args = ModelProfileSaveArgs {
        engine: "ollama".to_string(),
        model: "llama3".to_string(),
        label: "test".to_string(),
        params: params_path,
    };

    let result = model_profiles::execute(
        ModelProfilesSubcommand::Save(save_args),
        Some(db_path),
        "json".to_string(),
    )
    .await;

    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("JSON") || error_msg.contains("parse"));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_model_profiles_missing_file() {
    let (_temp_dir, db_path) = create_temp_db();
    let save_args = ModelProfileSaveArgs {
        engine: "ollama".to_string(),
        model: "llama3".to_string(),
        label: "test".to_string(),
        params: "/nonexistent/path.json".to_string(),
    };

    let result = model_profiles::execute(
        ModelProfilesSubcommand::Save(save_args),
        Some(db_path),
        "json".to_string(),
    )
    .await;

    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("not found") || error_msg.contains("No such file"));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_model_profiles_delete_nonexistent() {
    let (_temp_dir, db_path) = create_temp_db();
    let result = model_profiles::execute(
        ModelProfilesSubcommand::Delete {
            id: "nonexistent-id".to_string(),
        },
        Some(db_path),
        "json".to_string(),
    )
    .await;

    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("not found") || error_msg.contains("Profile"));
}
