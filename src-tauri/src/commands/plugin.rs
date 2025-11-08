// Plugin Commands
// プラグイン管理機能のTauri IPCコマンド

use crate::plugins::{PluginInfo, PluginType, PluginManager, execute_plugin, PluginContext};
use crate::utils::error::AppError;

/// プラグインを登録
#[tauri::command]
pub async fn register_plugin(
    plugin_id: String,
    plugin_name: String,
    plugin_version: String,
    plugin_author: String,
    plugin_description: Option<String>,
    plugin_type: String,
    permissions: Option<crate::plugins::PluginPermissions>,
) -> Result<(), AppError> {
    let plugin_type_enum = match plugin_type.as_str() {
        "Engine" => PluginType::Engine,
        "Model" => PluginType::Model,
        "Auth" => PluginType::Auth,
        "Logging" => PluginType::Logging,
        _ => PluginType::Custom,
    };
    
    let plugin = PluginInfo {
        id: plugin_id,
        name: plugin_name,
        version: plugin_version,
        author: plugin_author,
        description: plugin_description,
        enabled: true,
        plugin_type: plugin_type_enum,
        library_path: None,
        permissions: permissions.unwrap_or_default(),
    };
    
    PluginManager::register_plugin(plugin).await
}

/// すべてのプラグインを取得
#[tauri::command]
pub async fn get_all_plugins() -> Result<Vec<PluginInfo>, AppError> {
    PluginManager::get_all_plugins().await
}

/// プラグインを取得
#[tauri::command]
pub async fn get_plugin(plugin_id: String) -> Result<Option<PluginInfo>, AppError> {
    PluginManager::get_plugin(&plugin_id).await
}

/// プラグインを有効化/無効化
#[tauri::command]
pub async fn set_plugin_enabled(plugin_id: String, enabled: bool) -> Result<(), AppError> {
    PluginManager::set_plugin_enabled(&plugin_id, enabled).await
}

/// プラグインを削除
#[tauri::command]
pub async fn unregister_plugin(plugin_id: String) -> Result<(), AppError> {
    PluginManager::unregister_plugin(&plugin_id).await
}

/// プラグインの権限を更新
#[tauri::command]
pub async fn update_plugin_permissions(
    plugin_id: String,
    permissions: crate::plugins::PluginPermissions,
) -> Result<(), AppError> {
    PluginManager::update_plugin_permissions(&plugin_id, &permissions).await
}

/// プラグインを実行
#[tauri::command]
pub async fn execute_plugin_command(
    plugin_id: String,
    context_data: serde_json::Value,
) -> Result<crate::plugins::PluginExecutionResult, AppError> {
    let plugin = PluginManager::get_plugin(&plugin_id).await?
        .ok_or_else(|| AppError::ApiError {
            message: format!("プラグイン '{}' が見つかりません", plugin_id),
            code: "PLUGIN_NOT_FOUND".to_string(),
            source_detail: None,
        })?;
    
    let context = PluginContext {
        api_id: None,
        data: context_data,
    };
    
    Ok(execute_plugin(&plugin, &context).await)
}


