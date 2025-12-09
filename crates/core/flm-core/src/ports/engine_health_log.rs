//! Engine health log repository trait

use crate::domain::engine::HealthStatus;
use crate::error::RepoError;
use async_trait::async_trait;
use chrono::{DateTime, Utc};

/// Engine health log entry
#[derive(Clone, Debug)]
pub struct EngineHealthLog {
    pub id: i64,
    pub engine_id: String,
    pub model_id: Option<String>,
    pub status: String,
    pub latency_ms: Option<u64>,
    pub error_rate: f64,
    pub created_at: DateTime<Utc>,
}

/// Engine health log repository trait
#[async_trait]
pub trait EngineHealthLogRepository: Send + Sync {
    /// Record a health check result
    async fn record_health_check(
        &self,
        engine_id: &str,
        model_id: Option<&str>,
        status: &HealthStatus,
        error_rate: f64,
    ) -> Result<(), RepoError>;

    /// Get health logs for an engine
    async fn get_engine_logs(
        &self,
        engine_id: &str,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<EngineHealthLog>, RepoError>;

    /// Get health logs for a model
    async fn get_model_logs(
        &self,
        model_id: &str,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<EngineHealthLog>, RepoError>;

    /// Get health logs within a time range
    async fn get_logs_in_range(
        &self,
        engine_id: Option<&str>,
        model_id: Option<&str>,
        start_time: DateTime<Utc>,
        end_time: DateTime<Utc>,
        limit: Option<u32>,
    ) -> Result<Vec<EngineHealthLog>, RepoError>;

    /// Get summary statistics for an engine
    async fn get_engine_summary(
        &self,
        engine_id: &str,
        start_time: Option<DateTime<Utc>>,
        end_time: Option<DateTime<Utc>>,
    ) -> Result<EngineHealthSummary, RepoError>;

    /// Get summary statistics for a model
    async fn get_model_summary(
        &self,
        model_id: &str,
        start_time: Option<DateTime<Utc>>,
        end_time: Option<DateTime<Utc>>,
    ) -> Result<EngineHealthSummary, RepoError>;

    /// Clean up old logs (older than specified days)
    async fn cleanup_old_logs(&self, days_to_keep: u32) -> Result<u64, RepoError>;
}

/// Engine health summary statistics
#[derive(Clone, Debug)]
pub struct EngineHealthSummary {
    pub total_checks: u64,
    pub healthy_count: u64,
    pub degraded_count: u64,
    pub unreachable_count: u64,
    pub average_latency_ms: Option<f64>,
    pub average_error_rate: f64,
    pub success_rate: f64,
}

