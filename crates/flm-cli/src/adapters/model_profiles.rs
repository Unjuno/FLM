//! Model profile repository for config.db

use chrono::Utc;
use flm_core::error::RepoError;
use serde::Serialize;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use sqlx::{QueryBuilder, Row};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use uuid::Uuid;

/// SQLite-backed store for model profiles.
#[derive(Clone)]
pub struct ModelProfileStore {
    pool: SqlitePool,
}

impl ModelProfileStore {
    /// Open config.db (runs migrations).
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

        #[cfg(unix)]
        {
            if let Err(e) = set_db_file_permissions(db_path.as_ref()) {
                eprintln!("Warning: failed to set database file permissions: {e}");
            }
        }

        Ok(Self { pool })
    }

    /// List profiles filtered by engine/model (optional).
    pub async fn list(
        &self,
        engine: Option<&str>,
        model: Option<&str>,
    ) -> Result<Vec<ModelProfileRecord>, RepoError> {
        let mut builder = QueryBuilder::new(
            "SELECT id, engine_id, model_id, label, parameters_json, version, updated_at \
             FROM model_profiles WHERE 1=1",
        );

        if engine.is_some() {
            builder.push(" AND engine_id = ");
            builder.push_bind(engine);
        }

        if model.is_some() {
            builder.push(" AND model_id = ");
            builder.push_bind(model);
        }

        builder.push(" ORDER BY updated_at DESC");

        let rows = builder
            .build_query_as::<ModelProfileRow>()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to list model profiles: {e}"),
            })?;

        rows.into_iter().map(ModelProfileRecord::try_from).collect()
    }

    /// Save (insert/update) a profile.
    pub async fn save(
        &self,
        engine_id: &str,
        model_id: &str,
        label: &str,
        parameters: &serde_json::Value,
    ) -> Result<ModelProfileRecord, RepoError> {
        let parameters_json =
            serde_json::to_string(parameters).map_err(|e| RepoError::IoError {
                reason: format!("Failed to serialize profile parameters: {e}"),
            })?;

        let now = Utc::now().to_rfc3339();

        let existing = sqlx::query(
            "SELECT id, version FROM model_profiles WHERE engine_id = ? AND model_id = ? AND label = ?",
        )
        .bind(engine_id)
        .bind(model_id)
        .bind(label)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to query model profile: {e}"),
        })?;

        let record_id = if let Some(row) = existing {
            let id: String = row.get("id");
            let version: i64 = row.get("version");
            sqlx::query(
                "UPDATE model_profiles SET parameters_json = ?, version = ?, updated_at = ? WHERE id = ?",
            )
            .bind(&parameters_json)
            .bind(version + 1)
            .bind(&now)
            .bind(&id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to update model profile: {e}"),
            })?;
            id
        } else {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO model_profiles (id, engine_id, model_id, label, parameters_json, version, updated_at) \
                 VALUES (?, ?, ?, ?, ?, 1, ?)",
            )
            .bind(&id)
            .bind(engine_id)
            .bind(model_id)
            .bind(label)
            .bind(&parameters_json)
            .bind(&now)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to insert model profile: {e}"),
            })?;
            id
        };

        self.get(&record_id)
            .await?
            .ok_or_else(|| RepoError::NotFound {
                key: record_id.clone(),
            })
    }

    /// Delete profile by ID. Returns true if a row was removed.
    pub async fn delete(&self, id: &str) -> Result<bool, RepoError> {
        let result = sqlx::query("DELETE FROM model_profiles WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to delete model profile: {e}"),
            })?;
        Ok(result.rows_affected() > 0)
    }

    /// Get profile by ID.
    pub async fn get(&self, id: &str) -> Result<Option<ModelProfileRecord>, RepoError> {
        let row = sqlx::query_as::<_, ModelProfileRow>(
            "SELECT id, engine_id, model_id, label, parameters_json, version, updated_at \
             FROM model_profiles WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to fetch model profile: {e}"),
        })?;

        match row {
            Some(row) => Ok(Some(ModelProfileRecord::try_from(row)?)),
            None => Ok(None),
        }
    }
}

#[derive(sqlx::FromRow)]
struct ModelProfileRow {
    id: String,
    engine_id: String,
    model_id: String,
    label: String,
    parameters_json: String,
    version: i64,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelProfileRecord {
    pub id: String,
    pub engine_id: String,
    pub model_id: String,
    pub label: String,
    pub parameters: serde_json::Value,
    pub version: i64,
    pub updated_at: String,
}

impl TryFrom<ModelProfileRow> for ModelProfileRecord {
    type Error = RepoError;

    fn try_from(row: ModelProfileRow) -> Result<Self, Self::Error> {
        let parameters: serde_json::Value =
            serde_json::from_str(&row.parameters_json).map_err(|e| RepoError::IoError {
                reason: format!("Failed to parse profile parameters: {e}"),
            })?;

        Ok(Self {
            id: row.id,
            engine_id: row.engine_id,
            model_id: row.model_id,
            label: row.label,
            parameters,
            version: row.version,
            updated_at: row.updated_at,
        })
    }
}

#[cfg(unix)]
fn set_db_file_permissions<P: AsRef<Path>>(db_path: P) -> Result<(), std::io::Error> {
    use std::fs;
    let metadata = fs::metadata(&db_path)?;
    let mut perms = metadata.permissions();
    perms.set_mode(0o600);
    fs::set_permissions(&db_path, perms)
}
