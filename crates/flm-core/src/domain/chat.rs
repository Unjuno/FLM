//! Chat-related domain models
//!
//! See `docs/CORE_API.md` section 2 for the complete specification.

use super::models::{EngineId, ModelId};
use serde::{Deserialize, Serialize};

/// Chat message role
///
/// Defines the role of a message in a chat conversation.
/// Used in `ChatMessage` to indicate the sender's role.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    /// System message (instructions, context)
    System,
    /// User message
    User,
    /// Assistant response
    Assistant,
    /// Tool/function call result
    Tool,
}

/// Chat message
///
/// Represents a single message in a chat conversation.
/// Used in `ChatRequest` and `ChatResponse`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    /// Message role (system, user, assistant, tool)
    pub role: ChatRole,
    /// Message content
    pub content: String,
}

/// Chat request
///
/// Request to generate a chat completion.
/// Used by `LlmEngine::chat()` and `LlmEngine::chat_stream()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    /// Target engine ID
    pub engine_id: EngineId,
    /// Model identifier (normalized as `flm://{engine_id}/{model_name}`)
    pub model_id: ModelId,
    /// Conversation messages
    pub messages: Vec<ChatMessage>,
    /// Whether to stream the response
    pub stream: bool,
    /// Sampling temperature (0.0-2.0, higher = more creative)
    pub temperature: Option<f32>,
    /// Maximum tokens to generate
    pub max_tokens: Option<u32>,
    /// Stop sequences
    pub stop: Vec<String>,
}

/// Usage statistics
///
/// Token usage information for a chat completion or embedding request.
/// Included in `ChatResponse`, `EmbeddingResponse`, and `ChatStreamChunk`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UsageStats {
    /// Number of tokens in the prompt
    pub prompt_tokens: u32,
    /// Number of tokens in the completion
    pub completion_tokens: u32,
    /// Total tokens used
    pub total_tokens: u32,
}

/// Chat response
///
/// Non-streaming chat completion response.
/// Returned by `LlmEngine::chat()` and `EngineService::chat()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    /// Token usage statistics
    pub usage: UsageStats,
    /// Generated messages (typically one assistant message)
    pub messages: Vec<ChatMessage>,
}

/// Chat stream chunk
///
/// Incremental update in a streaming chat completion.
/// Emitted by `LlmEngine::chat_stream()` stream.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatStreamChunk {
    /// Message delta (incremental content)
    pub delta: ChatMessage,
    /// Usage statistics (present in final chunk)
    pub usage: Option<UsageStats>,
    /// Whether this is the final chunk
    pub is_done: bool,
}

/// Embedding request
///
/// Request to generate embeddings for text input(s).
/// Used by `LlmEngine::embeddings()` and `EngineService::embeddings()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    /// Target engine ID
    pub engine_id: EngineId,
    /// Model identifier (normalized as `flm://{engine_id}/{model_name}`)
    pub model_id: ModelId,
    /// Input texts (OpenAI-compatible: supports single item as array)
    pub input: Vec<String>,
}

/// Embedding vector
///
/// A single embedding vector with its index.
/// Part of `EmbeddingResponse` for multi-input requests.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingVector {
    /// Index in the input array
    pub index: usize,
    /// Embedding values (floating-point vector)
    pub values: Vec<f32>,
}

/// Embedding response
///
/// Response containing embedding vectors for input texts.
/// Returned by `LlmEngine::embeddings()` and `EngineService::embeddings()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    /// Token usage statistics
    pub usage: UsageStats,
    /// Generated embedding vectors (one per input)
    pub vectors: Vec<EmbeddingVector>,
}
