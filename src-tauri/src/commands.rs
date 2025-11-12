// Tauri IPCコマンド定義

pub mod alerts;
pub mod api;
pub mod backup;
pub mod database;
pub mod engine;
pub mod ipc_version;
pub mod model_converter;
pub mod model_sharing;
pub mod oauth;
pub mod ollama;
pub mod performance;
pub mod plugin;
pub mod port;
pub mod remote_sync;
pub mod scheduler;
pub mod settings;
pub mod suggestions;
pub mod system;
pub mod updater;

use crate::AppInfo;

/// 基本的なテストコマンド（greetコマンド）
/// フロントエンドから渡された名前を使用して挨拶メッセージを返す
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("こんにちは、{}さん！FLMへようこそ！", name)
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        description: env!("CARGO_PKG_DESCRIPTION").to_string(),
    }
}
