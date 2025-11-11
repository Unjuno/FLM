use crate::utils::error::AppError;
/// アップデート機能のコマンド
///
/// アプリケーション本体の自動アップデート機能を提供します。
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

/// アップデートチェック結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub update_available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
}

/// アップデート進捗情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub status: String,
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub message: Option<String>,
}

/// アップデートチェック
///
/// 最新バージョンが利用可能かどうかを確認します。
#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<UpdateCheckResult, AppError> {
    use tauri_plugin_updater::Updater;

    let current_version = env!("CARGO_PKG_VERSION").to_string();

    // アップデーターを取得（Tauri 2.xではappから直接取得）
    let updater = match app.try_state::<Updater>() {
        Some(updater) => updater.inner(),
        None => {
            return Err(AppError::ApiError {
                message: "アップデーターが初期化されていません".to_string(),
                code: "UPDATER_NOT_INITIALIZED".to_string(),
                source_detail: None,
            });
        }
    };

    // アップデートをチェック
    match updater.check().await {
        Ok(update) => {
            if let Some(update) = update {
                // アップデートが利用可能
                Ok(UpdateCheckResult {
                    update_available: true,
                    current_version: current_version.clone(),
                    latest_version: Some(update.version.clone()),
                    release_notes: update.body.clone(),
                    download_url: Some(update.download_url.to_string()),
                })
            } else {
                // アップデートなし
                Ok(UpdateCheckResult {
                    update_available: false,
                    current_version: current_version.clone(),
                    latest_version: Some(current_version),
                    release_notes: None,
                    download_url: None,
                })
            }
        }
        Err(e) => Err(AppError::ApiError {
            message: format!("アップデートチェックに失敗しました: {}", e),
            code: "UPDATE_CHECK_ERROR".to_string(),
            source_detail: None,
        }),
    }
}

/// アップデートのダウンロードとインストール
///
/// アップデートをダウンロードし、インストールを実行します。
#[tauri::command]
pub async fn install_app_update(app: AppHandle) -> Result<(), AppError> {
    use tauri_plugin_updater::Updater;

    // アップデーターを取得（Tauri 2.xではappから直接取得）
    let updater = match app.try_state::<Updater>() {
        Some(updater) => updater.inner(),
        None => {
            return Err(AppError::ApiError {
                message: "アップデーターが初期化されていません".to_string(),
                code: "UPDATER_NOT_INITIALIZED".to_string(),
                source_detail: None,
            });
        }
    };

    // アップデートをチェック
    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => {
            return Err(AppError::ApiError {
                message: "アップデートが利用できません".to_string(),
                code: "NO_UPDATE_AVAILABLE".to_string(),
                source_detail: None,
            });
        }
        Err(e) => {
            return Err(AppError::ApiError {
                message: format!("アップデートチェックに失敗しました: {}", e),
                code: "UPDATE_CHECK_ERROR".to_string(),
                source_detail: None,
            });
        }
    };

    // ダウンロードとインストールを実行
    // 注意: Tauri 2.xの`tauri-plugin-updater`では、進捗イベントはプラグインが自動的に発行します
    // フロントエンドで`app_update_progress`イベントをリッスンすることで進捗を取得できます
    update
        .download_and_install(
            |chunk_length, content_length| {
                // 進捗コールバック
                // content_lengthはOption<u64>、chunk_lengthはusize
                let total_bytes = content_length.unwrap_or(0);
                let progress = if total_bytes > 0 {
                    (chunk_length as f64 / total_bytes as f64) * 100.0
                } else {
                    0.0
                };

                let progress_info = UpdateProgress {
                    status: "downloading".to_string(),
                    progress,
                    downloaded_bytes: chunk_length as u64,
                    total_bytes,
                    message: Some("アップデートをダウンロード中...".to_string()),
                };

                if let Err(e) = app.emit("app_update_progress", &progress_info) {
                    eprintln!("[WARN] アプリ更新進捗イベントの送信に失敗しました: {}", e);
                }
            },
            || {
                // インストール開始時のコールバック
                if let Err(e) = app.emit("app_update_installed", ()) {
                    eprintln!(
                        "[WARN] アプリ更新インストール完了イベントの送信に失敗しました: {}",
                        e
                    );
                }
            },
        )
        .await
        .map_err(|e| AppError::ApiError {
            message: format!(
                "アップデートのダウンロードとインストールに失敗しました: {}",
                e
            ),
            code: "UPDATE_INSTALL_ERROR".to_string(),
            source_detail: None,
        })?;

    Ok(())
}
