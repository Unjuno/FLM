//! Database migration utilities

use flm_core::error::RepoError;
use sqlx::migrate::Migrator;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::{Path, PathBuf};
use std::str::FromStr;

/// Find the migrations directory path
///
/// This function searches for the migrations directory starting from
/// the current working directory and going up to find the workspace root.
fn find_migrations_path() -> Result<PathBuf, RepoError> {
    let current_dir = std::env::current_dir().map_err(|e| RepoError::IoError {
        reason: format!("Failed to get current directory: {e}"),
    })?;

    // Try common paths relative to workspace root
    let candidates = vec![
        current_dir.join("crates/flm-core/migrations"),
        current_dir.join("../flm-core/migrations"),
        current_dir.join("../../flm-core/migrations"),
    ];

    for path in candidates {
        if path.exists() && path.is_dir() {
            return Ok(path);
        }
    }

    Err(RepoError::IoError {
        reason: "Could not find migrations directory".to_string(),
    })
}

/// Run migrations on config.db
///
/// # Arguments
/// * `db_path` - Path to the config.db file
///
/// # Errors
/// Returns `RepoError` if migration fails
pub async fn migrate_config_db<P: AsRef<Path>>(db_path: P) -> Result<(), RepoError> {
    let path_str = db_path
        .as_ref()
        .to_str()
        .ok_or_else(|| RepoError::IoError {
            reason: "Invalid database path (non-UTF8)".to_string(),
        })?;

    let options = SqliteConnectOptions::from_str(path_str)
        .map_err(|e| RepoError::IoError {
            reason: format!("Invalid database path: {e}"),
        })?
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to connect to config.db: {e}"),
        })?;

    // Run migrations from flm-core/migrations directory
    // Find migrations path relative to workspace root
    let migrations_path = find_migrations_path()?;
    let migrator =
        Migrator::new(&*migrations_path)
            .await
            .map_err(|e| RepoError::MigrationFailed {
                reason: format!("Failed to create migrator: {e}"),
            })?;

    migrator
        .run(&pool)
        .await
        .map_err(|e| RepoError::MigrationFailed {
            reason: format!("Config DB migration failed: {e}"),
        })?;

    Ok(())
}

/// Run migrations on security.db
///
/// # Arguments
/// * `db_path` - Path to the security.db file
///
/// # Errors
/// Returns `RepoError` if migration fails
pub async fn migrate_security_db<P: AsRef<Path>>(db_path: P) -> Result<(), RepoError> {
    let path_str = db_path
        .as_ref()
        .to_str()
        .ok_or_else(|| RepoError::IoError {
            reason: "Invalid database path (non-UTF8)".to_string(),
        })?;

    let options = SqliteConnectOptions::from_str(path_str)
        .map_err(|e| RepoError::IoError {
            reason: format!("Invalid database path: {e}"),
        })?
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to connect to security.db: {e}"),
        })?;

    // Run migrations from flm-core/migrations directory
    // Find migrations path relative to workspace root
    let migrations_path = find_migrations_path()?;
    let migrator =
        Migrator::new(&*migrations_path)
            .await
            .map_err(|e| RepoError::MigrationFailed {
                reason: format!("Failed to create migrator: {e}"),
            })?;

    migrator
        .run(&pool)
        .await
        .map_err(|e| RepoError::MigrationFailed {
            reason: format!("Security DB migration failed: {e}"),
        })?;

    Ok(())
}
