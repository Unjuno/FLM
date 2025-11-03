// Ollama Engine Implementation
// OllamaエンジンのLLMEngineトレイト実装

use crate::utils::error::AppError;
use super::traits::LLMEngine;
use super::models::{EngineDetectionResult, EngineConfig, ModelInfo};
use crate::ollama as ollama_module;
use regex::Regex;

pub struct OllamaEngine;

impl OllamaEngine {
    pub fn new() -> Self {
        OllamaEngine
    }
}

impl LLMEngine for OllamaEngine {
    fn name(&self) -> &str {
        "Ollama"
    }
    
    fn engine_type(&self) -> &str {
        "ollama"
    }
    
    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        let ollama_result = ollama_module::detect_ollama().await?;
        
        Ok(EngineDetectionResult {
            engine_type: "ollama".to_string(),
            installed: ollama_result.installed || ollama_result.portable,
            running: ollama_result.running,
            version: ollama_result.version,
            path: ollama_result.portable_path.or(ollama_result.system_path),
            message: None,
        })
    }
    
    async fn start(&self, config: &EngineConfig) -> Result<u32, AppError> {
        let ollama_path = config.executable_path.clone();
        ollama_module::start_ollama(ollama_path).await
    }
    
    async fn stop(&self) -> Result<(), AppError> {
        ollama_module::stop_ollama().await
    }
    
    async fn is_running(&self) -> Result<bool, AppError> {
        ollama_module::check_ollama_running().await
    }
    
    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        // Ollama APIからモデル一覧を取得
        let client = reqwest::Client::new();
        let response = client
            .get(format!("{}/api/tags", self.get_base_url()))
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Ollama API接続エラー: {}", e),
                code: "CONNECTION_ERROR".to_string(),
            })?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("Ollama APIエラー: HTTP {}", response.status()),
                code: response.status().as_str().to_string(),
            });
        }
        
        let tags: serde_json::Value = response.json().await
            .map_err(|e| AppError::ApiError {
                message: format!("JSON解析エラー: {}", e),
                code: "JSON_ERROR".to_string(),
            })?;
        
        let models = tags["models"]
            .as_array()
            .ok_or_else(|| AppError::ModelError {
                message: "モデル一覧の形式が不正です".to_string(),
            })?
            .iter()
            .map(|m| {
                let name = m["name"].as_str().unwrap_or("").to_string();
                let parameter_size = extract_parameter_size(&name);
                
                ModelInfo {
                    name,
                    size: m["size"].as_u64(),
                    modified_at: m["modified_at"].as_str().map(|s| s.to_string()),
                    parameter_size,
                }
            })
            .collect();
        
        Ok(models)
    }
    
    fn get_base_url(&self) -> String {
        "http://localhost:11434".to_string()
    }
    
    fn default_port(&self) -> u16 {
        11434
    }
    
    fn supports_openai_compatible_api(&self) -> bool {
        true
    }
}

/// モデル名からパラメータサイズを抽出
fn extract_parameter_size(model_name: &str) -> Option<String> {
    // モデル名からパラメータ数を推定（例: "llama3:8b" -> "8B", "mistral:7b" -> "7B"）
    let re = Regex::new(r"(\d+)[bB]").ok()?;
    if let Some(captures) = re.captures(model_name) {
        if let Some(size) = captures.get(1) {
            return Some(format!("{}B", size.as_str()));
        }
    }
    None
}

