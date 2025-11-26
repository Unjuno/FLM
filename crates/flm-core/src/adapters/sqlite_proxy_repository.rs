//! SQLite-backed ProxyRepository implementation shared by CLI and daemon.

use crate::domain::proxy::{ProxyConfig, ProxyHandle, ProxyProfile};
use crate::error::RepoError;
use crate::ports::ProxyRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;

/// SQLite-based ProxyRepository implementation.
pub struct SqliteProxyRepository {
    pool: SqlitePool,
}

impl SqliteProxyRepository {
    /// Create a new ProxyRepository with a SQLite connection.
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
            let config: ProxyConfig =
                serde_json::from_str(&config_json).map_err(|e| RepoError::IoError {
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
            let config: ProxyConfig =
                serde_json::from_str(&config_json).map_err(|e| RepoError::IoError {
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
        let rows = sqlx::query_as::<_, (String, String)>(
            "SELECT id, handle_json FROM active_proxy_handles",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to list active proxy handles: {e}"),
        })?;

        let mut handles = Vec::new();
        for (_id, handle_json) in rows {
            let handle: ProxyHandle =
                serde_json::from_str(&handle_json).map_err(|e| RepoError::IoError {
                    reason: format!("Failed to deserialize proxy handle: {e}"),
                })?;
            handles.push(handle);
        }

        Ok(handles)
    }

    async fn save_active_handle(&self, handle: ProxyHandle) -> Result<(), RepoError> {
        let handle_json = serde_json::to_string(&handle).map_err(|e| RepoError::IoError {
            reason: format!("Failed to serialize proxy handle: {e}"),
        })?;

        sqlx::query(
            "INSERT OR REPLACE INTO active_proxy_handles (id, handle_json, created_at) VALUES (?, ?, datetime('now'))",
        )
        .bind(&handle.id)
        .bind(&handle_json)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to save active proxy handle: {e}"),
        })?;

        Ok(())
    }

    async fn remove_active_handle(&self, handle_id: &str) -> Result<(), RepoError> {
        sqlx::query("DELETE FROM active_proxy_handles WHERE id = ?")
            .bind(handle_id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to remove active proxy handle: {e}"),
            })?;

        Ok(())
    }
}
