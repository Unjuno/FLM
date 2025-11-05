// Modelfile Support Module
// Ollama Modelfileの作成・編集・管理

use crate::utils::error::AppError;
use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};

/// Modelfile設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelfileConfig {
    pub model_name: String,
    pub base_model: Option<String>, // ベースモデル（FROM句）
    pub system_prompt: Option<String>, // SYSTEMプロンプト
    pub template: Option<String>, // テンプレート
    pub parameters: Option<String>, // パラメータ（temperature, top_p等）
    pub adapter_path: Option<String>, // アダプターパス
    pub license: Option<String>, // ライセンス情報
}

/// Modelfileを生成
pub fn generate_modelfile(config: &ModelfileConfig) -> String {
    let mut modelfile = String::new();
    
    // FROM句
    if let Some(base_model) = &config.base_model {
        modelfile.push_str(&format!("FROM {}\n\n", base_model));
    }
    
    // SYSTEMプロンプト
    if let Some(system_prompt) = &config.system_prompt {
        modelfile.push_str(&format!("SYSTEM \"\"\"{}\"\"\"\n\n", system_prompt.replace("\"", "\\\"")));
    }
    
    // テンプレート
    if let Some(template) = &config.template {
        modelfile.push_str(&format!("TEMPLATE \"\"\"{}\"\"\"\n\n", template.replace("\"", "\\\"")));
    }
    
    // パラメータ
    if let Some(parameters) = &config.parameters {
        modelfile.push_str(&format!("PARAMETER {}\n\n", parameters));
    }
    
    // アダプター
    if let Some(adapter_path) = &config.adapter_path {
        modelfile.push_str(&format!("ADAPTER {}\n\n", adapter_path));
    }
    
    // ライセンス
    if let Some(license) = &config.license {
        modelfile.push_str(&format!("LICENSE \"\"\"{}\"\"\"\n\n", license.replace("\"", "\\\"")));
    }
    
    modelfile
}

/// Modelfileを保存
pub async fn save_modelfile(
    model_name: &str,
    modelfile_content: &str,
) -> Result<PathBuf, AppError> {
    // Modelfileの保存場所
    let app_data_dir = crate::database::connection::get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
        })?;
    
    let modelfiles_dir = app_data_dir.join("modelfiles");
    fs::create_dir_all(&modelfiles_dir).map_err(|e| AppError::IoError {
        message: format!("ディレクトリ作成エラー: {}", e),
    })?;
    
    let modelfile_path = modelfiles_dir.join(format!("{}.Modelfile", model_name));
    
    fs::write(&modelfile_path, modelfile_content).map_err(|e| AppError::IoError {
        message: format!("Modelfile保存エラー: {}", e),
    })?;
    
    Ok(modelfile_path)
}

/// Modelfileを読み込む
pub async fn load_modelfile(model_name: &str) -> Result<String, AppError> {
    let app_data_dir = crate::database::connection::get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
        })?;
    
    let modelfile_path = app_data_dir.join("modelfiles").join(format!("{}.Modelfile", model_name));
    
    if !modelfile_path.exists() {
        return Err(AppError::ApiError {
            message: format!("Modelfile '{}' が見つかりません", model_name),
            code: "FILE_NOT_FOUND".to_string(),
        });
    }
    
    fs::read_to_string(&modelfile_path).map_err(|e| AppError::IoError {
        message: format!("Modelfile読み込みエラー: {}", e),
    })
}

/// Modelfileを解析して設定に変換
pub fn parse_modelfile(modelfile_content: &str) -> Result<ModelfileConfig, AppError> {
    let mut config = ModelfileConfig {
        model_name: "".to_string(),
        base_model: None,
        system_prompt: None,
        template: None,
        parameters: None,
        adapter_path: None,
        license: None,
    };
    
    let lines: Vec<&str> = modelfile_content.lines().collect();
    let mut i = 0;
    
    while i < lines.len() {
        let line = lines[i].trim();
        
        if line.is_empty() || line.starts_with('#') {
            i += 1;
            continue;
        }
        
        if line.starts_with("FROM ") {
            config.base_model = Some(line[5..].trim().to_string());
        } else if line.starts_with("SYSTEM ") {
            // 複数行の可能性があるため、次の行も読み込む
            let mut system_prompt = String::new();
            i += 1;
            while i < lines.len() {
                let next_line = lines[i];
                if next_line.trim() == "\"\"\"" {
                    break;
                }
                system_prompt.push_str(next_line);
                system_prompt.push('\n');
                i += 1;
            }
            config.system_prompt = Some(system_prompt.trim().to_string());
        } else if line.starts_with("TEMPLATE ") {
            let mut template = String::new();
            i += 1;
            while i < lines.len() {
                let next_line = lines[i];
                if next_line.trim() == "\"\"\"" {
                    break;
                }
                template.push_str(next_line);
                template.push('\n');
                i += 1;
            }
            config.template = Some(template.trim().to_string());
        } else if line.starts_with("PARAMETER ") {
            config.parameters = Some(line[10..].trim().to_string());
        } else if line.starts_with("ADAPTER ") {
            config.adapter_path = Some(line[8..].trim().to_string());
        } else if line.starts_with("LICENSE ") {
            let mut license = String::new();
            i += 1;
            while i < lines.len() {
                let next_line = lines[i];
                if next_line.trim() == "\"\"\"" {
                    break;
                }
                license.push_str(next_line);
                license.push('\n');
                i += 1;
            }
            config.license = Some(license.trim().to_string());
        }
        
        i += 1;
    }
    
    Ok(config)
}

