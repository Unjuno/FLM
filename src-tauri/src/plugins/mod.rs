// Plugin Architecture Module
// サードパーティによる機能拡張のための基盤

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::utils::error::AppError;

/// プラグイン情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub plugin_type: PluginType,
}

/// プラグインタイプ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PluginType {
    Engine,      // エンジンプラグイン
    Model,      // モデル管理プラグイン
    Auth,       // 認証プラグイン
    Logging,    // ログプラグイン
    Custom,     // カスタムプラグイン
}

/// プラグインマネージャー
pub struct PluginManager;

impl PluginManager {
    /// プラグインを登録（データベースに保存）
    pub async fn register_plugin(plugin: PluginInfo) -> Result<(), AppError> {
        use crate::database::connection::get_connection;
        use rusqlite::params;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
        })?;
        
        let now = chrono::Utc::now().to_rfc3339();
        let plugin_type_str = match plugin.plugin_type {
            PluginType::Engine => "engine",
            PluginType::Model => "model",
            PluginType::Auth => "auth",
            PluginType::Logging => "logging",
            PluginType::Custom => "custom",
        };
        
        conn.execute(
            r#"
            INSERT INTO plugins (id, name, version, author, description, enabled, plugin_type, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                plugin.id,
                plugin.name,
                plugin.version,
                plugin.author,
                plugin.description,
                if plugin.enabled { 1 } else { 0 },
                plugin_type_str,
                now,
                now,
            ],
        ).map_err(|e| AppError::DatabaseError {
            message: format!("プラグイン登録エラー: {}", e),
        })?;
        
        Ok(())
    }
    
    /// プラグインを取得（データベースから）
    pub async fn get_plugin(id: &str) -> Result<Option<PluginInfo>, AppError> {
        use crate::database::connection::get_connection;
        use rusqlite::params;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
        })?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, version, author, description, enabled, plugin_type, created_at, updated_at FROM plugins WHERE id = ?1"
        ).map_err(|e| AppError::DatabaseError {
            message: format!("SQL準備エラー: {}", e),
        })?;
        
        let result = stmt.query_row(params![id], |row| {
            let plugin_type_str: String = row.get(6)?;
            let plugin_type = match plugin_type_str.as_str() {
                "engine" => PluginType::Engine,
                "model" => PluginType::Model,
                "auth" => PluginType::Auth,
                "logging" => PluginType::Logging,
                "custom" => PluginType::Custom,
                _ => PluginType::Custom,
            };
            
            Ok(PluginInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                author: row.get(3)?,
                description: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
                plugin_type,
            })
        });
        
        match result {
            Ok(plugin) => Ok(Some(plugin)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::DatabaseError {
                message: format!("プラグイン取得エラー: {}", e),
            }),
        }
    }
    
    /// すべてのプラグインを取得（データベースから）
    pub async fn get_all_plugins() -> Result<Vec<PluginInfo>, AppError> {
        use crate::database::connection::get_connection;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
        })?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, version, author, description, enabled, plugin_type, created_at, updated_at FROM plugins ORDER BY name"
        ).map_err(|e| AppError::DatabaseError {
            message: format!("SQL準備エラー: {}", e),
        })?;
        
        let plugins_iter = stmt.query_map([], |row| {
            let plugin_type_str: String = row.get(6)?;
            let plugin_type = match plugin_type_str.as_str() {
                "engine" => PluginType::Engine,
                "model" => PluginType::Model,
                "auth" => PluginType::Auth,
                "logging" => PluginType::Logging,
                "custom" => PluginType::Custom,
                _ => PluginType::Custom,
            };
            
            Ok(PluginInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                author: row.get(3)?,
                description: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
                plugin_type,
            })
        }).map_err(|e| AppError::DatabaseError {
            message: format!("プラグイン取得エラー: {}", e),
        })?;
        
        let mut plugins = Vec::new();
        for plugin_result in plugins_iter {
            plugins.push(plugin_result?);
        }
        
        Ok(plugins)
    }
    
    /// 有効なプラグインを取得（データベースから）
    pub async fn get_enabled_plugins() -> Result<Vec<PluginInfo>, AppError> {
        use crate::database::connection::get_connection;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
        })?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, version, author, description, enabled, plugin_type, created_at, updated_at FROM plugins WHERE enabled = 1 ORDER BY name"
        ).map_err(|e| AppError::DatabaseError {
            message: format!("SQL準備エラー: {}", e),
        })?;
        
        let plugins_iter = stmt.query_map([], |row| {
            let plugin_type_str: String = row.get(6)?;
            let plugin_type = match plugin_type_str.as_str() {
                "engine" => PluginType::Engine,
                "model" => PluginType::Model,
                "auth" => PluginType::Auth,
                "logging" => PluginType::Logging,
                "custom" => PluginType::Custom,
                _ => PluginType::Custom,
            };
            
            Ok(PluginInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                author: row.get(3)?,
                description: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
                plugin_type,
            })
        }).map_err(|e| AppError::DatabaseError {
            message: format!("プラグイン取得エラー: {}", e),
        })?;
        
        let mut plugins = Vec::new();
        for plugin_result in plugins_iter {
            plugins.push(plugin_result?);
        }
        
        Ok(plugins)
    }
    
    /// プラグインを有効化/無効化（データベースを更新）
    pub async fn set_plugin_enabled(id: &str, enabled: bool) -> Result<(), AppError> {
        use crate::database::connection::get_connection;
        use rusqlite::params;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
        })?;
        
        let rows_affected = conn.execute(
            "UPDATE plugins SET enabled = ?1, updated_at = ?2 WHERE id = ?3",
            params![if enabled { 1 } else { 0 }, chrono::Utc::now().to_rfc3339(), id],
        ).map_err(|e| AppError::DatabaseError {
            message: format!("プラグイン更新エラー: {}", e),
        })?;
        
        if rows_affected == 0 {
            return Err(AppError::ApiError {
                message: format!("プラグイン '{}' が見つかりません", id),
                code: "PLUGIN_NOT_FOUND".to_string(),
            });
        }
        
        Ok(())
    }
    
    /// プラグインを削除（データベースから削除）
    pub async fn unregister_plugin(id: &str) -> Result<(), AppError> {
        use crate::database::connection::get_connection;
        use rusqlite::params;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
        })?;
        
        let rows_affected = conn.execute(
            "DELETE FROM plugins WHERE id = ?1",
            params![id],
        ).map_err(|e| AppError::DatabaseError {
            message: format!("プラグイン削除エラー: {}", e),
        })?;
        
        if rows_affected == 0 {
            return Err(AppError::ApiError {
                message: format!("プラグイン '{}' が見つかりません", id),
                code: "PLUGIN_NOT_FOUND".to_string(),
            });
        }
        
        Ok(())
    }
}

/// プラグインインターフェース（将来拡張用）
pub trait Plugin {
    fn get_info(&self) -> &PluginInfo;
    fn initialize(&mut self) -> Result<(), AppError>;
    fn shutdown(&mut self) -> Result<(), AppError>;
}

/// プラグインの実行コンテキスト
#[derive(Debug, Clone)]
pub struct PluginContext {
    pub plugin_id: String,
    pub data: serde_json::Value,
}

/// プラグイン実行結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginExecutionResult {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

/// プラグインを実行
/// 現在はプラグイン情報に基づいた実行結果を返す
/// 将来の拡張では、プラグインの動的ロード（dylib/soファイル）と実行環境（サンドボックス）を実装
pub async fn execute_plugin(
    plugin_id: &str,
    context: PluginContext,
) -> Result<PluginExecutionResult, AppError> {
    // データベースからプラグイン情報を取得
    let plugin = PluginManager::get_plugin(plugin_id).await?
        .ok_or_else(|| AppError::ApiError {
            message: format!("プラグイン '{}' が見つかりません", plugin_id),
            code: "PLUGIN_NOT_FOUND".to_string(),
        })?;
    
    if !plugin.enabled {
        return Err(AppError::ApiError {
            message: format!("プラグイン '{}' は無効になっています", plugin_id),
            code: "PLUGIN_DISABLED".to_string(),
        });
    }
    
    // プラグインタイプに応じた処理
    // 実際の実装では、プラグインの動的ロードと実行が必要
    // 現在は、プラグイン情報に基づいて実行結果を返す
    let result = match plugin.plugin_type {
        PluginType::Engine => {
            // エンジンプラグインの実行
            // コンテキストデータを使用してエンジン操作を実行
            execute_engine_plugin(&plugin, &context).await
        },
        PluginType::Model => {
            // モデル管理プラグインの実行
            execute_model_plugin(&plugin, &context).await
        },
        PluginType::Auth => {
            // 認証プラグインの実行
            execute_auth_plugin(&plugin, &context).await
        },
        PluginType::Logging => {
            // ログプラグインの実行
            execute_logging_plugin(&plugin, &context).await
        },
        PluginType::Custom => {
            // カスタムプラグインの実行
            execute_custom_plugin(&plugin, &context).await
        },
    };
    
    // 実行結果を監査ログに記録
    use crate::utils::audit_log::{log_audit_event, AuditAction};
    let _ = log_audit_event(
        &context.plugin_id,
        AuditAction::Custom("plugin_execute".to_string()),
        "plugin",
        Some(plugin_id),
        Some(&serde_json::to_string(&result).unwrap_or_default()),
        None,
        None,
        None,
        result.success,
    ).await;
    
    Ok(result)
}

/// エンジンプラグインを実行
async fn execute_engine_plugin(
    plugin: &PluginInfo,
    context: &PluginContext,
) -> PluginExecutionResult {
    // エンジンプラグインの実行ロジック
    // コンテキストデータからエンジン設定を取得
    PluginExecutionResult {
        success: true,
        output: Some(format!("エンジンプラグイン '{}' が実行されました。コンテキスト: {}", 
            plugin.name,
            serde_json::to_string(&context.data).unwrap_or_default()
        )),
        error: None,
    }
}

/// モデル管理プラグインを実行
async fn execute_model_plugin(
    plugin: &PluginInfo,
    context: &PluginContext,
) -> PluginExecutionResult {
    PluginExecutionResult {
        success: true,
        output: Some(format!("モデル管理プラグイン '{}' が実行されました", plugin.name)),
        error: None,
    }
}

/// 認証プラグインを実行
async fn execute_auth_plugin(
    plugin: &PluginInfo,
    context: &PluginContext,
) -> PluginExecutionResult {
    PluginExecutionResult {
        success: true,
        output: Some(format!("認証プラグイン '{}' が実行されました", plugin.name)),
        error: None,
    }
}

/// ログプラグインを実行
async fn execute_logging_plugin(
    plugin: &PluginInfo,
    context: &PluginContext,
) -> PluginExecutionResult {
    PluginExecutionResult {
        success: true,
        output: Some(format!("ログプラグイン '{}' が実行されました", plugin.name)),
        error: None,
    }
}

/// カスタムプラグインを実行
async fn execute_custom_plugin(
    plugin: &PluginInfo,
    context: &PluginContext,
) -> PluginExecutionResult {
    PluginExecutionResult {
        success: true,
        output: Some(format!("カスタムプラグイン '{}' が実行されました。コンテキスト: {}", 
            plugin.name,
            serde_json::to_string(&context.data).unwrap_or_default()
        )),
        error: None,
    }
}

