// API Key Repository
// APIキー情報のデータアクセス層

use rusqlite::{Connection, params};
use chrono::{DateTime, Utc};
use crate::database::{DatabaseError, models::ApiKey};

/// APIキーリポジトリ
pub struct ApiKeyRepository;

impl ApiKeyRepository {
    /// API IDでAPIキーを取得
    pub fn find_by_api_id(conn: &Connection, api_id: &str) -> Result<Option<ApiKey>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT id, api_id, encrypted_key, created_at FROM api_keys WHERE api_id = ?"
        )?;
        
        let key_result = stmt.query_row(params![api_id], |row| {
            Ok(ApiKey {
                id: row.get(0)?,
                api_id: row.get(1)?,
                api_key_encrypted: String::from_utf8_lossy(&row.get::<_, Vec<u8>>(2)?).to_string(),
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .unwrap()
                    .with_timezone(&Utc),
            })
        });
        
        match key_result {
            Ok(key) => Ok(Some(key)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::from(e)),
        }
    }
    
    /// IDでAPIキーを取得
    pub fn find_by_id(conn: &Connection, id: &str) -> Result<Option<ApiKey>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT id, api_id, encrypted_key, created_at FROM api_keys WHERE id = ?"
        )?;
        
        let key_result = stmt.query_row(params![id], |row| {
            Ok(ApiKey {
                id: row.get(0)?,
                api_id: row.get(1)?,
                api_key_encrypted: String::from_utf8_lossy(&row.get::<_, Vec<u8>>(2)?).to_string(),
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .unwrap()
                    .with_timezone(&Utc),
            })
        });
        
        match key_result {
            Ok(key) => Ok(Some(key)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::from(e)),
        }
    }
    
    /// APIキーを作成
    pub fn create(conn: &Connection, api_key: &ApiKey, key_hash: &str) -> Result<(), DatabaseError> {
        let created_at = api_key.created_at.to_rfc3339();
        let updated_at = Utc::now().to_rfc3339();
        let encrypted_bytes = api_key.api_key_encrypted.as_bytes();
        
        conn.execute(
            "INSERT INTO api_keys (id, api_id, key_hash, encrypted_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            params![
                api_key.id,
                api_key.api_id,
                key_hash,
                encrypted_bytes,
                created_at,
                updated_at
            ],
        )?;
        
        Ok(())
    }
    
    /// APIキーを削除
    pub fn delete(conn: &Connection, id: &str) -> Result<(), DatabaseError> {
        conn.execute("DELETE FROM api_keys WHERE id = ?", params![id])?;
        Ok(())
    }
    
    /// API IDでAPIキーを削除
    pub fn delete_by_api_id(conn: &Connection, api_id: &str) -> Result<(), DatabaseError> {
        conn.execute("DELETE FROM api_keys WHERE api_id = ?", params![api_id])?;
        Ok(())
    }
}

