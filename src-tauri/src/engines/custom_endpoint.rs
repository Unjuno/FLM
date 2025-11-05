// Custom Endpoint Engine Implementation
// カスタムエンドポイント（任意のOpenAI互換API）対応

use crate::utils::error::AppError;
use super::traits::LLMEngine;
use super::models::{EngineDetectionResult, EngineConfig, ModelInfo};
use serde::{Deserialize, Serialize};

pub struct CustomEndpointEngine {
    base_url: String,
    name: String,
}

impl CustomEndpointEngine {
    pub fn new(base_url: String, name: Option<String>) -> Self {
        CustomEndpointEngine {
            base_url: base_url.clone(),
            name: name.unwrap_or_else(|| format!("カスタムエンドポイント ({})", base_url)),
        }
    }
    
    /// カスタムエンドポイントが利用可能かチェック
    async fn check_endpoint_available(base_url: &str) -> bool {
        let client = reqwest::Client::new();
        let response = client
            .get(format!("{}/v1/models", base_url))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;
        
        match response {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }
}

impl LLMEngine for CustomEndpointEngine {
    fn name(&self) -> &str {
        &self.name
    }
    
    fn engine_type(&self) -> &str {
        "custom_endpoint"
    }
    
    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        let available = Self::check_endpoint_available(&self.base_url).await;
        
        Ok(EngineDetectionResult {
            engine_type: "custom_endpoint".to_string(),
            installed: available,
            running: available,
            version: None,
            path: Some(self.base_url.clone()),
            message: if available {
                None
            } else {
                Some("カスタムエンドポイントに接続できませんでした。URLを確認してください。".to_string())
            },
        })
    }
    
    // 注意: get_version_from_apiはLLMEngineトレイトに定義されていないため削除
    // 必要に応じて、将来的にトレイトに追加するか、別の関数として実装
    
    async fn start(&self, config: &EngineConfig) -> Result<u32, AppError> {
        // カスタムエンドポイントは既に実行されている必要がある
        if !Self::check_endpoint_available(&self.base_url).await {
            return Err(AppError::ApiError {
                message: "カスタムエンドポイントに接続できませんでした。先にエンドポイントを起動してください。".to_string(),
                code: "ENDPOINT_NOT_AVAILABLE".to_string(),
            });
        }
        
        // プロセスIDは取得できないため、0を返す
        Ok(0)
    }
    
    async fn stop(&self) -> Result<(), AppError> {
        // カスタムエンドポイントは外部で管理されているため、停止できない
        Err(AppError::ApiError {
            message: "カスタムエンドポイントは外部で管理されているため、停止できません。".to_string(),
            code: "MANUAL_STOP_REQUIRED".to_string(),
        })
    }
    
    async fn is_running(&self) -> Result<bool, AppError> {
        Ok(Self::check_endpoint_available(&self.base_url).await)
    }
    
    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        // カスタムエンドポイントからモデル一覧を取得
        let client = reqwest::Client::new();
        let response = client
            .get(format!("{}/v1/models", self.get_base_url()))
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("カスタムエンドポイントAPI接続エラー: {}", e),
                code: "CONNECTION_ERROR".to_string(),
            })?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("カスタムエンドポイントAPIエラー: HTTP {}", response.status()),
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
                
                ModelInfo {
                    name,
                    size: None,
                    modified_at: None,
                    parameter_size: None,
                }
            })
            .collect();
        
        Ok(models)
    }
    
    fn get_base_url(&self) -> String {
        self.base_url.clone()
    }
    
    fn default_port(&self) -> u16 {
        // カスタムエンドポイントのポートは設定から取得
        8080
    }
    
    fn supports_openai_compatible_api(&self) -> bool {
        true
    }
}

