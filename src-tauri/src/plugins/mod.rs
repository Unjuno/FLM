// Plugin Architecture Module
// サードパーティによる機能拡張のための基盤

use serde::{Deserialize, Serialize};
use crate::utils::error::AppError;

/// プラグイン権限
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginPermissions {
    /// データベースアクセス権限（read, write, none）
    pub database_access: String, // "read", "write", "none"
    /// 外部通信権限（allow, deny）
    pub network_access: String, // "allow", "deny"
    /// APIキーアクセス権限（allow, deny）
    pub api_key_access: String, // "allow", "deny"
    /// ファイルシステムアクセス権限（allow, deny）
    pub filesystem_access: String, // "allow", "deny"
}

impl Default for PluginPermissions {
    fn default() -> Self {
        PluginPermissions {
            database_access: "none".to_string(),
            network_access: "deny".to_string(),
            api_key_access: "deny".to_string(),
            filesystem_access: "deny".to_string(),
        }
    }
}

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
    pub library_path: Option<String>, // 動的ライブラリのパス（.dylib, .so, .dll）
    pub permissions: PluginPermissions, // プラグインの権限
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

/// プラグイン実行コンテキスト
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginContext {
    pub api_id: Option<String>,
    pub data: serde_json::Value,
}

/// プラグイン実行結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginExecutionResult {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

/// プラグインの権限をチェック
fn check_plugin_permissions(
    plugin: &PluginInfo,
    required_permission: &str,
) -> Result<(), String> {
    match required_permission {
        "database_read" | "database_write" => {
            if plugin.permissions.database_access == "none" {
                return Err(format!("プラグイン '{}' にはデータベースアクセス権限がありません", plugin.name));
            }
            if required_permission == "database_write" && plugin.permissions.database_access != "write" {
                return Err(format!("プラグイン '{}' にはデータベース書き込み権限がありません", plugin.name));
            }
        }
        "network" => {
            if plugin.permissions.network_access != "allow" {
                return Err(format!("プラグイン '{}' には外部通信権限がありません", plugin.name));
            }
        }
        "api_key" => {
            if plugin.permissions.api_key_access != "allow" {
                return Err(format!("プラグイン '{}' にはAPIキーアクセス権限がありません", plugin.name));
            }
        }
        "filesystem" => {
            if plugin.permissions.filesystem_access != "allow" {
                return Err(format!("プラグイン '{}' にはファイルシステムアクセス権限がありません", plugin.name));
            }
        }
        _ => {
            return Err(format!("不明な権限: {}", required_permission));
        }
    }
    Ok(())
}

/// プラグインを実行
pub async fn execute_plugin(
    plugin: &PluginInfo,
    context: &PluginContext,
) -> PluginExecutionResult {
    if !plugin.enabled {
        return PluginExecutionResult {
            success: false,
            output: None,
            error: Some("プラグインが無効です".to_string()),
        };
    }

    // プラグインタイプに応じた権限チェック
    let required_permission = match plugin.plugin_type {
        PluginType::Logging => "database_write", // ログプラグインはデータベース書き込み権限が必要
        PluginType::Auth => "api_key", // 認証プラグインはAPIキーアクセス権限が必要
        _ => "", // その他のプラグインタイプは権限チェックなし（将来拡張可能）
    };

    if !required_permission.is_empty() {
        if let Err(e) = check_plugin_permissions(plugin, required_permission) {
            return PluginExecutionResult {
                success: false,
                output: None,
                error: Some(e),
            };
        }
    }

    match plugin.plugin_type {
        PluginType::Engine => execute_engine_plugin(plugin, context).await,
        PluginType::Model => execute_model_plugin(plugin, context).await,
        PluginType::Auth => execute_auth_plugin(plugin, context).await,
        PluginType::Logging => execute_logging_plugin(plugin, context).await,
        PluginType::Custom => execute_custom_plugin(plugin, context).await,
    }
}

/// エンジンプラグインを実行
async fn execute_engine_plugin(
    plugin: &PluginInfo,
    _context: &PluginContext,
) -> PluginExecutionResult {
    PluginExecutionResult {
        success: true,
        output: Some(format!("エンジンプラグイン '{}' が実行されました", plugin.name)),
        error: None,
    }
}

/// プラグインマネージャー
pub struct PluginManager;

impl PluginManager {
    /// プラグインを登録（データベースに保存）
    pub async fn register_plugin(plugin: PluginInfo) -> Result<(), AppError> {
        use crate::database::connection::get_connection;
        use rusqlite::params;
        use chrono::Utc;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー:  {}", e),
            source_detail: None,
        })?;
        
        let now = Utc::now().to_rfc3339();
        let plugin_type_str = match plugin.plugin_type {
            PluginType::Engine => "engine",
            PluginType::Model => "model",
            PluginType::Auth => "auth",
            PluginType::Logging => "logging",
            PluginType::Custom => "custom",
        };
        
        let permissions_json = serde_json::to_string(&plugin.permissions).map_err(|e| AppError::DatabaseError {
            message: format!("権限情報のシリアライズエラー: {}", e),
            source_detail: None,
        })?;
        
        conn.execute(
            r#"
            INSERT OR REPLACE INTO plugins 
            (id, name, version, author, description, enabled, plugin_type, library_path, permissions, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                plugin.id,
                plugin.name,
                plugin.version,
                plugin.author,
                plugin.description,
                if plugin.enabled { 1 } else { 0 },
                plugin_type_str,
                plugin.library_path,
                permissions_json,
                now,
                now,
            ],
        ).map_err(|e| AppError::DatabaseError {
            message: format!("プラグイン登録エラー: {}", e),
            source_detail: None,
        })?;
        
        Ok(())
    }
    
    /// プラグインを取得（データベースから）
    pub async fn get_plugin(id: &str) -> Result<Option<PluginInfo>, AppError> {
        use crate::database::connection::get_connection;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー:  {}", e),
            source_detail: None,
        })?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, version, author, description, enabled, plugin_type, library_path, permissions FROM plugins WHERE id = ?1"
        ).map_err(|e| AppError::DatabaseError {
            message: format!("SQL準備エラー: {}", e),
            source_detail: None,
        })?;
        
        use rusqlite::params;
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
            
            let permissions_json: Option<String> = row.get(8)?;
            let permissions = if let Some(json) = permissions_json {
                serde_json::from_str(&json).unwrap_or_default()
            } else {
                PluginPermissions::default()
            };
            
            Ok(PluginInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                author: row.get(3)?,
                description: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
                plugin_type,
                library_path: row.get(7)?,
                permissions,
            })
        });
        
        match result {
            Ok(plugin) => Ok(Some(plugin)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::DatabaseError {
                message: format!("プラグイン取得エラー: {}", e),
                source_detail: None,
            }),
        }
    }
    
    /// すべてのプラグインを取得（データベースから）
    pub async fn get_all_plugins() -> Result<Vec<PluginInfo>, AppError> {
        use crate::database::connection::get_connection;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
            source_detail: None,
        })?;
        
        // テーブルの存在確認
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='plugins'",
                [],
                |row| Ok(row.get::<_, i32>(0)? > 0),
            )
            .unwrap_or(false);
        
        if !table_exists {
            // テーブルが存在しない場合は空の配列を返す
            return Ok(Vec::new());
        }
        
        let mut stmt = match conn.prepare(
            "SELECT id, name, version, author, description, enabled, plugin_type, library_path, permissions, created_at, updated_at FROM plugins ORDER BY name"
        ) {
            Ok(stmt) => stmt,
            Err(e) => {
                // SQL準備エラーの場合、テーブル構造が一致していない可能性がある
                // エラーログを出力して空の配列を返す
                eprintln!("[WARN] プラグインテーブルのSQL準備エラー: {}", e);
                return Ok(Vec::new());
            }
        };
        
        let plugins_iter = match stmt.query_map([], |row| {
            let plugin_type_str: String = row.get(6)?;
            let plugin_type = match plugin_type_str.as_str() {
                "engine" => PluginType::Engine,
                "model" => PluginType::Model,
                "auth" => PluginType::Auth,
                "logging" => PluginType::Logging,
                "custom" => PluginType::Custom,
                _ => PluginType::Custom,
            };
            
            let permissions_json: Option<String> = row.get(8)?;
            let permissions = if let Some(json) = permissions_json {
                serde_json::from_str(&json).unwrap_or_default()
            } else {
                PluginPermissions::default()
            };
            
            Ok(PluginInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                author: row.get(3)?,
                description: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
                plugin_type,
                library_path: row.get(7)?,
                permissions,
            })
        }) {
            Ok(iter) => iter,
            Err(e) => {
                eprintln!("[WARN] プラグイン取得エラー: {}", e);
                return Ok(Vec::new());
            }
        };
        
        let mut plugins = Vec::new();
        for plugin_result in plugins_iter {
            match plugin_result {
                Ok(plugin) => plugins.push(plugin),
                Err(e) => {
                    eprintln!("[WARN] プラグインデータの解析エラー: {}", e);
                    // 個別のエラーは無視して続行
                }
            }
        }
        
        Ok(plugins)
    }
    
    /// 有効なプラグインを取得（データベースから）
    pub async fn get_enabled_plugins() -> Result<Vec<PluginInfo>, AppError> {
        use crate::database::connection::get_connection;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー:  {}", e),
            source_detail: None,
        })?;
        
        let mut stmt = conn.prepare(
            "SELECT id, name, version, author, description, enabled, plugin_type, library_path, permissions FROM plugins WHERE enabled = 1 ORDER BY name"
        ).map_err(|e| AppError::DatabaseError {
            message: format!("SQL準備エラー: {}", e),
            source_detail: None,
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
            
            let permissions_json: Option<String> = row.get(8)?;
            let permissions = if let Some(json) = permissions_json {
                serde_json::from_str(&json).unwrap_or_default()
            } else {
                PluginPermissions::default()
            };
            
            Ok(PluginInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                author: row.get(3)?,
                description: row.get(4)?,
                enabled: row.get::<_, i32>(5)? != 0,
                plugin_type,
                library_path: row.get(7)?,
                permissions,
            })
        }).map_err(|e| AppError::DatabaseError {
            message: format!("プラグイン取得エラー: {}", e),
            source_detail: None,
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
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
            source_detail: None,
        })?;
        
        use rusqlite::params;
        let rows_affected = conn.execute(
            "UPDATE plugins SET enabled = ?1 WHERE id = ?2",
            params![if enabled { 1 } else { 0 }, id],
        ).map_err(|e| AppError::DatabaseError {
            message: format!("プラグイン更新エラー: {}", e),
            source_detail: None,
        })?;
        
        if rows_affected == 0 {
            return Err(AppError::ApiError {
                message: format!("プラグイン '{}' が見つかりません", id),
                code: "PLUGIN_NOT_FOUND".to_string(),
                source_detail: None,
            });
        }
        
        Ok(())
    }
    
    /// プラグインを削除
    pub async fn unregister_plugin(id: &str) -> Result<(), AppError> {
        use crate::database::connection::get_connection;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
            source_detail: None,
        })?;
        
        use rusqlite::params;
        let rows_affected = conn.execute(
            "DELETE FROM plugins WHERE id = ?1",
            params![id],
        ).map_err(|e| AppError::DatabaseError {
            message: format!("プラグイン削除エラー: {}", e),
            source_detail: None,
        })?;
        
        if rows_affected == 0 {
            return Err(AppError::ApiError {
                message: format!("プラグイン '{}' が見つかりません", id),
                code: "PLUGIN_NOT_FOUND".to_string(),
                source_detail: None,
            });
        }
        
        Ok(())
    }
    
    /// プラグインの権限を更新
    pub async fn update_plugin_permissions(
        id: &str,
        permissions: &PluginPermissions,
    ) -> Result<(), AppError> {
        use crate::database::connection::get_connection;
        use chrono::Utc;
        
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
            source_detail: None,
        })?;
        
        let permissions_json = serde_json::to_string(permissions).map_err(|e| AppError::DatabaseError {
            message: format!("権限情報のシリアライズエラー: {}", e),
            source_detail: None,
        })?;
        
        let now = Utc::now().to_rfc3339();
        use rusqlite::params;
        let rows_affected = conn.execute(
            "UPDATE plugins SET permissions = ?1, updated_at = ?2 WHERE id = ?3",
            params![permissions_json, now, id],
        ).map_err(|e| AppError::DatabaseError {
            message: format!("プラグイン権限更新エラー: {}", e),
            source_detail: None,
        })?;
        
        if rows_affected == 0 {
            return Err(AppError::ApiError {
                message: format!("プラグイン '{}' が見つかりません", id),
                code: "PLUGIN_NOT_FOUND".to_string(),
                source_detail: None,
            });
        }
        
        Ok(())
    }
}

/// モデル管理プラグインを実行
async fn execute_model_plugin(
    plugin: &PluginInfo,
    _context: &PluginContext,
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
    _context: &PluginContext,
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
    _context: &PluginContext,
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


