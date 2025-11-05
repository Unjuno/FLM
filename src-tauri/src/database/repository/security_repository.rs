// Security Repository
// APIセキュリティ設定とレート制限追跡のリポジトリ

use crate::database::{DatabaseError, models::{ApiSecuritySettings, RateLimitTracking}};
use chrono::{DateTime, Utc};
use rusqlite::{Connection, params};

pub struct ApiSecuritySettingsRepository;

impl ApiSecuritySettingsRepository {
    pub fn new() -> Self {
        ApiSecuritySettingsRepository
    }
    
    /// API IDでセキュリティ設定を取得
    pub fn find_by_api_id(conn: &Connection, api_id: &str) -> Result<Option<ApiSecuritySettings>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT api_id, ip_whitelist, rate_limit_enabled, rate_limit_requests, 
             rate_limit_window_seconds, key_rotation_enabled, key_rotation_interval_days, 
             created_at, updated_at 
             FROM api_security_settings WHERE api_id = ?"
        )?;
        
        let mut rows = stmt.query_map(params![api_id], |row| {
            Ok(ApiSecuritySettings {
                api_id: row.get(0)?,
                ip_whitelist: row.get(1)?,
                rate_limit_enabled: row.get::<_, i32>(2)? != 0,
                rate_limit_requests: row.get(3)?,
                rate_limit_window_seconds: row.get(4)?,
                key_rotation_enabled: row.get::<_, i32>(5)? != 0,
                key_rotation_interval_days: row.get(6)?,
                created_at: row.get::<_, String>(7)?.parse::<DateTime<Utc>>()
                    .map_err(|e| rusqlite::Error::InvalidColumnType(7, format!("DateTime parse error: {}", e), rusqlite::types::Type::Text))?,
                updated_at: row.get::<_, String>(8)?.parse::<DateTime<Utc>>()
                    .map_err(|e| rusqlite::Error::InvalidColumnType(8, format!("DateTime parse error: {}", e), rusqlite::types::Type::Text))?,
            })
        })?;
        
        match rows.next() {
            Some(Ok(settings)) => Ok(Some(settings)),
            Some(Err(e)) => Err(DatabaseError::QueryFailed(e.to_string())),
            None => Ok(None),
        }
    }
    
    /// セキュリティ設定を作成
    pub fn create(conn: &Connection, settings: &ApiSecuritySettings) -> Result<(), DatabaseError> {
        conn.execute(
            "INSERT INTO api_security_settings 
             (api_id, ip_whitelist, rate_limit_enabled, rate_limit_requests, 
              rate_limit_window_seconds, key_rotation_enabled, key_rotation_interval_days, 
              created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                settings.api_id,
                settings.ip_whitelist,
                if settings.rate_limit_enabled { 1 } else { 0 },
                settings.rate_limit_requests,
                settings.rate_limit_window_seconds,
                if settings.key_rotation_enabled { 1 } else { 0 },
                settings.key_rotation_interval_days,
                settings.created_at.to_rfc3339(),
                settings.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }
    
    /// セキュリティ設定を更新
    pub fn update(conn: &Connection, settings: &ApiSecuritySettings) -> Result<(), DatabaseError> {
        conn.execute(
            "UPDATE api_security_settings 
             SET ip_whitelist = ?, rate_limit_enabled = ?, rate_limit_requests = ?, 
                 rate_limit_window_seconds = ?, key_rotation_enabled = ?, 
                 key_rotation_interval_days = ?, updated_at = ? 
             WHERE api_id = ?",
            params![
                settings.ip_whitelist,
                if settings.rate_limit_enabled { 1 } else { 0 },
                settings.rate_limit_requests,
                settings.rate_limit_window_seconds,
                if settings.key_rotation_enabled { 1 } else { 0 },
                settings.key_rotation_interval_days,
                settings.updated_at.to_rfc3339(),
                settings.api_id,
            ],
        )?;
        Ok(())
    }
}

pub struct RateLimitTrackingRepository;

impl RateLimitTrackingRepository {
    pub fn new() -> Self {
        RateLimitTrackingRepository
    }
    
    /// API ID、識別子、時間窓でレート制限追跡を取得
    pub fn find_by_api_and_identifier(
        conn: &Connection,
        api_id: &str,
        identifier: &str,
        window_start: &DateTime<Utc>,
    ) -> Result<Option<RateLimitTracking>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT id, api_id, identifier, request_count, window_start, created_at 
             FROM rate_limit_tracking 
             WHERE api_id = ? AND identifier = ? AND window_start = ?"
        )?;
        
        let mut rows = stmt.query_map(
            params![api_id, identifier, window_start.to_rfc3339()],
            |row| {
                Ok(RateLimitTracking {
                    id: row.get(0)?,
                    api_id: row.get(1)?,
                    identifier: row.get(2)?,
                    request_count: row.get(3)?,
                    window_start: row.get::<_, String>(4)?.parse::<DateTime<Utc>>()
                        .map_err(|e| rusqlite::Error::InvalidColumnType(4, format!("DateTime parse error: {}", e), rusqlite::types::Type::Text))?,
                    created_at: row.get::<_, String>(5)?.parse::<DateTime<Utc>>()
                        .map_err(|e| rusqlite::Error::InvalidColumnType(5, format!("DateTime parse error: {}", e), rusqlite::types::Type::Text))?,
                })
            },
        )?;
        
        match rows.next() {
            Some(Ok(tracking)) => Ok(Some(tracking)),
            Some(Err(e)) => Err(DatabaseError::QueryFailed(e.to_string())),
            None => Ok(None),
        }
    }
    
    /// レート制限追跡を作成
    pub fn create(
        conn: &Connection,
        api_id: &str,
        identifier: &str,
        window_start: &DateTime<Utc>,
    ) -> Result<RateLimitTracking, DatabaseError> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();
        
        conn.execute(
            "INSERT INTO rate_limit_tracking 
             (id, api_id, identifier, request_count, window_start, created_at) 
             VALUES (?, ?, ?, 1, ?, ?)",
            params![
                id,
                api_id,
                identifier,
                window_start.to_rfc3339(),
                now.to_rfc3339(),
            ],
        )?;
        
        Ok(RateLimitTracking {
            id,
            api_id: api_id.to_string(),
            identifier: identifier.to_string(),
            request_count: 1,
            window_start: *window_start,
            created_at: now,
        })
    }
    
    /// レート制限追跡を更新
    pub fn update(conn: &Connection, tracking: &RateLimitTracking) -> Result<(), DatabaseError> {
        conn.execute(
            "UPDATE rate_limit_tracking 
             SET request_count = ? 
             WHERE id = ?",
            params![tracking.request_count, tracking.id],
        )?;
        Ok(())
    }
}

