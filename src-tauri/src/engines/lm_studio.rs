// LM Studio Engine Implementation
// LM StudioエンジンのLLMEngineトレイト実装

use crate::utils::error::AppError;
use super::traits::LLMEngine;
use super::models::{EngineDetectionResult, EngineConfig, ModelInfo};
use std::path::PathBuf;
use std::process::Command;

pub struct LMStudioEngine;

impl LMStudioEngine {
    pub fn new() -> Self {
        LMStudioEngine
    }
    
    /// LM Studioのパスを検出
    async fn detect_lm_studio_path() -> Option<String> {
        #[cfg(target_os = "windows")]
        {
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                let path = PathBuf::from(local_app_data)
                    .join("Programs")
                    .join("LM Studio")
                    .join("LM Studio.exe");
                if path.exists() {
                    return Some(path.to_string_lossy().to_string());
                }
            }
        }
        
        #[cfg(target_os = "macos")]
        {
            let path = PathBuf::from("/Applications/LM Studio.app");
            if path.exists() {
                return Some(path.to_string_lossy().to_string());
            }
        }
        
        #[cfg(target_os = "linux")]
        {
            if let Ok(home) = std::env::var("HOME") {
                let path = PathBuf::from(home)
                    .join(".lmstudio")
                    .join("lm-studio");
                if path.exists() {
                    return Some(path.to_string_lossy().to_string());
                }
            }
        }
        
        None
    }
}

impl LLMEngine for LMStudioEngine {
    fn name(&self) -> &str {
        "LM Studio"
    }
    
    fn engine_type(&self) -> &str {
        "lm_studio"
    }
    
    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        let path = Self::detect_lm_studio_path().await;
        let installed = path.is_some();
        let running = self.is_running().await.unwrap_or(false);
        
        Ok(EngineDetectionResult {
            engine_type: "lm_studio".to_string(),
            installed,
            running,
            version: None, // LM Studioのバージョン取得は複雑なため、省略
            path,
            message: if installed && !running {
                Some("LM Studioがインストールされていますが、起動していません。".to_string())
            } else if !installed {
                Some("LM Studioがインストールされていません。".to_string())
            } else {
                None
            },
        })
    }
    
    async fn start(&self, _config: &EngineConfig) -> Result<u32, AppError> {
        // LM Studioは手動で起動する必要がある
        // 自動起動はサポートしていない（ユーザーが手動で起動することを想定）
        if let Some(path) = Self::detect_lm_studio_path().await {
            #[cfg(target_os = "windows")]
            {
                Command::new(&path)
                    .spawn()
                    .map_err(|e| AppError::ProcessError {
                        message: format!("LM Studio起動エラー: {}", e),
                    })?;
                // プロセスIDの取得は困難なため、0を返す
                return Ok(0);
            }
            
            #[cfg(target_os = "macos")]
            {
                Command::new("open")
                    .arg(&path)
                    .spawn()
                    .map_err(|e| AppError::ProcessError {
                        message: format!("LM Studio起動エラー: {}", e),
                    })?;
                return Ok(0);
            }
            
            #[cfg(target_os = "linux")]
            {
                Command::new(&path)
                    .spawn()
                    .map_err(|e| AppError::ProcessError {
                        message: format!("LM Studio起動エラー: {}", e),
                    })?;
                return Ok(0);
            }
        }
        
        Err(AppError::ApiError {
            message: "LM Studioが見つかりません。先にインストールしてください。".to_string(),
            code: "NOT_INSTALLED".to_string(),
        })
    }
    
    async fn stop(&self) -> Result<(), AppError> {
        // LM Studioは手動で停止する必要がある
        // HTTP APIでの停止はサポートしていない
        Err(AppError::ApiError {
            message: "LM Studioは手動で停止してください。".to_string(),
            code: "MANUAL_STOP_REQUIRED".to_string(),
        })
    }
    
    async fn is_running(&self) -> Result<bool, AppError> {
        // LM StudioのAPIサーバーが起動しているかチェック
        let client = reqwest::Client::new();
        let response = client
            .get(format!("{}/v1/models", self.get_base_url()))
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await;
        
        match response {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => Ok(false),
        }
    }
    
    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        // LM Studio APIからモデル一覧を取得
        let client = reqwest::Client::new();
        let response = client
            .get(format!("{}/v1/models", self.get_base_url()))
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("LM Studio API接続エラー: {}", e),
                code: "CONNECTION_ERROR".to_string(),
            })?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("LM Studio APIエラー: HTTP {}", response.status()),
                code: response.status().as_str().to_string(),
            });
        }
        
        let json: serde_json::Value = response.json().await
            .map_err(|e| AppError::ApiError {
                message: format!("JSON解析エラー: {}", e),
                code: "JSON_ERROR".to_string(),
            })?;
        
        let models = json["data"]
            .as_array()
            .ok_or_else(|| AppError::ModelError {
                message: "モデル一覧の形式が不正です".to_string(),
            })?
            .iter()
            .map(|m| {
                let name = m["id"].as_str()
                    .or_else(|| m["name"].as_str())
                    .unwrap_or("")
                    .to_string();
                let parameter_size = extract_parameter_size(&name);
                
                ModelInfo {
                    name,
                    size: None,
                    modified_at: None,
                    parameter_size,
                }
            })
            .collect();
        
        Ok(models)
    }
    
    fn get_base_url(&self) -> String {
        "http://localhost:1234".to_string()
    }
    
    fn default_port(&self) -> u16 {
        1234
    }
    
    fn supports_openai_compatible_api(&self) -> bool {
        true
    }
}

/// モデル名からパラメータサイズを抽出
fn extract_parameter_size(model_name: &str) -> Option<String> {
    let re = regex::Regex::new(r"(\d+)[bB]").ok()?;
    if let Some(captures) = re.captures(model_name) {
        if let Some(size) = captures.get(1) {
            return Some(format!("{}B", size.as_str()));
        }
    }
    None
}

