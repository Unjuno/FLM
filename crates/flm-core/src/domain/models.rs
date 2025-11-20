//! Core domain models
//!
//! These types are the foundation of the FLM domain layer.
//! All types must match the specification in `docs/CORE_API.md` section 2.

use serde::{Deserialize, Serialize};

/// Engine identifier
pub type EngineId = String;

/// Model identifier (normalized as `flm://{engine_id}/{model_name}`)
pub type ModelId = String;

/// Engine kind enumeration
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EngineKind {
    Ollama,
    Vllm,
    LmStudio,
    LlamaCpp,
}

/// Engine capabilities
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct EngineCapabilities {
    pub chat: bool,
    pub chat_stream: bool,
    pub embeddings: bool,
    pub moderation: bool,
    pub tools: bool,
}
