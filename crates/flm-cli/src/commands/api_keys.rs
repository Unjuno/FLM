//! API keys command implementation

use crate::adapters::SqliteSecurityRepository;
use crate::cli::api_keys::ApiKeysSubcommand;
use flm_core::services::SecurityService;
use std::path::PathBuf;

/// Get the default security.db path
fn default_security_db_path() -> PathBuf {
    // TODO: Use OS-specific config directory
    // For now, use current directory
    PathBuf::from("security.db")
}

/// Execute api-keys create command
pub async fn execute_create(
    label: String,
    db_path: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_security_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    let result = service.create_api_key(&label)?;
    println!("API Key created:");
    println!("  ID: {}", result.record.id);
    println!("  Label: {}", result.record.label);
    println!("  Plain Key: {}", result.plain);
    println!("\n⚠️  WARNING: This key will only be shown once. Save it securely!");

    Ok(())
}

/// Execute api-keys list command
pub async fn execute_list(db_path: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_security_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    let keys = service.list_api_keys()?;

    if keys.is_empty() {
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
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_security_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    service.revoke_api_key(&id)?;
    println!("API key '{id}' revoked");

    Ok(())
}

/// Execute api-keys rotate command
pub async fn execute_rotate(
    id: String,
    label: Option<String>,
    db_path: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_security_db_path);

    // Initialize repository (migrations run automatically)
    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    let result = service.rotate_api_key(&id, label.as_deref())?;
    println!("API Key rotated:");
    println!("  ID: {}", result.record.id);
    println!("  Label: {}", result.record.label);
    println!("  Plain Key: {}", result.plain);
    println!("\n⚠️  WARNING: This key will only be shown once. Save it securely!");
    println!("⚠️  The old key '{id}' has been revoked.");

    Ok(())
}

/// Execute api-keys command
pub async fn execute(
    subcommand: ApiKeysSubcommand,
    db_path: Option<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        ApiKeysSubcommand::Create { label } => execute_create(label, db_path).await,
        ApiKeysSubcommand::List => execute_list(db_path).await,
        ApiKeysSubcommand::Revoke { id } => execute_revoke(id, db_path).await,
        ApiKeysSubcommand::Rotate { id, label } => execute_rotate(id, label, db_path).await,
    }
}
