// Setting Repository
// ユーザー設定のデータアクセス層

use rusqlite::{Connection, params};
use chrono::{DateTime, Utc};
use crate::database::{DatabaseError, models::UserSetting};

/// ユーザー設定リポジトリ
pub struct SettingRepository;

impl SettingRepository {
    /// 全ての設定を取得
    pub fn find_all(conn: &Connection) -> Result<Vec<UserSetting>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT key, value, updated_at FROM user_settings ORDER BY key"
        )?;
        
        let setting_iter = stmt.query_map([], |row| {
            Ok(UserSetting {
                key: row.get(0)?,
                value: row.get(1)?,
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid updated_at format: {e}")))?
                    .with_timezone(&Utc),
            })
        })?;
        
        let mut settings = Vec::new();
        for setting in setting_iter {
            settings.push(setting?);
        }
        
        Ok(settings)
    }
    
    /// キーで設定を取得
    pub fn find_by_key(conn: &Connection, key: &str) -> Result<Option<UserSetting>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT key, value, updated_at FROM user_settings WHERE key = ?"
        )?;
        
        let setting_result = stmt.query_row(params![key], |row| {
            Ok(UserSetting {
                key: row.get(0)?,
                value: row.get(1)?,
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid updated_at format: {e}")))?
                    .with_timezone(&Utc),
            })
        });
        
        match setting_result {
            Ok(setting) => Ok(Some(setting)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::from(e)),
        }
    }
    
    /// 設定を作成または更新
    pub fn upsert(conn: &Connection, key: &str, value: &str) -> Result<(), DatabaseError> {
        let updated_at = Utc::now().to_rfc3339();
        
        conn.execute(
            "INSERT INTO user_settings (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![key, value, updated_at],
        )?;
        
        Ok(())
    }
    
    /// 設定を削除
    pub fn delete(conn: &Connection, key: &str) -> Result<(), DatabaseError> {
        conn.execute("DELETE FROM user_settings WHERE key = ?", params![key])?;
        Ok(())
    }
}

