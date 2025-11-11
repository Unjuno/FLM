// Remote Sync Commands
// クラウド同期機能のTauri IPCコマンド

use crate::utils::error::AppError;
use crate::utils::remote_sync::{RemoteAccessConfig, SyncInfo};

/// 設定を同期
#[tauri::command]
pub async fn sync_settings(
    config: RemoteAccessConfig,
    settings_data: String,
) -> Result<SyncInfo, AppError> {
    crate::utils::remote_sync::sync_settings(&config, &settings_data).await
}

/// 同期された設定を取得
#[tauri::command]
pub async fn get_synced_settings(config: RemoteAccessConfig) -> Result<Option<String>, AppError> {
    crate::utils::remote_sync::get_synced_settings(&config).await
}

/// リモートアクセス用の設定をエクスポート
#[tauri::command]
pub async fn export_settings_for_remote() -> Result<String, AppError> {
    crate::utils::remote_sync::export_settings_for_remote().await
}

/// リモートアクセス用の設定をインポート
#[tauri::command]
pub async fn import_settings_from_remote(settings_json: String) -> Result<(), AppError> {
    crate::utils::remote_sync::import_settings_from_remote(&settings_json).await
}

/// デバイスIDを生成
#[tauri::command]
pub fn generate_device_id() -> String {
    crate::utils::remote_sync::generate_device_id()
}
