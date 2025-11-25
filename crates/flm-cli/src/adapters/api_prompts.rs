//! API prompt repository for config.db

use chrono::Utc;
use flm_core::error::RepoError;
use serde::Serialize;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::Row;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

#[derive(Clone)]
pub struct ApiPromptStore {
    pool: sqlx::SqlitePool,
}

impl ApiPromptStore {
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

    pub async fn list(&self) -> Result<Vec<ApiPromptRecord>, RepoError> {
        let rows = sqlx::query_as::<_, ApiPromptRecordRow>(
            "SELECT api_id, template_text, version, updated_at FROM api_prompts ORDER BY api_id",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to list API prompts: {e}"),
        })?;

        Ok(rows.into_iter().map(ApiPromptRecord::from).collect())
    }

    pub async fn get(&self, api_id: &str) -> Result<Option<ApiPromptRecord>, RepoError> {
        let row = sqlx::query_as::<_, ApiPromptRecordRow>(
            "SELECT api_id, template_text, version, updated_at FROM api_prompts WHERE api_id = ?",
        )
        .bind(api_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to fetch API prompt: {e}"),
        })?;

        Ok(row.map(ApiPromptRecord::from))
    }

    pub async fn set(
        &self,
        api_id: &str,
        template_text: &str,
    ) -> Result<ApiPromptRecord, RepoError> {
        let now = Utc::now().to_rfc3339();

        let existing = sqlx::query("SELECT version FROM api_prompts WHERE api_id = ?")
            .bind(api_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to query API prompt: {e}"),
            })?;

        if let Some(row) = existing {
            let version: i64 = row.get("version");
            sqlx::query(
                "UPDATE api_prompts SET template_text = ?, version = ?, updated_at = ? WHERE api_id = ?",
            )
            .bind(template_text)
            .bind(version + 1)
            .bind(&now)
            .bind(api_id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to update API prompt: {e}"),
            })?;
        } else {
            sqlx::query(
                "INSERT INTO api_prompts (api_id, template_text, version, updated_at) VALUES (?, ?, 1, ?)",
            )
            .bind(api_id)
            .bind(template_text)
            .bind(&now)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to insert API prompt: {e}"),
            })?;
        }

        self.get(api_id).await?.ok_or_else(|| RepoError::NotFound {
            key: api_id.to_string(),
        })
    }
}

#[derive(sqlx::FromRow)]
struct ApiPromptRecordRow {
    api_id: String,
    template_text: String,
    version: i64,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ApiPromptRecord {
    pub api_id: String,
    pub template_text: String,
    pub version: i64,
    pub updated_at: String,
}

impl From<ApiPromptRecordRow> for ApiPromptRecord {
    fn from(row: ApiPromptRecordRow) -> Self {
        Self {
            api_id: row.api_id,
            template_text: row.template_text,
            version: row.version,
            updated_at: row.updated_at,
        }
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
