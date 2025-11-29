//! ConfigRepository implementation using SQLite

use flm_core::error::RepoError;
use flm_core::ports::ConfigRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

/// SQLite-based ConfigRepository implementation
pub struct SqliteConfigRepository {
    pool: SqlitePool,
}

impl SqliteConfigRepository {
    /// Create a new ConfigRepository with a SQLite connection
    ///
    /// # Arguments
    /// * `db_path` - Path to the config.db file
    ///
    /// # Errors
    /// Returns `RepoError` if the database connection fails
    pub async fn new<P: AsRef<Path>>(db_path: P) -> Result<Self, RepoError> {
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
            .max_connections(5)
            .connect_with(options)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to connect to config.db: {e}"),
            })?;

        // Run migrations on the pool we just created
        sqlx::migrate!("../../core/flm-core/migrations")
            .run(&pool)
            .await
            .map_err(|e| RepoError::MigrationFailed {
                reason: format!("Config DB migration failed: {e}"),
            })?;

        // Set restrictive file permissions (Unix only: chmod 600 equivalent)
        // On Windows, file permissions are managed differently and default permissions are usually sufficient
        #[cfg(unix)]
        {
            if let Err(e) = set_db_file_permissions(db_path.as_ref()) {
                // Log warning but don't fail - database is already created and functional
                eprintln!("Warning: Failed to set database file permissions: {}", e);
            }
        }

        Ok(Self { pool })
    }

    /// Get the connection pool (for migration)
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

#[async_trait::async_trait]
impl ConfigRepository for SqliteConfigRepository {
    async fn get(&self, key: &str) -> Result<Option<String>, RepoError> {
        let row = sqlx::query_as::<_, (String,)>("SELECT value FROM settings WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to get config: {e}"),
            })?;

        Ok(row.map(|r| r.0))
    }

    async fn set(&self, key: &str, value: &str) -> Result<(), RepoError> {
        sqlx::query(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        )
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to set config: {e}"),
        })?;

        Ok(())
    }

    async fn list(&self) -> Result<Vec<(String, String)>, RepoError> {
        let rows =
            sqlx::query_as::<_, (String, String)>("SELECT key, value FROM settings ORDER BY key")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| RepoError::IoError {
                    reason: format!("Failed to list config: {e}"),
                })?;

        Ok(rows)
    }
}

/// Set restrictive file permissions for database files (Unix only)
///
/// Sets permissions to 600 (rw-------) to ensure only the owner can read/write.
/// On Windows, this function is a no-op as Windows uses a different permission model.
#[cfg(unix)]
fn set_db_file_permissions<P: AsRef<Path>>(db_path: P) -> Result<(), std::io::Error> {
    use std::fs;
    let metadata = fs::metadata(&db_path)?;
    let mut perms = metadata.permissions();
    // chmod 600: owner read+write, group/others no access
    perms.set_mode(0o600);
    fs::set_permissions(&db_path, perms)
}
