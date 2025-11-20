//! Chat-related domain models
//!
//! See `docs/CORE_API.md` section 2 for the complete specification.

use super::models::{EngineId, ModelId};
use serde::{Deserialize, Serialize};

/// Chat message role
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    System,
    User,
    Assistant,
    Tool,
}

/// Chat message
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
}

/// Chat request
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    pub engine_id: EngineId,
    pub model_id: ModelId,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stop: Vec<String>,
}

/// Usage statistics
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UsageStats {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Chat response
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub usage: UsageStats,
    pub messages: Vec<ChatMessage>,
}

/// Chat stream chunk
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatStreamChunk {
    pub delta: ChatMessage,
    pub usage: Option<UsageStats>,
    pub is_done: bool,
}

/// Embedding request
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub engine_id: EngineId,
    pub model_id: ModelId,
    /// OpenAI-compatible text array (supports single item as array)
    pub input: Vec<String>,
}

/// Embedding vector
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingVector {
    pub index: usize,
    pub values: Vec<f32>,
}

/// Embedding response
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub usage: UsageStats,
    pub vectors: Vec<EmbeddingVector>,
}
