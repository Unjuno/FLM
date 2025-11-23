//! Core domain models
//!
//! These types are the foundation of the FLM domain layer.
//! All types must match the specification in `docs/CORE_API.md` section 2.

use serde::{Deserialize, Serialize};

/// Engine identifier
///
/// Unique identifier for an LLM engine instance.
/// Format: arbitrary string (e.g., "ollama", "vllm-local").
pub type EngineId = String;

/// Model identifier (normalized as `flm://{engine_id}/{model_name}`)
///
/// Normalized model identifier used throughout the system.
/// Format: `flm://{engine_id}/{model_name}` (e.g., "flm://ollama/llama2:latest").
pub type ModelId = String;

/// Engine kind enumeration
///
/// Supported LLM engine types.
/// Each variant corresponds to an engine adapter crate (e.g., `flm-engine-ollama`).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EngineKind {
    /// Ollama engine
    Ollama,
    /// vLLM engine
    Vllm,
    /// LM Studio engine
    LmStudio,
    /// llama.cpp engine
    LlamaCpp,
}

/// Engine capabilities
///
/// Defines which features an engine supports.
/// Returned by `LlmEngine::capabilities()`.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct EngineCapabilities {
    /// Whether the engine supports non-streaming chat
    pub chat: bool,
    /// Whether the engine supports streaming chat
    pub chat_stream: bool,
    /// Whether the engine supports embeddings
    pub embeddings: bool,
    /// Whether the engine supports content moderation
    pub moderation: bool,
    /// Whether the engine supports function/tool calling
    pub tools: bool,
}
