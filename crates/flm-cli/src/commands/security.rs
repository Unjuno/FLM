//! Security command implementation

use crate::adapters::SqliteSecurityRepository;
use crate::cli::security::{BackupSubcommand, PolicySubcommand, SecuritySubcommand};
use crate::utils::get_security_db_path;
use flm_core::domain::security::SecurityPolicy;
use flm_core::services::SecurityService;
use serde_json::json;
use std::fs;
use std::path::PathBuf;

/// Execute security command
pub async fn execute(
    subcommand: SecuritySubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        SecuritySubcommand::Policy { subcommand } => {
            execute_policy(subcommand, db_path, format).await
        }
        SecuritySubcommand::Backup { subcommand } => {
            execute_backup(subcommand, db_path, format).await
        }
    }
}

/// Execute policy command
async fn execute_policy(
    subcommand: PolicySubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        PolicySubcommand::Show => execute_policy_show(db_path, format).await,
        PolicySubcommand::Set { json, file } => execute_policy_set(json, file, db_path, format).await,
    }
}

/// Execute policy show command
async fn execute_policy_show(
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    let policy = service.get_policy("default").await?;

    if format == "json" {
        if let Some(policy) = policy {
            let output = json!({
                "version": "1.0",
                "data": {
                    "id": policy.id,
                    "policy_json": serde_json::from_str::<serde_json::Value>(&policy.policy_json)?,
                    "updated_at": policy.updated_at
                }
            });
            println!("{}", serde_json::to_string_pretty(&output)?);
        } else {
            let output = json!({
                "version": "1.0",
                "data": null
            });
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
    } else {
        if let Some(policy) = policy {
            println!("Security Policy (default):");
            println!("  Updated: {}", policy.updated_at);
            println!("  Policy JSON:");
            let policy_value: serde_json::Value = serde_json::from_str(&policy.policy_json)?;
            println!("{}", serde_json::to_string_pretty(&policy_value)?);
        } else {
            println!("No security policy found (default)");
        }
    }

    Ok(())
}

/// Execute policy set command
async fn execute_policy_set(
    json: Option<String>,
    file: Option<String>,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let policy_json = match (json, file) {
        (Some(json_str), None) => json_str,
        (None, Some(file_path)) => {
            fs::read_to_string(&file_path).map_err(|e| {
                format!("Failed to read policy file '{}': {}", file_path, e)
            })?
        }
        (Some(_), Some(_)) => {
            return Err("Cannot specify both --json and --file".into());
        }
        (None, None) => {
            return Err("Must specify either --json or --file".into());
        }
    };

    // Validate JSON
    serde_json::from_str::<serde_json::Value>(&policy_json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    service.set_policy(policy.clone()).await?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "id": policy.id,
                "updated_at": policy.updated_at
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("Security policy updated successfully");
        println!("  ID: {}", policy.id);
        println!("  Updated: {}", policy.updated_at);
    }

    Ok(())
}

/// Execute backup command
async fn execute_backup(
    subcommand: BackupSubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        BackupSubcommand::Create { output } => {
            execute_backup_create(output, db_path, format).await
        }
        BackupSubcommand::Restore { file } => {
            execute_backup_restore(file, db_path, format).await
        }
    }
}

/// Execute backup create command
pub async fn execute_backup_create(
    output: Option<String>,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let security_db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    if !security_db_path.exists() {
        return Err("security.db does not exist".into());
    }

    // Determine backup directory
    let backup_dir = if let Some(output_path) = output {
        PathBuf::from(output_path)
    } else {
        // Use OS config directory/flm/backups/
        let app_data_dir = crate::utils::paths::get_app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        app_data_dir.join("backups")
    };

    // Create backup directory if it doesn't exist
    fs::create_dir_all(&backup_dir)?;

    // Generate backup filename with timestamp
    let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
    let backup_filename = format!("security.db.bak.{}", timestamp);
    let backup_path = backup_dir.join(&backup_filename);

    // Copy security.db to backup location
    fs::copy(&security_db_path, &backup_path)?;

    // Manage backup generations (keep only 3 most recent)
    let mut backup_files: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
    for entry in fs::read_dir(&backup_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && path.file_name().and_then(|n| n.to_str()).map_or(false, |n| n.starts_with("security.db.bak.")) {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    backup_files.push((path, modified));
                }
            }
        }
    }

    // Sort by modification time (newest first)
    backup_files.sort_by(|a, b| b.1.cmp(&a.1));

    // Remove oldest backups if more than 3
    if backup_files.len() > 3 {
        for (path, _) in backup_files.iter().skip(3) {
            if let Err(e) = fs::remove_file(path) {
                eprintln!("Warning: Failed to remove old backup {:?}: {}", path, e);
            }
        }
    }

    if format == "json" {
        let output_json = json!({
            "version": "1.0",
            "data": {
                "backup_path": backup_path.to_str().unwrap(),
                "timestamp": timestamp.to_string(),
                "total_backups": backup_files.len().min(3)
            }
        });
        println!("{}", serde_json::to_string_pretty(&output_json)?);
    } else {
        println!("Backup created successfully");
        println!("  Path: {}", backup_path.display());
        println!("  Timestamp: {}", timestamp);
        eprintln!("Backup saved to: {}", backup_path.display());
    }

    Ok(())
}

/// Execute backup restore command
pub async fn execute_backup_restore(
    file: String,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let backup_path = PathBuf::from(&file);
    if !backup_path.exists() {
        return Err(format!("Backup file does not exist: {}", file).into());
    }

    let security_db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Check if security.db exists and warn user
    if security_db_path.exists() {
        if format != "json" {
            eprintln!("Warning: security.db already exists at: {}", security_db_path.display());
            eprintln!("This operation will overwrite the existing database.");
            eprintln!("Make sure the application is stopped before proceeding.");
        }
    }

    // Create parent directory if needed
    if let Some(parent) = security_db_path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Copy backup to security.db location
    fs::copy(&backup_path, &security_db_path)?;

    // Run migrations on the restored database
    let repo = SqliteSecurityRepository::new(&security_db_path).await?;
    // Repository initialization already runs migrations, so we just need to verify
    let service = SecurityService::new(repo);

    // Verify the restored database is accessible
    match service.list_api_keys().await {
        Ok(_) => {
            if format == "json" {
                let output_json = json!({
                    "version": "1.0",
                    "data": {
                        "restored_path": security_db_path.to_str().unwrap(),
                        "backup_path": file,
                        "migrations_applied": true
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output_json)?);
            } else {
                println!("Backup restored successfully");
                println!("  Restored to: {}", security_db_path.display());
                println!("  Migrations applied");
                println!("\nNote: The application should be restarted to use the restored database.");
            }
        }
        Err(e) => {
            return Err(format!("Failed to verify restored database: {}", e).into());
        }
    }

    Ok(())
}

