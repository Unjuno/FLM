//! Config command implementation

use crate::adapters::SqliteConfigRepository;
use crate::cli::config::ConfigSubcommand;
use crate::utils::get_config_db_path;
use flm_core::services::ConfigService;
use serde_json::json;
use std::path::PathBuf;

/// Execute config get command
pub async fn execute_get(
    key: String,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteConfigRepository::new(&db_path).await?;
    let service = ConfigService::new(repo);

    match service.get(&key).await? {
        Some(value) => {
            if format == "json" {
                let output = json!({
                    "version": "1.0",
                    "data": {
                        "key": key,
                        "value": value
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else {
                println!("{value}");
            }
        }
        None => {
            if format == "json" {
                let output = json!({
                    "version": "1.0",
                    "data": {
                        "key": key,
                        "value": null
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output)?);
                std::process::exit(1);
            } else {
                eprintln!("Key '{key}' not found");
                std::process::exit(1);
            }
        }
    }

    Ok(())
}

/// Execute config set command
pub async fn execute_set(
    key: String,
    value: String,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteConfigRepository::new(&db_path).await?;
    let service = ConfigService::new(repo);

    service.set(&key, &value).await?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "key": key,
                "value": value
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("Set '{key}' = '{value}'");
    }

    Ok(())
}

/// Execute config list command
pub async fn execute_list(
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteConfigRepository::new(&db_path).await?;
    let service = ConfigService::new(repo);

    let items = service.list().await?;

    if format == "json" {
        let config_map: std::collections::HashMap<String, String> = items.into_iter().collect();
        let output = json!({
            "version": "1.0",
            "data": {
                "config": config_map
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else if items.is_empty() {
        println!("No configuration items found");
    } else {
        for (key, value) in items {
            println!("{key} = {value}");
        }
    }

    Ok(())
}

/// Execute config command
pub async fn execute(
    subcommand: ConfigSubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        ConfigSubcommand::Get { key } => execute_get(key, db_path, format).await,
        ConfigSubcommand::Set { key, value } => execute_set(key, value, db_path, format).await,
        ConfigSubcommand::List => execute_list(db_path, format).await,
    }
}
