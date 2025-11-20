//! Engine-related port traits

use crate::domain::chat::{
    ChatRequest, ChatResponse, ChatStreamChunk, EmbeddingRequest, EmbeddingResponse,
};
#[allow(unused_imports)]
use crate::domain::engine::{EngineBinaryInfo, EngineRuntimeInfo, EngineState, ModelInfo};
use crate::domain::models::EngineCapabilities;
use crate::error::EngineError;
use futures::Stream;
use std::pin::Pin;

/// Type alias for chat stream (used in LlmEngine trait)
pub type ChatStream = Pin<Box<dyn Stream<Item = Result<ChatStreamChunk, EngineError>> + Send>>;

/// LLM Engine trait
///
/// All engine adapters must implement this trait.
/// See `docs/CORE_API.md` section 3.
pub trait LlmEngine: Send + Sync {
    fn id(&self) -> String;
    fn kind(&self) -> crate::domain::models::EngineKind;
    fn capabilities(&self) -> EngineCapabilities;

    fn health_check(&self) -> Result<crate::domain::engine::HealthStatus, EngineError>;
    fn list_models(&self) -> Result<Vec<ModelInfo>, EngineError>;

    fn chat(&self, req: ChatRequest) -> Result<ChatResponse, EngineError>;
    fn chat_stream(&self, req: ChatRequest) -> Result<ChatStream, EngineError>;

    fn embeddings(&self, req: EmbeddingRequest) -> Result<EmbeddingResponse, EngineError>;
}

/// Engine repository trait
pub trait EngineRepository {
    fn list_registered(&self) -> Vec<Box<dyn LlmEngine>>;
    fn register(&self, engine: Box<dyn LlmEngine>);
}

/// Engine process controller trait
pub trait EngineProcessController {
    fn detect_binaries(&self) -> Vec<EngineBinaryInfo>;
    fn detect_running(&self) -> Vec<EngineRuntimeInfo>;
}
