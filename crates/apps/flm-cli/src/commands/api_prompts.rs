//! `flm api prompts` command implementation

use crate::adapters::{ApiPromptRecord, ApiPromptStore};
use crate::cli::api_prompts::ApiPromptsSubcommand;
use crate::commands::CliUserError;
use crate::utils::get_config_db_path;
use serde_json::json;
use std::path::PathBuf;
use tokio::fs;

pub async fn execute(
    subcommand: ApiPromptsSubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);

    let store = ApiPromptStore::new(&db_path).await?;

    match subcommand {
        ApiPromptsSubcommand::List => {
            let prompts = store.list().await?;
            render_list(&prompts, &format)?;
        }
        ApiPromptsSubcommand::Show { api_id } => {
            let prompt = store
                .get(&api_id)
                .await?
                .ok_or_else(|| CliUserError::new(format!("Prompt '{api_id}' not found")))?;
            render_single(&prompt, &format)?;
        }
        ApiPromptsSubcommand::Set { api_id, file } => {
            let prompt_text = read_prompt_file(&file).await?;
            let record = store.set(&api_id, &prompt_text).await?;
            render_single(&record, &format)?;
        }
        ApiPromptsSubcommand::Delete { api_id } => {
            let deleted = store.delete(&api_id).await?;
            if !deleted {
                return Err(Box::new(CliUserError::new(format!(
                    "Prompt '{api_id}' not found"
                ))));
            }
            if format == "json" {
                let output = json!({
                    "version": "1.0",
                    "data": {
                        "status": "deleted",
                        "api_id": api_id
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else {
                println!("Deleted prompt '{api_id}'");
            }
        }
    }

    Ok(())
}

async fn read_prompt_file(path: &str) -> Result<String, Box<dyn std::error::Error>> {
    let file_path = PathBuf::from(path);
    if !file_path.exists() {
        return Err(Box::new(CliUserError::new(format!(
            "Prompt file not found: {}",
            file_path.display()
        ))));
    }

    let contents = fs::read_to_string(&file_path).await.map_err(|e| {
        CliUserError::new(format!(
            "Failed to read prompt file {}: {e}",
            file_path.display()
        ))
    })?;

    if contents.trim().is_empty() {
        return Err(Box::new(CliUserError::new(
            "Prompt file cannot be empty".to_string(),
        )));
    }

    Ok(contents)
}

fn render_list(
    prompts: &[ApiPromptRecord],
    format: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "prompts": prompts
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
        return Ok(());
    }

    if prompts.is_empty() {
        println!("No API prompts configured.");
        return Ok(());
    }

    for prompt in prompts {
        println!("API ID: {}", prompt.api_id);
        println!("  Version: {}", prompt.version);
        println!("  Updated: {}", prompt.updated_at);
        println!("  Template:\n{}\n", prompt.template_text);
    }

    Ok(())
}

fn render_single(prompt: &ApiPromptRecord, format: &str) -> Result<(), Box<dyn std::error::Error>> {
    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "prompt": prompt
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("API ID: {}", prompt.api_id);
        println!("Version: {}", prompt.version);
        println!("Updated: {}", prompt.updated_at);
        println!("Template:\n{}", prompt.template_text);
    }
    Ok(())
}
