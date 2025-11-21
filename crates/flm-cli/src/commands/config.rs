//! Config command implementation

use crate::adapters::SqliteConfigRepository;
use crate::cli::config::ConfigSubcommand;
use flm_core::services::ConfigService;
use std::path::PathBuf;

/// Get the default config.db path
fn default_config_db_path() -> PathBuf {
    // TODO: Use OS-specific config directory
    // For now, use current directory
    PathBuf::from("config.db")
}

/// Execute config get command
pub async fn execute_get(
    key: String,
    db_path: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_config_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteConfigRepository::new(&db_path).await?;
    let service = ConfigService::new(repo);

    match service.get(&key)? {
        Some(value) => {
            println!("{}", value);
        }
        None => {
            eprintln!("Key '{key}' not found");
            std::process::exit(1);
        }
    }

    Ok(())
}

/// Execute config set command
pub async fn execute_set(
    key: String,
    value: String,
    db_path: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_config_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteConfigRepository::new(&db_path).await?;
    let service = ConfigService::new(repo);

    service.set(&key, &value)?;
    println!("Set '{key}' = '{value}'");

    Ok(())
}

/// Execute config list command
pub async fn execute_list(db_path: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_config_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteConfigRepository::new(&db_path).await?;
    let service = ConfigService::new(repo);

    let items = service.list()?;

    if items.is_empty() {
        println!("No configuration items found");
    } else {
        for (key, value) in items {
            println!("{} = {}", key, value);
        }
    }

    Ok(())
}

/// Execute config command
pub async fn execute(
    subcommand: ConfigSubcommand,
    db_path: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        ConfigSubcommand::Get { key } => execute_get(key, db_path).await,
        ConfigSubcommand::Set { key, value } => execute_set(key, value, db_path).await,
        ConfigSubcommand::List => execute_list(db_path).await,
    }
}
