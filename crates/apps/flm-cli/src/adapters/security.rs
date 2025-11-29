//! SecurityRepository implementation using SQLite

use flm_core::domain::security::{ApiKeyRecord, DnsCredentialProfile, SecurityPolicy};
use flm_core::error::RepoError;
use flm_core::ports::SecurityRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

/// SQLite-based SecurityRepository implementation
pub struct SqliteSecurityRepository {
    pool: SqlitePool,
    read_only: bool,
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

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to connect to security.db: {e}"),
            })?;

        // Try to run migrations
        let migration_result = sqlx::migrate!("../../core/flm-core/migrations")
            .run(&pool)
            .await;

        let (pool, read_only) = match migration_result {
            Ok(_) => {
                // Set restrictive file permissions (Unix only: chmod 600 equivalent)
                // On Windows, file permissions are managed differently and default permissions are usually sufficient
                #[cfg(unix)]
                {
                    if let Err(e) = set_db_file_permissions(db_path.as_ref()) {
                        // Log warning but don't fail - database is already created and functional
                        eprintln!("Warning: Failed to set database file permissions: {e}");
                    }
                }
                (pool, false)
            }
            Err(e) => {
                // Migration failed - try to connect in read-only mode
                eprintln!("Warning: Migration failed: {e}. Attempting read-only mode.");
                let read_only_options = SqliteConnectOptions::new()
                    .filename(path_str)
                    .read_only(true);

                match SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect_with(read_only_options)
                    .await
                {
                    Ok(read_only_pool) => {
                        eprintln!(
                            "Connected in read-only mode. Write operations will be disabled."
                        );
                        (read_only_pool, true)
                    }
                    Err(read_only_err) => {
                        return Err(RepoError::MigrationFailed {
                            reason: format!(
                                "Migration failed and read-only connection also failed: original={e}, read_only={read_only_err}"
                            ),
                        });
                    }
                }
            }
        };

        Ok(Self { pool, read_only })
    }

    /// Get the connection pool (for migration)
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Check if database is in read-only mode and return error if write operation is attempted
    fn check_write_allowed(&self, operation: &str) -> Result<(), RepoError> {
        if self.read_only {
            Err(RepoError::ReadOnlyMode {
                reason: format!(
                    "Cannot {operation}: database is in read-only mode due to migration failure"
                ),
            })
        } else {
            Ok(())
        }
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
            }
        }

        Ok(result)
    }

    /// Unblock an IP address
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

    /// Clear all temporary blocks (keep permanent blocks)
    pub async fn clear_temporary_blocks(&self) -> Result<(), RepoError> {
        sqlx::query("DELETE FROM ip_blocklist WHERE permanent_block = 0")
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to clear temporary blocks: {e}"),
            })?;
        Ok(())
    }

    /// List audit logs with optional filters
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
        let limit = limit.unwrap_or(100).min(1000);
        let offset = offset.unwrap_or(0);

        let mut query = String::from(
            "SELECT id, request_id, api_key_id, endpoint, status, latency_ms, event_type, severity, ip, details, created_at FROM audit_logs WHERE 1=1"
        );

        if event_type.is_some() {
            query.push_str(" AND event_type = ?");
        }
        if severity.is_some() {
            query.push_str(" AND severity = ?");
        }
        if ip.is_some() {
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
        let limit = limit.unwrap_or(100).min(1000);
        let offset = offset.unwrap_or(0);

        let mut query = String::from(
            "SELECT id, ip, pattern, score, request_path, user_agent, method, created_at FROM intrusion_attempts WHERE 1=1"
        );

        if ip.is_some() {
            query.push_str(" AND ip = ?");
        }
        if min_score.is_some() {
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
    pub async fn list_anomaly_detections(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
        ip: Option<&str>,
        anomaly_type: Option<&str>,
    ) -> Result<Vec<(String, String, String, i64, Option<String>, String)>, RepoError> {
        let limit = limit.unwrap_or(100).min(1000);
        let offset = offset.unwrap_or(0);

        let mut query = String::from(
            "SELECT id, ip, anomaly_type, score, details, created_at FROM anomaly_detections WHERE 1=1"
        );

        if ip.is_some() {
            query.push_str(" AND ip = ?");
        }
        if anomaly_type.is_some() {
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

    /// List all certificates from the certificates table
    ///
    /// Returns a vector of (id, cert_path, key_path, mode, domain, expires_at, updated_at)
    pub async fn list_certificates(
        &self,
    ) -> Result<
        Vec<(
            String,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            String,
        )>,
        RepoError,
    > {
        let rows = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                String,
                Option<String>,
                Option<String>,
                String,
            ),
        >(
            "SELECT id, cert_path, key_path, mode, domain, expires_at, updated_at FROM certificates ORDER BY updated_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to list certificates: {e}"),
        })?;

        Ok(rows)
    }

    /// List rate limit states with optional filtering by API key ID
    ///
    /// Returns a vector of (api_key_id, requests_count, reset_at)
    pub async fn list_rate_limit_states(
        &self,
        api_key_id: Option<&str>,
    ) -> Result<Vec<(String, i64, String)>, RepoError> {
        let query = if api_key_id.is_some() {
            "SELECT api_key_id, requests_count, reset_at FROM rate_limit_states WHERE api_key_id = ? ORDER BY reset_at ASC"
        } else {
            "SELECT api_key_id, requests_count, reset_at FROM rate_limit_states ORDER BY reset_at ASC"
        };

        let mut sql_query = sqlx::query_as::<_, (String, i64, String)>(query);

        if let Some(key_id) = api_key_id {
            sql_query = sql_query.bind(key_id);
        }

        let rows = sql_query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to list rate limit states: {e}"),
            })?;

        Ok(rows)
    }
}

#[async_trait::async_trait]
impl SecurityRepository for SqliteSecurityRepository {
    async fn save_api_key(&self, key: ApiKeyRecord) -> Result<(), RepoError> {
        self.check_write_allowed("save API key")?;
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

        Ok(
            row.map(|(id, label, hash, created_at, revoked_at)| ApiKeyRecord {
                id,
                label,
                hash,
                created_at,
                revoked_at,
            }),
        )
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

    async fn list_active_api_keys(&self) -> Result<Vec<ApiKeyRecord>, RepoError> {
        // Optimized query: filter revoked keys at database level
        let rows = sqlx::query_as::<_, (String, String, String, String, Option<String>)>(
            "SELECT id, label, hash, created_at, revoked_at FROM api_keys WHERE revoked_at IS NULL ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to list active API keys: {e}"),
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
        self.check_write_allowed("revoke API key")?;
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
        self.check_write_allowed("save policy")?;
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
    }

    async fn fetch_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError> {
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
    }

    async fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError> {
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
    }

    async fn upsert_dns_credential(&self, profile: DnsCredentialProfile) -> Result<(), RepoError> {
        self.check_write_allowed("save DNS credential")?;
        sqlx::query(
            r#"INSERT INTO dns_credentials (id, provider, label, zone_id, zone_name, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   provider = excluded.provider,
                   label = excluded.label,
                   zone_id = excluded.zone_id,
                   zone_name = excluded.zone_name,
                   updated_at = excluded.updated_at"#,
        )
        .bind(&profile.id)
        .bind(&profile.provider)
        .bind(&profile.label)
        .bind(&profile.zone_id)
        .bind(&profile.zone_name)
        .bind(&profile.created_at)
        .bind(&profile.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to upsert DNS credential: {e}"),
        })?;
        Ok(())
    }

    async fn fetch_dns_credential(
        &self,
        id: &str,
    ) -> Result<Option<DnsCredentialProfile>, RepoError> {
        let row = sqlx::query_as::<_, (String, String, String, String, Option<String>, String, String)>(
            "SELECT id, provider, label, zone_id, zone_name, created_at, updated_at FROM dns_credentials WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to fetch DNS credential: {e}"),
        })?;

        Ok(row.map(
            |(id, provider, label, zone_id, zone_name, created_at, updated_at)| {
                DnsCredentialProfile {
                    id,
                    provider,
                    label,
                    zone_id,
                    zone_name,
                    created_at,
                    updated_at,
                }
            },
        ))
    }

    async fn list_dns_credentials(&self) -> Result<Vec<DnsCredentialProfile>, RepoError> {
        let rows = sqlx::query_as::<_, (String, String, String, String, Option<String>, String, String)>(
            "SELECT id, provider, label, zone_id, zone_name, created_at, updated_at FROM dns_credentials ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to list DNS credentials: {e}"),
        })?;

        Ok(rows
            .into_iter()
            .map(
                |(id, provider, label, zone_id, zone_name, created_at, updated_at)| {
                    DnsCredentialProfile {
                        id,
                        provider,
                        label,
                        zone_id,
                        zone_name,
                        created_at,
                        updated_at,
                    }
                },
            )
            .collect())
    }

    async fn delete_dns_credential(&self, id: &str) -> Result<(), RepoError> {
        self.check_write_allowed("delete DNS credential")?;
        sqlx::query("DELETE FROM dns_credentials WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to delete DNS credential: {e}"),
            })?;
        Ok(())
    }
}

/// Set restrictive file permissions for database files (Unix only)
///
/// Sets permissions to 600 (rw-------) to ensure only the owner can read/write.
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
