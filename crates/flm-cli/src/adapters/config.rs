//! ConfigRepository implementation using SQLite

use flm_core::error::RepoError;
use flm_core::ports::ConfigRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::str::FromStr;

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

        let options = SqliteConnectOptions::from_str(path_str)
            .map_err(|e| RepoError::IoError {
                reason: format!("Invalid database path: {}", e),
            })?
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to connect to config.db: {}", e),
            })?;

        // Run migrations
        crate::db::migration::migrate_config_db(db_path).await?;

        Ok(Self { pool })
    }

    /// Get the connection pool (for migration)
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

impl ConfigRepository for SqliteConfigRepository {
    fn get(&self, key: &str) -> Result<Option<String>, RepoError> {
        // Use tokio::runtime::Handle to run async code in sync context
        let rt = tokio::runtime::Handle::try_current().map_err(|_| RepoError::IoError {
            reason: "No async runtime available".to_string(),
        })?;

        rt.block_on(async {
            let row = sqlx::query_as::<_, (String,)>(
                "SELECT value FROM settings WHERE key = ?",
            )
            .bind(key)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to get config: {}", e),
            })?;

            Ok(row.map(|r| r.0))
        })
    }

    fn set(&self, key: &str, value: &str) -> Result<(), RepoError> {
        let rt = tokio::runtime::Handle::try_current().map_err(|_| RepoError::IoError {
            reason: "No async runtime available".to_string(),
        })?;

        rt.block_on(async {
            sqlx::query(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
            )
            .bind(key)
            .bind(value)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to set config: {}", e),
            })?;

            Ok(())
        })
    }

    fn list(&self) -> Result<Vec<(String, String)>, RepoError> {
        let rt = tokio::runtime::Handle::try_current().map_err(|_| RepoError::IoError {
            reason: "No async runtime available".to_string(),
        })?;

        rt.block_on(async {
            let rows = sqlx::query_as::<_, (String, String)>(
                "SELECT key, value FROM settings ORDER BY key",
            )
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to list config: {}", e),
            })?;

            Ok(rows)
        })
    }
}

