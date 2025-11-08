// llama.cpp Engine Implementation
// llama.cppエンジンのLLMEngineトレイト実装

use crate::utils::error::AppError;
use super::traits::LLMEngine;
use super::models::{EngineDetectionResult, EngineConfig, ModelInfo};
use std::process::Command;

pub struct LlamaCppEngine;

#[allow(dead_code)] // LLMEngineトレイト実装で使用されるメソッドを含む
impl LlamaCppEngine {
    pub fn new() -> Self {
        LlamaCppEngine
    }
    
    /// 実行ファイルからllama.cppのバージョンを取得
    #[allow(dead_code)] // 将来のバージョン検証機能で使用予定
    async fn get_version_from_executable(exe_path: &str) -> Result<String, AppError> {
        let output = Command::new(exe_path)
            .arg("--version")
            .output()
            .map_err(|e| AppError::ProcessError {
                message: format!("llama.cppバージョン取得エラー: {}", e),
                source_detail: None,
            })?;
        
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            Ok(version.trim().to_string())
        } else {
            // バージョン情報が取得できない場合はデフォルト値を返す
            Ok("unknown".to_string())
        }
    }
    
    #[allow(dead_code)] // LLMEngineトレイト実装で使用
    fn get_base_url(&self) -> String {
        "http://localhost:8080".to_string()
    }
    
    #[allow(dead_code)] // LLMEngineトレイト実装で使用
    fn default_port(&self) -> u16 {
        8080
    }
    
    #[allow(dead_code)] // LLMEngineトレイト実装で使用
    fn supports_openai_compatible_api(&self) -> bool {
        // llama.cppサーバーはOpenAI互換APIをサポートしている場合とそうでない場合がある
        // ここではtrueと仮定（実際の実装では動的にチェックすることも可能）
        true
    }
    
    #[allow(dead_code)] // LLMEngineトレイト実装で使用
    async fn is_running(&self) -> Result<bool, AppError> {
        // llama.cppサーバーのヘルスチェックエンドポイントを確認
        let client = crate::utils::http_client::create_http_client_short_timeout()?;
        let response = client
            .get(&format!("{}/v1/models", self.get_base_url()))
            .send()
            .await;
        
        match response {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => Ok(false),
        }
    }
    
    #[allow(dead_code)] // LLMEngineトレイト実装で使用
    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        let client = crate::utils::http_client::create_http_client()?;
        let response = client
            .get(&format!("{}/v1/models", self.get_base_url()))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("llama.cpp API接続エラー: {}", e),
                code: "CONNECTION_ERROR".to_string(),
                source_detail: None,
            })?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("llama.cpp APIエラー: HTTP {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }
        
        let json: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
            message: format!("llama.cpp API JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: None,
        })?;
        
        let models = json["data"]
            .as_array()
            .ok_or_else(|| AppError::ModelError {
                message: "モデル一覧の形式が不正です".to_string(),
                source_detail: None,
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
    
    #[allow(dead_code)] // LLMEngineトレイト実装で使用
    async fn start(&self, _config: &EngineConfig) -> Result<u32, AppError> {
        // llama.cppは手動で起動する必要がある
        Err(AppError::ApiError {
            message: "llama.cppサーバーは手動で起動してください。".to_string(),
            code: "MANUAL_START_REQUIRED".to_string(),
            source_detail: None,
        })
    }
    
    #[allow(dead_code)] // LLMEngineトレイト実装で使用
    async fn stop(&self) -> Result<(), AppError> {
        // llama.cppサーバーの停止APIは標準化されていない
        Err(AppError::ApiError {
            message: "llama.cppサーバーは手動で停止してください。".to_string(),
            code: "MANUAL_STOP_REQUIRED".to_string(),
            source_detail: None,
        })
    }
    
    #[allow(dead_code)] // LLMEngineトレイト実装で使用
    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        // llama.cppの検出は複雑なため、簡易実装
        let running = self.is_running().await.unwrap_or(false);
        
        Ok(EngineDetectionResult {
            engine_type: "llama_cpp".to_string(),
            installed: false, // 動的検出は困難
            running,
            version: None,
            path: None,
            message: if !running {
                Some("llama.cppサーバーが起動していません。手動で起動してください。".to_string())
            } else {
                None
            },
            portable: None,
        })
    }
}

#[allow(dead_code)] // トレイト実装メソッドは将来の使用のために保持
impl LLMEngine for LlamaCppEngine {
    fn name(&self) -> &str {
        "llama.cpp"
    }
    
    fn engine_type(&self) -> &str {
        "llama_cpp"
    }
    
    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        // llama.cppの検出は複雑なため、簡易実装
        let running = self.is_running().await.unwrap_or(false);
        
        Ok(EngineDetectionResult {
            engine_type: "llama_cpp".to_string(),
            installed: running,
            running,
            version: None,
            path: None,
            message: if !running {
                Some("llama.cppが起動していません。".to_string())
            } else {
                None
            },
            portable: None,
        })
    }
    
    async fn start(&self, _config: &EngineConfig) -> Result<u32, AppError> {
        // llama.cppは手動で起動する必要がある
        Err(AppError::ApiError {
            message: "llama.cppは手動で起動してください。".to_string(),
            code: "MANUAL_START_REQUIRED".to_string(),
            source_detail: None,
        })
    }
    
    async fn stop(&self) -> Result<(), AppError> {
        // llama.cppは手動で停止する必要がある
        Ok(())
    }
    
    async fn is_running(&self) -> Result<bool, AppError> {
        let client = crate::utils::http_client::create_http_client_short_timeout()?;
        let response = client
            .get("http://localhost:8080/v1/models")
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
            .get("http://localhost:8080/v1/models")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("llama.cpp APIリクエストエラー: {}", e),
                code: "API_ERROR".to_string(),
                source_detail: None,
            })?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("llama.cpp APIエラー: {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }
        
        let json: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: None,
        })?;
        
        let models = json["data"]
            .as_array()
            .ok_or_else(|| AppError::ModelError {
                message: "モデル一覧の形式が不正です".to_string(),
                source_detail: None,
            })?
            .iter()
            .filter_map(|m| {
                let name = m["id"].as_str()
                    .or_else(|| m["name"].as_str())?
                    .to_string();
                let parameter_size = extract_parameter_size(&name);
                
                Some(ModelInfo {
                    name,
                    size: None,
                    modified_at: None,
                    parameter_size,
                })
            })
            .collect();
        
        Ok(models)
    }
    
    fn get_base_url(&self) -> String {
        "http://localhost:8080".to_string()
    }
    
    fn default_port(&self) -> u16 {
        8080
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


