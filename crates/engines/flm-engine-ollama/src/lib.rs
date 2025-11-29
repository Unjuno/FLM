//! Ollama engine adapter
//!
//! This crate implements the `LlmEngine` trait for Ollama.
//! See `docs/ENGINE_DETECT.md` for detection specification.

use async_trait::async_trait;
use base64::{engine::general_purpose, Engine as _};
use flm_core::domain::chat::{
    ChatMessage, ChatRequest, ChatResponse, ChatRole, ChatStreamChunk, EmbeddingRequest,
    EmbeddingResponse, EmbeddingVector, MultimodalAttachmentKind, TranscriptionRequest,
    TranscriptionResponse, UsageStats,
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

/// Ollama engine implementation
pub struct OllamaEngine {
    engine_id: EngineId,
    base_url: String,
    client: reqwest::Client,
}

impl OllamaEngine {
    /// Create a new OllamaEngine instance
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
        format!("{}/api/{}", self.base_url, endpoint)
    }
}

#[async_trait]
impl LlmEngine for OllamaEngine {
    fn id(&self) -> EngineId {
        self.engine_id.clone()
    }

    fn kind(&self) -> EngineKind {
        EngineKind::Ollama
    }

    fn capabilities(&self) -> EngineCapabilities {
        EngineCapabilities {
            chat: true,
            chat_stream: true,
            embeddings: true,
            moderation: false,
            tools: false,        // Model-specific
            reasoning: false,    // Model-specific
            vision_inputs: true, // Model-specific
            audio_inputs: true,  // Model-specific
            audio_outputs: false,
            max_image_bytes: Some(8 * 1024 * 1024),
            max_audio_bytes: Some(25 * 1024 * 1024),
        }
    }

    async fn health_check(&self) -> Result<HealthStatus, EngineError> {
        let start = Instant::now();
        let url = self.api_url("tags");

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
        let url = self.api_url("tags");

        let response: OllamaTagsResponse = self
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
            .models
            .into_iter()
            .map(|model| ModelInfo {
                engine_id: self.engine_id.clone(),
                model_id: format!("flm://{}/{}", self.engine_id, model.name),
                display_name: model.name.clone(),
                context_length: None, // Ollama API doesn't provide this
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

        let ollama_req = OllamaChatRequest {
            model: model.to_string(),
            messages: req
                .messages
                .into_iter()
                .map(convert_to_ollama_message)
                .collect(),
            stream: false,
            options: OllamaOptions {
                temperature: req.temperature.map(|t| t as f64),
                top_p: None,
                max_tokens: req.max_tokens,
            },
        };

        let url = self.api_url("chat");
        let response: OllamaChatResponse = self
            .client
            .post(&url)
            .json(&ollama_req)
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

        Ok(ChatResponse {
            usage: UsageStats {
                prompt_tokens: response.prompt_eval_count.unwrap_or(0),
                completion_tokens: response.eval_count.unwrap_or(0),
                total_tokens: response
                    .prompt_eval_count
                    .unwrap_or(0)
                    .saturating_add(response.eval_count.unwrap_or(0)),
            },
            messages: vec![ChatMessage {
                role: ChatRole::Assistant,
                content: response.message.content,
                attachments: Vec::new(),
            }],
            audio: Vec::new(),
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

        let ollama_req = OllamaChatRequest {
            model: model.to_string(),
            messages: req
                .messages
                .into_iter()
                .map(convert_to_ollama_message)
                .collect(),
            stream: true,
            options: OllamaOptions {
                temperature: req.temperature.map(|t| t as f64),
                top_p: None,
                max_tokens: req.max_tokens,
            },
        };

        let url = self.api_url("chat");
        let client = self.client.clone();

        // Create a stream from the response
        // Use tokio::spawn to run the async operation in the background
        let stream = async_stream::stream! {
            let response = client
                .post(&url)
                .json(&ollama_req)
                .send()
                .await
                .map_err(|e| EngineError::NetworkError {
                    reason: format!("Request failed: {e}"),
                })?;

            let mut stream = response.bytes_stream();
            let mut accumulated_content = String::new();
            let mut is_done = false;

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

                        match serde_json::from_str::<OllamaChatChunk>(json_str) {
                            Ok(chunk) => {
                                accumulated_content.push_str(&chunk.message.content);
                                yield Ok(ChatStreamChunk {
                                    delta: ChatMessage {
                                        role: ChatRole::Assistant,
                                        content: chunk.message.content.clone(),
                                        attachments: Vec::new(),
                                    },
                                    usage: if chunk.done {
                                        Some(UsageStats {
                                            prompt_tokens: chunk.prompt_eval_count.unwrap_or(0),
                                            completion_tokens: chunk.eval_count.unwrap_or(0),
                                            total_tokens: chunk
                                                .prompt_eval_count
                                                .unwrap_or(0)
                                                .saturating_add(chunk.eval_count.unwrap_or(0)),
                                        })
                                    } else {
                                        None
                                    },
                                    is_done: chunk.done,
                                    audio: Vec::new(),
                                });

                                if chunk.done {
                                    is_done = true;
                                    break;
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

        // Ollama embeddings API only supports single input
        if req.input.len() != 1 {
            return Err(EngineError::InvalidResponse {
                reason: "Ollama embeddings API only supports single input".to_string(),
            });
        }

        let ollama_req = OllamaEmbeddingRequest {
            model: model.to_string(),
            prompt: req.input[0].clone(),
        };

        let url = self.api_url("embeddings");
        let response: OllamaEmbeddingResponse = self
            .client
            .post(&url)
            .json(&ollama_req)
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
            usage: UsageStats {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            vectors: vec![EmbeddingVector {
                index: 0,
                values: response.embedding,
            }],
        })
    }

    async fn transcribe_audio(
        &self,
        req: TranscriptionRequest,
    ) -> Result<TranscriptionResponse, EngineError> {
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

        // Check if model name contains "whisper" (case-insensitive)
        let model_lower = model.to_lowercase();
        if !model_lower.contains("whisper") {
            return Err(EngineError::UnsupportedOperation {
                operation: "transcribe_audio".to_string(),
                reason: format!(
                    "Model '{model}' is not a Whisper model. Only Whisper models support audio transcription."
                ),
            });
        }

        // Ollama's /api/generate endpoint can be used for Whisper transcription
        // We need to send the audio file as Base64-encoded data
        // Note: Ollama may require the audio to be sent as a prompt with Base64 data
        // or via a file upload mechanism. This implementation uses Base64 encoding.

        // Encode audio data to Base64
        let audio_base64 = general_purpose::STANDARD.encode(&req.audio_data);

        // Create a prompt that includes the audio data
        // Note: This is a workaround until Ollama supports direct audio file uploads
        // The actual format may vary depending on Ollama's API specification
        let prompt = if let Some(ref prompt_text) = req.prompt {
            format!("{prompt_text} [AUDIO_DATA:{audio_base64}]")
        } else {
            format!("[AUDIO_DATA:{audio_base64}]")
        };

        // Use /api/generate endpoint for transcription
        // Note: Ollama's actual API for Whisper may differ. This is a placeholder implementation.
        let ollama_req = OllamaGenerateRequest {
            model: model.to_string(),
            prompt,
            stream: false,
            options: OllamaOptions {
                temperature: req.temperature,
                top_p: None,
                max_tokens: None,
            },
        };

        let url = self.api_url("generate");
        let response: OllamaGenerateResponse = self
            .client
            .post(&url)
            .json(&ollama_req)
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

        Ok(TranscriptionResponse {
            text: response.response,
            language: req.language,
        })
    }
}

// Ollama API request/response types

#[derive(Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Serialize, Deserialize)]
struct OllamaMessage {
    role: String,
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    images: Option<Vec<String>>,
}

/// Convert ChatMessage (OpenAI-compatible format) to OllamaMessage format
///
/// This function converts the abstract ChatRequest format to Ollama's specific API format.
/// Image attachments are converted to Base64 strings for Ollama's `images` field.
/// Audio attachments are not supported by Ollama API and will be ignored.
fn convert_to_ollama_message(msg: ChatMessage) -> OllamaMessage {
    let role = match msg.role {
        ChatRole::User => "user".to_string(),
        ChatRole::Assistant => "assistant".to_string(),
        ChatRole::System => "system".to_string(),
        ChatRole::Tool => "user".to_string(), // Fallback to user
    };

    // Extract image attachments and convert to Base64 strings for Ollama's images field
    let images: Vec<String> = msg
        .attachments
        .iter()
        .filter_map(|att| {
            if matches!(att.kind, MultimodalAttachmentKind::InputImage) {
                // Convert image data to Base64 (Ollama expects Base64-encoded images)
                Some(general_purpose::STANDARD.encode(&att.data))
            } else {
                // Audio attachments are not supported by Ollama API
                None
            }
        })
        .collect();

    OllamaMessage {
        role,
        content: msg.content,
        images: if images.is_empty() {
            None
        } else {
            Some(images)
        },
    }
}

#[derive(Serialize)]
struct OllamaOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
    message: OllamaMessage,
    #[allow(dead_code)] // Used for validation but not in response construction
    done: bool,
    #[serde(rename = "prompt_eval_count")]
    prompt_eval_count: Option<u32>,
    #[serde(rename = "eval_count")]
    eval_count: Option<u32>,
}

#[derive(Deserialize)]
struct OllamaChatChunk {
    message: OllamaMessage,
    done: bool,
    #[serde(rename = "prompt_eval_count")]
    prompt_eval_count: Option<u32>,
    #[serde(rename = "eval_count")]
    eval_count: Option<u32>,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Serialize)]
struct OllamaEmbeddingRequest {
    model: String,
    prompt: String,
}

#[derive(Deserialize)]
struct OllamaEmbeddingResponse {
    embedding: Vec<f32>,
}

#[derive(Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Deserialize)]
struct OllamaGenerateResponse {
    response: String,
    #[allow(dead_code)]
    done: bool,
}
