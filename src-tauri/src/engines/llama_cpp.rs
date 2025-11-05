// llama.cpp Engine Implementation
// llama.cppエンジンのLLMEngineトレイト実装

use crate::utils::error::AppError;
use super::traits::LLMEngine;
use super::models::{EngineDetectionResult, EngineConfig, ModelInfo};
use std::process::Command;

pub struct LlamaCppEngine;

impl LlamaCppEngine {
    pub fn new() -> Self {
        LlamaCppEngine
    }
    
    /// llama.cppサーバーを検出
    async fn detect_llama_cpp_server() -> Option<String> {
        #[cfg(target_os = "windows")]
        {
            // Windows: システムパスから検索
            let output = Command::new("where")
                .arg("llama-server")
                .output()
                .ok()?;
            
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .lines()
                    .next()?
                    .to_string();
                return Some(path);
            }
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            // Unix系: which コマンドで検索
            let output = Command::new("which")
                .arg("llama-server")
                .output()
                .ok()?;
            
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
            
            // 別名で検索
            let output = Command::new("which")
                .arg("llama-cpp-server")
                .output()
                .ok()?;
            
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }
        
        None
    }
}

impl LLMEngine for LlamaCppEngine {
    fn name(&self) -> &str {
        "llama.cpp"
    }
    
    fn engine_type(&self) -> &str {
        "llama_cpp"
    }
    
    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        let path = Self::detect_llama_cpp_server().await;
        let installed = path.is_some();
        let running = self.is_running().await.unwrap_or(false);
        
        // バージョン取得は未実装（将来実装予定）
        let version = None;
        
        Ok(EngineDetectionResult {
            engine_type: "llama_cpp".to_string(),
            installed,
            running,
            version,
            path,
            message: if !installed {
                Some("llama.cppサーバーが見つかりません。先にインストールしてください。".to_string())
            } else if !running {
                Some("llama.cppサーバーが起動していません。".to_string())
            } else {
                None
            },
        })
    }
    
    // 注意: get_version_from_apiはLLMEngineトレイトに定義されていないため削除
    // 必要に応じて、将来的にトレイトに追加するか、別の関数として実装
    
    async fn start(&self, config: &EngineConfig) -> Result<u32, AppError> {
        // detect_llama_cpp_serverを実行してパスを取得
        let executable_path = if let Some(path) = config.executable_path.clone() {
            path
        } else {
            Self::detect_llama_cpp_server().await
                .ok_or_else(|| AppError::ApiError {
                    message: "llama.cppサーバーが見つかりません。先にインストールしてください。".to_string(),
                    code: "NOT_INSTALLED".to_string(),
                })?
        };
        
        // llama.cppサーバーの起動は複雑なため、基本的には手動起動を想定
        Err(AppError::ApiError {
            message: format!("llama.cppサーバーは手動で起動してください。例: {} --host 0.0.0.0 --port {}", executable_path, config.port.unwrap_or(self.default_port())),
            code: "MANUAL_START_REQUIRED".to_string(),
        })
    }
    
    async fn stop(&self) -> Result<(), AppError> {
        // llama.cppサーバーの停止APIは標準化されていない
        Err(AppError::ApiError {
            message: "llama.cppサーバーは手動で停止してください。".to_string(),
            code: "MANUAL_STOP_REQUIRED".to_string(),
        })
    }
    
    async fn is_running(&self) -> Result<bool, AppError> {
        // llama.cppサーバーのヘルスチェックエンドポイントを確認
        let client = reqwest::Client::new();
        let response = client
            .get(format!("{}/health", self.get_base_url()))
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await;
        
        match response {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => {
                // ヘルスチェックが失敗した場合、/v1/modelsを試す
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
        }
    }
    
    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        // llama.cppサーバーがOpenAI互換APIをサポートしているかチェック
        let client = reqwest::Client::new();
        let response = client
            .get(format!("{}/v1/models", self.get_base_url()))
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("llama.cpp API接続エラー: {}", e),
                code: "CONNECTION_ERROR".to_string(),
            })?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("llama.cpp APIエラー: HTTP {}", response.status()),
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
        "http://localhost:8080".to_string()
    }
    
    fn default_port(&self) -> u16 {
        8080
    }
    
    fn supports_openai_compatible_api(&self) -> bool {
        // llama.cppサーバーはOpenAI互換APIをサポートしている場合とそうでない場合がある
        // ここではtrueと仮定（実際の実装では動的にチェックすることも可能）
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

