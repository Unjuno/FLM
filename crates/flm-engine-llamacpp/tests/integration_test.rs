//! Integration tests for llama.cpp engine adapter
//!
//! These tests verify that the llama.cpp engine adapter works correctly with mock HTTP servers.

use flm_core::domain::chat::{ChatMessage, ChatRequest, ChatRole, EmbeddingRequest};
use flm_core::ports::LlmEngine;
use flm_engine_llamacpp::LlamaCppEngine;
use futures::StreamExt;
use reqwest::StatusCode;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn test_llamacpp_engine_id() {
    let mock_server = MockServer::start().await;
    let engine = LlamaCppEngine::new("llamacpp-test".to_string(), mock_server.uri()).unwrap();

    assert_eq!(engine.id(), "llamacpp-test".to_string());
    assert_eq!(
        engine.kind(),
        flm_core::domain::models::EngineKind::LlamaCpp
    );
}

#[tokio::test]
async fn test_llamacpp_engine_list_models() {
    let mock_server = MockServer::start().await;

    // Mock the /v1/models endpoint
    Mock::given(method("GET"))
        .and(path("/v1/models"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "object": "list",
                "data": [
                    {
                        "id": "llama-2-7b-chat",
                        "object": "model",
                        "created": 1686935002,
                        "owned_by": "meta"
                    }
                ]
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = LlamaCppEngine::new("llamacpp-test".to_string(), mock_server.uri()).unwrap();

    let models = engine.list_models().await.unwrap();
    assert_eq!(models.len(), 1);
    assert_eq!(models[0].model_id, "flm://llamacpp-test/llama-2-7b-chat");
    assert_eq!(models[0].display_name, "llama-2-7b-chat");
}

#[tokio::test]
async fn test_llamacpp_engine_health_check() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/v1/models"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "object": "list",
                "data": []
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = LlamaCppEngine::new("llamacpp-test".to_string(), mock_server.uri()).unwrap();

    let health = engine.health_check().await.unwrap();
    assert!(matches!(
        health,
        flm_core::domain::engine::HealthStatus::Healthy { .. }
    ));
}

#[tokio::test]
async fn test_llamacpp_engine_chat() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/v1/chat/completions"))
        .respond_with(
            ResponseTemplate::new(StatusCode::OK).set_body_json(serde_json::json!({
                "id": "chatcmpl-123",
                "object": "chat.completion",
                "created": 1677652288,
                "model": "llama-2-7b-chat",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "Hello!"
                        },
                        "finish_reason": "stop"
                    }
                ],
                "usage": {
                    "prompt_tokens": 1,
                    "completion_tokens": 1,
                    "total_tokens": 2
                }
            })),
        )
        .mount(&mock_server)
        .await;

    let engine = LlamaCppEngine::new("llamacpp-test".to_string(), mock_server.uri()).unwrap();

    let req = ChatRequest {
        engine_id: "llamacpp-test".to_string(),
        model_id: "flm://llamacpp-test/llama-2-7b-chat".to_string(),
        messages: vec![ChatMessage {
            role: ChatRole::User,
            content: "Hello".to_string(),
        }],
        stream: false,
        temperature: None,
        max_tokens: None,
        stop: vec![],
    };

    let response = engine.chat(req).await.unwrap();
    assert_eq!(response.messages.len(), 1);
    assert_eq!(response.messages[0].content, "Hello!");
}

#[tokio::test]
async fn test_llamacpp_engine_embeddings() {
    let mock_server = MockServer::start().await;

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

    let engine = LlamaCppEngine::new("llamacpp-test".to_string(), mock_server.uri()).unwrap();

    let req = EmbeddingRequest {
        engine_id: "llamacpp-test".to_string(),
        model_id: "flm://llamacpp-test/llama-2-7b-chat".to_string(),
        input: vec!["Hello".to_string()],
    };

    let response = engine.embeddings(req).await.unwrap();
    assert_eq!(response.vectors.len(), 1);
    assert_eq!(response.vectors[0].values.len(), 5);
    assert_eq!(response.vectors[0].index, 0);
}

#[tokio::test]
async fn test_llamacpp_engine_chat_stream() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/v1/chat/completions"))
        .respond_with(ResponseTemplate::new(StatusCode::OK)
            .set_body_string("data: {\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677652288,\"model\":\"llama-2-7b-chat\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"Hello\"},\"finish_reason\":null}]}\n\ndata: {\"id\":\"chatcmpl-123\",\"object\":\"chat.completion.chunk\",\"created\":1677652288,\"model\":\"llama-2-7b-chat\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"!\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n"))
        .mount(&mock_server)
        .await;

    let engine = LlamaCppEngine::new("llamacpp-test".to_string(), mock_server.uri()).unwrap();

    let req = ChatRequest {
        engine_id: "llamacpp-test".to_string(),
        model_id: "flm://llamacpp-test/llama-2-7b-chat".to_string(),
        messages: vec![ChatMessage {
            role: ChatRole::User,
            content: "Hello".to_string(),
        }],
        stream: true,
        temperature: None,
        max_tokens: None,
        stop: vec![],
    };

    let mut stream = engine.chat_stream(req).await.unwrap();
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
