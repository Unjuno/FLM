//! Engine service
//!
//! See `docs/CORE_API.md` section 5 for the complete specification.

use crate::domain::chat::{
    ChatRequest, ChatResponse, ChatStreamChunk, EmbeddingRequest, EmbeddingResponse,
};
use crate::domain::engine::{EngineState, ModelInfo};
use crate::domain::models::EngineId;
use crate::error::EngineError;
#[allow(unused_imports)]
use crate::ports::{ConfigRepository, EngineProcessController, EngineRepository};
use futures::Stream;
use std::pin::Pin;

/// Type alias for chat stream
pub type ChatStream = Pin<Box<dyn Stream<Item = Result<ChatStreamChunk, EngineError>> + Send>>;

/// Engine service
///
/// This service coordinates engine detection, model listing, and chat operations.
pub struct EngineService {
    // TODO: Add fields for repositories and controllers
    // These will be injected via constructor
}

impl EngineService {
    /// Create a new EngineService
    #[allow(clippy::new_without_default)]
    pub fn new(// TODO: Add repository and controller parameters
    ) -> Self {
        // TODO: Initialize with injected dependencies
        Self {}
    }

    /// Detect all available engines
    pub fn detect_engines(&self) -> Result<Vec<EngineState>, EngineError> {
        // TODO: Implement according to ENGINE_DETECT.md
        todo!("Implement engine detection")
    }

    /// List models for a specific engine
    pub fn list_models(&self, _engine_id: EngineId) -> Result<Vec<ModelInfo>, EngineError> {
        // TODO: Implement model listing
        todo!("Implement model listing")
    }

    /// Send a chat request
    pub fn chat(&self, _req: ChatRequest) -> Result<ChatResponse, EngineError> {
        // TODO: Implement chat
        todo!("Implement chat")
    }

    /// Send a streaming chat request
    pub fn chat_stream(&self, _req: ChatRequest) -> Result<ChatStream, EngineError> {
        // TODO: Implement streaming chat
        todo!("Implement streaming chat")
    }

    /// Generate embeddings
    pub fn embeddings(&self, _req: EmbeddingRequest) -> Result<EmbeddingResponse, EngineError> {
        // TODO: Implement embeddings
        todo!("Implement embeddings")
    }
}
