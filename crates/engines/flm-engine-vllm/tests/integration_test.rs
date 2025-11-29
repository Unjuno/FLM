//! Integration tests for vLLM engine adapter
//!
//! These tests verify that the vLLM engine adapter works correctly with mock HTTP servers.

use flm_core::domain::chat::{ChatMessage, ChatRequest, ChatRole};
use flm_core::ports::LlmEngine;
use flm_engine_vllm::VllmEngine;
use reqwest::StatusCode;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn test_vllm_engine_id() {
    let mock_server = MockServer::start().await;
    let engine = VllmEngine::new("vllm-test".to_string(), mock_server.uri()).unwrap();

    assert_eq!(engine.id(), "vllm-test".to_string());
    assert_eq!(engine.kind(), flm_core::domain::models::EngineKind::Vllm);
}

#[tokio::test]
async fn test_vllm_engine_list_models() {
    let mock_server = MockServer::start().await;

    // Mock the /v1/models endpoint
    Mock::given(method("GET"))
        .and(path("/v1/models"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "object": "list",
                "data": [
                    {
                        "id": "meta-llama/Llama-2-7b-chat-hf",
                        "object": "model",
                        "created": 1686935002,
                        "owned_by": "meta-llama"
                    }
                ]
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = VllmEngine::new("vllm-test".to_string(), mock_server.uri()).unwrap();

    let models = engine.list_models().await.unwrap();
    assert_eq!(models.len(), 1);
    // vLLM engine returns model_id in flm:// format
    assert_eq!(
        models[0].model_id,
        "flm://vllm-test/meta-llama/Llama-2-7b-chat-hf"
    );
}

#[tokio::test]
async fn test_vllm_engine_health_check() {
    let mock_server = MockServer::start().await;

    // Mock the /health endpoint
    Mock::given(method("GET"))
        .and(path("/health"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "status": "ok"
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = VllmEngine::new("vllm-test".to_string(), mock_server.uri()).unwrap();

    let health = engine.health_check().await.unwrap();
    // Accept both Healthy and Degraded status (latency might vary in tests)
    match health {
        flm_core::domain::engine::HealthStatus::Healthy { .. } => {
            // Expected case
        }
        flm_core::domain::engine::HealthStatus::Degraded { .. } => {
            // Also acceptable for tests (high latency but still working)
        }
        _ => {
            panic!("Expected Healthy or Degraded, got: {:?}", health);
        }
    }
}

#[tokio::test]
async fn test_vllm_engine_chat() {
    let mock_server = MockServer::start().await;

    // Mock the /v1/chat/completions endpoint
    Mock::given(method("POST"))
        .and(path("/v1/chat/completions"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "id": "chatcmpl-123",
                "object": "chat.completion",
                "created": 1677652288,
                "model": "meta-llama/Llama-2-7b-chat-hf",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "Hello! How can I help you?"
                        },
                        "finish_reason": "stop"
                    }
                ],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 5,
                    "total_tokens": 15
                }
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = VllmEngine::new("vllm-test".to_string(), mock_server.uri()).unwrap();

    let req = ChatRequest {
        engine_id: "vllm-test".to_string(),
        model_id: "flm://vllm-test/meta-llama/Llama-2-7b-chat-hf".to_string(),
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
async fn test_vllm_engine_embeddings() {
    let mock_server = MockServer::start().await;

    // Mock the /v1/embeddings endpoint
    Mock::given(method("POST"))
        .and(path("/v1/embeddings"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "object": "list",
                "data": [
                    {
                        "object": "embedding",
                        "embedding": [0.1, 0.2, 0.3, 0.4, 0.5],
                        "index": 0
                    }
                ],
                "usage": {
                    "prompt_tokens": 1,
                    "completion_tokens": 0,
                    "total_tokens": 1
                }
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = VllmEngine::new("vllm-test".to_string(), mock_server.uri()).unwrap();

    use flm_core::domain::chat::EmbeddingRequest;
    let req = EmbeddingRequest {
        engine_id: "vllm-test".to_string(),
        model_id: "flm://vllm-test/meta-llama/Llama-2-7b-chat-hf".to_string(),
        input: vec!["Hello".to_string()],
    };

    let response = engine.embeddings(req).await.unwrap();
    assert_eq!(response.vectors.len(), 1);
    assert_eq!(response.vectors[0].values.len(), 5);
    assert_eq!(response.vectors[0].index, 0);
}

#[tokio::test]
async fn test_vllm_engine_chat_stream() {
    let mock_server = MockServer::start().await;

    // Mock the /v1/chat/completions endpoint with streaming response
    // First chunk has role, subsequent chunks don't need role
    Mock::given(method("POST"))
        .and(path("/v1/chat/completions"))
        .respond_with(ResponseTemplate::new(StatusCode::OK)
            .set_body_string("data: {\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677652288,\"model\":\"meta-llama/Llama-2-7b-chat-hf\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"Hello\"},\"finish_reason\":null}]}\n\ndata: {\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677652288,\"model\":\"meta-llama/Llama-2-7b-chat-hf\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"!\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n"))
        .mount(&mock_server)
        .await;

    let engine = VllmEngine::new("vllm-test".to_string(), mock_server.uri()).unwrap();

    let req = ChatRequest {
        engine_id: "vllm-test".to_string(),
        model_id: "flm://vllm-test/meta-llama/Llama-2-7b-chat-hf".to_string(),
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
