// Engine Manager
// エンジンの統一管理を行うマネージャー

use std::collections::HashMap;
use crate::utils::error::AppError;
use super::traits::LLMEngine;
use super::models::{EngineDetectionResult, EngineConfig, ModelInfo};
use super::ollama::OllamaEngine;
use super::lm_studio::LMStudioEngine;
use super::vllm::VLLMEngine;
use super::llama_cpp::LlamaCppEngine;

pub struct EngineManager {
    engines: HashMap<String, String>, // エンジンタイプ名のみを保存（dyn互換性の問題を回避）
}

impl EngineManager {
    pub fn new() -> Self {
        let mut engines = HashMap::new();
        
        // 各エンジンタイプを登録
        engines.insert("ollama".to_string(), "ollama".to_string());
        engines.insert("lm_studio".to_string(), "lm_studio".to_string());
        engines.insert("vllm".to_string(), "vllm".to_string());
        engines.insert("llama_cpp".to_string(), "llama_cpp".to_string());
        
        EngineManager { engines }
    }
    
    /// 利用可能なエンジンタイプのリストを取得
    pub fn get_available_engine_types(&self) -> Vec<String> {
        self.engines.keys().cloned().collect()
    }
    
    /// すべてのエンジンを検出
    pub async fn detect_all_engines(&self) -> Vec<EngineDetectionResult> {
        let mut results = Vec::new();
        
        let engine_types = vec!["ollama", "lm_studio", "vllm", "llama_cpp"];
        
        for engine_type in engine_types {
            match self.detect_engine(engine_type).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    eprintln!("エンジン検出エラー ({}): {}", engine_type, e);
                    results.push(EngineDetectionResult {
                        engine_type: engine_type.to_string(),
                        installed: false,
                        running: false,
                        version: None,
                        path: None,
                        message: Some(format!("検出エラー: {}", e)),
                        portable: None,
                    });
                }
            }
        }
        
        results
    }
    
    /// エンジンを検出
    pub async fn detect_engine(&self, engine_type: &str) -> Result<EngineDetectionResult, AppError> {
        match engine_type {
            "ollama" => {
                let engine = OllamaEngine::new();
                engine.detect().await
            }
            "lm_studio" => {
                let engine = LMStudioEngine::new();
                engine.detect().await
            }
            "vllm" => {
                let engine = VLLMEngine::new();
                engine.detect().await
            }
            "llama_cpp" => {
                let engine = LlamaCppEngine::new();
                engine.detect().await
            }
            _ => Err(AppError::ApiError {
                message: format!("不明なエンジンタイプ: {}", engine_type),
                code: "UNKNOWN_ENGINE".to_string(),
                source_detail: None,
            })
        }
    }
    
    /// エンジンを起動
    pub async fn start_engine(&self, engine_type: &str, config: Option<EngineConfig>) -> Result<u32, AppError> {
        let default_port = match engine_type {
            "ollama" => 11434,
            "lm_studio" => 1234,
            "vllm" => 8000,
            "llama_cpp" => 8080,
            _ => {
                eprintln!("[ERROR] 不明なエンジンタイプ: {}", engine_type);
                return Err(AppError::ApiError {
                    message: format!("不明なエンジンタイプ: {}", engine_type),
                    code: "UNKNOWN_ENGINE".to_string(),
                    source_detail: None,
                });
            }
        };
        
        let config = config.unwrap_or_else(|| {
            eprintln!("[DEBUG] デフォルト設定を使用");
            EngineConfig {
                engine_type: engine_type.to_string(),
                base_url: None,
                executable_path: None,
                port: Some(default_port),
                auto_detect: true,
            }
        });
        
        eprintln!("[DEBUG] エンジン設定: エンジンタイプ={}, ベースURL={:?}, ポート={:?}, 自動検出={}", 
            config.engine_type, config.base_url, config.port, config.auto_detect);
        
        let result = match engine_type {
            "ollama" => {
                eprintln!("[DEBUG] Ollamaエンジンを起動します");
                let engine = OllamaEngine::new();
                engine.start(&config).await
            }
            "lm_studio" => {
                eprintln!("[DEBUG] LM Studioエンジンを起動します");
                let engine = LMStudioEngine::new();
                engine.start(&config).await
            }
            "vllm" => {
                eprintln!("[DEBUG] vLLMエンジンを起動します");
                let engine = VLLMEngine::new();
                engine.start(&config).await
            }
            "llama_cpp" => {
                eprintln!("[DEBUG] llama.cppエンジンを起動します");
                let engine = LlamaCppEngine::new();
                engine.start(&config).await
            }
            _ => {
                eprintln!("[ERROR] 不明なエンジンタイプ（match内）: {}", engine_type);
                Err(AppError::ApiError {
                    message: format!("不明なエンジンタイプ: {}", engine_type),
                    code: "UNKNOWN_ENGINE".to_string(),
                    source_detail: None,
                })
            }
        };
        
        if let Err(e) = &result {
            eprintln!("[ERROR] エンジンの起動に失敗: エンジンタイプ={}, エラー={:?}", engine_type, e);
        }
        
        result
    }
    
    /// エンジンを停止
    pub async fn stop_engine(&self, engine_type: &str) -> Result<(), AppError> {
        match engine_type {
            "ollama" => {
                let engine = OllamaEngine::new();
                engine.stop().await
            }
            "lm_studio" => {
                let engine = LMStudioEngine::new();
                engine.stop().await
            }
            "vllm" => {
                let engine = VLLMEngine::new();
                engine.stop().await
            }
            "llama_cpp" => {
                let engine = LlamaCppEngine::new();
                engine.stop().await
            }
            _ => Err(AppError::ApiError {
                message: format!("不明なエンジンタイプ:  {}", engine_type),
                code: "UNKNOWN_ENGINE".to_string(),
                source_detail: None,
            })
        }
    }
    
    /// エンジンのベースURLを取得
    pub fn get_engine_base_url(&self, engine_type: &str) -> String {
        match engine_type {
            "ollama" => OllamaEngine::new().get_base_url(),
            "lm_studio" => LMStudioEngine::new().get_base_url(),
            "vllm" => VLLMEngine::new().get_base_url(),
            "llama_cpp" => LlamaCppEngine::new().get_base_url(),
            _ => OllamaEngine::new().get_base_url(), // デフォルト
        }
    }
    
    /// エンジンの実行状態を確認
    pub async fn is_engine_running(&self, engine_type: &str) -> Result<bool, AppError> {
        match engine_type {
            "ollama" => {
                let engine = OllamaEngine::new();
                engine.is_running().await
            }
            "lm_studio" => {
                let engine = LMStudioEngine::new();
                engine.is_running().await
            }
            "vllm" => {
                let engine = VLLMEngine::new();
                engine.is_running().await
            }
            "llama_cpp" => {
                let engine = LlamaCppEngine::new();
                engine.is_running().await
            }
            _ => Err(AppError::ApiError {
                message: format!("不明なエンジンタイプ: {}", engine_type),
                code: "UNKNOWN_ENGINE".to_string(),
                source_detail: None,
            })
        }
    }
    
    /// エンジンのモデル一覧を取得
    pub async fn get_engine_models(&self, engine_type: &str) -> Result<Vec<ModelInfo>, AppError> {
        match engine_type {
            "ollama" => {
                let engine = OllamaEngine::new();
                engine.get_models().await
            }
            "lm_studio" => {
                let engine = LMStudioEngine::new();
                engine.get_models().await
            }
            "vllm" => {
                let engine = VLLMEngine::new();
                engine.get_models().await
            }
            "llama_cpp" => {
                let engine = LlamaCppEngine::new();
                engine.get_models().await
            }
            _ => Err(AppError::ApiError {
                message: format!("不明なエンジンタイプ: {}", engine_type),
                code: "UNKNOWN_ENGINE".to_string(),
                source_detail: None,
            })
        }
    }
    
    // 注意: `get_engine`メソッドは削除されました。
    // asyncトレイトは`dyn`互換性がないため、直接エンジンインスタンスを作成する方法を使用してください。
    // 例: `OllamaEngine::new()` など
}

impl Default for EngineManager {
    fn default() -> Self {
        Self::new()
    }
}


