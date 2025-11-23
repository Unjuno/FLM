//! ProxyRepository implementation using SQLite
//!
//! This adapter implements the ProxyRepository trait for managing proxy profiles
//! and active handles in config.db.

use flm_core::domain::proxy::{ProxyHandle, ProxyProfile};
use flm_core::error::RepoError;
use flm_core::ports::ProxyRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;

/// SQLite-based ProxyRepository implementation
pub struct SqliteProxyRepository {
    pool: SqlitePool,
}

impl SqliteProxyRepository {
    /// Create a new ProxyRepository with a SQLite connection
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
        sqlx::migrate!("../flm-core/migrations")
            .run(&pool)
            .await
            .map_err(|e| RepoError::MigrationFailed {
                reason: format!("Config DB migration failed: {e}"),
            })?;

        Ok(Self { pool })
    }
}

#[async_trait::async_trait]
impl ProxyRepository for SqliteProxyRepository {
    async fn save_profile(&self, profile: ProxyProfile) -> Result<(), RepoError> {
        let config_json =
            serde_json::to_string(&profile.config).map_err(|e| RepoError::IoError {
                reason: format!("Failed to serialize proxy config: {e}"),
            })?;

        sqlx::query(
            "INSERT OR REPLACE INTO proxy_profiles (id, config_json, created_at) VALUES (?, ?, ?)",
        )
        .bind(&profile.id)
        .bind(&config_json)
        .bind(&profile.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to save proxy profile: {e}"),
        })?;

        Ok(())
    }

    async fn load_profile(&self, id: &str) -> Result<Option<ProxyProfile>, RepoError> {
        let row = sqlx::query_as::<_, (String, String, String)>(
            "SELECT id, config_json, created_at FROM proxy_profiles WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to load proxy profile: {e}"),
        })?;

        if let Some((id, config_json, created_at)) = row {
            let config: flm_core::domain::proxy::ProxyConfig = serde_json::from_str(&config_json)
                .map_err(|e| RepoError::IoError {
                reason: format!("Failed to deserialize proxy config: {e}"),
            })?;

            Ok(Some(ProxyProfile {
                id,
                config,
                created_at,
            }))
        } else {
            Ok(None)
        }
    }

    async fn list_profiles(&self) -> Result<Vec<ProxyProfile>, RepoError> {
        let rows = sqlx::query_as::<_, (String, String, String)>(
            "SELECT id, config_json, created_at FROM proxy_profiles ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to list proxy profiles: {e}"),
        })?;

        let mut profiles = Vec::new();
        for (id, config_json, created_at) in rows {
            let config: flm_core::domain::proxy::ProxyConfig = serde_json::from_str(&config_json)
                .map_err(|e| RepoError::IoError {
                reason: format!("Failed to deserialize proxy config: {e}"),
            })?;

            profiles.push(ProxyProfile {
                id,
                config,
                created_at,
            });
        }

        Ok(profiles)
    }

    async fn list_active_handles(&self) -> Result<Vec<ProxyHandle>, RepoError> {
        // Note: Active handles are managed in memory by ProxyController.
        // This method returns an empty vector for now.
        // In a production system, we might store handles in a separate table
        // or use a shared state manager.
        Ok(Vec::new())
    }
}
