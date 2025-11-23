//! API keys command implementation

use crate::adapters::SqliteSecurityRepository;
use crate::cli::api_keys::ApiKeysSubcommand;
use crate::utils::get_security_db_path;
use flm_core::services::SecurityService;
use serde_json::json;
use std::path::PathBuf;

/// Execute api-keys create command
pub async fn execute_create(
    label: String,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    let result = service.create_api_key(&label).await?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "id": result.record.id,
                "label": result.record.label,
                "plain_key": result.plain,
                "created_at": result.record.created_at
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("API Key created:");
        println!("  ID: {}", result.record.id);
        println!("  Label: {}", result.record.label);
        println!("  Plain Key: {}", result.plain);
        println!("\n⚠️  WARNING: This key will only be shown once. Save it securely!");
    }

    Ok(())
}

/// Execute api-keys list command
pub async fn execute_list(
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    let keys = service.list_api_keys().await?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "api_keys": keys
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else if keys.is_empty() {
        println!("No API keys found");
    } else {
        println!("API Keys:");
        for key in keys {
            println!("  {} - {} (created: {})", key.id, key.label, key.created_at);
        }
    }

    Ok(())
}

/// Execute api-keys revoke command
pub async fn execute_revoke(
    id: String,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    service.revoke_api_key(&id).await?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "id": id,
                "revoked": true
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("API key '{id}' revoked");
    }

    Ok(())
}

/// Execute api-keys rotate command
pub async fn execute_rotate(
    id: String,
    label: Option<String>,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    let result = service.rotate_api_key(&id, label.as_deref()).await?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "id": result.record.id,
                "label": result.record.label,
                "plain_key": result.plain,
                "created_at": result.record.created_at,
                "old_key_id": id
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("API Key rotated:");
        println!("  ID: {}", result.record.id);
        println!("  Label: {}", result.record.label);
        println!("  Plain Key: {}", result.plain);
        println!("\n⚠️  WARNING: This key will only be shown once. Save it securely!");
        println!("⚠️  The old key '{id}' has been revoked.");
    }

    Ok(())
}

/// Execute api-keys command
pub async fn execute(
    subcommand: ApiKeysSubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        ApiKeysSubcommand::Create { label } => execute_create(label, db_path, format).await,
        ApiKeysSubcommand::List => execute_list(db_path, format).await,
        ApiKeysSubcommand::Revoke { id } => execute_revoke(id, db_path, format).await,
        ApiKeysSubcommand::Rotate { id, label } => execute_rotate(id, label, db_path, format).await,
    }
}
