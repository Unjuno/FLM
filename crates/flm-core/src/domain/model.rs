//! Model domain model

use serde::{Deserialize, Serialize};
use std::fmt;

use super::EngineId;

/// モデルID（例: "flm://ollama-1/llama3.2"）
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ModelId(String);

impl ModelId {
    /// 新しいモデルIDを作成
    ///
    /// why: エンジンIDとモデル名から一意のIDを生成。
    /// alt: UUIDを使う案もあったが、可読性と検索性を優先してflm://スキーム形式を採用。
    pub fn new(engine_id: &EngineId, model_name: &str) -> Self {
        Self(format!("flm://{}/{}", engine_id.as_str(), model_name))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for ModelId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// モデルのドメインモデル
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Model {
    /// モデルID
    pub id: ModelId,
    /// 元のモデル名（エンジン固有）
    pub name: String,
    /// エンジンID
    pub engine_id: EngineId,
    /// モデルサイズ（バイト）
    pub size: Option<u64>,
    /// パラメータ数（例: "7B", "13B"）
    pub parameters: Option<String>,
    /// 追加メタデータ
    pub metadata: Option<serde_json::Value>,
}
