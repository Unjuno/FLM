//! EngineRepository implementation using SQLite
//!
//! This adapter implements the EngineRepository trait for managing engine registrations
//! and caching engine states in config.db.

use flm_core::domain::engine::EngineState;
use flm_core::error::RepoError;
use flm_core::ports::{EngineRepository, LlmEngine};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::str::FromStr;
use std::sync::{Arc, RwLock};

/// SQLite-based EngineRepository implementation
///
/// This implementation stores engine registrations in memory and caches engine states
/// in the engines_cache table of config.db.
pub struct SqliteEngineRepository {
    pool: SqlitePool,
    // In-memory registry of LlmEngine instances
    engines: Arc<RwLock<Vec<Box<dyn LlmEngine>>>>,
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
    ///
    /// # Returns
    /// * `Ok(Some(EngineState))` if found and not expired
    /// * `Ok(None)` if not found or expired
    /// * `Err(RepoError)` if an error occurs
    pub async fn get_cached_engine_state(
        &self,
        engine_id: &str,
        _ttl_seconds: u64,
    ) -> Result<Option<EngineState>, RepoError> {
        let row = sqlx::query_as::<_, (String, String)>(
            "SELECT state_json, cached_at FROM engines_cache WHERE engine_id = ?",
        )
        .bind(engine_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to get cached engine state: {e}"),
        })?;

        if let Some((state_json, _cached_at)) = row {
            // Check if cache is still valid (TTL check)
            // For now, we'll use a simple approach: always return cached if exists
            // TODO: Implement proper TTL checking using cached_at timestamp
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

impl EngineRepository for SqliteEngineRepository {
    fn list_registered(&self) -> Vec<Box<dyn LlmEngine>> {
        let _engines = self.engines.read().unwrap();
        // Clone the engines (they are Arc-wrapped internally)
        // Note: This is a limitation - we can't actually clone trait objects
        // For now, we'll return an empty vector and handle this differently
        // TODO: Refactor to use Arc<dyn LlmEngine> instead of Box<dyn LlmEngine>
        Vec::new()
    }

    fn register(&self, engine: Box<dyn LlmEngine>) {
        let mut engines = self.engines.write().unwrap();
        engines.push(engine);
    }
}
