//! SQLite-based EngineHealthLogRepository implementation

use chrono::{DateTime, Utc};
use flm_core::domain::engine::HealthStatus;
use flm_core::error::RepoError;
use flm_core::ports::engine_health_log::{
    EngineHealthLog, EngineHealthLogRepository, EngineHealthSummary,
};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;

/// SQLite-based EngineHealthLogRepository implementation
pub struct SqliteEngineHealthLogRepository {
    pool: SqlitePool,
}

impl SqliteEngineHealthLogRepository {
    /// Create a new EngineHealthLogRepository with a SQLite connection
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

        sqlx::migrate!("../../core/flm-core/migrations")
            .run(&pool)
            .await
            .map_err(|e| RepoError::MigrationFailed {
                reason: format!("Config DB migration failed: {e}"),
            })?;

        Ok(Self { pool })
    }
}

#[async_trait::async_trait]
impl EngineHealthLogRepository for SqliteEngineHealthLogRepository {
    async fn record_health_check(
        &self,
        engine_id: &str,
        model_id: Option<&str>,
        status: &HealthStatus,
        error_rate: f64,
    ) -> Result<(), RepoError> {
        let status_str = match status {
            HealthStatus::Healthy { .. } => "healthy",
            HealthStatus::Degraded { .. } => "degraded",
            HealthStatus::Unreachable { .. } => "unreachable",
        };

        let latency_ms = match status {
            HealthStatus::Healthy { latency_ms } => Some(*latency_ms),
            HealthStatus::Degraded { latency_ms, .. } => Some(*latency_ms),
            HealthStatus::Unreachable { .. } => None,
        };

        sqlx::query(
            "INSERT INTO engine_health_logs (engine_id, model_id, status, latency_ms, error_rate, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(engine_id)
        .bind(model_id)
        .bind(status_str)
        .bind(latency_ms.map(|l| l as i64))
        .bind(error_rate)
        .bind(Utc::now())
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to record health check: {e}"),
        })?;

        Ok(())
    }

    async fn get_engine_logs(
        &self,
        engine_id: &str,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<EngineHealthLog>, RepoError> {
        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);

        let rows = sqlx::query_as::<_, (i64, String, Option<String>, String, Option<i64>, f64, String)>(
            "SELECT id, engine_id, model_id, status, latency_ms, error_rate, created_at FROM engine_health_logs WHERE engine_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(engine_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to get engine logs: {e}"),
        })?;

        let logs = rows
            .into_iter()
            .map(
                |(id, engine_id, model_id, status, latency_ms, error_rate, created_at)| {
                    let created_at = DateTime::parse_from_rfc3339(&created_at)
                        .map_err(|e| RepoError::IoError {
                            reason: format!("Failed to parse created_at: {e}"),
                        })?
                        .with_timezone(&Utc);

                    Ok(EngineHealthLog {
                        id,
                        engine_id,
                        model_id,
                        status,
                        latency_ms: latency_ms.map(|l| l as u64),
                        error_rate,
                        created_at,
                    })
                },
            )
            .collect::<Result<Vec<_>, RepoError>>()?;

        Ok(logs)
    }

    async fn get_model_logs(
        &self,
        model_id: &str,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<EngineHealthLog>, RepoError> {
        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);

        let rows = sqlx::query_as::<_, (i64, String, Option<String>, String, Option<i64>, f64, String)>(
            "SELECT id, engine_id, model_id, status, latency_ms, error_rate, created_at FROM engine_health_logs WHERE model_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(model_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to get model logs: {e}"),
        })?;

        let logs = rows
            .into_iter()
            .map(
                |(id, engine_id, model_id, status, latency_ms, error_rate, created_at)| {
                    let created_at = DateTime::parse_from_rfc3339(&created_at)
                        .map_err(|e| RepoError::IoError {
                            reason: format!("Failed to parse created_at: {e}"),
                        })?
                        .with_timezone(&Utc);

                    Ok(EngineHealthLog {
                        id,
                        engine_id,
                        model_id,
                        status,
                        latency_ms: latency_ms.map(|l| l as u64),
                        error_rate,
                        created_at,
                    })
                },
            )
            .collect::<Result<Vec<_>, RepoError>>()?;

        Ok(logs)
    }

    async fn get_logs_in_range(
        &self,
        engine_id: Option<&str>,
        model_id: Option<&str>,
        start_time: DateTime<Utc>,
        end_time: DateTime<Utc>,
        limit: Option<u32>,
    ) -> Result<Vec<EngineHealthLog>, RepoError> {
        let limit = limit.unwrap_or(1000);

        let mut query = String::from(
            "SELECT id, engine_id, model_id, status, latency_ms, error_rate, created_at FROM engine_health_logs WHERE created_at >= ? AND created_at <= ?",
        );
        let mut bind_engine_id = false;
        let mut bind_model_id = false;

        if engine_id.is_some() {
            query.push_str(" AND engine_id = ?");
            bind_engine_id = true;
        }
        if model_id.is_some() {
            query.push_str(" AND model_id = ?");
            bind_model_id = true;
        }
        query.push_str(" ORDER BY created_at DESC LIMIT ?");

        let mut query_builder = sqlx::query_as::<
            _,
            (
                i64,
                String,
                Option<String>,
                String,
                Option<i64>,
                f64,
                String,
            ),
        >(&query)
        .bind(start_time.to_rfc3339())
        .bind(end_time.to_rfc3339());

        if bind_engine_id {
            if let Some(eid) = engine_id {
                query_builder = query_builder.bind(eid);
            } else {
                return Err(RepoError::ValidationError {
                    reason: "engine_id is required but not provided".to_string(),
                });
            }
        }
        if bind_model_id {
            if let Some(mid) = model_id {
                query_builder = query_builder.bind(mid);
            } else {
                return Err(RepoError::ValidationError {
                    reason: "model_id is required but not provided".to_string(),
                });
            }
        }
        query_builder = query_builder.bind(limit as i64);

        let rows = query_builder
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to get logs in range: {e}"),
            })?;

        let logs = rows
            .into_iter()
            .map(
                |(id, engine_id, model_id, status, latency_ms, error_rate, created_at)| {
                    let created_at = DateTime::parse_from_rfc3339(&created_at)
                        .map_err(|e| RepoError::IoError {
                            reason: format!("Failed to parse created_at: {e}"),
                        })?
                        .with_timezone(&Utc);

                    Ok(EngineHealthLog {
                        id,
                        engine_id,
                        model_id,
                        status,
                        latency_ms: latency_ms.map(|l| l as u64),
                        error_rate,
                        created_at,
                    })
                },
            )
            .collect::<Result<Vec<_>, RepoError>>()?;

        Ok(logs)
    }

    async fn get_engine_summary(
        &self,
        engine_id: &str,
        start_time: Option<DateTime<Utc>>,
        end_time: Option<DateTime<Utc>>,
    ) -> Result<EngineHealthSummary, RepoError> {
        let mut query = String::from(
            "SELECT COUNT(*) as total, 
                    SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy,
                    SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded,
                    SUM(CASE WHEN status = 'unreachable' THEN 1 ELSE 0 END) as unreachable,
                    AVG(latency_ms) as avg_latency,
                    AVG(error_rate) as avg_error_rate
             FROM engine_health_logs WHERE engine_id = ?",
        );

        if start_time.is_some() {
            query.push_str(" AND created_at >= ?");
        }
        if end_time.is_some() {
            query.push_str(" AND created_at <= ?");
        }

        let mut query_builder =
            sqlx::query_as::<_, (i64, i64, i64, i64, Option<f64>, Option<f64>)>(&query)
                .bind(engine_id);

        if let Some(st) = start_time {
            query_builder = query_builder.bind(st.to_rfc3339());
        }
        if let Some(et) = end_time {
            query_builder = query_builder.bind(et.to_rfc3339());
        }

        let row = query_builder
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to get engine summary: {e}"),
            })?;

        let (total, healthy, degraded, unreachable, avg_latency, avg_error_rate) = row;

        let total = total as u64;
        let healthy = healthy as u64;
        let degraded = degraded as u64;
        let unreachable = unreachable as u64;
        let success_rate = if total > 0 {
            (healthy as f64) / (total as f64)
        } else {
            0.0
        };

        Ok(EngineHealthSummary {
            total_checks: total,
            healthy_count: healthy,
            degraded_count: degraded,
            unreachable_count: unreachable,
            average_latency_ms: avg_latency,
            average_error_rate: avg_error_rate.unwrap_or(0.0),
            success_rate,
        })
    }

    async fn get_model_summary(
        &self,
        model_id: &str,
        start_time: Option<DateTime<Utc>>,
        end_time: Option<DateTime<Utc>>,
    ) -> Result<EngineHealthSummary, RepoError> {
        let mut query = String::from(
            "SELECT COUNT(*) as total, 
                    SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy,
                    SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded,
                    SUM(CASE WHEN status = 'unreachable' THEN 1 ELSE 0 END) as unreachable,
                    AVG(latency_ms) as avg_latency,
                    AVG(error_rate) as avg_error_rate
             FROM engine_health_logs WHERE model_id = ?",
        );

        if start_time.is_some() {
            query.push_str(" AND created_at >= ?");
        }
        if end_time.is_some() {
            query.push_str(" AND created_at <= ?");
        }

        let mut query_builder =
            sqlx::query_as::<_, (i64, i64, i64, i64, Option<f64>, Option<f64>)>(&query)
                .bind(model_id);

        if let Some(st) = start_time {
            query_builder = query_builder.bind(st.to_rfc3339());
        }
        if let Some(et) = end_time {
            query_builder = query_builder.bind(et.to_rfc3339());
        }

        let row = query_builder
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to get model summary: {e}"),
            })?;

        let (total, healthy, degraded, unreachable, avg_latency, avg_error_rate) = row;

        let total = total as u64;
        let healthy = healthy as u64;
        let degraded = degraded as u64;
        let unreachable = unreachable as u64;
        let success_rate = if total > 0 {
            (healthy as f64) / (total as f64)
        } else {
            0.0
        };

        Ok(EngineHealthSummary {
            total_checks: total,
            healthy_count: healthy,
            degraded_count: degraded,
            unreachable_count: unreachable,
            average_latency_ms: avg_latency,
            average_error_rate: avg_error_rate.unwrap_or(0.0),
            success_rate,
        })
    }

    async fn cleanup_old_logs(&self, days_to_keep: u32) -> Result<u64, RepoError> {
        let cutoff_date = Utc::now() - chrono::Duration::days(days_to_keep as i64);
        let cutoff_str = cutoff_date.to_rfc3339();

        let result = sqlx::query("DELETE FROM engine_health_logs WHERE created_at < ?")
            .bind(cutoff_str)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to cleanup old logs: {e}"),
            })?;

        Ok(result.rows_affected())
    }
}
