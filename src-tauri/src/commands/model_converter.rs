// Model Converter Commands
// モデル変換コマンド

use crate::utils::model_converter::{ModelConversionConfig, ModelConversionProgress, convert_to_gguf};
use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

/// モデル変換設定（フロントエンドから受け取る形式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConversionConfigInput {
    pub source_path: String,
    pub target_name: String,
    pub quantization: Option<String>,
    pub output_format: String,
}

/// モデル変換コマンド
/// 
/// モデルをGGUF形式に変換します。
/// 
/// # 引数
/// * `config` - モデル変換設定
/// 
/// # 戻り値
/// * 変換後のファイルパス
#[tauri::command]
pub async fn convert_model(
    config: ModelConversionConfigInput,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let conversion_config = ModelConversionConfig {
        source_path: config.source_path,
        target_name: config.target_name,
        quantization: config.quantization,
        output_format: config.output_format,
    };
    
    // 進捗イベントを発行するコールバック
    let mut last_progress = 0.0;
    let progress_callback = move |progress: ModelConversionProgress| -> Result<(), AppError> {
        // 進捗が変化した場合のみイベントを発行（パフォーマンス最適化）
        if (progress.progress - last_progress).abs() > 1.0 || last_progress == 0.0 {
            last_progress = progress.progress;
            
            // イベントを発行（エラーは無視）
            let _ = app_handle.emit("model_conversion_progress", &progress);
        }
        Ok(())
    };
    
    convert_to_gguf(conversion_config, progress_callback)
        .await
        .map_err(|e| match e {
            AppError::ApiError { message, .. } => message,
            AppError::IoError { message, .. } => message,
            _ => format!("モデル変換に失敗しました: {}", e),
        })
}

