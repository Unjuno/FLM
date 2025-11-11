// Model Sharing Commands
// モデル共有機能のTauri IPCコマンド

use crate::utils::error::AppError;
use crate::utils::model_sharing::{
    download_shared_model, search_shared_models, share_model, ModelSharingConfig, SharedModelInfo,
};
use std::path::PathBuf;

/// モデルを共有
#[tauri::command]
pub async fn share_model_command(config: ModelSharingConfig) -> Result<SharedModelInfo, AppError> {
    share_model(config).await
}

/// 共有モデルを検索
#[tauri::command]
pub async fn search_shared_models_command(
    query: Option<String>,
    tags: Option<Vec<String>>,
    limit: Option<u32>,
) -> Result<Vec<SharedModelInfo>, AppError> {
    search_shared_models(query, tags, limit).await
}

/// 共有モデルをダウンロード
#[tauri::command]
pub async fn download_shared_model_command(
    model_id: String,
    target_path: String,
) -> Result<String, AppError> {
    let path = download_shared_model(&model_id, Some(PathBuf::from(target_path))).await?;
    Ok(path.to_string_lossy().to_string())
}
