// Modelfile Support Module
// Ollama Modelfileの作成・編集・管理

use crate::utils::error::AppError;
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
        modelfile.push_str(&format!("FROM {}\n", base_model));
    }
    
    // SYSTEMプロンプト
    if let Some(system_prompt) = &config.system_prompt {
        modelfile.push_str(&format!("SYSTEM \"\"\"\n{}\n\"\"\"\n", system_prompt));
    }
    
    // テンプレート
    if let Some(template) = &config.template {
        modelfile.push_str(&format!("TEMPLATE \"\"\"\n{}\n\"\"\"\n", template));
    }
    
    // パラメータ
    if let Some(parameters) = &config.parameters {
        modelfile.push_str(&format!("PARAMETER {}\n", parameters));
    }
    
    // アダプター
    if let Some(adapter_path) = &config.adapter_path {
        modelfile.push_str(&format!("ADAPTER {}\n", adapter_path));
    }
    
    // ライセンス
    if let Some(license) = &config.license {
        modelfile.push_str(&format!("LICENSE \"\"\"\n{}\n\"\"\"\n", license));
    }
    
    modelfile
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
