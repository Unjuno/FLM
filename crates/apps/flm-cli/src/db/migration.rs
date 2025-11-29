//! Database migration utilities

use flm_core::error::RepoError;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
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
    sqlx::migrate!("../../core/flm-core/migrations")
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
    sqlx::migrate!("../../core/flm-core/migrations")
        .run(&pool)
        .await
        .map_err(|e| RepoError::MigrationFailed {
            reason: format!("Security DB migration failed: {e}"),
        })?;

    // Enforce restrictive permissions (chmod 600 equivalent on Unix)
    set_secure_permissions(db_path.as_ref()).map_err(|e| RepoError::IoError {
        reason: format!("Failed to set security.db permissions: {e}"),
    })?;

    Ok(())
}

#[cfg(unix)]
fn set_secure_permissions(path: &Path) -> std::io::Result<()> {
    let metadata = std::fs::metadata(path)?;
    let mut perms = metadata.permissions();
    // rw------- (600)
    perms.set_mode(0o600);
    std::fs::set_permissions(path, perms)
}

#[cfg(not(unix))]
fn set_secure_permissions(_path: &Path) -> std::io::Result<()> {
    // Windows and other platforms rely on ACL defaults; no-op
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[cfg(unix)]
    #[test]
    fn set_secure_permissions_unix_sets_mode() {
        let file = NamedTempFile::new().expect("temp file");
        set_secure_permissions(file.path()).expect("set permissions");

        let metadata = std::fs::metadata(file.path()).expect("metadata");
        let mode = metadata.permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
    }

    #[cfg(not(unix))]
    #[test]
    fn set_secure_permissions_noop_non_unix() {
        let file = NamedTempFile::new().expect("temp file");
        // Should not error even though it is a no-op
        set_secure_permissions(file.path()).expect("set permissions noop");
    }
}
