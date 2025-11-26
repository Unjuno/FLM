//! Adapter implementations for flm-proxy
//!
//! This module contains concrete implementations of port traits
//! needed by the proxy server, without depending on flm-cli.

use async_trait::async_trait;
use flm_core::domain::security::{ApiKeyRecord, SecurityPolicy};
use flm_core::error::RepoError;
use flm_core::ports::SecurityRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use tracing::error;

/// Metadata for audit log entries (reduces clippy argument count).
pub struct AuditLogMetadata<'a> {
    pub severity: &'a str,
    pub ip: Option<&'a str>,
    pub details: Option<&'a str>,
}

/// Optional request context for intrusion attempts.
pub struct IntrusionRequestContext<'a> {
    pub request_path: Option<&'a str>,
    pub user_agent: Option<&'a str>,
    pub method: Option<&'a str>,
}

/// SQLite-based SecurityRepository implementation for flm-proxy
#[derive(Clone)]
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

        let options = SqliteConnectOptions::new()
            .filename(path_str)
            .create_if_missing(true);

        // Get max connections from environment variable or use default (10)
        let max_connections = std::env::var("FLM_DB_MAX_CONNECTIONS")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(10)
            .clamp(1, 100); // At least 1 connection, cap at 100

        let pool = SqlitePoolOptions::new()
            .max_connections(max_connections)
            .connect_with(options)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to connect to security.db: {e}"),
            })?;

        // Run migrations
        sqlx::migrate!("../flm-core/migrations")
            .run(&pool)
            .await
            .map_err(|e| RepoError::MigrationFailed {
                reason: format!("Security DB migration failed: {e}"),
            })?;

        // Set restrictive file permissions (Unix only: chmod 600 equivalent)
        // On Windows, file permissions are managed differently and default permissions are usually sufficient
        #[cfg(unix)]
        {
            if let Err(_) = set_db_file_permissions(&db_path) {
                warn!(
                    error_type = "db_permissions_failed",
                    "Failed to set database file permissions. Continuing anyway."
                );
            }
        }

        Ok(Self { pool })
    }
}

#[async_trait]
impl SecurityRepository for SqliteSecurityRepository {
    async fn save_api_key(&self, key: ApiKeyRecord) -> Result<(), RepoError> {
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
    }

    async fn fetch_api_key(&self, id: &str) -> Result<Option<ApiKeyRecord>, RepoError> {
        let row = sqlx::query_as::<_, (String, String, String, String, Option<String>)>(
            "SELECT id, label, hash, created_at, revoked_at FROM api_keys WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to fetch API key: {e}"),
        })?;

        if let Some((id, label, hash, created_at, revoked_at)) = row {
            Ok(Some(ApiKeyRecord {
                id,
                label,
                hash,
                created_at,
                revoked_at,
            }))
        } else {
            Ok(None)
        }
    }

    async fn list_api_keys(&self) -> Result<Vec<ApiKeyRecord>, RepoError> {
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
    }

    async fn mark_api_key_revoked(&self, id: &str, revoked_at: &str) -> Result<(), RepoError> {
        sqlx::query("UPDATE api_keys SET revoked_at = ? WHERE id = ?")
            .bind(revoked_at)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to revoke API key: {e}"),
            })?;
        Ok(())
    }

    async fn save_policy(&self, policy: SecurityPolicy) -> Result<(), RepoError> {
        sqlx::query(
            "INSERT OR REPLACE INTO security_policies (id, policy_json, updated_at) VALUES (?, ?, ?)",
        )
        .bind(&policy.id)
        .bind(&policy.policy_json)
        .bind(&policy.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to save security policy: {e}"),
        })?;
        Ok(())
    }

    async fn fetch_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError> {
        let row = sqlx::query_as::<_, (String, String, String)>(
            "SELECT id, policy_json, updated_at FROM security_policies WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to fetch security policy: {e}"),
        })?;

        if let Some((id, policy_json, updated_at)) = row {
            Ok(Some(SecurityPolicy {
                id,
                policy_json,
                updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    async fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError> {
        let rows = sqlx::query_as::<_, (String, String, String)>(
            "SELECT id, policy_json, updated_at FROM security_policies ORDER BY updated_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to list security policies: {e}"),
        })?;

        Ok(rows
            .into_iter()
            .map(|(id, policy_json, updated_at)| SecurityPolicy {
                id,
                policy_json,
                updated_at,
            })
            .collect())
    }
}

// Additional methods for SqliteSecurityRepository (not part of SecurityRepository trait)
impl SqliteSecurityRepository {
    /// Save rate limit state for an API key
    ///
    /// # Arguments
    /// * `api_key_id` - The API key ID
    /// * `requests_count` - Current request count
    /// * `reset_at` - Reset timestamp (RFC3339 format)
    pub async fn save_rate_limit_state(
        &self,
        api_key_id: &str,
        requests_count: u32,
        reset_at: &str,
    ) -> Result<(), RepoError> {
        sqlx::query(
            "INSERT OR REPLACE INTO rate_limit_states (api_key_id, requests_count, reset_at) VALUES (?, ?, ?)",
        )
        .bind(api_key_id)
        .bind(requests_count as i64)
        .bind(reset_at)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to save rate limit state: {e}"),
        })?;
        Ok(())
    }

    /// Fetch rate limit state for an API key
    ///
    /// # Arguments
    /// * `api_key_id` - The API key ID
    ///
    /// # Returns
    /// * `Ok(Some((requests_count, reset_at)))` if state exists
    /// * `Ok(None)` if state does not exist
    /// * `Err(RepoError)` if an error occurs
    pub async fn fetch_rate_limit_state(
        &self,
        api_key_id: &str,
    ) -> Result<Option<(u32, String)>, RepoError> {
        let row = sqlx::query_as::<_, (i64, String)>(
            "SELECT requests_count, reset_at FROM rate_limit_states WHERE api_key_id = ?",
        )
        .bind(api_key_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to fetch rate limit state: {e}"),
        })?;

        if let Some((count, reset_at)) = row {
            Ok(Some((count as u32, reset_at)))
        } else {
            Ok(None)
        }
    }

    /// Delete expired rate limit states
    ///
    /// Removes rate limit states where reset_at is in the past.
    pub async fn cleanup_expired_rate_limits(&self) -> Result<(), RepoError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("DELETE FROM rate_limit_states WHERE reset_at < ?")
            .bind(&now)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to cleanup expired rate limits: {e}"),
            })?;
        Ok(())
    }

    /// Save audit log entry
    ///
    /// # Arguments
    /// * `request_id` - Unique request identifier
    /// * `api_key_id` - API key ID (if authenticated)
    /// * `endpoint` - Request endpoint
    /// * `status` - HTTP status code
    /// * `latency_ms` - Request latency in milliseconds
    /// * `event_type` - Event type ('auth_success', 'auth_failure', 'ip_blocked', 'intrusion', 'anomaly', 'resource_alert')
    /// * `severity` - Severity level ('low', 'medium', 'high', 'critical')
    /// * `ip` - Client IP address
    /// * `details` - Additional details in JSON format
    #[allow(clippy::too_many_arguments)]
    pub async fn save_audit_log(
        &self,
        request_id: &str,
        api_key_id: Option<&str>,
        endpoint: &str,
        status: u16,
        latency_ms: Option<u64>,
        event_type: Option<&str>,
        metadata: AuditLogMetadata<'_>,
    ) -> Result<(), RepoError> {
        sqlx::query(
            "INSERT INTO audit_logs (request_id, api_key_id, endpoint, status, latency_ms, event_type, severity, ip, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(request_id)
        .bind(api_key_id)
        .bind(endpoint)
        .bind(status as i64)
        .bind(latency_ms.map(|v| v as i64))
        .bind(event_type)
        .bind(metadata.severity)
        .bind(metadata.ip)
        .bind(metadata.details)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to save audit log: {e}"),
        })?;
        Ok(())
    }

    /// Get all blocked IPs from database
    ///
    /// Returns a vector of (IP address, failure_count, first_failure_at, blocked_until, permanent_block, last_attempt)
    pub async fn get_blocked_ips(
        &self,
    ) -> Result<Vec<(std::net::IpAddr, u32, String, Option<String>, bool, String)>, RepoError> {
        use std::net::IpAddr;

        let rows = sqlx::query_as::<_, (String, i64, String, Option<String>, i64, String)>(
            "SELECT ip, failure_count, first_failure_at, blocked_until, permanent_block, last_attempt FROM ip_blocklist"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to fetch blocked IPs: {e}"),
        })?;

        let mut result = Vec::new();
        for (
            ip_str,
            failure_count,
            first_failure_at,
            blocked_until,
            permanent_block,
            last_attempt,
        ) in rows
        {
            if let Ok(ip) = ip_str.parse::<IpAddr>() {
                result.push((
                    ip,
                    failure_count as u32,
                    first_failure_at,
                    blocked_until,
                    permanent_block != 0,
                    last_attempt,
                ));
            } else {
                error!(ip = %ip_str, "Failed to parse IP address from database");
            }
        }

        Ok(result)
    }

    /// Add or update a failure record for an IP address
    ///
    /// # Arguments
    /// * `ip` - IP address
    /// * `failure_count` - Current failure count
    /// * `first_failure_at` - Timestamp of first failure (RFC3339)
    /// * `blocked_until` - Timestamp when block expires (RFC3339, None if not blocked)
    /// * `permanent_block` - Whether this is a permanent block
    /// * `last_attempt` - Timestamp of last attempt (RFC3339)
    pub async fn add_ip_failure(
        &self,
        ip: &std::net::IpAddr,
        failure_count: u32,
        first_failure_at: &str,
        blocked_until: Option<&str>,
        permanent_block: bool,
        last_attempt: &str,
    ) -> Result<(), RepoError> {
        sqlx::query(
            "INSERT OR REPLACE INTO ip_blocklist (ip, failure_count, first_failure_at, blocked_until, permanent_block, last_attempt, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
        )
        .bind(ip.to_string())
        .bind(failure_count as i64)
        .bind(first_failure_at)
        .bind(blocked_until)
        .bind(if permanent_block { 1 } else { 0 })
        .bind(last_attempt)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to add IP failure: {e}"),
        })?;
        Ok(())
    }

    /// Unblock an IP address
    ///
    /// Removes the IP from the blocklist.
    pub async fn unblock_ip(&self, ip: &std::net::IpAddr) -> Result<(), RepoError> {
        sqlx::query("DELETE FROM ip_blocklist WHERE ip = ?")
            .bind(ip.to_string())
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to unblock IP: {e}"),
            })?;
        Ok(())
    }

    /// Clear all temporary blocks (keeps permanent blocks)
    pub async fn clear_temporary_blocks(&self) -> Result<(), RepoError> {
        sqlx::query("DELETE FROM ip_blocklist WHERE permanent_block = 0")
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to clear temporary blocks: {e}"),
            })?;
        Ok(())
    }

    /// Clean up expired temporary blocks
    ///
    /// Removes blocks where blocked_until is in the past.
    pub async fn cleanup_expired_blocks(&self) -> Result<(), RepoError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("DELETE FROM ip_blocklist WHERE permanent_block = 0 AND blocked_until IS NOT NULL AND blocked_until < ?")
            .bind(&now)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to cleanup expired blocks: {e}"),
            })?;
        Ok(())
    }

    /// Save intrusion detection attempt
    ///
    /// # Arguments
    /// * `id` - Unique identifier for the intrusion attempt
    /// * `ip` - IP address
    /// * `pattern` - Detected pattern type
    /// * `score` - Intrusion score
    /// * `request_path` - Request path
    /// * `user_agent` - User-Agent header
    /// * `method` - HTTP method
    pub async fn save_intrusion_attempt(
        &self,
        id: &str,
        ip: &std::net::IpAddr,
        pattern: &str,
        score: u32,
        ctx: IntrusionRequestContext<'_>,
    ) -> Result<(), RepoError> {
        sqlx::query(
            "INSERT INTO intrusion_attempts (id, ip, pattern, score, request_path, user_agent, method) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(id)
        .bind(ip.to_string())
        .bind(pattern)
        .bind(score as i64)
        .bind(ctx.request_path)
        .bind(ctx.user_agent)
        .bind(ctx.method)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to save intrusion attempt: {e}"),
        })?;
        Ok(())
    }

    /// List audit logs with optional filters
    ///
    /// # Arguments
    /// * `limit` - Maximum number of logs to return (default: 100)
    /// * `offset` - Number of logs to skip (default: 0)
    /// * `event_type` - Filter by event type (optional)
    /// * `severity` - Filter by severity (optional)
    /// * `ip` - Filter by IP address (optional)
    ///
    /// # Returns
    /// Vector of audit log entries: (id, request_id, api_key_id, endpoint, status, latency_ms, event_type, severity, ip, details, created_at)
    pub async fn list_audit_logs(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
        event_type: Option<&str>,
        severity: Option<&str>,
        ip: Option<&str>,
    ) -> Result<
        Vec<(
            i64,
            String,
            Option<String>,
            String,
            i64,
            Option<i64>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            String,
        )>,
        RepoError,
    > {
        let limit = limit.unwrap_or(100).min(1000); // Cap at 1000
        let offset = offset.unwrap_or(0);

        let mut query = String::from(
            "SELECT id, request_id, api_key_id, endpoint, status, latency_ms, event_type, severity, ip, details, created_at FROM audit_logs WHERE 1=1"
        );

        if let Some(_et) = event_type {
            query.push_str(" AND event_type = ?");
        }
        if let Some(_s) = severity {
            query.push_str(" AND severity = ?");
        }
        if let Some(_ip_addr) = ip {
            query.push_str(" AND ip = ?");
        }

        query.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

        let mut sql_query = sqlx::query_as::<
            _,
            (
                i64,
                String,
                Option<String>,
                String,
                i64,
                Option<i64>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                String,
            ),
        >(&query);

        if let Some(et) = event_type {
            sql_query = sql_query.bind(et);
        }
        if let Some(s) = severity {
            sql_query = sql_query.bind(s);
        }
        if let Some(ip_addr) = ip {
            sql_query = sql_query.bind(ip_addr);
        }

        sql_query = sql_query.bind(limit as i64).bind(offset as i64);

        let rows = sql_query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to list audit logs: {e}"),
            })?;

        Ok(rows)
    }

    /// List intrusion attempts with optional filters
    ///
    /// # Arguments
    /// * `limit` - Maximum number of attempts to return (default: 100)
    /// * `offset` - Number of attempts to skip (default: 0)
    /// * `ip` - Filter by IP address (optional)
    /// * `min_score` - Minimum score filter (optional)
    ///
    /// # Returns
    /// Vector of intrusion attempts: (id, ip, pattern, score, request_path, user_agent, method, created_at)
    pub async fn list_intrusion_attempts(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
        ip: Option<&str>,
        min_score: Option<u32>,
    ) -> Result<
        Vec<(
            String,
            String,
            String,
            i64,
            Option<String>,
            Option<String>,
            Option<String>,
            String,
        )>,
        RepoError,
    > {
        let limit = limit.unwrap_or(100).min(1000); // Cap at 1000
        let offset = offset.unwrap_or(0);

        let mut query = String::from(
            "SELECT id, ip, pattern, score, request_path, user_agent, method, created_at FROM intrusion_attempts WHERE 1=1"
        );

        if let Some(_ip_addr) = ip {
            query.push_str(" AND ip = ?");
        }
        if let Some(_ms) = min_score {
            query.push_str(" AND score >= ?");
        }

        query.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

        let mut sql_query = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                i64,
                Option<String>,
                Option<String>,
                Option<String>,
                String,
            ),
        >(&query);

        if let Some(ip_addr) = ip {
            sql_query = sql_query.bind(ip_addr);
        }
        if let Some(ms) = min_score {
            sql_query = sql_query.bind(ms as i64);
        }

        sql_query = sql_query.bind(limit as i64).bind(offset as i64);

        let rows = sql_query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to list intrusion attempts: {e}"),
            })?;

        Ok(rows)
    }

    /// List anomaly detections with optional filters
    ///
    /// # Arguments
    /// * `limit` - Maximum number of detections to return (default: 100)
    /// * `offset` - Number of detections to skip (default: 0)
    /// * `ip` - Filter by IP address (optional)
    /// * `anomaly_type` - Filter by anomaly type (optional)
    ///
    /// # Returns
    /// Vector of anomaly detections: (id, ip, anomaly_type, score, details, created_at)
    pub async fn list_anomaly_detections(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
        ip: Option<&str>,
        anomaly_type: Option<&str>,
    ) -> Result<Vec<(String, String, String, i64, Option<String>, String)>, RepoError> {
        let limit = limit.unwrap_or(100).min(1000); // Cap at 1000
        let offset = offset.unwrap_or(0);

        let mut query = String::from(
            "SELECT id, ip, anomaly_type, score, details, created_at FROM anomaly_detections WHERE 1=1"
        );

        if let Some(_ip_addr) = ip {
            query.push_str(" AND ip = ?");
        }
        if let Some(_at) = anomaly_type {
            query.push_str(" AND anomaly_type = ?");
        }

        query.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

        let mut sql_query =
            sqlx::query_as::<_, (String, String, String, i64, Option<String>, String)>(&query);

        if let Some(ip_addr) = ip {
            sql_query = sql_query.bind(ip_addr);
        }
        if let Some(at) = anomaly_type {
            sql_query = sql_query.bind(at);
        }

        sql_query = sql_query.bind(limit as i64).bind(offset as i64);

        let rows = sql_query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to list anomaly detections: {e}"),
            })?;

        Ok(rows)
    }
}

/// Set restrictive file permissions for database file (Unix only)
///
/// Sets permissions to 600 (owner read+write, group/others no access).
/// On Windows, this function is a no-op as Windows uses a different permission model.
#[cfg(unix)]
fn set_db_file_permissions<P: AsRef<Path>>(db_path: P) -> Result<(), std::io::Error> {
    use std::fs;
    let metadata = fs::metadata(&db_path)?;
    let mut perms = metadata.permissions();
    // chmod 600: owner read+write, group/others no access
    perms.set_mode(0o600);
    fs::set_permissions(&db_path, perms)
}
