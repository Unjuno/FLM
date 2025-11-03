// API Repository
// API設定情報のデータアクセス層

use rusqlite::{Connection, params};
use chrono::{DateTime, Utc};
use crate::database::{DatabaseError, models::Api, models::ApiStatus};

/// APIリポジトリ
pub struct ApiRepository;

impl ApiRepository {
    /// 全てのAPIを取得
    pub fn find_all(conn: &Connection) -> Result<Vec<Api>, DatabaseError> {
        // engine_typeとengine_configカラムが存在するかチェックしてクエリを動的に構築
        let mut stmt = conn.prepare(
            "SELECT id, name, model, port, enable_auth, status, 
             COALESCE(engine_type, 'ollama'), engine_config, created_at, updated_at 
             FROM apis ORDER BY created_at DESC"
        )?;
        
        let api_iter = stmt.query_map([], |row| {
            Ok(Api {
                id: row.get(0)?,
                name: row.get(1)?,
                model: row.get(2)?,
                port: row.get(3)?,
                enable_auth: row.get::<_, i32>(4)? != 0,
                status: ApiStatus::from_str(row.get::<_, String>(5)?.as_str()),
                engine_type: row.get::<_, Option<String>>(6)?,
                engine_config: row.get::<_, Option<String>>(7)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid created_at format: {}", e)))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid updated_at format: {}", e)))?
                    .with_timezone(&Utc),
            })
        })?;
        
        let mut apis = Vec::new();
        for api in api_iter {
            apis.push(api?);
        }
        
        Ok(apis)
    }
    
    /// IDでAPIを取得
    pub fn find_by_id(conn: &Connection, id: &str) -> Result<Option<Api>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT id, name, model, port, enable_auth, status, 
             COALESCE(engine_type, 'ollama'), engine_config, created_at, updated_at 
             FROM apis WHERE id = ?"
        )?;
        
        let api_result = stmt.query_row(params![id], |row| {
            Ok(Api {
                id: row.get(0)?,
                name: row.get(1)?,
                model: row.get(2)?,
                port: row.get(3)?,
                enable_auth: row.get::<_, i32>(4)? != 0,
                status: ApiStatus::from_str(row.get::<_, String>(5)?.as_str()),
                engine_type: row.get::<_, Option<String>>(6)?,
                engine_config: row.get::<_, Option<String>>(7)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid created_at format: {}", e)))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid updated_at format: {}", e)))?
                    .with_timezone(&Utc),
            })
        });
        
        match api_result {
            Ok(api) => Ok(Some(api)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::from(e)),
        }
    }
    
    /// 名前でAPIを取得
    pub fn find_by_name(conn: &Connection, name: &str) -> Result<Option<Api>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT id, name, model, port, enable_auth, status, 
             COALESCE(engine_type, 'ollama'), engine_config, created_at, updated_at 
             FROM apis WHERE name = ?"
        )?;
        
        let api_result = stmt.query_row(params![name], |row| {
            Ok(Api {
                id: row.get(0)?,
                name: row.get(1)?,
                model: row.get(2)?,
                port: row.get(3)?,
                enable_auth: row.get::<_, i32>(4)? != 0,
                status: ApiStatus::from_str(row.get::<_, String>(5)?.as_str()),
                engine_type: row.get::<_, Option<String>>(6)?,
                engine_config: row.get::<_, Option<String>>(7)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid created_at format: {}", e)))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid updated_at format: {}", e)))?
                    .with_timezone(&Utc),
            })
        });
        
        match api_result {
            Ok(api) => Ok(Some(api)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::from(e)),
        }
    }
    
    /// ポート番号でAPIを取得
    pub fn find_by_port(conn: &Connection, port: u16) -> Result<Option<Api>, DatabaseError> {
        let mut stmt = conn.prepare(
            "SELECT id, name, model, port, enable_auth, status, 
             COALESCE(engine_type, 'ollama'), engine_config, created_at, updated_at 
             FROM apis WHERE port = ?"
        )?;
        
        let api_result = stmt.query_row(params![port], |row| {
            Ok(Api {
                id: row.get(0)?,
                name: row.get(1)?,
                model: row.get(2)?,
                port: row.get(3)?,
                enable_auth: row.get::<_, i32>(4)? != 0,
                status: ApiStatus::from_str(row.get::<_, String>(5)?.as_str()),
                engine_type: row.get::<_, Option<String>>(6)?,
                engine_config: row.get::<_, Option<String>>(7)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid created_at format: {}", e)))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid updated_at format: {}", e)))?
                    .with_timezone(&Utc),
            })
        });
        
        match api_result {
            Ok(api) => Ok(Some(api)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DatabaseError::from(e)),
        }
    }
    
    /// ステータスでAPIを取得
    pub fn find_by_status(conn: &Connection, status: ApiStatus) -> Result<Vec<Api>, DatabaseError> {
        let status_str = status.as_str();
        let mut stmt = conn.prepare(
            "SELECT id, name, model, port, enable_auth, status, 
             COALESCE(engine_type, 'ollama'), engine_config, created_at, updated_at 
             FROM apis WHERE status = ? ORDER BY created_at DESC"
        )?;
        
        let api_iter = stmt.query_map(params![status_str], |row| {
            Ok(Api {
                id: row.get(0)?,
                name: row.get(1)?,
                model: row.get(2)?,
                port: row.get(3)?,
                enable_auth: row.get::<_, i32>(4)? != 0,
                status: ApiStatus::from_str(row.get::<_, String>(5)?.as_str()),
                engine_type: row.get::<_, Option<String>>(6)?,
                engine_config: row.get::<_, Option<String>>(7)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(8)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid created_at format: {}", e)))?
                    .with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map_err(|e| DatabaseError::Other(format!("Invalid updated_at format: {}", e)))?
                    .with_timezone(&Utc),
            })
        })?;
        
        let mut apis = Vec::new();
        for api in api_iter {
            apis.push(api?);
        }
        
        Ok(apis)
    }
    
    /// APIを作成
    pub fn create(conn: &Connection, api: &Api) -> Result<(), DatabaseError> {
        let created_at = api.created_at.to_rfc3339();
        let updated_at = api.updated_at.to_rfc3339();
        let status_str = api.status.as_str();
        let engine_type = api.engine_type.as_deref().unwrap_or("ollama");
        
        conn.execute(
            "INSERT INTO apis (id, name, model, port, enable_auth, status, engine_type, engine_config, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                api.id,
                api.name,
                api.model,
                api.port,
                if api.enable_auth { 1 } else { 0 },
                status_str,
                engine_type,
                api.engine_config,
                created_at,
                updated_at
            ],
        )?;
        
        Ok(())
    }
    
    /// APIを更新
    pub fn update(conn: &Connection, api: &Api) -> Result<(), DatabaseError> {
        let updated_at = Utc::now().to_rfc3339();
        let status_str = api.status.as_str();
        let engine_type = api.engine_type.as_deref().unwrap_or("ollama");
        
        conn.execute(
            "UPDATE apis SET name = ?, model = ?, port = ?, enable_auth = ?, status = ?, engine_type = ?, engine_config = ?, updated_at = ? WHERE id = ?",
            params![
                api.name,
                api.model,
                api.port,
                if api.enable_auth { 1 } else { 0 },
                status_str,
                engine_type,
                api.engine_config,
                updated_at,
                api.id
            ],
        )?;
        
        Ok(())
    }
    
    /// APIステータスを更新
    pub fn update_status(conn: &Connection, id: &str, status: ApiStatus) -> Result<(), DatabaseError> {
        let updated_at = Utc::now().to_rfc3339();
        let status_str = status.as_str();
        
        conn.execute(
            "UPDATE apis SET status = ?, updated_at = ? WHERE id = ?",
            params![status_str, updated_at, id],
        )?;
        
        Ok(())
    }
    
    /// APIを削除
    pub fn delete(conn: &Connection, id: &str) -> Result<(), DatabaseError> {
        conn.execute("DELETE FROM apis WHERE id = ?", params![id])?;
        Ok(())
    }
}

