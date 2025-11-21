//! ConfigRepository implementation using SQLite

use flm_core::error::RepoError;
use flm_core::ports::ConfigRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::future::Future;
use std::path::Path;
use std::str::FromStr;
use tokio::runtime::{Handle, Runtime, RuntimeFlavor};
use tokio::task;

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

        // Run migrations on the pool we just created
        let migrations_path = crate::db::migration::find_migrations_path()?;
        let migrator = sqlx::migrate::Migrator::new(&*migrations_path)
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

        Ok(Self { pool })
    }

    /// Get the connection pool (for migration)
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

impl ConfigRepository for SqliteConfigRepository {
    fn get(&self, key: &str) -> Result<Option<String>, RepoError> {
        run_blocking(async {
            let row = sqlx::query_as::<_, (String,)>("SELECT value FROM settings WHERE key = ?")
                .bind(key)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| RepoError::IoError {
                    reason: format!("Failed to get config: {e}"),
                })?;

            Ok(row.map(|r| r.0))
        })
    }

    fn set(&self, key: &str, value: &str) -> Result<(), RepoError> {
        run_blocking(async {
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
        })
    }

    fn list(&self) -> Result<Vec<(String, String)>, RepoError> {
        run_blocking(async {
            let rows = sqlx::query_as::<_, (String, String)>(
                "SELECT key, value FROM settings ORDER BY key",
            )
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to list config: {e}"),
            })?;

            Ok(rows)
        })
    }
}

fn run_blocking<F, T>(future: F) -> Result<T, RepoError>
where
    F: Future<Output = Result<T, RepoError>>,
{
    if let Ok(handle) = Handle::try_current() {
        if handle.runtime_flavor() == RuntimeFlavor::MultiThread {
            return task::block_in_place(|| handle.block_on(future));
        }
    }

    let rt = Runtime::new().map_err(|e| RepoError::IoError {
        reason: format!("Failed to create async runtime: {e}"),
    })?;
    rt.block_on(future)
}
