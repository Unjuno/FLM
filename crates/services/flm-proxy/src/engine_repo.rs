//! Minimal EngineRepository implementation for flm-proxy
//!
//! This is a simple in-memory implementation for the proxy server.
//! Engines should be registered by the CLI before starting the proxy.

use async_trait::async_trait;
use flm_core::ports::{EngineRepository, LlmEngine};
use std::sync::{Arc, RwLock};
use tracing::error;

/// Simple in-memory EngineRepository for proxy server
pub struct InMemoryEngineRepository {
    engines: Arc<RwLock<Vec<Arc<dyn LlmEngine>>>>,
}

impl InMemoryEngineRepository {
    /// Create a new InMemoryEngineRepository
    pub fn new() -> Self {
        Self {
            engines: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

impl Default for InMemoryEngineRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl EngineRepository for InMemoryEngineRepository {
    async fn list_registered(&self) -> Vec<Arc<dyn LlmEngine>> {
        match self.engines.read() {
            Ok(engines) => engines.clone(),
            Err(_) => {
                error!(
                    error_type = "read_lock_failed",
                    "Failed to acquire read lock on engines. Returning empty list."
                );
                Vec::new()
            }
        }
    }

    async fn register(&self, engine: Arc<dyn LlmEngine>) {
        match self.engines.write() {
            Ok(mut engines) => {
                // Remove existing engine with same ID if any
                engines.retain(|e| e.id() != engine.id());
                engines.push(engine);
            }
            Err(_) => {
                error!(
                    error_type = "write_lock_failed",
                    "Failed to acquire write lock on engines. Engine registration skipped."
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use flm_core::domain::chat::{ChatRequest, ChatResponse, EmbeddingRequest, EmbeddingResponse};
    use flm_core::domain::engine::{HealthStatus, ModelInfo};
    use flm_core::domain::models::{EngineCapabilities, EngineKind};
    use flm_core::error::EngineError;
    use flm_core::ports::LlmEngine;
    use std::sync::Arc;

    struct TestEngine {
        id: String,
    }

    #[async_trait]
    impl LlmEngine for TestEngine {
        fn id(&self) -> String {
            self.id.clone()
        }

        fn kind(&self) -> EngineKind {
            EngineKind::Ollama
        }

        fn capabilities(&self) -> EngineCapabilities {
            EngineCapabilities::default()
        }

        async fn health_check(&self) -> Result<HealthStatus, EngineError> {
            Err(EngineError::InvalidResponse {
                reason: "not implemented".to_string(),
            })
        }

        async fn list_models(&self) -> Result<Vec<ModelInfo>, EngineError> {
            Ok(Vec::new())
        }

        async fn chat(&self, _req: ChatRequest) -> Result<ChatResponse, EngineError> {
            Err(EngineError::InvalidResponse {
                reason: "not implemented".to_string(),
            })
        }

        async fn chat_stream(
            &self,
            _req: ChatRequest,
        ) -> Result<flm_core::ports::ChatStream, EngineError> {
            Err(EngineError::InvalidResponse {
                reason: "not implemented".to_string(),
            })
        }

        async fn embeddings(
            &self,
            _req: EmbeddingRequest,
        ) -> Result<EmbeddingResponse, EngineError> {
            Err(EngineError::InvalidResponse {
                reason: "not implemented".to_string(),
            })
        }
    }

    #[tokio::test]
    async fn test_engine_repo_new() {
        let repo = InMemoryEngineRepository::new();
        let engines = repo.list_registered().await;
        assert!(engines.is_empty());
    }

    #[tokio::test]
    async fn test_engine_repo_register() {
        let repo = InMemoryEngineRepository::new();
        let engine = Arc::new(TestEngine {
            id: "test-engine-1".to_string(),
        });

        repo.register(engine.clone()).await;
        let engines = repo.list_registered().await;
        assert_eq!(engines.len(), 1);
        assert_eq!(engines[0].id(), "test-engine-1");
    }

    #[tokio::test]
    async fn test_engine_repo_register_multiple() {
        let repo = InMemoryEngineRepository::new();
        let engine1 = Arc::new(TestEngine {
            id: "test-engine-1".to_string(),
        });
        let engine2 = Arc::new(TestEngine {
            id: "test-engine-2".to_string(),
        });

        repo.register(engine1.clone()).await;
        repo.register(engine2.clone()).await;

        let engines = repo.list_registered().await;
        assert_eq!(engines.len(), 2);
        let ids: Vec<String> = engines.iter().map(|e| e.id()).collect();
        assert!(ids.contains(&"test-engine-1".to_string()));
        assert!(ids.contains(&"test-engine-2".to_string()));
    }

    #[tokio::test]
    async fn test_engine_repo_register_duplicate() {
        let repo = InMemoryEngineRepository::new();
        let engine1 = Arc::new(TestEngine {
            id: "test-engine-1".to_string(),
        });
        let engine2 = Arc::new(TestEngine {
            id: "test-engine-1".to_string(),
        });

        repo.register(engine1.clone()).await;
        repo.register(engine2.clone()).await;

        let engines = repo.list_registered().await;
        assert_eq!(engines.len(), 1);
        assert_eq!(engines[0].id(), "test-engine-1");
    }

    #[tokio::test]
    async fn test_engine_repo_default() {
        let repo = InMemoryEngineRepository::default();
        let engines = repo.list_registered().await;
        assert!(engines.is_empty());
    }
}
