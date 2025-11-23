//! Engine-related port traits

use crate::domain::chat::{
    ChatRequest, ChatResponse, ChatStreamChunk, EmbeddingRequest, EmbeddingResponse,
};
#[allow(unused_imports)]
use crate::domain::engine::{EngineBinaryInfo, EngineRuntimeInfo, EngineState, ModelInfo};
use crate::domain::models::EngineCapabilities;
use crate::error::EngineError;
use async_trait::async_trait;
use futures::Stream;
use std::pin::Pin;
use std::sync::Arc;

/// Type alias for chat stream (used in LlmEngine trait)
pub type ChatStream = Pin<Box<dyn Stream<Item = Result<ChatStreamChunk, EngineError>> + Send>>;

/// LLM Engine trait
///
/// All engine adapters must implement this trait.
/// See `docs/CORE_API.md` section 3.
#[async_trait]
pub trait LlmEngine: Send + Sync {
    fn id(&self) -> String;
    fn kind(&self) -> crate::domain::models::EngineKind;
    fn capabilities(&self) -> EngineCapabilities;

    async fn health_check(&self) -> Result<crate::domain::engine::HealthStatus, EngineError>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>, EngineError>;

    async fn chat(&self, req: ChatRequest) -> Result<ChatResponse, EngineError>;
    async fn chat_stream(&self, req: ChatRequest) -> Result<ChatStream, EngineError>;

    async fn embeddings(&self, req: EmbeddingRequest) -> Result<EmbeddingResponse, EngineError>;
}

/// Engine repository trait
#[async_trait::async_trait]
pub trait EngineRepository: Send + Sync {
    async fn list_registered(&self) -> Vec<Arc<dyn LlmEngine>>;
    async fn register(&self, engine: Arc<dyn LlmEngine>);
}

/// Engine process controller trait
pub trait EngineProcessController: Send + Sync {
    fn detect_binaries(&self) -> Vec<EngineBinaryInfo>;
    fn detect_running(&self) -> Vec<EngineRuntimeInfo>;
}
