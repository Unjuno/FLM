//! SecurityRepository implementation using SQLite

use flm_core::domain::security::{ApiKeyRecord, SecurityPolicy};
use flm_core::error::RepoError;
use flm_core::ports::SecurityRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::str::FromStr;

/// SQLite-based SecurityRepository implementation
pub struct SqliteSecurityRepository {
    pool: SqlitePool,
}

impl SqliteSecurityRepository {
    /// Create a new SecurityRepository with a SQLite connection
    ///
    /// # Arguments
    /// * `db_path` - Path to the security.db file
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
                reason: format!("Failed to connect to security.db: {e}"),
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
                reason: format!("Security DB migration failed: {e}"),
            })?;

        Ok(Self { pool })
    }

    /// Get the connection pool (for migration)
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

impl SecurityRepository for SqliteSecurityRepository {
    fn save_api_key(&self, key: ApiKeyRecord) -> Result<(), RepoError> {
        let rt = tokio::runtime::Handle::try_current().map_err(|_| RepoError::IoError {
            reason: "No async runtime available".to_string(),
        })?;

        rt.block_on(async {
            sqlx::query(
                "INSERT OR REPLACE INTO api_keys (id, label, hash, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(&key.id)
            .bind(&key.label)
            .bind(&key.hash)
            .bind(&key.created_at)
            .bind(&key.revoked_at)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to save API key: {e}"),
            })?;

            Ok(())
        })
    }

    fn fetch_api_key(&self, id: &str) -> Result<Option<ApiKeyRecord>, RepoError> {
        let rt = tokio::runtime::Handle::try_current().map_err(|_| RepoError::IoError {
            reason: "No async runtime available".to_string(),
        })?;

        rt.block_on(async {
            let row = sqlx::query_as::<_, (String, String, String, String, Option<String>)>(
                "SELECT id, label, hash, created_at, revoked_at FROM api_keys WHERE id = ?",
            )
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to fetch API key: {e}"),
            })?;

            Ok(
                row.map(|(id, label, hash, created_at, revoked_at)| ApiKeyRecord {
                    id,
                    label,
                    hash,
                    created_at,
                    revoked_at,
                }),
            )
        })
    }

    fn list_api_keys(&self) -> Result<Vec<ApiKeyRecord>, RepoError> {
        let rt = tokio::runtime::Handle::try_current().map_err(|_| RepoError::IoError {
            reason: "No async runtime available".to_string(),
        })?;

        rt.block_on(async {
            let rows = sqlx::query_as::<_, (String, String, String, String, Option<String>)>(
                "SELECT id, label, hash, created_at, revoked_at FROM api_keys ORDER BY created_at DESC",
            )
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to list API keys: {e}"),
            })?;

            Ok(rows
                .into_iter()
                .map(|(id, label, hash, created_at, revoked_at)| ApiKeyRecord {
                    id,
                    label,
                    hash,
                    created_at,
                    revoked_at,
                })
                .collect())
        })
    }

    fn mark_api_key_revoked(&self, id: &str, revoked_at: &str) -> Result<(), RepoError> {
        let rt = tokio::runtime::Handle::try_current().map_err(|_| RepoError::IoError {
            reason: "No async runtime available".to_string(),
        })?;

        rt.block_on(async {
            sqlx::query("UPDATE api_keys SET revoked_at = ? WHERE id = ?")
                .bind(revoked_at)
                .bind(id)
                .execute(&self.pool)
                .await
                .map_err(|e| RepoError::IoError {
                    reason: format!("Failed to revoke API key: {e}"),
                })?;

            Ok(())
        })
    }

    fn save_policy(&self, policy: SecurityPolicy) -> Result<(), RepoError> {
        let rt = tokio::runtime::Handle::try_current().map_err(|_| RepoError::IoError {
            reason: "No async runtime available".to_string(),
        })?;

        rt.block_on(async {
            sqlx::query(
                "INSERT OR REPLACE INTO security_policies (id, policy_json, updated_at) VALUES (?, ?, ?)",
            )
            .bind(&policy.id)
            .bind(&policy.policy_json)
            .bind(&policy.updated_at)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to save policy: {e}"),
            })?;

            Ok(())
        })
    }

    fn fetch_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError> {
        let rt = tokio::runtime::Handle::try_current().map_err(|_| RepoError::IoError {
            reason: "No async runtime available".to_string(),
        })?;

        rt.block_on(async {
            let row = sqlx::query_as::<_, (String, String, String)>(
                "SELECT id, policy_json, updated_at FROM security_policies WHERE id = ?",
            )
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to fetch policy: {e}"),
            })?;

            Ok(row.map(|(id, policy_json, updated_at)| SecurityPolicy {
                id,
                policy_json,
                updated_at,
            }))
        })
    }

    fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError> {
        let rt = tokio::runtime::Handle::try_current().map_err(|_| RepoError::IoError {
            reason: "No async runtime available".to_string(),
        })?;

        rt.block_on(async {
            let rows = sqlx::query_as::<_, (String, String, String)>(
                "SELECT id, policy_json, updated_at FROM security_policies ORDER BY updated_at DESC",
            )
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to list policies: {e}"),
            })?;

            Ok(rows
                .into_iter()
                .map(|(id, policy_json, updated_at)| SecurityPolicy {
                    id,
                    policy_json,
                    updated_at,
                })
                .collect())
        })
    }
}
