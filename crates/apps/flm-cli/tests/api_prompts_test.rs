//! Tests for `flm api prompts`

use flm_cli::adapters::ApiPromptStore;
use flm_cli::cli::api_prompts::ApiPromptsSubcommand;
use flm_cli::commands::api_prompts;
use tempfile::TempDir;

fn create_temp_db() -> (TempDir, String) {
    let temp_dir = tempfile::tempdir().unwrap();
    let db_path = temp_dir.path().join("config.db");
    (temp_dir, db_path.to_str().unwrap().to_string())
}

fn write_prompt(dir: &TempDir, name: &str, text: &str) -> String {
    let path = dir.path().join(name);
    std::fs::write(&path, text).unwrap();
    path.to_str().unwrap().to_string()
}

#[tokio::test(flavor = "multi_thread")]
async fn test_api_prompts_set_and_show() {
    let (temp_dir, db_path) = create_temp_db();
    let prompt_path = write_prompt(&temp_dir, "prompt.txt", "You are a helpful assistant.");

    api_prompts::execute(
        ApiPromptsSubcommand::Set {
            api_id: "chat_completions".to_string(),
            file: prompt_path,
        },
        Some(db_path.clone()),
        "json".to_string(),
    )
    .await
    .expect("set prompt");

    let store = ApiPromptStore::new(&db_path).await.expect("open store");
    let prompt = store
        .get("chat_completions")
        .await
        .expect("query prompt")
        .expect("prompt exists");
    assert_eq!(prompt.version, 1);
    assert_eq!(prompt.template_text.trim(), "You are a helpful assistant.");

    api_prompts::execute(
        ApiPromptsSubcommand::Show {
            api_id: "chat_completions".to_string(),
        },
        Some(db_path.clone()),
        "json".to_string(),
    )
    .await
    .expect("show prompt");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_api_prompts_list_after_update() {
    let (temp_dir, db_path) = create_temp_db();
    let prompt_path = write_prompt(&temp_dir, "prompt.txt", "First version");

    api_prompts::execute(
        ApiPromptsSubcommand::Set {
            api_id: "embeddings".to_string(),
            file: prompt_path.clone(),
        },
        Some(db_path.clone()),
        "json".to_string(),
    )
    .await
    .expect("set prompt");

    let prompt_path_updated = write_prompt(&temp_dir, "prompt.txt", "Second version");
    api_prompts::execute(
        ApiPromptsSubcommand::Set {
            api_id: "embeddings".to_string(),
            file: prompt_path_updated,
        },
        Some(db_path.clone()),
        "json".to_string(),
    )
    .await
    .expect("update prompt");

    let store = ApiPromptStore::new(&db_path).await.expect("open store");
    let prompts = store.list().await.expect("list prompts");
    assert_eq!(prompts.len(), 1);
    assert_eq!(prompts[0].version, 2);
    assert_eq!(prompts[0].template_text.trim(), "Second version");

    api_prompts::execute(
        ApiPromptsSubcommand::List,
        Some(db_path.clone()),
        "text".to_string(),
    )
    .await
    .expect("list prompts");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_api_prompts_empty_file() {
    let (temp_dir, db_path) = create_temp_db();
    let prompt_path = write_prompt(&temp_dir, "empty.txt", "");

    let result = api_prompts::execute(
        ApiPromptsSubcommand::Set {
            api_id: "test".to_string(),
            file: prompt_path,
        },
        Some(db_path),
        "json".to_string(),
    )
    .await;

    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("empty") || error_msg.contains("Empty"));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_api_prompts_missing_file() {
    let (_temp_dir, db_path) = create_temp_db();
    let result = api_prompts::execute(
        ApiPromptsSubcommand::Set {
            api_id: "test".to_string(),
            file: "/nonexistent/prompt.txt".to_string(),
        },
        Some(db_path),
        "json".to_string(),
    )
    .await;

    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("not found") || error_msg.contains("No such file"));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_api_prompts_show_nonexistent() {
    let (_temp_dir, db_path) = create_temp_db();
    let result = api_prompts::execute(
        ApiPromptsSubcommand::Show {
            api_id: "nonexistent".to_string(),
        },
        Some(db_path),
        "json".to_string(),
    )
    .await;

    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("not found") || error_msg.contains("Prompt"));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_api_prompts_delete() {
    let (temp_dir, db_path) = create_temp_db();
    let prompt_path = write_prompt(&temp_dir, "prompt.txt", "Prompt A");

    api_prompts::execute(
        ApiPromptsSubcommand::Set {
            api_id: "delete_me".to_string(),
            file: prompt_path,
        },
        Some(db_path.clone()),
        "json".to_string(),
    )
    .await
    .expect("set prompt");

    api_prompts::execute(
        ApiPromptsSubcommand::Delete {
            api_id: "delete_me".to_string(),
        },
        Some(db_path.clone()),
        "text".to_string(),
    )
    .await
    .expect("delete prompt");

    let store = ApiPromptStore::new(&db_path).await.expect("open store");
    let prompt = store.get("delete_me").await.expect("query");
    assert!(prompt.is_none());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_api_prompts_delete_missing() {
    let (_temp_dir, db_path) = create_temp_db();
    let result = api_prompts::execute(
        ApiPromptsSubcommand::Delete {
            api_id: "missing".to_string(),
        },
        Some(db_path),
        "json".to_string(),
    )
    .await;

    assert!(result.is_err());
    let error_msg = result.unwrap_err().to_string();
    assert!(error_msg.contains("not found"));
}
