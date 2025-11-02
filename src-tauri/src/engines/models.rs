// FLM - Engine Models
// エンジン関連の型定義

use serde::{Deserialize, Serialize};

/// エンジン検出結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineDetectionResult {
    pub engine_type: String,
    pub installed: bool,
    pub running: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub message: Option<String>,
}

/// エンジン設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    pub engine_type: String,
    pub base_url: Option<String>,
    pub executable_path: Option<String>,
    pub port: Option<u16>,
    pub auto_detect: bool,
}

/// エンジン情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineInfo {
    pub engine_type: String,
    pub name: String,
    pub version: Option<String>,
    pub base_url: String,
    pub installed: bool,
    pub running: bool,
    pub supports_openai_compatible_api: bool,
}

/// モデル情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
    pub parameter_size: Option<String>,
}

/// エンジン設定データ（データベース保存用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfigData {
    pub id: String,
    pub engine_type: String,
    pub name: String,
    pub base_url: String,
    pub auto_detect: bool,
    pub executable_path: Option<String>,
    pub is_default: bool,
}

