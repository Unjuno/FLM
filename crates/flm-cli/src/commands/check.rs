//! Check command implementation

use crate::adapters::{SqliteConfigRepository, SqliteSecurityRepository};
use crate::commands::CliUserError;
use crate::utils::{get_config_db_path, get_security_db_path};
use flm_core::services::{ConfigService, SecurityService};
use serde_json::json;
use sqlx::sqlite::SqlitePool;
use sqlx::Row;
use std::path::PathBuf;

/// Check result for a single check item
#[derive(Debug, Clone)]
struct CheckItem {
    name: String,
    status: CheckStatus,
    message: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
enum CheckStatus {
    Ok,
    Warning,
    Error,
}

/// Execute check command
pub async fn execute(
    verbose: bool,
    db_path_config: Option<String>,
    db_path_security: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let config_db_path = db_path_config
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);
    let security_db_path = db_path_security
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let mut checks = Vec::new();

    // Check config.db
    checks.extend(check_config_db(&config_db_path, verbose).await?);

    // Check security.db
    checks.extend(check_security_db(&security_db_path, verbose).await?);

    // Determine overall status
    let has_errors = checks.iter().any(|c| c.status == CheckStatus::Error);
    let has_warnings = checks.iter().any(|c| c.status == CheckStatus::Warning);

    if format == "json" {
        let status = if has_errors {
            "error"
        } else if has_warnings {
            "warning"
        } else {
            "ok"
        };

        let checks_json: Vec<serde_json::Value> = checks
            .iter()
            .map(|c| {
                json!({
                    "name": c.name,
                    "status": match c.status {
                        CheckStatus::Ok => "ok",
                        CheckStatus::Warning => "warning",
                        CheckStatus::Error => "error",
                    },
                    "message": c.message
                })
            })
            .collect();

        let output = json!({
            "version": "1.0",
            "data": {
                "status": status,
                "checks": checks_json
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        if verbose {
            println!("Database Integrity Check\n");
            for check in &checks {
                let status_symbol = match check.status {
                    CheckStatus::Ok => "✓",
                    CheckStatus::Warning => "⚠",
                    CheckStatus::Error => "✗",
                };
                print!("{} {}", status_symbol, check.name);
                if let Some(msg) = &check.message {
                    println!(": {}", msg);
                } else {
                    println!();
                }
            }
            println!();
        }

        if has_errors {
            println!("❌ Integrity check failed with errors");
        } else if has_warnings {
            println!("⚠️  Integrity check completed with warnings");
        } else {
            println!("✓ Database integrity check passed");
        }
    }

    if has_errors {
        return Err(Box::new(CliUserError::silent()));
    }

    Ok(())
}

/// Check config.db integrity
async fn check_config_db(
    db_path: &PathBuf,
    verbose: bool,
) -> Result<Vec<CheckItem>, Box<dyn std::error::Error>> {
    let mut checks = Vec::new();

    // Check if database exists
    if !db_path.exists() {
        checks.push(CheckItem {
            name: "config.db exists".to_string(),
            status: CheckStatus::Warning,
            message: Some(
                "Database file does not exist (will be created on first use)".to_string(),
            ),
        });
        return Ok(checks);
    }

    // Connect to database
    let pool = match SqlitePool::connect(&format!("sqlite://{}", db_path.display())).await {
        Ok(pool) => pool,
        Err(e) => {
            checks.push(CheckItem {
                name: "config.db connection".to_string(),
                status: CheckStatus::Error,
                message: Some(format!("Failed to connect: {}", e)),
            });
            return Ok(checks);
        }
    };

    // Check required tables
    let required_tables = vec!["settings", "engines_cache", "proxy_profiles"];
    for table in required_tables {
        let table_exists = sqlx::query(&format!(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='{}'",
            table
        ))
        .fetch_optional(&pool)
        .await?;

        if table_exists.is_some() {
            checks.push(CheckItem {
                name: format!("config.db table '{}'", table),
                status: CheckStatus::Ok,
                message: if verbose {
                    Some("Table exists".to_string())
                } else {
                    None
                },
            });
        } else {
            checks.push(CheckItem {
                name: format!("config.db table '{}'", table),
                status: CheckStatus::Error,
                message: Some("Table missing".to_string()),
            });
        }
    }

    // Check settings table integrity
    if let Ok(rows) = sqlx::query("SELECT COUNT(*) as count FROM settings")
        .fetch_one(&pool)
        .await
    {
        let count: i64 = rows.get("count");
        checks.push(CheckItem {
            name: "config.db settings count".to_string(),
            status: CheckStatus::Ok,
            message: if verbose {
                Some(format!("{} settings found", count))
            } else {
                None
            },
        });
    }

    // Check proxy_profiles table integrity
    if let Ok(rows) = sqlx::query("SELECT COUNT(*) as count FROM proxy_profiles")
        .fetch_one(&pool)
        .await
    {
        let count: i64 = rows.get("count");
        checks.push(CheckItem {
            name: "config.db proxy_profiles count".to_string(),
            status: CheckStatus::Ok,
            message: if verbose {
                Some(format!("{} profiles found", count))
            } else {
                None
            },
        });
    }

    // Test ConfigService
    match SqliteConfigRepository::new(db_path).await {
        Ok(repo) => {
            let service = ConfigService::new(repo);
            match service.list().await {
                Ok(_) => {
                    checks.push(CheckItem {
                        name: "config.db service access".to_string(),
                        status: CheckStatus::Ok,
                        message: if verbose {
                            Some("ConfigService can access database".to_string())
                        } else {
                            None
                        },
                    });
                }
                Err(e) => {
                    checks.push(CheckItem {
                        name: "config.db service access".to_string(),
                        status: CheckStatus::Error,
                        message: Some(format!("ConfigService error: {}", e)),
                    });
                }
            }
        }
        Err(e) => {
            checks.push(CheckItem {
                name: "config.db service initialization".to_string(),
                status: CheckStatus::Error,
                message: Some(format!("Failed to initialize ConfigService: {}", e)),
            });
        }
    }

    Ok(checks)
}

/// Check security.db integrity
async fn check_security_db(
    db_path: &PathBuf,
    verbose: bool,
) -> Result<Vec<CheckItem>, Box<dyn std::error::Error>> {
    let mut checks = Vec::new();

    // Check if database exists
    if !db_path.exists() {
        checks.push(CheckItem {
            name: "security.db exists".to_string(),
            status: CheckStatus::Warning,
            message: Some(
                "Database file does not exist (will be created on first use)".to_string(),
            ),
        });
        return Ok(checks);
    }

    // Connect to database
    let pool = match SqlitePool::connect(&format!("sqlite://{}", db_path.display())).await {
        Ok(pool) => pool,
        Err(e) => {
            checks.push(CheckItem {
                name: "security.db connection".to_string(),
                status: CheckStatus::Error,
                message: Some(format!("Failed to connect: {}", e)),
            });
            return Ok(checks);
        }
    };

    // Check required tables
    let required_tables = vec!["api_keys", "security_policies", "audit_logs"];
    for table in required_tables {
        let table_exists = sqlx::query(&format!(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='{}'",
            table
        ))
        .fetch_optional(&pool)
        .await?;

        if table_exists.is_some() {
            checks.push(CheckItem {
                name: format!("security.db table '{}'", table),
                status: CheckStatus::Ok,
                message: if verbose {
                    Some("Table exists".to_string())
                } else {
                    None
                },
            });
        } else {
            checks.push(CheckItem {
                name: format!("security.db table '{}'", table),
                status: CheckStatus::Error,
                message: Some("Table missing".to_string()),
            });
        }
    }

    // Check API keys integrity
    if let Ok(rows) = sqlx::query("SELECT COUNT(*) as count FROM api_keys")
        .fetch_one(&pool)
        .await
    {
        let count: i64 = rows.get("count");
        let active_count: i64 =
            sqlx::query("SELECT COUNT(*) as count FROM api_keys WHERE revoked_at IS NULL")
                .fetch_one(&pool)
                .await
                .map(|row| row.get("count"))
                .unwrap_or(0);

        checks.push(CheckItem {
            name: "security.db api_keys count".to_string(),
            status: CheckStatus::Ok,
            message: if verbose {
                Some(format!("{} total keys, {} active", count, active_count))
            } else {
                None
            },
        });

        // Check for keys with empty hash (should not happen)
        if let Ok(rows) =
            sqlx::query("SELECT COUNT(*) as count FROM api_keys WHERE hash = '' OR hash IS NULL")
                .fetch_one(&pool)
                .await
        {
            let invalid_count: i64 = rows.get("count");
            if invalid_count > 0 {
                checks.push(CheckItem {
                    name: "security.db api_keys hash integrity".to_string(),
                    status: CheckStatus::Error,
                    message: Some(format!("{} keys with invalid hash", invalid_count)),
                });
            } else {
                checks.push(CheckItem {
                    name: "security.db api_keys hash integrity".to_string(),
                    status: CheckStatus::Ok,
                    message: if verbose {
                        Some("All keys have valid hashes".to_string())
                    } else {
                        None
                    },
                });
            }
        }
    }

    // Check security_policies integrity
    if let Ok(rows) = sqlx::query("SELECT COUNT(*) as count FROM security_policies")
        .fetch_one(&pool)
        .await
    {
        let count: i64 = rows.get("count");
        checks.push(CheckItem {
            name: "security.db security_policies count".to_string(),
            status: CheckStatus::Ok,
            message: if verbose {
                Some(format!("{} policies found", count))
            } else {
                None
            },
        });

        // Check default policy exists and has valid JSON
        if let Ok(Some(policy_row)) =
            sqlx::query("SELECT policy_json FROM security_policies WHERE id = 'default'")
                .fetch_optional(&pool)
                .await
        {
            let policy_json: String = policy_row.get("policy_json");
            match serde_json::from_str::<serde_json::Value>(&policy_json) {
                Ok(_) => {
                    checks.push(CheckItem {
                        name: "security.db default policy JSON".to_string(),
                        status: CheckStatus::Ok,
                        message: if verbose {
                            Some("Policy JSON is valid".to_string())
                        } else {
                            None
                        },
                    });
                }
                Err(e) => {
                    checks.push(CheckItem {
                        name: "security.db default policy JSON".to_string(),
                        status: CheckStatus::Error,
                        message: Some(format!("Invalid JSON: {}", e)),
                    });
                }
            }
        } else if count == 0 {
            checks.push(CheckItem {
                name: "security.db default policy".to_string(),
                status: CheckStatus::Warning,
                message: Some(
                    "Default policy not found (will be created on first use)".to_string(),
                ),
            });
        }
    }

    // Test SecurityService
    match SqliteSecurityRepository::new(db_path).await {
        Ok(repo) => {
            let service = SecurityService::new(repo);
            match service.list_api_keys().await {
                Ok(_) => {
                    checks.push(CheckItem {
                        name: "security.db service access".to_string(),
                        status: CheckStatus::Ok,
                        message: if verbose {
                            Some("SecurityService can access database".to_string())
                        } else {
                            None
                        },
                    });
                }
                Err(e) => {
                    checks.push(CheckItem {
                        name: "security.db service access".to_string(),
                        status: CheckStatus::Error,
                        message: Some(format!("SecurityService error: {}", e)),
                    });
                }
            }
        }
        Err(e) => {
            checks.push(CheckItem {
                name: "security.db service initialization".to_string(),
                status: CheckStatus::Error,
                message: Some(format!("Failed to initialize SecurityService: {}", e)),
            });
        }
    }

    Ok(checks)
}
