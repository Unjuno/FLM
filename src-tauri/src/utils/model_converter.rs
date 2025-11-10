// Model Converter Module
// モデル変換機能（GGUF形式への自動変換）

use crate::utils::error::AppError;
use std::path::PathBuf;
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
        message: Some(format!("モデル変換が完了しました: {}", output_path.to_string_lossy())),
    })?;
    
    Ok(output_path.to_string_lossy().to_string())
}

/// GGUF変換ツールを検索
async fn find_gguf_converter() -> Result<PathBuf, AppError> {
    use crate::database::connection::get_app_data_dir;
    
    // 1. 環境変数から検索
    if let Ok(path) = std::env::var("LLAMA_CPP_CONVERTER_PATH") {
        let converter_path = PathBuf::from(&path);
        if converter_path.exists() {
            eprintln!("[INFO] GGUF変換ツールを環境変数から検出: {}", path);
            return Ok(converter_path);
        }
    }
    
    // 2. 一般的なパスから検索
    let mut possible_paths = vec![
        // Pythonスクリプト（llama.cppのconvert-llama-to-gguf.py）
        PathBuf::from("convert-llama-to-gguf.py"),
        PathBuf::from("./convert-llama-to-gguf.py"),
        PathBuf::from("../llama.cpp/convert-llama-to-gguf.py"),
        PathBuf::from("~/llama.cpp/convert-llama-to-gguf.py"),
        // 実行可能ファイル
        PathBuf::from("llama-convert"),
        PathBuf::from("./llama-convert"),
    ];
    
    // アプリデータディレクトリ内のパスを追加
    if let Ok(app_data_dir) = get_app_data_dir() {
        possible_paths.push(app_data_dir.join("tools").join("convert-llama-to-gguf.py"));
        possible_paths.push(app_data_dir.join("tools").join("llama-convert"));
    }
    
    for path in possible_paths.into_iter() {
        if path.exists() {
            eprintln!("[INFO] GGUF変換ツールを検出: {}", path.to_string_lossy());
            return Ok(path);
        }
    }
    
    // 3. Pythonが利用可能な場合、Pythonスクリプトとして実行可能か確認
    if let Ok(python_output) = tokio::process::Command::new("python")
        .arg("--version")
        .output()
        .await
    {
        if python_output.status.success() {
            // Pythonが利用可能な場合、convert-llama-to-gguf.pyが存在するか確認
            // 注意: 実際の変換にはllama.cppのリポジトリが必要です
            eprintln!("[INFO] Pythonが利用可能です。llama.cppのconvert-llama-to-gguf.pyスクリプトが必要です。");
            // Pythonが利用可能でも、スクリプトが見つからない場合はエラーを返す
        }
    }
    
    Err(AppError::ApiError {
        message: "GGUF変換ツールが見つかりません。llama.cppのconvert-llama-to-gguf.pyスクリプトまたはllama-convertコマンドが必要です。環境変数LLAMA_CPP_CONVERTER_PATHにパスを設定するか、llama.cppをインストールしてください。".to_string(),
        code: "CONVERTER_NOT_FOUND".to_string(),
        source_detail: Some("find_gguf_converter: GGUF変換ツールの検出に失敗しました。llama.cppのインストールを確認してください。".to_string()),
    })
}

/// モデルファイルを変換
async fn convert_model_file(
    converter_tool: &PathBuf,
    source_path: &str,
    target_name: &str,
    quantization: &Option<String>,
) -> Result<PathBuf, AppError> {
    use crate::database::connection::get_app_data_dir;
    use std::fs;
    
    // ソースファイルの存在確認
    let source_path_buf = PathBuf::from(source_path);
    if !source_path_buf.exists() {
        return Err(AppError::ApiError {
            message: format!("変換元のモデルファイルが見つかりません: {}", source_path),
            code: "SOURCE_FILE_NOT_FOUND".to_string(),
            source_detail: None,
        });
    }
    
    // 出力ディレクトリを決定
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
            source_detail: None,
        })?;
    let output_dir = app_data_dir.join("models").join("converted");
    fs::create_dir_all(&output_dir).map_err(|e| AppError::IoError {
        message: format!("出力ディレクトリ作成エラー: {}", e),
        source_detail: None,
    })?;
    
    // 出力ファイル名を決定
    let output_filename = format!("{}.gguf", target_name);
    let output_path = output_dir.join(&output_filename);
    
    // 変換ツールの種類を判定（Pythonスクリプトか実行可能ファイルか）
    let is_python_script = converter_tool.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext == "py")
        .unwrap_or(false);
    
    if is_python_script {
        // Pythonスクリプトとして実行
        let mut cmd = tokio::process::Command::new("python");
        cmd.arg(converter_tool);
        cmd.arg("--outfile").arg(&output_path);
        cmd.arg("--outtype").arg("f16"); // デフォルトはf16
        
        // 量子化レベルの指定
        if let Some(quant) = quantization {
            cmd.arg("--outtype").arg(quant);
        }
        
        cmd.arg(&source_path_buf);
        
        eprintln!("[INFO] GGUF変換を実行中: {:?}", cmd);
        
        let output = cmd.output().await.map_err(|e| AppError::ApiError {
            message: format!("変換コマンド実行エラー: {}", e),
            code: "CONVERSION_ERROR".to_string(),
            source_detail: None,
        })?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(AppError::ApiError {
                message: format!("モデル変換に失敗しました: {}", stderr),
                code: "CONVERSION_FAILED".to_string(),
                source_detail: Some(format!("標準出力: {}\n標準エラー: {}", stdout, stderr)),
            });
        }
        
        eprintln!("[INFO] モデル変換が完了しました: {}", output_path.to_string_lossy());
    } else {
        // 実行可能ファイルとして実行
        let mut cmd = tokio::process::Command::new(converter_tool);
        cmd.arg("--input").arg(&source_path_buf);
        cmd.arg("--output").arg(&output_path);
        
        if let Some(quant) = quantization {
            cmd.arg("--quantize").arg(quant);
        }
        
        eprintln!("[INFO] GGUF変換を実行中: {:?}", cmd);
        
        let output = cmd.output().await.map_err(|e| AppError::ApiError {
            message: format!("変換コマンド実行エラー: {}", e),
            code: "CONVERSION_ERROR".to_string(),
            source_detail: None,
        })?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(AppError::ApiError {
                message: format!("モデル変換に失敗しました: {}", stderr),
                code: "CONVERSION_FAILED".to_string(),
                source_detail: Some(format!("標準出力: {}\n標準エラー: {}", stdout, stderr)),
            });
        }
        
        eprintln!("[INFO] モデル変換が完了しました: {}", output_path.to_string_lossy());
    }
    
    // 出力ファイルの存在確認
    if !output_path.exists() {
        return Err(AppError::ApiError {
            message: format!("変換後のファイルが生成されませんでした: {}", output_path.to_string_lossy()),
            code: "OUTPUT_FILE_NOT_FOUND".to_string(),
            source_detail: None,
        });
    }
    
    Ok(output_path)
}


