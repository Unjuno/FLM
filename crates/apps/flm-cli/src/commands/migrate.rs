//! `flm migrate legacy` command implementation
//!
//! This module provides migration utilities for legacy prototype data.

use crate::cli::migrate::{LegacyAction, MigrateSubcommand};
use crate::commands::CliUserError;
use crate::utils::{get_config_db_path, get_security_db_path};
use chrono::Utc;
use serde_json::json;
use std::path::Path;
use std::path::PathBuf;
use tokio::fs;

/// Execute migrate command
pub async fn execute(
    subcommand: MigrateSubcommand,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        MigrateSubcommand::Legacy { action } => match action {
            LegacyAction::Plan(args) => {
                execute_legacy(
                    args.source,
                    args.tmp,
                    LegacyExecutionMode::Plan,
                    db_path_config,
                    db_path_security,
                    format,
                )
                .await
            }
            LegacyAction::Convert(args) => {
                execute_legacy(
                    args.source,
                    args.tmp,
                    LegacyExecutionMode::Convert,
                    db_path_config,
                    db_path_security,
                    format,
                )
                .await
            }
            LegacyAction::Apply(args) => {
                if !args.confirm {
                    return Err(Box::new(CliUserError::new(
                        "Migration apply requires --confirm flag".to_string(),
                    )));
                }
                execute_legacy(
                    args.source,
                    args.tmp,
                    LegacyExecutionMode::Apply,
                    db_path_config,
                    db_path_security,
                    format,
                )
                .await
            }
        },
    }
}

#[derive(Copy, Clone)]
enum LegacyExecutionMode {
    Plan,
    Convert,
    Apply,
}

#[allow(clippy::too_many_arguments)]
async fn execute_legacy(
    source: String,
    tmp: Option<String>,
    mode: LegacyExecutionMode,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    // Validate source directory
    let source_path = PathBuf::from(&source);
    if !source_path.exists() {
        return Err(Box::new(CliUserError::new(format!(
            "Source directory does not exist: {source}"
        ))));
    }

    if !source_path.is_dir() {
        return Err(Box::new(CliUserError::new(format!(
            "Source path is not a directory: {source}"
        ))));
    }

    let is_dry_run = matches!(mode, LegacyExecutionMode::Plan);
    let should_apply = matches!(mode, LegacyExecutionMode::Apply);

    // Determine temporary directory
    let tmp_dir = if let Some(tmp_path) = tmp {
        PathBuf::from(tmp_path)
    } else {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        PathBuf::from(format!("./tmp/flm-migrate-{timestamp}"))
    };

    // Create temporary directory
    fs::create_dir_all(&tmp_dir).await?;

    // Create logs directory
    let logs_dir = PathBuf::from("logs/migrations");
    fs::create_dir_all(&logs_dir).await?;

    // Generate log file path
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let log_file = logs_dir.join(format!("{timestamp}.log"));

    // Start migration process
    let migration_result = match mode {
        LegacyExecutionMode::Plan => {
            execute_dry_run(&source_path, &tmp_dir, &log_file, format.clone()).await
        }
        LegacyExecutionMode::Convert => {
            execute_convert(&source_path, &tmp_dir, &log_file, format.clone()).await
        }
        LegacyExecutionMode::Apply => {
            execute_apply(
                &source_path,
                &tmp_dir,
                &log_file,
                db_path_config,
                db_path_security,
                format.clone(),
            )
            .await
        }
    };

    // Handle migration result
    match migration_result {
        Ok(summary) => {
            if format == "json" {
                let output = json!({
                    "version": "1.0",
                    "data": {
                        "status": "success",
                        "summary": summary,
                        "tmp_dir": tmp_dir.to_str().ok_or_else(|| {
                            format!(
                                "Error: Invalid UTF-8 encoding in temporary directory path.\n\
                                Path: {}\n\
                                This usually indicates a system configuration issue.\n\
                                Please ensure your system locale supports UTF-8.",
                                tmp_dir.display()
                            )
                        })?,
                        "log_file": log_file.to_str().ok_or_else(|| {
                            format!(
                                "Error: Invalid UTF-8 encoding in log file path.\n\
                                Path: {}\n\
                                This usually indicates a system configuration issue.\n\
                                Please ensure your system locale supports UTF-8.",
                                log_file.display()
                            )
                        })?,
                        "dry_run": is_dry_run,
                        "applied": should_apply
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else {
                println!("Migration completed successfully");
                println!("  Temporary directory: {}", tmp_dir.display());
                println!("  Log file: {}", log_file.display());
                if should_apply {
                    println!("  Migration has been applied to production databases");
                } else {
                    println!("  Migration files generated. Use --apply to apply changes.");
                }
            }
            Ok(())
        }
        Err(e) => {
            // Log error
            let error_msg = format!("Migration failed: {e}\n");
            tokio::fs::write(&log_file, error_msg.as_bytes()).await.ok();

            if format == "json" {
                let output = json!({
                    "error": {
                        "code": "MIGRATION_FAILED",
                        "message": e.to_string(),
                        "log_file": log_file.to_str().ok_or_else(|| {
                            format!(
                                "Error: Invalid UTF-8 encoding in log file path.\n\
                                Path: {}\n\
                                This usually indicates a system configuration issue.\n\
                                Please ensure your system locale supports UTF-8.",
                                log_file.display()
                            )
                        })?,
                        "suggestion": "Check the log file for detailed error information and ensure all prerequisites are met."
                    }
                });
                eprintln!("{}", serde_json::to_string_pretty(&output)?);
            } else {
                eprintln!("Error: Migration failed");
                eprintln!("Details: {e}");
                eprintln!("Log file: {}", log_file.display());
                eprintln!("Suggestion: Check the log file for detailed error information.");
            }
            Err(e)
        }
    }
}

/// Execute dry run: analyze legacy data and show what would be migrated
async fn execute_dry_run(
    source: &Path,
    tmp_dir: &Path,
    log_file: &Path,
    format: String,
) -> Result<MigrationSummary, Box<dyn std::error::Error>> {
    let mut log_entries = Vec::new();
    log_entries.push(format!(
        "[{}] Starting dry-run migration analysis",
        Utc::now()
    ));

    // Check for legacy config.json
    let config_json_path = source.join("config.json");
    let has_config_json = config_json_path.exists();

    // Check for legacy SQLite databases
    let legacy_db_paths = [
        source.join("database.db"),
        source.join("data.db"),
        source.join("flm.db"),
    ];
    let has_legacy_db = legacy_db_paths.iter().any(|p| p.exists());

    let mut summary = MigrationSummary {
        config_json_found: has_config_json,
        legacy_db_found: has_legacy_db,
        settings_count: 0,
        api_keys_count: 0,
        proxy_profiles_count: 0,
        warnings: Vec::new(),
        errors: Vec::new(),
    };

    if !has_config_json && !has_legacy_db {
        summary.errors.push(
            "No legacy data found. Expected config.json or database.db in source directory."
                .to_string(),
        );
        log_entries.push(format!("[{}] ERROR: No legacy data found", Utc::now()));
    } else {
        if has_config_json {
            log_entries.push(format!("[{}] Found config.json", Utc::now()));
            summary.settings_count = 1; // Estimate
        }

        if has_legacy_db {
            log_entries.push(format!("[{}] Found legacy database", Utc::now()));
            summary.api_keys_count = 1; // Estimate
        }
    }

    // Write log
    let log_content = log_entries.join("\n");
    fs::write(log_file, log_content).await?;

    // Generate summary report
    let report_path = tmp_dir.join("migration-plan.json");
    let report = json!({
        "timestamp": Utc::now().to_rfc3339(),
        "source": source.to_str().ok_or_else(|| {
            format!(
                "Error: Invalid UTF-8 encoding in source path.\n\
                Path: {}\n\
                This usually indicates a system configuration issue.\n\
                Please ensure your system locale supports UTF-8 or use a different path.",
                source.display()
            )
        })?,
        "summary": {
            "config_json_found": summary.config_json_found,
            "legacy_db_found": summary.legacy_db_found,
            "estimated_settings": summary.settings_count,
            "estimated_api_keys": summary.api_keys_count,
            "estimated_proxy_profiles": summary.proxy_profiles_count,
        },
        "warnings": summary.warnings,
        "errors": summary.errors,
        "next_steps": [
            "Review the migration plan in migration-plan.json",
            "Run without --dry-run to generate migration files",
            "Review generated files in temporary directory",
            "Use --apply --confirm to apply migration to production databases"
        ]
    });
    fs::write(&report_path, serde_json::to_string_pretty(&report)?).await?;

    if format != "json" {
        println!("Dry-run analysis complete");
        println!("  Config JSON found: {}", summary.config_json_found);
        println!("  Legacy database found: {}", summary.legacy_db_found);
        if !summary.errors.is_empty() {
            println!("  Errors: {}", summary.errors.len());
            for error in &summary.errors {
                eprintln!("    - {error}");
            }
        }
        println!("  Report saved to: {}", report_path.display());
    }

    Ok(summary)
}

/// Execute convert: generate migration files without applying
async fn execute_convert(
    source: &Path,
    tmp_dir: &Path,
    log_file: &Path,
    format: String,
) -> Result<MigrationSummary, Box<dyn std::error::Error>> {
    let mut log_entries = Vec::new();
    log_entries.push(format!("[{}] Starting migration conversion", Utc::now()));

    let mut summary = MigrationSummary {
        config_json_found: false,
        legacy_db_found: false,
        settings_count: 0,
        api_keys_count: 0,
        proxy_profiles_count: 0,
        warnings: Vec::new(),
        errors: Vec::new(),
    };

    // Convert config.json if exists
    let config_json_path = source.join("config.json");
    if config_json_path.exists() {
        log_entries.push(format!("[{}] Converting config.json", Utc::now()));
        summary.config_json_found = true;

        match convert_config_json(&config_json_path, tmp_dir, &mut log_entries).await {
            Ok(count) => {
                summary.settings_count = count;
                log_entries.push(format!(
                    "[{}] Converted {} settings from config.json",
                    Utc::now(),
                    count
                ));
            }
            Err(e) => {
                let error_msg = format!("Failed to convert config.json: {e}");
                summary.errors.push(error_msg.clone());
                log_entries.push(format!("[{}] ERROR: {}", Utc::now(), error_msg));
            }
        }
    }

    // Convert legacy database if exists
    let legacy_db_paths = [
        source.join("database.db"),
        source.join("data.db"),
        source.join("flm.db"),
    ];

    for db_path in legacy_db_paths {
        if db_path.exists() {
            log_entries.push(format!(
                "[{}] Converting legacy database: {}",
                Utc::now(),
                db_path.display()
            ));
            summary.legacy_db_found = true;

            match convert_legacy_db(&db_path, tmp_dir, &mut log_entries).await {
                Ok((api_keys, profiles)) => {
                    summary.api_keys_count = api_keys;
                    summary.proxy_profiles_count = profiles;
                    log_entries.push(format!(
                        "[{}] Converted {} API keys and {} proxy profiles",
                        Utc::now(),
                        api_keys,
                        profiles
                    ));
                }
                Err(e) => {
                    let error_msg = format!("Failed to convert legacy database: {e}");
                    summary.errors.push(error_msg.clone());
                    log_entries.push(format!("[{}] ERROR: {}", Utc::now(), error_msg));
                }
            }
            break; // Only process first found database
        }
    }

    // Write log
    let log_content = log_entries.join("\n");
    fs::write(log_file, log_content).await?;

    if format != "json" {
        println!("Conversion complete");
        println!("  Settings: {}", summary.settings_count);
        println!("  API keys: {}", summary.api_keys_count);
        println!("  Proxy profiles: {}", summary.proxy_profiles_count);
        if !summary.errors.is_empty() {
            eprintln!("  Errors: {}", summary.errors.len());
        }
        println!("  Migration files saved to: {}", tmp_dir.display());
    }

    Ok(summary)
}

/// Execute apply: convert and apply to production databases
async fn execute_apply(
    source: &Path,
    tmp_dir: &Path,
    log_file: &Path,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
    format: String,
) -> Result<MigrationSummary, Box<dyn std::error::Error>> {
    // First, perform conversion
    let summary = execute_convert(source, tmp_dir, log_file, format.clone()).await?;

    // Check for errors before applying
    if !summary.errors.is_empty() {
        return Err(Box::new(CliUserError::new(format!(
            "Cannot apply migration due to errors: {}",
            summary.errors.join("; ")
        ))));
    }

    // Create backup before applying
    let config_db_path = db_path_config
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);
    let security_db_path = db_path_security
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Create backups before applying
    let mut log_entries = vec![format!(
        "[{}] Creating backups before applying migration",
        Utc::now()
    )];

    // Backup config.db if it exists
    if config_db_path.exists() {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let backup_path = config_db_path
            .parent()
            .ok_or_else(|| {
                format!(
                    "Error: Cannot determine parent directory for database path.\n\
                    Path: {}\n\
                    This may occur if the path is a root directory.\n\
                    Please specify a valid database path.",
                    config_db_path.display()
                )
            })?
            .join(format!("config.db.bak.{timestamp}"));
        fs::copy(&config_db_path, &backup_path).await?;
        log_entries.push(format!(
            "[{}] Backed up config.db to {}",
            Utc::now(),
            backup_path.display()
        ));
    }

    // Backup security.db if it exists
    if security_db_path.exists() {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let backup_path = security_db_path
            .parent()
            .ok_or_else(|| {
                format!(
                    "Error: Cannot determine parent directory for database path.\n\
                    Path: {}\n\
                    This may occur if the path is a root directory.\n\
                    Please specify a valid database path.",
                    security_db_path.display()
                )
            })?
            .join(format!("security.db.bak.{timestamp}"));
        fs::copy(&security_db_path, &backup_path).await?;
        log_entries.push(format!(
            "[{}] Backed up security.db to {}",
            Utc::now(),
            backup_path.display()
        ));
    }

    // Validate migration data before applying
    log_entries.push(format!("[{}] Validating migration data", Utc::now()));
    let validation_result = validate_migration_data(tmp_dir, &mut log_entries).await;
    if !validation_result.is_empty() {
        // Rollback backups if validation fails
        log_entries.push(format!(
            "[{}] Validation failed, rolling back backups",
            Utc::now()
        ));
        rollback_backups(&config_db_path, &security_db_path, &mut log_entries).await?;
        return Err(Box::new(CliUserError::new(format!(
            "Migration validation failed: {}",
            validation_result.join("; ")
        ))));
    }

    // Apply settings to config.db
    let settings_path = tmp_dir.join("settings.json");
    if settings_path.exists() {
        log_entries.push(format!("[{}] Applying settings to config.db", Utc::now()));
        match apply_settings(&settings_path, &config_db_path, &mut log_entries).await {
            Ok(()) => {}
            Err(e) => {
                // Rollback on error
                log_entries.push(format!(
                    "[{}] Error applying settings, rolling back: {}",
                    Utc::now(),
                    e
                ));
                rollback_backups(&config_db_path, &security_db_path, &mut log_entries).await?;
                return Err(e);
            }
        }
    }

    // Apply proxy profiles to config.db
    let profiles_path = tmp_dir.join("proxy_profiles.json");
    if profiles_path.exists() {
        log_entries.push(format!(
            "[{}] Applying proxy profiles to config.db",
            Utc::now()
        ));
        match apply_proxy_profiles(&profiles_path, &config_db_path, &mut log_entries).await {
            Ok(()) => {}
            Err(e) => {
                // Rollback on error
                log_entries.push(format!(
                    "[{}] Error applying proxy profiles, rolling back: {}",
                    Utc::now(),
                    e
                ));
                rollback_backups(&config_db_path, &security_db_path, &mut log_entries).await?;
                return Err(e);
            }
        }
    }

    // Note about API keys (cannot be migrated)
    let api_keys_path = tmp_dir.join("api_keys.json");
    if api_keys_path.exists() {
        log_entries.push(format!(
            "[{}] Note: API keys cannot be migrated (encrypted). Users must create new API keys.",
            Utc::now()
        ));
    }

    // Write log
    let log_content = log_entries.join("\n");
    let existing_content = match fs::read_to_string(log_file).await {
        Ok(content) => content,
        Err(e) => {
            // Log file may not exist yet, which is fine
            if e.kind() != std::io::ErrorKind::NotFound {
                eprintln!("Warning: Failed to read existing log file {}: {}", log_file.display(), e);
            }
            String::new()
        }
    };
    fs::write(log_file, format!("{existing_content}\n{log_content}")).await?;

    if format != "json" {
        println!("Migration applied successfully");
        println!("  Settings and proxy profiles have been migrated");
        println!(
            "  Note: API keys cannot be migrated. Create new API keys using 'flm api-keys create'"
        );
        println!("  See log file for details: {}", log_file.display());
    }

    Ok(summary)
}

/// Convert config.json to new schema
async fn convert_config_json(
    config_path: &Path,
    tmp_dir: &Path,
    log_entries: &mut Vec<String>,
) -> Result<usize, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(config_path).await?;
    let config: serde_json::Value = serde_json::from_str(&content)?;

    // Convert settings
    let settings_path = tmp_dir.join("settings.json");
    let settings_json = json!({
        "source": "legacy_config.json",
        "settings": config,
        "converted_at": Utc::now().to_rfc3339()
    });
    fs::write(
        &settings_path,
        serde_json::to_string_pretty(&settings_json)?,
    )
    .await?;

    log_entries.push(format!(
        "[{}] Wrote settings to {}",
        Utc::now(),
        settings_path.display()
    ));

    // Count settings (estimate)
    let count = if let Some(obj) = config.as_object() {
        obj.len()
    } else {
        1
    };

    Ok(count)
}

/// Convert legacy database to new schema
async fn convert_legacy_db(
    db_path: &Path,
    tmp_dir: &Path,
    log_entries: &mut Vec<String>,
) -> Result<(usize, usize), Box<dyn std::error::Error>> {
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use sqlx::Row;

    log_entries.push(format!(
        "[{}] Opening legacy database: {}",
        Utc::now(),
        db_path.display()
    ));

    // Connect to legacy database (read-only)
    let path_str = db_path
        .to_str()
        .ok_or_else(|| CliUserError::new("Invalid database path (non-UTF8)".to_string()))?;

    let options = SqliteConnectOptions::new()
        .filename(path_str)
        .read_only(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|e| CliUserError::new(format!("Failed to connect to legacy database: {e}")))?;

    let mut api_keys_count = 0;
    let mut proxy_profiles_count = 0;

    // Convert apis table to proxy_profiles
    let profiles_path = tmp_dir.join("proxy_profiles.json");
    let mut proxy_profiles = Vec::new();

    // Check if apis table exists
    let table_exists: bool = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT name FROM sqlite_master WHERE type='table' AND name='apis')",
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(false);

    if table_exists {
        log_entries.push(format!(
            "[{}] Converting apis table to proxy_profiles",
            Utc::now()
        ));

        let rows = sqlx::query(
            "SELECT id, name, model, port, enable_auth, status, created_at, updated_at FROM apis",
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| CliUserError::new(format!("Failed to read apis table: {e}")))?;

        for row in rows {
            let id: String = row.get(0);
            let name: String = row.get(1);
            let model: String = row.get(2);
            let port: i64 = row.get(3);
            let enable_auth: i64 = row.get(4);
            let status: String = row.get(5);
            let created_at: String = row.get(6);
            let _updated_at: String = row.get(7);

            // Convert to new proxy profile format
            let profile = json!({
                "id": id,
                "name": name,
                "model": model,
                "port": port,
                "enable_auth": enable_auth != 0,
                "status": status,
                "created_at": created_at,
                "source": "legacy_apis_table"
            });

            proxy_profiles.push(profile);
            proxy_profiles_count += 1;
        }

        log_entries.push(format!(
            "[{}] Converted {} proxy profiles",
            Utc::now(),
            proxy_profiles_count
        ));
    } else {
        log_entries.push(format!("[{}] apis table not found, skipping", Utc::now()));
    }

    // Write proxy profiles
    let profiles_json = json!({
        "source": db_path.to_string_lossy().to_string(),
        "proxy_profiles": proxy_profiles,
        "converted_at": Utc::now().to_rfc3339(),
        "count": proxy_profiles_count
    });
    fs::write(
        &profiles_path,
        serde_json::to_string_pretty(&profiles_json)?,
    )
    .await?;

    // Convert api_keys table
    let api_keys_path = tmp_dir.join("api_keys.json");
    let mut api_keys = Vec::new();

    // Check if api_keys table exists
    let keys_table_exists: bool = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT name FROM sqlite_master WHERE type='table' AND name='api_keys')",
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(false);

    if keys_table_exists {
        log_entries.push(format!(
            "[{}] Converting api_keys table (note: encrypted keys cannot be migrated)",
            Utc::now()
        ));

        // Note: Legacy database stores encrypted keys, which cannot be decrypted without the key
        // We can only migrate metadata (id, api_id, created_at)
        let rows = sqlx::query("SELECT id, api_id, created_at FROM api_keys")
            .fetch_all(&pool)
            .await
            .map_err(|e| CliUserError::new(format!("Failed to read api_keys table: {e}")))?;

        for row in rows {
            let id: String = row.get(0);
            let api_id: String = row.get(1);
            let created_at: String = row.get(2);

            // Note: We cannot migrate the actual key because it's encrypted
            // User will need to create new API keys
            let api_key = json!({
                "id": id,
                "api_id": api_id,
                "created_at": created_at,
                "note": "Original encrypted key cannot be migrated. New API key must be created.",
                "source": "legacy_api_keys_table"
            });

            api_keys.push(api_key);
            api_keys_count += 1;
        }

        log_entries.push(format!(
            "[{}] Found {} API keys (encrypted keys cannot be migrated)",
            Utc::now(),
            api_keys_count
        ));
    } else {
        log_entries.push(format!(
            "[{}] api_keys table not found, skipping",
            Utc::now()
        ));
    }

    // Write API keys
    let api_keys_json = json!({
        "source": db_path.to_string_lossy().to_string(),
        "api_keys": api_keys,
        "converted_at": Utc::now().to_rfc3339(),
        "count": api_keys_count,
        "warning": "Encrypted API keys from legacy database cannot be migrated. New API keys must be created."
    });
    fs::write(
        &api_keys_path,
        serde_json::to_string_pretty(&api_keys_json)?,
    )
    .await?;

    // Convert user_settings table to settings
    let settings_path = tmp_dir.join("settings.json");
    let mut settings = Vec::new();

    let settings_table_exists: bool = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings')",
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(false);

    if settings_table_exists {
        log_entries.push(format!(
            "[{}] Converting user_settings table to settings",
            Utc::now()
        ));

        let rows = sqlx::query("SELECT key, value, updated_at FROM user_settings")
            .fetch_all(&pool)
            .await
            .map_err(|e| CliUserError::new(format!("Failed to read user_settings table: {e}")))?;

        for row in rows {
            let key: String = row.get(0);
            let value: String = row.get(1);
            let updated_at: String = row.get(2);

            let setting = json!({
                "key": key,
                "value": value,
                "updated_at": updated_at,
                "source": "legacy_user_settings_table"
            });

            settings.push(setting);
        }

        log_entries.push(format!(
            "[{}] Converted {} settings",
            Utc::now(),
            settings.len()
        ));
    }

    // Write settings
    let settings_json = json!({
        "source": db_path.to_string_lossy().to_string(),
        "settings": settings,
        "converted_at": Utc::now().to_rfc3339(),
        "count": settings.len()
    });
    fs::write(
        &settings_path,
        serde_json::to_string_pretty(&settings_json)?,
    )
    .await?;

    log_entries.push(format!(
        "[{}] Database conversion complete: {} API keys, {} proxy profiles",
        Utc::now(),
        api_keys_count,
        proxy_profiles_count
    ));

    Ok((api_keys_count, proxy_profiles_count))
}

/// Apply settings from JSON file to config.db
async fn apply_settings(
    settings_path: &Path,
    config_db_path: &Path,
    log_entries: &mut Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

    let content = fs::read_to_string(settings_path).await?;
    let data: serde_json::Value = serde_json::from_str(&content)?;

    // Connect to config.db
    let path_str = config_db_path
        .to_str()
        .ok_or_else(|| CliUserError::new("Invalid database path (non-UTF8)".to_string()))?;

    let options = SqliteConnectOptions::new()
        .filename(path_str)
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|e| CliUserError::new(format!("Failed to connect to config.db: {e}")))?;

    // Run migrations
    sqlx::migrate!("../../core/flm-core/migrations")
        .run(&pool)
        .await
        .map_err(|e| CliUserError::new(format!("Migration failed: {e}")))?;

    // Apply settings from JSON
    if let Some(settings) = data.get("settings").and_then(|s| s.as_array()) {
        for setting in settings {
            if let (Some(key), Some(value)) = (
                setting.get("key").and_then(|k| k.as_str()),
                setting.get("value").and_then(|v| v.as_str()),
            ) {
                sqlx::query(
                    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
                )
                .bind(key)
                .bind(value)
                .bind(Utc::now().to_rfc3339())
                .execute(&pool)
                .await?;
            }
        }
        log_entries.push(format!(
            "[{}] Applied {} settings",
            Utc::now(),
            settings.len()
        ));
    } else if let Some(settings_obj) = data.get("settings").and_then(|s| s.as_object()) {
        // Handle config.json format (object instead of array)
        for (key, value) in settings_obj {
            let value_str = if value.is_string() {
                value.as_str().expect("value should be string since is_string() returned true").to_string()
            } else {
                serde_json::to_string(value)?
            };

            sqlx::query(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
            )
            .bind(key)
            .bind(value_str)
            .bind(Utc::now().to_rfc3339())
            .execute(&pool)
            .await?;
        }
        log_entries.push(format!(
            "[{}] Applied {} settings from config.json",
            Utc::now(),
            settings_obj.len()
        ));
    }

    Ok(())
}

/// Apply proxy profiles from JSON file to config.db
async fn apply_proxy_profiles(
    profiles_path: &Path,
    config_db_path: &Path,
    log_entries: &mut Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

    let content = fs::read_to_string(profiles_path).await?;
    let data: serde_json::Value = serde_json::from_str(&content)?;

    // Connect to config.db
    let path_str = config_db_path
        .to_str()
        .ok_or_else(|| CliUserError::new("Invalid database path (non-UTF8)".to_string()))?;

    let options = SqliteConnectOptions::new()
        .filename(path_str)
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|e| CliUserError::new(format!("Failed to connect to config.db: {e}")))?;

    // Run migrations
    sqlx::migrate!("../../core/flm-core/migrations")
        .run(&pool)
        .await
        .map_err(|e| CliUserError::new(format!("Migration failed: {e}")))?;

    // Apply proxy profiles
    if let Some(profiles) = data.get("proxy_profiles").and_then(|p| p.as_array()) {
        for profile in profiles {
            let config_json = serde_json::to_string(profile)?;
            let id = profile
                .get("id")
                .and_then(|i| i.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("legacy_{}", Utc::now().timestamp_millis()));

            sqlx::query("INSERT OR REPLACE INTO proxy_profiles (id, config_json, created_at) VALUES (?, ?, ?)")
                .bind(&id)
                .bind(&config_json)
                .bind(Utc::now().to_rfc3339())
                .execute(&pool)
                .await?;
        }
        log_entries.push(format!(
            "[{}] Applied {} proxy profiles",
            Utc::now(),
            profiles.len()
        ));
    }

    Ok(())
}

/// Validate migration data before applying
async fn validate_migration_data(tmp_dir: &Path, log_entries: &mut Vec<String>) -> Vec<String> {
    let mut errors = Vec::new();

    // Validate settings.json if exists
    let settings_path = tmp_dir.join("settings.json");
    if settings_path.exists() {
        if let Ok(content) = fs::read_to_string(&settings_path).await {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                // Validate settings structure
                if !data.get("settings").is_some() {
                    errors.push("settings.json missing 'settings' field".to_string());
                }
            } else {
                errors.push("settings.json is not valid JSON".to_string());
            }
        } else {
            errors.push("Failed to read settings.json".to_string());
        }
    }

    // Validate proxy_profiles.json if exists
    let profiles_path = tmp_dir.join("proxy_profiles.json");
    if profiles_path.exists() {
        if let Ok(content) = fs::read_to_string(&profiles_path).await {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                // Validate proxy profiles structure
                if let Some(profiles) = data.get("proxy_profiles").and_then(|p| p.as_array()) {
                    for (idx, profile) in profiles.iter().enumerate() {
                        if !profile.is_object() {
                            errors.push(format!("proxy_profiles[{}] is not an object", idx));
                        }
                    }
                }
            } else {
                errors.push("proxy_profiles.json is not valid JSON".to_string());
            }
        } else {
            errors.push("Failed to read proxy_profiles.json".to_string());
        }
    }

    if errors.is_empty() {
        log_entries.push(format!("[{}] Validation passed", Utc::now()));
    } else {
        log_entries.push(format!(
            "[{}] Validation failed: {} errors",
            Utc::now(),
            errors.len()
        ));
    }

    errors
}

/// Rollback backups if migration fails
async fn rollback_backups(
    config_db_path: &Path,
    security_db_path: &Path,
    log_entries: &mut Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Find backup files
    let config_backup = if let Some(parent) = config_db_path.parent() {
        match fs::read_dir(parent).await {
            Ok(mut entries) => {
                let mut backups = Vec::new();
                while let Ok(Some(entry)) = entries.next_entry().await {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.starts_with("config.db.bak.") {
                            backups.push(entry.path());
                        }
                    }
                }
                backups.sort();
                backups.last().cloned()
            }
            Err(_) => None,
        }
    } else {
        None
    };

    if let Some(backup) = config_backup {
        if config_db_path.exists() {
            fs::remove_file(config_db_path).await?;
        }
        fs::copy(&backup, config_db_path).await?;
        log_entries.push(format!(
            "[{}] Rolled back config.db from backup",
            Utc::now()
        ));
    }

    let security_backup = if let Some(parent) = security_db_path.parent() {
        match fs::read_dir(parent).await {
            Ok(mut entries) => {
                let mut backups = Vec::new();
                while let Ok(Some(entry)) = entries.next_entry().await {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.starts_with("security.db.bak.") {
                            backups.push(entry.path());
                        }
                    }
                }
                backups.sort();
                backups.last().cloned()
            }
            Err(_) => None,
        }
    } else {
        None
    };

    if let Some(backup) = security_backup {
        if security_db_path.exists() {
            fs::remove_file(security_db_path).await?;
        }
        fs::copy(&backup, security_db_path).await?;
        log_entries.push(format!(
            "[{}] Rolled back security.db from backup",
            Utc::now()
        ));
    }

    Ok(())
}

/// Migration summary
#[derive(serde::Serialize)]
struct MigrationSummary {
    config_json_found: bool,
    legacy_db_found: bool,
    settings_count: usize,
    api_keys_count: usize,
    proxy_profiles_count: usize,
    warnings: Vec<String>,
    errors: Vec<String>,
}
