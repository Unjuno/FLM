



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
    
    /// LM Studio APIからバージョンを取得
    async fn get_version_from_api() -> Result<String, AppError> {
        let client = crate::utils::http_client::create_http_client_short_timeout()?;
        let response = client
            .get("http://localhost:1234/v1/models")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("LM Studio API接続エラー: {}", e),
                code: "CONNECTION_ERROR".to_string(),
                source_detail: None,
            })?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("LM Studio APIエラー: HTTP {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }
        
        // バージョン情報はレスポンスから取得できないため、デフォルト値を返す
        Ok("unknown".to_string())
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

#[allow(dead_code)] // トレイト実装メソッドは将来の使用のために保持
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
        
        // バージョン取得: LM Studio APIから取得を試みる
        let version = if running {
            Self::get_version_from_api().await.ok()
        } else {
            None
        };
        
        Ok(EngineDetectionResult {
            engine_type: "lm_studio".to_string(),
            installed,
            running,
            version,
            path,
            message: if installed && !running {
                Some("LM Studioがインストールされていますが、起動していません。".to_string())
            } else if !installed {
                Some("LM Studioがインストールされていません。".to_string())
            } else {
                None
            },
            portable: None,
        })
    }
    
    // 注意: get_version_from_apiはLLMEngineトレイトに定義されていないため削除
    // 必要に応じて、将来的にトレイトに追加するか、別の関数として実装
    
    async fn start(&self, _config: &EngineConfig) -> Result<u32, AppError> {
        // LM Studioは手動で起動する必要がある
        // 自動起動はサポートしていない（ユーザーが手動で起動することを想定）
        if let Some(path) = Self::detect_lm_studio_path().await {
            #[cfg(target_os = "windows")]
            {
                Command::new(&path)
                    .spawn()
                    .map_err(|e| AppError::ProcessError {
                        message: format!("LM Studio起動エラー:  {}", e),
                        source_detail: None,
                    })?;
                return Ok(0);
            }
            
            #[cfg(target_os = "linux")]
            {
                Command::new(&path)
                    .spawn()
                    .map_err(|e| AppError::ProcessError {
                        message: format!("LM Studio起動エラー: {}", e),
                        source_detail: None,
                    })?;
                return Ok(0);
            }
            
            #[cfg(target_os = "macos")]
            {
                Command::new("open")
                    .arg(&path)
                    .spawn()
                    .map_err(|e| AppError::ProcessError {
                        message: format!("LM Studio起動エラー: {}", e),
                        source_detail: None,
                    })?;
                return Ok(0);
            }
        }
        
        Err(AppError::ProcessError {
            message: "LM Studioのパスが見つかりませんでした".to_string(),
            source_detail: None,
        })
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
    
    async fn is_running(&self) -> Result<bool, AppError> {
        let client = crate::utils::http_client::create_http_client_short_timeout()?;
        let response = client
            .get("http://localhost:1234/v1/models")
            .send()
            .await;
        
        match response {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => Ok(false),
        }
    }
    
    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        let client = crate::utils::http_client::create_http_client()?;
        let response = client
            .get("http://localhost:1234/v1/models")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("LM Studio APIリクエストエラー: {}", e),
                code: "API_ERROR".to_string(),
                source_detail: None,
            })?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("LM Studio APIエラー: {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }
        
        let data: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: None,
        })?;
        
        let models = data["data"]
            .as_array()
            .ok_or_else(|| AppError::ModelError {
                message: "モデル一覧の形式が不正です".to_string(),
                source_detail: None,
            })?
            .iter()
            .filter_map(|m| {
                let name = m["id"].as_str()?.to_string();
                Some(ModelInfo {
                    name: name.clone(),
                    size: m["size"].as_u64(),
                    modified_at: None,
                    parameter_size: extract_parameter_size(&name),
                })
            })
            .collect();
        
        Ok(models)
    }
    
    async fn stop(&self) -> Result<(), AppError> {
        // LM Studioは手動で停止する必要がある
        // 自動停止はサポートしていない
        Ok(())
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


