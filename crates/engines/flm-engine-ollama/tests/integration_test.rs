//! Integration tests for Ollama engine adapter
//!
//! These tests verify that the Ollama engine adapter works correctly with mock HTTP servers.

use flm_core::domain::chat::{ChatMessage, ChatRequest, ChatRole};
use flm_core::ports::LlmEngine;
use flm_engine_ollama::OllamaEngine;
use reqwest::StatusCode;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn test_ollama_engine_id() {
    let mock_server = MockServer::start().await;
    let engine = OllamaEngine::new("ollama-test".to_string(), mock_server.uri()).unwrap();

    assert_eq!(engine.id(), "ollama-test".to_string());
    assert_eq!(engine.kind(), flm_core::domain::models::EngineKind::Ollama);
}

#[tokio::test]
async fn test_ollama_engine_list_models() {
    let mock_server = MockServer::start().await;

    // Mock the /api/tags endpoint
    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "models": [
                    {
                        "name": "llama2",
                        "model": "llama2:latest",
                        "size": 3825819519u64,
                        "digest": "sha256:...",
                        "details": {
                            "parent_model": "",
                            "format": "gguf",
                            "family": "llama",
                            "families": ["llama"],
                            "parameter_size": "7B",
                            "quantization_level": "Q4_0"
                        }
                    }
                ]
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = OllamaEngine::new("ollama-test".to_string(), mock_server.uri()).unwrap();

    let models = engine.list_models().await.unwrap();
    assert_eq!(models.len(), 1);
    assert_eq!(models[0].model_id, "llama2:latest");
}

#[tokio::test]
async fn test_ollama_engine_health_check() {
    let mock_server = MockServer::start().await;

    // Mock the /api/tags endpoint for health check
    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "models": []
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = OllamaEngine::new("ollama-test".to_string(), mock_server.uri()).unwrap();

    let health = engine.health_check().await.unwrap();
    assert!(matches!(
        health,
        flm_core::domain::engine::HealthStatus::Healthy { .. }
    ));
}

#[tokio::test]
async fn test_ollama_engine_chat() {
    let mock_server = MockServer::start().await;

    // Mock the /api/chat endpoint
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "model": "llama2:latest",
                "created_at": "2023-08-04T19:22:45.499127Z",
                "message": {
                    "role": "assistant",
                    "content": "Hello! How can I help you?"
                },
                "done": true,
                "total_duration": 1000000000,
                "load_duration": 500000000,
                "prompt_eval_count": 10,
                "prompt_eval_duration": 200000000,
                "eval_count": 5,
                "eval_duration": 300000000
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = OllamaEngine::new("ollama-test".to_string(), mock_server.uri()).unwrap();

    let req = ChatRequest {
        engine_id: "ollama-test".to_string(),
        model_id: "flm://ollama-test/llama2:latest".to_string(),
        messages: vec![ChatMessage {
            role: ChatRole::User,
            content: "Hello".to_string(),
            attachments: Vec::new(),
        }],
        stream: false,
        temperature: None,
        max_tokens: None,
        stop: vec![],
        requested_modalities: Vec::new(),
    };

    let response = engine.chat(req).await.unwrap();
    assert_eq!(response.messages.len(), 1);
    assert_eq!(response.messages[0].content, "Hello! How can I help you?");
    assert_eq!(response.usage.prompt_tokens, 10);
    assert_eq!(response.usage.completion_tokens, 5);
}

#[tokio::test]
async fn test_ollama_engine_embeddings() {
    let mock_server = MockServer::start().await;

    // Mock the /api/embeddings endpoint
    Mock::given(method("POST"))
        .and(path("/api/embeddings"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "embedding": [0.1, 0.2, 0.3, 0.4, 0.5]
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = OllamaEngine::new("ollama-test".to_string(), mock_server.uri()).unwrap();

    use flm_core::domain::chat::EmbeddingRequest;
    let req = EmbeddingRequest {
        engine_id: "ollama-test".to_string(),
        model_id: "flm://ollama-test/llama2:latest".to_string(),
        input: vec!["Hello".to_string()],
    };

    let response = engine.embeddings(req).await.unwrap();
    assert_eq!(response.vectors.len(), 1);
    assert_eq!(response.vectors[0].values.len(), 5);
    assert_eq!(response.vectors[0].index, 0);
}

#[tokio::test]
async fn test_ollama_engine_chat_stream() {
    let mock_server = MockServer::start().await;

    // Mock the /api/chat endpoint with streaming response
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .respond_with(ResponseTemplate::new(StatusCode::OK)
            .set_body_string("{\"model\":\"llama2:latest\",\"created_at\":\"2023-08-04T19:22:45.499127Z\",\"message\":{\"role\":\"assistant\",\"content\":\"Hello\"},\"done\":false}\n{\"model\":\"llama2:latest\",\"created_at\":\"2023-08-04T19:22:45.499127Z\",\"message\":{\"role\":\"assistant\",\"content\":\"!\"},\"done\":true}\n"))
        .mount(&mock_server)
        .await;

    let engine = OllamaEngine::new("ollama-test".to_string(), mock_server.uri()).unwrap();

    let req = ChatRequest {
        engine_id: "ollama-test".to_string(),
        model_id: "flm://ollama-test/llama2:latest".to_string(),
        messages: vec![ChatMessage {
            role: ChatRole::User,
            content: "Hello".to_string(),
            attachments: Vec::new(),
        }],
        stream: true,
        temperature: None,
        max_tokens: None,
        stop: vec![],
        requested_modalities: Vec::new(),
    };

    let mut stream = engine.chat_stream(req).await.unwrap();
    use futures::StreamExt;

    let mut chunks = Vec::new();
    while let Some(result) = stream.next().await {
        let chunk = result.unwrap();
        let is_done = chunk.is_done;
        chunks.push(chunk);
        if is_done {
            break;
        }
    }

    assert!(!chunks.is_empty());
    assert!(chunks.last().unwrap().is_done);
}
