// Custom Endpoint Engine Implementation
// カスタムエンドポイント（任意のOpenAI互換API）対応

use crate::utils::error::AppError;
use super::traits::LLMEngine;
use super::models::{EngineDetectionResult, EngineConfig, ModelInfo};

pub struct CustomEndpointEngine {
    base_url: String,
    name: String,
}

impl CustomEndpointEngine {
    pub fn new(base_url: String, name: Option<String>) -> Self {
        CustomEndpointEngine {
            base_url: base_url.clone(),
            name: name.unwrap_or_else(|| "カスタムエンドポイント".to_string()),
        }
    }
    
    #[allow(dead_code)] // トレイト実装で使用される可能性があるため保持
    fn get_base_url(&self) -> String {
        self.base_url.clone()
    }
    
    #[allow(dead_code)] // トレイト実装で使用される可能性があるため保持
    fn default_port(&self) -> u16 {
        // カスタムエンドポイントのポートは設定から取得
        8080
    }
    
    #[allow(dead_code)] // トレイト実装で使用される可能性があるため保持
    fn supports_openai_compatible_api(&self) -> bool {
        true
    }
}

#[allow(dead_code)] // トレイト実装メソッドは将来の使用のために保持
impl LLMEngine for CustomEndpointEngine {
    fn name(&self) -> &str {
        &self.name
    }
    
    fn engine_type(&self) -> &str {
        "custom_endpoint"
    }
    
    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        let running = self.is_running().await.unwrap_or(false);
        
        Ok(EngineDetectionResult {
            engine_type: "custom_endpoint".to_string(),
            installed: true,
            running,
            version: None,
            path: Some(self.base_url.clone()),
            message: if !running {
                Some("カスタムエンドポイントが起動していません。".to_string())
            } else {
                None
            },
            portable: None,
        })
    }
    
    async fn start(&self, _config: &EngineConfig) -> Result<u32, AppError> {
        // カスタムエンドポイントは手動で起動する必要がある
        Err(AppError::ApiError {
            message: "カスタムエンドポイントは手動で起動してください。".to_string(),
            code: "MANUAL_START_REQUIRED".to_string(),
            source_detail: None,
        })
    }
    
    async fn stop(&self) -> Result<(), AppError> {
        // カスタムエンドポイントは手動で停止する必要がある
        Ok(())
    }
    
    async fn is_running(&self) -> Result<bool, AppError> {
        let client = crate::utils::http_client::create_http_client_short_timeout()?;
        let response = client
            .get(&format!("{}/v1/models", self.base_url))
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
            .get(&format!("{}/v1/models", self.base_url))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("カスタムエンドポイントAPIリクエストエラー: {}", e),
                code: "API_ERROR".to_string(),
                source_detail: None,
            })?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("カスタムエンドポイントAPIエラー: {}", response.status()),
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
                    name,
                    size: m["size"].as_u64(),
                    modified_at: None,
                    parameter_size: None,
                })
            })
            .collect();
        
        Ok(models)
    }
    
    fn get_base_url(&self) -> String {
        self.base_url.clone()
    }
    
    fn default_port(&self) -> u16 {
        8080
    }
    
    fn supports_openai_compatible_api(&self) -> bool {
        true
    }
}


