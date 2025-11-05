// Model Converter Module
// モデル変換機能（GGUF形式への自動変換）

use crate::utils::error::AppError;
use crate::database::connection::get_app_data_dir;
use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};

/// モデル変換進捗情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConversionProgress {
    pub status: String,             // "downloading" | "converting" | "completed" | "error"
    pub progress: f64,              // 0.0 - 100.0
    pub message: Option<String>,    // ステータスメッセージ
}

/// モデル変換設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConversionConfig {
    pub source_path: String,        // 変換元のモデルパス
    pub target_name: String,        // 変換後のモデル名
    pub quantization: Option<String>, // 量子化レベル（Q4_K_M, Q8_0等）
    pub output_format: String,      // 出力形式（gguf）
}

/// モデルをGGUF形式に変換
pub async fn convert_to_gguf<F>(
    config: ModelConversionConfig,
    mut progress_callback: F,
) -> Result<String, AppError>
where
    F: FnMut(ModelConversionProgress) -> Result<(), AppError>,
{
    progress_callback(ModelConversionProgress {
        status: "converting".to_string(),
        progress: 0.0,
        message: Some("モデル変換を開始しています...".to_string()),
    })?;

    // llama.cppの変換ツールを使用してGGUF形式に変換
    // 注意: この機能はllama.cppまたはtransformersライブラリが必要
    
    // 1. 変換ツールの存在確認
    let converter_tool = find_gguf_converter().await?;
    
    progress_callback(ModelConversionProgress {
        status: "converting".to_string(),
        progress: 20.0,
        message: Some("モデルを読み込んでいます...".to_string()),
    })?;
    
    // 2. 変換実行
    let output_path = convert_model_file(
        &converter_tool,
        &config.source_path,
        &config.target_name,
        &config.quantization,
    ).await?;
    
    progress_callback(ModelConversionProgress {
        status: "completed".to_string(),
        progress: 100.0,
        message: Some(format!("モデル変換が完了しました: {}", output_path)),
    })?;
    
    Ok(output_path)
}

/// GGUF変換ツールを検索
async fn find_gguf_converter() -> Result<PathBuf, AppError> {
    // システムパスからllama.cppの変換ツールを検索
    use std::process::Command;
    
    // convert.py (llama.cpp)を試す
    let output = Command::new("python")
        .arg("-c")
        .arg("import sys; print(sys.executable)")
        .output();
    
    if let Ok(output) = output {
        if output.status.success() {
            let python_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            
            // llama.cppのconvert.pyを検索
            let possible_paths = vec![
                "convert.py",
                "llama.cpp/convert.py",
                "convert-hf-to-gguf.py",
            ];
            
            for path in possible_paths {
                let full_path = PathBuf::from(&python_path).parent()
                    .unwrap()
                    .join(path);
                
                if full_path.exists() {
                    return Ok(full_path);
                }
            }
        }
    }
    
    Err(AppError::ApiError {
        message: "GGUF変換ツールが見つかりませんでした。llama.cppまたはtransformersライブラリをインストールしてください。".to_string(),
        code: "CONVERTER_NOT_FOUND".to_string(),
    })
}

/// モデルファイルを変換
async fn convert_model_file(
    converter_tool: &PathBuf,
    source_path: &str,
    target_name: &str,
    quantization: &Option<String>,
) -> Result<String, AppError> {
    use tokio::process::Command as AsyncCommand;
    
    // 出力ディレクトリを取得
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
        })?;
    
    let converted_models_dir = app_data_dir.join("converted_models");
    fs::create_dir_all(&converted_models_dir).map_err(|e| AppError::IoError {
        message: format!("ディレクトリ作成エラー: {}", e),
    })?;
    
    let output_path = converted_models_dir.join(format!("{}.gguf", target_name));
    
    // 変換コマンドを実行
    let mut cmd = AsyncCommand::new("python");
    cmd.arg(converter_tool);
    cmd.arg(source_path);
    cmd.arg("-o");
    cmd.arg(&output_path);
    
    if let Some(q) = quantization {
        cmd.arg("--quantize");
        cmd.arg(q);
    }
    
    let output = cmd.output().await
        .map_err(|e| AppError::ProcessError {
            message: format!("モデル変換エラー: {}", e),
        })?;
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::ProcessError {
            message: format!("モデル変換に失敗しました: {}", error_msg),
        });
    }
    
    Ok(output_path.to_string_lossy().to_string())
}

