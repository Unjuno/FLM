//! llama.cpp engine adapter
//!
//! This crate implements the `LlmEngine` trait for llama.cpp.
//! See `docs/ENGINE_DETECT.md` for detection specification.
//!
//! llama.cpp provides an OpenAI-compatible API when running in server mode,
//! so the implementation is similar to vLLM and LM Studio.

use async_trait::async_trait;
use flm_core::domain::chat::{
    ChatMessage, ChatRequest, ChatResponse, ChatRole, ChatStreamChunk, EmbeddingRequest,
    EmbeddingResponse, EmbeddingVector, UsageStats,
};
use flm_core::domain::engine::{HealthStatus, ModelInfo};
use flm_core::domain::models::{EngineCapabilities, EngineId, EngineKind};
use flm_core::error::EngineError;
use flm_core::ports::LlmEngine;
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use std::time::Instant;
use tokio_stream::StreamExt;

/// llama.cpp engine implementation
pub struct LlamaCppEngine {
    engine_id: EngineId,
    base_url: String,
    client: reqwest::Client,
}

impl LlamaCppEngine {
    /// Create a new LlamaCppEngine instance
    pub fn new(engine_id: EngineId, base_url: String) -> Result<Self, EngineError> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| EngineError::NetworkError {
                reason: format!("Failed to create HTTP client: {e}"),
            })?;

        Ok(Self {
            engine_id,
            base_url,
            client,
        })
    }

    /// Get the base URL for API requests
    fn api_url(&self, endpoint: &str) -> String {
        format!("{}/v1/{}", self.base_url, endpoint)
    }
}

#[async_trait]
impl LlmEngine for LlamaCppEngine {
    fn id(&self) -> EngineId {
        self.engine_id.clone()
    }

    fn kind(&self) -> EngineKind {
        EngineKind::LlamaCpp
    }

    fn capabilities(&self) -> EngineCapabilities {
        EngineCapabilities {
            chat: true,
            chat_stream: true,
            embeddings: true,
            moderation: false,
            tools: false,
        }
    }

    async fn health_check(&self) -> Result<HealthStatus, EngineError> {
        let start = Instant::now();
        let url = self.api_url("models");

        let response =
            self.client
                .get(&url)
                .send()
                .await
                .map_err(|e| EngineError::NetworkError {
                    reason: format!("Request failed: {e}"),
                })?;

        let latency_ms = start.elapsed().as_millis() as u64;
        if response.status().is_success() {
            if latency_ms < 1500 {
                Ok(HealthStatus::Healthy { latency_ms })
            } else {
                Ok(HealthStatus::Degraded {
                    latency_ms,
                    reason: "High latency".to_string(),
                })
            }
        } else {
            Ok(HealthStatus::Unreachable {
                reason: format!("HTTP {}", response.status().as_u16()),
            })
        }
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, EngineError> {
        let url = self.api_url("models");

        let response: OpenAiModelsResponse = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| EngineError::NetworkError {
                reason: format!("Request failed: {e}"),
            })?
            .json()
            .await
            .map_err(|e| EngineError::ApiError {
                reason: format!("Failed to parse JSON: {e}"),
                status_code: None,
            })?;

        let models = response
            .data
            .into_iter()
            .map(|model| ModelInfo {
                engine_id: self.engine_id.clone(),
                model_id: format!("flm://{}/{}", self.engine_id, model.id),
                display_name: model.id.clone(),
                context_length: None, // llama.cpp API doesn't always provide this
                supports_streaming: true,
                supports_embeddings: true,
            })
            .collect();

        Ok(models)
    }

    async fn chat(&self, req: ChatRequest) -> Result<ChatResponse, EngineError> {
        // Verify engine_id matches
        if req.engine_id != self.engine_id {
            return Err(EngineError::InvalidResponse {
                reason: format!(
                    "Engine ID mismatch: expected {}, got {}",
                    self.engine_id, req.engine_id
                ),
            });
        }

        // Extract model name from model_id (format: flm://{engine_id}/{model_name})
        let model = req
            .model_id
            .strip_prefix(&format!("flm://{}/", self.engine_id))
            .ok_or_else(|| EngineError::InvalidResponse {
                reason: format!("Invalid model ID: {}", req.model_id),
            })?;

        let openai_req = OpenAiChatRequest {
            model: model.to_string(),
            messages: req
                .messages
                .into_iter()
                .map(|m| OpenAiMessageRequest {
                    role: match m.role {
                        ChatRole::User => "user".to_string(),
                        ChatRole::Assistant => "assistant".to_string(),
                        ChatRole::System => "system".to_string(),
                        ChatRole::Tool => "user".to_string(), // Fallback to user
                    },
                    content: m.content,
                })
                .collect(),
            stream: false,
            temperature: req.temperature.map(|t| t as f64),
            max_tokens: req.max_tokens,
        };

        let url = self.api_url("chat/completions");
        let response: OpenAiChatResponse = self
            .client
            .post(&url)
            .json(&openai_req)
            .send()
            .await
            .map_err(|e| EngineError::NetworkError {
                reason: format!("Request failed: {e}"),
            })?
            .json()
            .await
            .map_err(|e| EngineError::ApiError {
                reason: format!("Failed to parse JSON: {e}"),
                status_code: None,
            })?;

        // Extract the first choice
        let choice = response
            .choices
            .first()
            .ok_or_else(|| EngineError::InvalidResponse {
                reason: "No choices in response".to_string(),
            })?;

        let content = choice.message.content.clone().unwrap_or_default();

        Ok(ChatResponse {
            usage: response.usage.unwrap_or(UsageStats {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            }),
            messages: vec![ChatMessage {
                role: ChatRole::Assistant,
                content,
            }],
        })
    }

    async fn chat_stream(
        &self,
        req: ChatRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<ChatStreamChunk, EngineError>> + Send>>, EngineError>
    {
        // Verify engine_id matches
        if req.engine_id != self.engine_id {
            return Err(EngineError::InvalidResponse {
                reason: format!(
                    "Engine ID mismatch: expected {}, got {}",
                    self.engine_id, req.engine_id
                ),
            });
        }

        // Extract model name from model_id
        let model = req
            .model_id
            .strip_prefix(&format!("flm://{}/", self.engine_id))
            .ok_or_else(|| EngineError::InvalidResponse {
                reason: format!("Invalid model ID: {}", req.model_id),
            })?;

        let openai_req = OpenAiChatRequest {
            model: model.to_string(),
            messages: req
                .messages
                .into_iter()
                .map(|m| OpenAiMessageRequest {
                    role: match m.role {
                        ChatRole::User => "user".to_string(),
                        ChatRole::Assistant => "assistant".to_string(),
                        ChatRole::System => "system".to_string(),
                        ChatRole::Tool => "user".to_string(),
                    },
                    content: m.content,
                })
                .collect(),
            stream: true,
            temperature: req.temperature.map(|t| t as f64),
            max_tokens: req.max_tokens,
        };

        let url = self.api_url("chat/completions");
        let client = self.client.clone();

        // Create a stream from the response
        let stream = async_stream::stream! {
            let response = client
                .post(&url)
                .json(&openai_req)
                .send()
                .await
                .map_err(|e| EngineError::NetworkError {
                    reason: format!("Request failed: {e}"),
                })?;

            let mut stream = response.bytes_stream();
            let mut accumulated_content = String::new();
            let mut is_done = false;
            #[allow(unused_assignments)]
            let mut final_usage: Option<UsageStats> = None;

            while let Some(chunk_result) = stream.next().await {
                let bytes = chunk_result.map_err(|e| EngineError::NetworkError {
                    reason: format!("Stream error: {e}"),
                })?;

                // Parse SSE format
                let text = String::from_utf8_lossy(&bytes);
                for line in text.lines() {
                    if let Some(json_str) = line.strip_prefix("data: ") {
                        if json_str == "[DONE]" {
                            is_done = true;
                            break;
                        }

                        match serde_json::from_str::<OpenAiChatChunk>(json_str) {
                            Ok(chunk) => {
                                if let Some(delta) = chunk.choices.first() {
                                    if let Some(delta_content) = delta.delta.content.as_ref() {
                                        if !delta_content.is_empty() {
                                            accumulated_content.push_str(delta_content);
                                            yield Ok(ChatStreamChunk {
                                                delta: ChatMessage {
                                                    role: ChatRole::Assistant,
                                                    content: delta_content.clone(),
                                                },
                                                usage: if delta.finish_reason.is_some() {
                                                    final_usage = chunk.usage.clone();
                                                    final_usage.clone()
                                                } else {
                                                    None
                                                },
                                                is_done: delta.finish_reason.is_some(),
                                            });
                                        }

                                        if delta.finish_reason.is_some() {
                                            is_done = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                yield Err(EngineError::InvalidResponse {
                                    reason: format!("Failed to parse chunk: {e}"),
                                });
                            }
                        }
                    }
                }

                if is_done {
                    break;
                }
            }
        };

        Ok(Box::pin(stream))
    }

    async fn embeddings(&self, req: EmbeddingRequest) -> Result<EmbeddingResponse, EngineError> {
        // Verify engine_id matches
        if req.engine_id != self.engine_id {
            return Err(EngineError::InvalidResponse {
                reason: format!(
                    "Engine ID mismatch: expected {}, got {}",
                    self.engine_id, req.engine_id
                ),
            });
        }

        // Extract model name from model_id
        let model = req
            .model_id
            .strip_prefix(&format!("flm://{}/", self.engine_id))
            .ok_or_else(|| EngineError::InvalidResponse {
                reason: format!("Invalid model ID: {}", req.model_id),
            })?;

        let openai_req = OpenAiEmbeddingRequest {
            model: model.to_string(),
            input: req.input,
        };

        let url = self.api_url("embeddings");
        let response: OpenAiEmbeddingResponse = self
            .client
            .post(&url)
            .json(&openai_req)
            .send()
            .await
            .map_err(|e| EngineError::NetworkError {
                reason: format!("Request failed: {e}"),
            })?
            .json()
            .await
            .map_err(|e| EngineError::ApiError {
                reason: format!("Failed to parse JSON: {e}"),
                status_code: None,
            })?;

        Ok(EmbeddingResponse {
            usage: response.usage.unwrap_or(UsageStats {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            }),
            vectors: response
                .data
                .into_iter()
                .enumerate()
                .map(|(idx, item)| EmbeddingVector {
                    index: idx,
                    values: item.embedding,
                })
                .collect(),
        })
    }
}

// OpenAI-compatible API request/response types

#[derive(Serialize)]
struct OpenAiChatRequest {
    model: String,
    messages: Vec<OpenAiMessageRequest>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Serialize)]
struct OpenAiMessageRequest {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OpenAiMessageResponse {
    #[allow(dead_code)]
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    content: Option<String>,
}

#[derive(Deserialize)]
struct OpenAiChatResponse {
    choices: Vec<OpenAiChoice>,
    usage: Option<UsageStats>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessageResponse,
    #[serde(rename = "finish_reason")]
    #[allow(dead_code)]
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct OpenAiChatChunk {
    choices: Vec<OpenAiChunkChoice>,
    usage: Option<UsageStats>,
}

#[derive(Deserialize)]
struct OpenAiChunkChoice {
    delta: OpenAiMessageResponse,
    #[serde(rename = "finish_reason")]
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct OpenAiModelsResponse {
    data: Vec<OpenAiModel>,
}

#[derive(Deserialize)]
struct OpenAiModel {
    id: String,
}

#[derive(Serialize)]
struct OpenAiEmbeddingRequest {
    model: String,
    input: Vec<String>,
}

#[derive(Deserialize)]
struct OpenAiEmbeddingResponse {
    data: Vec<OpenAiEmbeddingData>,
    usage: Option<UsageStats>,
}

#[derive(Deserialize)]
struct OpenAiEmbeddingData {
    embedding: Vec<f32>,
}
