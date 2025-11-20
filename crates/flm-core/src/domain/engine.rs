//! Engine domain model

use serde::{Deserialize, Serialize};
use std::fmt;

/// エンジンの種別
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EngineType {
    Ollama,
    VLlm,
    LmStudio,
    LlamaCpp,
}

impl fmt::Display for EngineType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EngineType::Ollama => write!(f, "ollama"),
            EngineType::VLlm => write!(f, "vllm"),
            EngineType::LmStudio => write!(f, "lmstudio"),
            EngineType::LlamaCpp => write!(f, "llamacpp"),
        }
    }
}

/// エンジンID（例: "ollama-1", "vllm-2"）
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct EngineId(String);

impl EngineId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for EngineId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// エンジンの状態
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EngineStatus {
    /// インストール済みだが起動していない
    InstalledOnly,
    /// 起動中かつ正常
    RunningHealthy,
    /// 起動中だが一部機能に問題
    RunningDegraded,
    /// ネットワークエラー
    ErrorNetwork,
    /// APIエラー
    ErrorApi,
    /// 未検出
    NotFound,
}

/// エンジンのドメインモデル
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Engine {
    /// エンジンID
    pub id: EngineId,
    /// エンジン種別
    pub engine_type: EngineType,
    /// エンジンの状態
    pub status: EngineStatus,
    /// ベースURL（例: "http://localhost:11434"）
    pub base_url: String,
    /// バージョン情報（オプション）
    pub version: Option<String>,
    /// 追加メタデータ
    pub metadata: Option<serde_json::Value>,
}

impl Engine {
    /// 新しいエンジンを作成
    ///
    /// why: エンジン検出時に使用。初期状態は NotFound で作成し、検出ロジックで状態を更新する。
    pub fn new(id: EngineId, engine_type: EngineType, base_url: String) -> Self {
        Self {
            id,
            engine_type,
            status: EngineStatus::NotFound,
            base_url,
            version: None,
            metadata: None,
        }
    }

    /// エンジンが正常に稼働しているか
    pub fn is_healthy(&self) -> bool {
        matches!(self.status, EngineStatus::RunningHealthy)
    }

    /// エンジンが利用可能か（Healthy or Degraded）
    pub fn is_available(&self) -> bool {
        matches!(
            self.status,
            EngineStatus::RunningHealthy | EngineStatus::RunningDegraded
        )
    }
}
