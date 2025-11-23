//! EngineRepository implementation using SQLite
//!
//! This adapter implements the EngineRepository trait for managing engine registrations
//! and caching engine states in config.db.

use async_trait::async_trait;
use flm_core::domain::engine::EngineState;
use flm_core::error::RepoError;
use flm_core::ports::{EngineRepository, LlmEngine};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::sync::{Arc, RwLock};

/// SQLite-based EngineRepository implementation
///
/// This implementation stores engine registrations in memory and caches engine states
/// in the engines_cache table of config.db.
pub struct SqliteEngineRepository {
    pool: SqlitePool,
    // In-memory registry of LlmEngine instances
    engines: Arc<RwLock<Vec<Arc<dyn LlmEngine>>>>,
}

impl SqliteEngineRepository {
    /// Create a new EngineRepository with a SQLite connection
    ///
    /// # Arguments
    /// * `db_path` - Path to the config.db file
    ///
    /// # Errors
    /// Returns `RepoError` if the database connection fails
    pub async fn new<P: AsRef<Path>>(db_path: P) -> Result<Arc<Self>, RepoError> {
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

        // Run migrations on the pool we just created
        sqlx::migrate!("../flm-core/migrations")
            .run(&pool)
            .await
            .map_err(|e| RepoError::MigrationFailed {
                reason: format!("Config DB migration failed: {e}"),
            })?;

        Ok(Arc::new(Self {
            pool,
            engines: Arc::new(RwLock::new(Vec::new())),
        }))
    }

    /// Cache an engine state
    ///
    /// # Arguments
    /// * `state` - The engine state to cache
    ///
    /// # Errors
    /// Returns `RepoError` if caching fails
    pub async fn cache_engine_state(&self, state: &EngineState) -> Result<(), RepoError> {
        let state_json = serde_json::to_string(state).map_err(|e| RepoError::IoError {
            reason: format!("Failed to serialize engine state: {e}"),
        })?;

        sqlx::query(
            "INSERT OR REPLACE INTO engines_cache (engine_id, state_json, cached_at) VALUES (?, ?, datetime('now'))",
        )
        .bind(&state.id)
        .bind(&state_json)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to cache engine state: {e}"),
        })?;

        Ok(())
    }

    /// Get a cached engine state
    ///
    /// # Arguments
    /// * `engine_id` - The engine ID to look up
    /// * `ttl_seconds` - Time-to-live in seconds (cache expires after this duration)
    ///
    /// # Returns
    /// * `Ok(Some(EngineState))` if found and not expired
    /// * `Ok(None)` if not found or expired
    /// * `Err(RepoError)` if an error occurs
    pub async fn get_cached_engine_state(
        &self,
        engine_id: &str,
        ttl_seconds: u64,
    ) -> Result<Option<EngineState>, RepoError> {
        // Use SQLite datetime functions to check if cache is still valid
        // cached_at + ttl_seconds should be >= current time
        let row = sqlx::query_as::<_, (String,)>(
            "SELECT state_json FROM engines_cache 
             WHERE engine_id = ? 
             AND datetime(cached_at, '+' || ? || ' seconds') >= datetime('now')",
        )
        .bind(engine_id)
        .bind(ttl_seconds.to_string())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to get cached engine state: {e}"),
        })?;

        if let Some((state_json,)) = row {
            let state: EngineState =
                serde_json::from_str(&state_json).map_err(|e| RepoError::IoError {
                    reason: format!("Failed to deserialize engine state: {e}"),
                })?;
            Ok(Some(state))
        } else {
            Ok(None)
        }
    }
}

#[async_trait]
impl EngineRepository for SqliteEngineRepository {
    async fn list_registered(&self) -> Vec<Arc<dyn LlmEngine>> {
        let engines = self
            .engines
            .read()
            .expect("Failed to acquire read lock on engine registry");
        engines.clone()
    }

    async fn register(&self, engine: Arc<dyn LlmEngine>) {
        let mut engines = self
            .engines
            .write()
            .expect("Failed to acquire write lock on engine registry");
        engines.push(engine);
    }
}
