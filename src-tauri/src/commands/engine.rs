// Engine Management Commands
// エンジン管理のIPCコマンド

use crate::engines::{EngineManager, EngineDetectionResult, EngineConfig, EngineConfigData};
use crate::database::connection::get_connection;
use rusqlite::params;
use uuid::Uuid;
use chrono::Utc;

/// グローバルエンジンマネージャーインスタンス（シンプルな実装）
fn get_engine_manager() -> EngineManager {
    EngineManager::new()
}

/// 利用可能なエンジン一覧を取得
#[tauri::command]
pub async fn get_available_engines() -> Result<Vec<String>, String> {
    let manager = get_engine_manager();
    Ok(manager.get_available_engine_types())
}

/// 特定のエンジンを検出
#[tauri::command]
pub async fn detect_engine(engine_type: String) -> Result<EngineDetectionResult, String> {
    let manager = get_engine_manager();
    manager.detect_engine(&engine_type).await
        .map_err(|e| format!("{}", e))
}

/// すべてのエンジンを検出
#[tauri::command]
pub async fn detect_all_engines() -> Result<Vec<EngineDetectionResult>, String> {
    let manager = get_engine_manager();
    Ok(manager.detect_all_engines().await)
}

/// エンジンを起動
#[tauri::command]
pub async fn start_engine(
    engine_type: String,
    config: Option<EngineConfig>
) -> Result<u32, String> {
    let manager = get_engine_manager();
    manager.start_engine(&engine_type, config).await
        .map_err(|e| format!("{}", e))
}

/// エンジンを停止
#[tauri::command]
pub async fn stop_engine(engine_type: String) -> Result<(), String> {
    let manager = get_engine_manager();
    manager.stop_engine(&engine_type).await
        .map_err(|e| format!("{}", e))
}

/// エンジン設定を保存
#[tauri::command]
pub async fn save_engine_config(config: EngineConfigData) -> Result<String, String> {
    let conn = get_connection()
        .map_err(|e| format!("データベース接続エラー: {}", e))?;
    
    let now = Utc::now().to_rfc3339();
    let id = if config.id.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        config.id.clone()
    };
    
    conn.execute(
        r#"
        INSERT OR REPLACE INTO engine_configs 
        (id, engine_type, name, base_url, auto_detect, executable_path, is_default, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 
                COALESCE((SELECT created_at FROM engine_configs WHERE id = ?1), ?8),
                ?8)
        "#,
        params![
            id,
            config.engine_type,
            config.name,
            config.base_url,
            if config.auto_detect { 1 } else { 0 },
            config.executable_path,
            if config.is_default { 1 } else { 0 },
            now,
        ],
    )
    .map_err(|e| format!("データベース保存エラー: {}", e))?;
    
    // デフォルトエンジンを設定する場合、他のエンジンのis_defaultを0に設定
    if config.is_default {
        conn.execute(
            "UPDATE engine_configs SET is_default = 0 WHERE engine_type = ?1 AND id != ?2",
            params![config.engine_type, id],
        )
        .map_err(|e| format!("デフォルトエンジン設定エラー: {}", e))?;
    }
    
    Ok(id)
}

/// エンジン設定一覧を取得
#[tauri::command]
pub async fn get_engine_configs(engine_type: Option<String>) -> Result<Vec<EngineConfigData>, String> {
    let conn = get_connection()
        .map_err(|e| format!("データベース接続エラー: {}", e))?;
    
    let query = if engine_type.is_some() {
        "SELECT id, engine_type, name, base_url, auto_detect, executable_path, is_default, created_at, updated_at FROM engine_configs WHERE engine_type = ?1 ORDER BY is_default DESC, created_at DESC"
    } else {
        "SELECT id, engine_type, name, base_url, auto_detect, executable_path, is_default, created_at, updated_at FROM engine_configs ORDER BY is_default DESC, created_at DESC"
    };
    
    let mut stmt = conn.prepare(query)
        .map_err(|e| format!("クエリ準備エラー: {}", e))?;
    
    let mut configs = Vec::new();
    
    if let Some(et) = engine_type.as_ref() {
        let rows = stmt.query_map(params![et], |row| {
            Ok(EngineConfigData {
                id: row.get(0)?,
                engine_type: row.get(1)?,
                name: row.get(2)?,
                base_url: row.get(3)?,
                auto_detect: row.get::<_, i32>(4)? != 0,
                executable_path: row.get(5)?,
                is_default: row.get::<_, i32>(6)? != 0,
            })
        })
        .map_err(|e| format!("クエリ実行エラー: {}", e))?;
        
        for row in rows {
            configs.push(row.map_err(|e| format!("行読み込みエラー: {}", e))?);
        }
    } else {
        let rows = stmt.query_map([], |row| {
            Ok(EngineConfigData {
                id: row.get(0)?,
                engine_type: row.get(1)?,
                name: row.get(2)?,
                base_url: row.get(3)?,
                auto_detect: row.get::<_, i32>(4)? != 0,
                executable_path: row.get(5)?,
                is_default: row.get::<_, i32>(6)? != 0,
            })
        })
        .map_err(|e| format!("クエリ実行エラー: {}", e))?;
        
        for row in rows {
            configs.push(row.map_err(|e| format!("行読み込みエラー: {}", e))?);
        }
    }
    
    Ok(configs)
}

/// エンジン設定を削除
#[tauri::command]
pub async fn delete_engine_config(config_id: String) -> Result<(), String> {
    let conn = get_connection()
        .map_err(|e| format!("データベース接続エラー: {}", e))?;
    
    conn.execute(
        "DELETE FROM engine_configs WHERE id = ?1",
        params![config_id],
    )
    .map_err(|e| format!("削除エラー: {}", e))?;
    
    Ok(())
}

/// エンジンからモデル一覧を取得
#[tauri::command]
pub async fn get_engine_models(engine_type: String) -> Result<Vec<crate::engines::ModelInfo>, String> {
    let manager = get_engine_manager();
    manager.get_engine_models(&engine_type).await
        .map_err(|e| format!("{}", e))
}

