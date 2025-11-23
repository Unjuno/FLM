//! Database migration utilities

use flm_core::error::RepoError;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::path::Path;

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

    let options = SqliteConnectOptions::new()
        .filename(path_str)
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to connect to config.db: {e}"),
        })?;

    // Run migrations from flm-core/migrations directory
    sqlx::migrate!("../flm-core/migrations")
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

    let options = SqliteConnectOptions::new()
        .filename(path_str)
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to connect to security.db: {e}"),
        })?;

    // Run migrations from flm-core/migrations directory
    sqlx::migrate!("../flm-core/migrations")
        .run(&pool)
        .await
        .map_err(|e| RepoError::MigrationFailed {
            reason: format!("Security DB migration failed: {e}"),
        })?;

    Ok(())
}
