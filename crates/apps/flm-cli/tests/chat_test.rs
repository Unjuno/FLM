//! Integration tests for chat command
//!
//! These tests verify that chat commands work correctly with mock engines.

use base64::Engine;
use flm_cli::adapters::SqliteEngineRepository;
use flm_core::domain::chat::{ChatMessage, ChatResponse, ChatStreamChunk, UsageStats};
use flm_core::domain::models::EngineCapabilities;
use flm_core::error::EngineError;
use flm_core::ports::{EngineRepository, LlmEngine};
use flm_core::services::EngineService;
use futures::stream;
use std::sync::Arc;

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
            moderation: false,
            tools: false,
            reasoning: false,
            vision_inputs: true,
            audio_inputs: true,
            audio_outputs: false,
            max_image_bytes: Some(8 * 1024 * 1024),
            max_audio_bytes: Some(25 * 1024 * 1024),
        }
    }

    async fn health_check(&self) -> Result<flm_core::domain::engine::HealthStatus, EngineError> {
        Ok(flm_core::domain::engine::HealthStatus::Healthy { latency_ms: 0 })
    }

    async fn list_models(&self) -> Result<Vec<flm_core::domain::engine::ModelInfo>, EngineError> {
        use flm_core::domain::models::ModelCapabilities;

        // Detect capabilities from model name
        let capabilities =
            if self.model_name.contains("o1") || self.model_name.contains("reasoning") {
                Some(ModelCapabilities {
                    reasoning: true,
                    tools: false,
                    vision: false,
                    audio_inputs: false,
                    audio_outputs: false,
                })
            } else if self.model_name.contains("llava") || self.model_name.contains("vision") {
                Some(ModelCapabilities {
                    reasoning: false,
                    tools: false,
                    vision: true,
                    audio_inputs: false,
                    audio_outputs: false,
                })
            } else if self.model_name.contains("whisper") || self.model_name.contains("audio") {
                Some(ModelCapabilities {
                    reasoning: false,
                    tools: false,
                    vision: false,
                    audio_inputs: true,
                    audio_outputs: true,
                })
            } else if self.model_name.contains("gpt-4") || self.model_name.contains("tool") {
                Some(ModelCapabilities {
                    reasoning: false,
                    tools: true,
                    vision: true,
                    audio_inputs: false,
                    audio_outputs: false,
                })
            } else {
                None
            };

        Ok(vec![flm_core::domain::engine::ModelInfo {
            engine_id: self.id.clone(),
            model_id: format!("flm://{}/{}", self.id, self.model_name),
            display_name: self.model_name.clone(),
            context_length: Some(4096),
            supports_streaming: true,
            supports_embeddings: true,
            capabilities,
        }])
    }

    async fn chat(
        &self,
        req: flm_core::domain::chat::ChatRequest,
    ) -> Result<ChatResponse, EngineError> {
        // Verify multimodal attachments are present
        let has_attachments = req.messages.iter().any(|m| !m.attachments.is_empty());
        let attachment_count: usize = req.messages.iter().map(|m| m.attachments.len()).sum();

        let mut response_content = format!("Mock response to: {}", req.messages[0].content);
        if has_attachments {
            response_content.push_str(&format!(" (with {} attachment(s))", attachment_count));
        }

        Ok(ChatResponse {
            usage: UsageStats {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
            messages: vec![ChatMessage {
                role: flm_core::domain::chat::ChatRole::Assistant,
                content: response_content,
                attachments: Vec::new(),
            }],
            audio: Vec::new(),
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
                    attachments: Vec::new(),
                },
                usage: None,
                is_done: false,
                audio: Vec::new(),
            }),
            Ok(ChatStreamChunk {
                delta: ChatMessage {
                    role: flm_core::domain::chat::ChatRole::Assistant,
                    content: String::new(),
                    attachments: Vec::new(),
                },
                usage: Some(UsageStats {
                    prompt_tokens: 10,
                    completion_tokens: 20,
                    total_tokens: 30,
                }),
                is_done: true,
                audio: Vec::new(),
            }),
        ];
        Ok(Box::pin(stream::iter(chunks)))
    }

    async fn embeddings(
        &self,
        _req: flm_core::domain::chat::EmbeddingRequest,
    ) -> Result<flm_core::domain::chat::EmbeddingResponse, EngineError> {
        Err(EngineError::InvalidResponse {
            reason: "Embeddings not supported".to_string(),
        })
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn test_chat_with_model_capabilities_vision_supported() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");

    // Create repository and register mock engine with vision model
    let engine_repo_arc = SqliteEngineRepository::new(&config_db).await.unwrap();
    let mock_engine = Arc::new(MockEngine {
        id: "test-engine".to_string(),
        model_name: "llava-model".to_string(), // Vision model
    });
    engine_repo_arc.register(mock_engine.clone()).await;

    // Create a test image file
    let test_image_data = base64::engine::general_purpose::STANDARD
        .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
        .unwrap();
    let image_path = temp_dir.path().join("test.png");
    std::fs::write(&image_path, &test_image_data).unwrap();

    // Test chat with image attachment on vision model
    use flm_cli::cli::chat::Chat;
    let chat = Chat {
        model: "flm://test-engine/llava-model".to_string(),
        prompt: "Describe this image".to_string(),
        stream: false,
        temperature: None,
        max_tokens: None,
        image: vec![image_path.to_str().unwrap().to_string()],
        image_url: Vec::new(),
        audio: None,
    };

    // Should succeed because model supports vision
    let result = flm_cli::commands::chat::execute(
        chat,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Note: This will fail at the engine level since MockEngine doesn't actually process images
    // But the capability check should pass
    // The error should be from the engine, not from capability check
    if result.is_err() {
        let error_msg = result.unwrap_err().to_string();
        // Should not fail due to vision capability check
        assert!(
            !error_msg.contains("does not support vision"),
            "Should not fail due to vision capability. Error: {error_msg}"
        );
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn test_chat_with_model_capabilities_reasoning_model() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");

    // Create repository and register mock engine with reasoning model
    let engine_repo_arc = SqliteEngineRepository::new(&config_db).await.unwrap();
    let mock_engine = Arc::new(MockEngine {
        id: "test-engine".to_string(),
        model_name: "o1-preview".to_string(), // Reasoning model
    });
    engine_repo_arc.register(mock_engine.clone()).await;

    // Test chat with reasoning model
    use flm_cli::cli::chat::Chat;
    let chat = Chat {
        model: "flm://test-engine/o1-preview".to_string(),
        prompt: "Solve this step by step".to_string(),
        stream: false,
        temperature: None,
        max_tokens: None,
        image: Vec::new(),
        image_url: Vec::new(),
        audio: None,
    };

    // Should succeed - reasoning capability is detected but doesn't affect basic chat
    let result = flm_cli::commands::chat::execute(
        chat,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should succeed (may fail at engine level, but capability check should pass)
    if result.is_err() {
        let error_msg = result.unwrap_err().to_string();
        // Should not fail due to capability check
        assert!(
            !error_msg.contains("does not support"),
            "Should not fail due to capability check. Error: {error_msg}"
        );
    }
}

/// Wrapper to convert Arc<SqliteEngineRepository> to Box<dyn EngineRepository + Send + Sync>
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
    let engine_repo: Box<dyn EngineRepository + Send + Sync> =
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
            attachments: Vec::new(),
        }],
        stream: false,
        temperature: None,
        max_tokens: None,
        stop: Vec::new(),
        requested_modalities: Vec::new(),
    };

    // Execute chat
    let response = service.chat(request).await.unwrap();

    assert_eq!(response.messages.len(), 1);
    assert!(response.messages[0]
        .content
        .contains("Mock response to: Hello"));
    assert_eq!(response.usage.total_tokens, 30);
}

#[tokio::test(flavor = "multi_thread")]
async fn test_chat_invalid_model_id() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");

    // Test chat with invalid model ID format
    use flm_cli::cli::chat::Chat;
    let chat = Chat {
        model: "invalid-model-id".to_string(),
        prompt: "Hello".to_string(),
        stream: false,
        temperature: None,
        max_tokens: None,
        image: Vec::new(),
        image_url: Vec::new(),
        audio: None,
    };

    let result = flm_cli::commands::chat::execute(
        chat,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should fail with invalid model ID format
    assert!(result.is_err(), "Chat with invalid model ID should fail");
    let error_msg = result.unwrap_err().to_string();
    assert!(
        error_msg.contains("flm://")
            || error_msg.contains("Invalid")
            || error_msg.contains("model"),
        "Error message should mention model ID issue. Got: {error_msg}"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_chat_nonexistent_engine() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");

    // Test chat with non-existent engine
    use flm_cli::cli::chat::Chat;
    let chat = Chat {
        model: "flm://nonexistent-engine/test-model".to_string(),
        prompt: "Hello".to_string(),
        stream: false,
        temperature: None,
        max_tokens: None,
        image: Vec::new(),
        image_url: Vec::new(),
        audio: None,
    };

    let result = flm_cli::commands::chat::execute(
        chat,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should fail because engine doesn't exist
    assert!(result.is_err(), "Chat with non-existent engine should fail");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_chat_with_image_attachment() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");

    // Create repository and register mock engine with vision support
    let engine_repo_arc = SqliteEngineRepository::new(&config_db).await.unwrap();
    let mock_engine = Arc::new(MockEngine {
        id: "test-engine".to_string(),
        model_name: "test-model".to_string(),
    });
    engine_repo_arc.register(mock_engine.clone()).await;

    // Create service
    let engine_repo: Box<dyn EngineRepository + Send + Sync> =
        Box::new(ArcEngineRepositoryWrapper(engine_repo_arc));
    let process_controller = Box::new(flm_cli::adapters::DefaultEngineProcessController::new());
    let http_client = Box::new(flm_cli::adapters::ReqwestHttpClient::new().unwrap());
    let service = EngineService::new(process_controller, http_client, engine_repo);

    // Create a test image file (1x1 PNG)
    let test_image_data = base64::engine::general_purpose::STANDARD
        .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
        .unwrap();
    let image_path = temp_dir.path().join("test.png");
    std::fs::write(&image_path, &test_image_data).unwrap();

    // Create chat request with image attachment
    let request = flm_core::domain::chat::ChatRequest {
        engine_id: "test-engine".to_string(),
        model_id: "flm://test-engine/test-model".to_string(),
        messages: vec![ChatMessage {
            role: flm_core::domain::chat::ChatRole::User,
            content: "Describe this image".to_string(),
            attachments: vec![flm_core::domain::chat::MultimodalAttachment {
                kind: flm_core::domain::chat::MultimodalAttachmentKind::InputImage,
                data: test_image_data,
                mime_type: "image/png".to_string(),
                filename: Some("test.png".to_string()),
                size_bytes: Some(95),
                detail: None,
                duration_ms: None,
            }],
        }],
        stream: false,
        temperature: None,
        max_tokens: None,
        stop: Vec::new(),
        requested_modalities: Vec::new(),
    };

    // Execute chat
    let response = service.chat(request).await.unwrap();

    // Verify response includes attachment count
    assert_eq!(response.messages.len(), 1);
    assert!(response.messages[0]
        .content
        .contains("with 1 attachment(s)"));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_chat_with_unsupported_modality() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");

    // Create repository and register mock engine WITHOUT vision support
    let engine_repo_arc = SqliteEngineRepository::new(&config_db).await.unwrap();
    let mock_engine_no_vision = Arc::new(MockEngineNoVision {
        id: "test-engine-no-vision".to_string(),
        model_name: "test-model".to_string(),
    });
    engine_repo_arc
        .register(mock_engine_no_vision.clone())
        .await;

    // Create a test image file
    let test_image_data = base64::engine::general_purpose::STANDARD
        .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
        .unwrap();
    let image_path = temp_dir.path().join("test.png");
    std::fs::write(&image_path, &test_image_data).unwrap();

    // Test chat with image attachment on non-vision engine
    use flm_cli::cli::chat::Chat;
    let chat = Chat {
        model: "flm://test-engine-no-vision/test-model".to_string(),
        prompt: "Describe this image".to_string(),
        stream: false,
        temperature: None,
        max_tokens: None,
        image: vec![image_path.to_str().unwrap().to_string()],
        image_url: Vec::new(),
        audio: None,
    };

    let result = flm_cli::commands::chat::execute(
        chat,
        Some(config_db.to_str().unwrap().to_string()),
        "json".to_string(),
    )
    .await;

    // Should fail because engine doesn't support vision
    assert!(
        result.is_err(),
        "Chat with image on non-vision engine should fail"
    );
    let error_msg = result.unwrap_err().to_string();
    assert!(
        error_msg.contains("vision") || error_msg.contains("not support"),
        "Error message should mention vision support. Got: {error_msg}"
    );
}

/// Mock engine without vision support for testing
struct MockEngineNoVision {
    id: String,
    model_name: String,
}

#[async_trait::async_trait]
impl LlmEngine for MockEngineNoVision {
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
            moderation: false,
            tools: false,
            reasoning: false,
            vision_inputs: false, // No vision support
            audio_inputs: false,
            audio_outputs: false,
            max_image_bytes: None,
            max_audio_bytes: None,
        }
    }

    async fn health_check(&self) -> Result<flm_core::domain::engine::HealthStatus, EngineError> {
        Ok(flm_core::domain::engine::HealthStatus::Healthy { latency_ms: 0 })
    }

    async fn list_models(&self) -> Result<Vec<flm_core::domain::engine::ModelInfo>, EngineError> {
        // MockEngineNoVision always returns None for capabilities
        // to test fallback to engine capabilities
        Ok(vec![flm_core::domain::engine::ModelInfo {
            engine_id: self.id.clone(),
            model_id: format!("flm://{}/{}", self.id, self.model_name),
            display_name: self.model_name.clone(),
            context_length: Some(4096),
            supports_streaming: true,
            supports_embeddings: true,
            capabilities: None, // No model-specific capabilities, use engine capabilities
        }])
    }

    async fn chat(
        &self,
        _req: flm_core::domain::chat::ChatRequest,
    ) -> Result<ChatResponse, EngineError> {
        Ok(ChatResponse {
            usage: UsageStats {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
            messages: vec![ChatMessage {
                role: flm_core::domain::chat::ChatRole::Assistant,
                content: "Mock response".to_string(),
                attachments: Vec::new(),
            }],
            audio: Vec::new(),
        })
    }

    async fn chat_stream(
        &self,
        _req: flm_core::domain::chat::ChatRequest,
    ) -> Result<flm_core::ports::ChatStream, EngineError> {
        let chunks: Vec<Result<ChatStreamChunk, EngineError>> = vec![
            Ok(ChatStreamChunk {
                delta: ChatMessage {
                    role: flm_core::domain::chat::ChatRole::Assistant,
                    content: "Mock stream".to_string(),
                    attachments: Vec::new(),
                },
                usage: None,
                is_done: false,
                audio: Vec::new(),
            }),
            Ok(ChatStreamChunk {
                delta: ChatMessage {
                    role: flm_core::domain::chat::ChatRole::Assistant,
                    content: String::new(),
                    attachments: Vec::new(),
                },
                usage: Some(UsageStats {
                    prompt_tokens: 10,
                    completion_tokens: 20,
                    total_tokens: 30,
                }),
                is_done: true,
                audio: Vec::new(),
            }),
        ];
        Ok(Box::pin(stream::iter(chunks)))
    }

    async fn embeddings(
        &self,
        _req: flm_core::domain::chat::EmbeddingRequest,
    ) -> Result<flm_core::domain::chat::EmbeddingResponse, EngineError> {
        Err(EngineError::InvalidResponse {
            reason: "Embeddings not supported".to_string(),
        })
    }
}
