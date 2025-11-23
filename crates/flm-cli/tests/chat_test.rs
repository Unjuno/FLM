//! Integration tests for chat command
//!
//! These tests verify that chat commands work correctly with mock engines.

use flm_cli::adapters::SqliteEngineRepository;
use flm_cli::commands::chat::parse_model_id;
use flm_core::domain::chat::{ChatMessage, ChatResponse, ChatStreamChunk, UsageStats};
use flm_core::domain::models::EngineCapabilities;
use flm_core::error::EngineError;
use flm_core::ports::{EngineRepository, LlmEngine};
use flm_core::services::EngineService;
use futures::stream;
use std::sync::Arc;
use tempfile::TempDir;

/// Mock engine for testing
struct MockEngine {
    id: String,
    model_name: String,
}

#[async_trait::async_trait]
impl LlmEngine for MockEngine {
    fn id(&self) -> String {
        self.id.clone()
    }

    fn kind(&self) -> flm_core::domain::models::EngineKind {
        flm_core::domain::models::EngineKind::Ollama
    }

    fn capabilities(&self) -> EngineCapabilities {
        EngineCapabilities {
            chat: true,
            chat_stream: true,
            embeddings: true,
        }
    }

    async fn health_check(&self) -> Result<flm_core::domain::engine::HealthStatus, EngineError> {
        Ok(flm_core::domain::engine::HealthStatus::Healthy)
    }

    async fn list_models(&self) -> Result<Vec<flm_core::domain::engine::ModelInfo>, EngineError> {
        Ok(vec![flm_core::domain::engine::ModelInfo {
            engine_id: self.id.clone(),
            model_id: format!("flm://{}/{}", self.id, self.model_name),
            display_name: self.model_name.clone(),
            context_length: Some(4096),
            supports_streaming: true,
            supports_embeddings: true,
        }])
    }

    async fn chat(
        &self,
        req: flm_core::domain::chat::ChatRequest,
    ) -> Result<ChatResponse, EngineError> {
        Ok(ChatResponse {
            usage: UsageStats {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
            messages: vec![ChatMessage {
                role: flm_core::domain::chat::ChatRole::Assistant,
                content: format!("Mock response to: {}", req.messages[0].content),
            }],
        })
    }

    async fn chat_stream(
        &self,
        req: flm_core::domain::chat::ChatRequest,
    ) -> Result<flm_core::ports::ChatStream, EngineError> {
        let content = format!("Mock stream response to: {}", req.messages[0].content);
        let chunks: Vec<Result<ChatStreamChunk, EngineError>> = vec![
            Ok(ChatStreamChunk {
                delta: ChatMessage {
                    role: flm_core::domain::chat::ChatRole::Assistant,
                    content: content.clone(),
                },
                usage: None,
                is_done: false,
            }),
            Ok(ChatStreamChunk {
                delta: ChatMessage {
                    role: flm_core::domain::chat::ChatRole::Assistant,
                    content: String::new(),
                },
                usage: Some(UsageStats {
                    prompt_tokens: 10,
                    completion_tokens: 20,
                    total_tokens: 30,
                }),
                is_done: true,
            }),
        ];
        Ok(Box::pin(stream::iter(chunks)))
    }

    async fn embeddings(
        &self,
        _req: flm_core::domain::chat::EmbeddingRequest,
    ) -> Result<flm_core::domain::chat::EmbeddingResponse, EngineError> {
        Err(EngineError::NotSupported {
            engine_id: self.id.clone(),
        })
    }
}

/// Wrapper to convert Arc<SqliteEngineRepository> to Box<dyn EngineRepository>
struct ArcEngineRepositoryWrapper(Arc<SqliteEngineRepository>);

#[async_trait::async_trait]
impl EngineRepository for ArcEngineRepositoryWrapper {
    async fn list_registered(&self) -> Vec<Arc<dyn LlmEngine>> {
        self.0.list_registered().await
    }

    async fn register(&self, engine: Arc<dyn LlmEngine>) {
        self.0.register(engine).await;
    }
}

#[test]
fn test_parse_model_id_valid() {
    let result = parse_model_id("flm://ollama/llama3:8b");
    assert!(result.is_ok());
    let (engine_id, model_name) = result.unwrap();
    assert_eq!(engine_id, "ollama");
    assert_eq!(model_name, "llama3:8b");
}

#[test]
fn test_parse_model_id_invalid_format() {
    let result = parse_model_id("ollama/llama3:8b");
    assert!(result.is_err());

    let result = parse_model_id("flm://ollama");
    assert!(result.is_err());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_chat_with_mock_engine() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");

    // Create repository and register mock engine
    let engine_repo_arc = SqliteEngineRepository::new(&config_db).await.unwrap();
    let mock_engine = Arc::new(MockEngine {
        id: "test-engine".to_string(),
        model_name: "test-model".to_string(),
    });
    engine_repo_arc.register(mock_engine.clone()).await;

    // Create service
    let engine_repo: Box<dyn EngineRepository> =
        Box::new(ArcEngineRepositoryWrapper(engine_repo_arc));
    let process_controller = Box::new(flm_cli::adapters::DefaultEngineProcessController::new());
    let http_client = Box::new(flm_cli::adapters::ReqwestHttpClient::new().unwrap());
    let service = EngineService::new(process_controller, http_client, engine_repo);

    // Create chat request
    let request = flm_core::domain::chat::ChatRequest {
        engine_id: "test-engine".to_string(),
        model_id: "flm://test-engine/test-model".to_string(),
        messages: vec![ChatMessage {
            role: flm_core::domain::chat::ChatRole::User,
            content: "Hello".to_string(),
        }],
        stream: false,
        temperature: None,
        max_tokens: None,
        stop: Vec::new(),
    };

    // Execute chat
    let response = service.chat(request).await.unwrap();

    assert_eq!(response.messages.len(), 1);
    assert!(response.messages[0]
        .content
        .contains("Mock response to: Hello"));
    assert_eq!(response.usage.total_tokens, 30);
}

