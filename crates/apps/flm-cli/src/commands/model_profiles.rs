//! `flm model-profiles` command implementation

use crate::adapters::{ModelProfileRecord, ModelProfileStore};
use crate::cli::model_profiles::{ModelProfileSaveArgs, ModelProfilesSubcommand};
use crate::commands::CliUserError;
use crate::utils::get_config_db_path;
use flm_core::error::RepoError;
use serde_json::json;
use std::path::PathBuf;
use tokio::fs;

pub async fn execute(
    subcommand: ModelProfilesSubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);

    let store = ModelProfileStore::new(&db_path).await?;

    match subcommand {
        ModelProfilesSubcommand::List { engine, model } => {
            let profiles = store.list(engine.as_deref(), model.as_deref()).await?;
            render_list(&profiles, &format)?;
        }
        ModelProfilesSubcommand::Save(args) => {
            let profile = save_profile(&store, args).await?;
            render_single(&profile, &format)?;
        }
        ModelProfilesSubcommand::Delete { id } => {
            let deleted = store.delete(&id).await?;
            if !deleted {
                return Err(Box::new(CliUserError::new(format!(
                    "Profile '{id}' not found"
                ))));
            }
            if format == "json" {
                let output = json!({
                    "version": "1.0",
                    "data": {
                        "deleted": true,
                        "id": id
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else {
                println!("Deleted profile {id}");
            }
        }
    }

    Ok(())
}

async fn save_profile(
    store: &ModelProfileStore,
    args: ModelProfileSaveArgs,
) -> Result<ModelProfileRecord, Box<dyn std::error::Error>> {
    let params_path = PathBuf::from(&args.params);
    if !params_path.exists() {
        return Err(Box::new(CliUserError::new(format!(
            "Params file not found: {}",
            params_path.display()
        ))));
    }

    let contents = fs::read_to_string(&params_path).await.map_err(|e| {
        CliUserError::new(format!(
            "Failed to read params file {}: {e}",
            params_path.display()
        ))
    })?;

    let parsed: serde_json::Value = serde_json::from_str(&contents).map_err(|e| {
        CliUserError::new(format!(
            "Params file must be valid JSON ({}): {e}",
            params_path.display()
        ))
    })?;

    let normalized_model = normalize_model_id(&args.model, &args.engine);

    let record = store
        .save(&args.engine, &normalized_model, &args.label, &parsed)
        .await
        .map_err(map_repo_err)?;

    Ok(record)
}

fn normalize_model_id(model: &str, engine: &str) -> String {
    if model.starts_with("flm://") {
        model.to_string()
    } else {
        format!("flm://{engine}/{model}")
    }
}

fn render_list(
    profiles: &[ModelProfileRecord],
    format: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "profiles": profiles
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
        return Ok(());
    }

    if profiles.is_empty() {
        println!("No model profiles found.");
        return Ok(());
    }

    for profile in profiles {
        println!("ID: {}", profile.id);
        println!("  Engine: {}", profile.engine_id);
        println!("  Model: {}", profile.model_id);
        println!("  Label: {}", profile.label);
        println!("  Version: {}", profile.version);
        println!("  Updated: {}", profile.updated_at);
        println!(
            "  Parameters: {}",
            serde_json::to_string_pretty(&profile.parameters)?
        );
    }

    Ok(())
}

fn render_single(
    profile: &ModelProfileRecord,
    format: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "profile": profile
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("Saved profile {}", profile.id);
        println!("  Engine: {}", profile.engine_id);
        println!("  Model: {}", profile.model_id);
        println!("  Label: {}", profile.label);
        println!("  Version: {}", profile.version);
        println!(
            "  Parameters: {}",
            serde_json::to_string_pretty(&profile.parameters)?
        );
    }

    Ok(())
}

fn map_repo_err(err: RepoError) -> Box<dyn std::error::Error> {
    match err {
        RepoError::IoError { reason } => Box::new(CliUserError::new(reason)),
        other => Box::new(other),
    }
}
