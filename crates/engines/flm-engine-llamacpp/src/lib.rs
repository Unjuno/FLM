//! llama.cpp engine adapter
//!
//! This crate implements the `LlmEngine` trait for llama.cpp.
//! See `docs/ENGINE_DETECT.md` for detection specification.
//!
//! llama.cpp provides an OpenAI-compatible API when running in server mode,
//! so the implementation is similar to vLLM and LM Studio.

use async_trait::async_trait;
use base64::{engine::general_purpose, Engine as _};
use flm_core::domain::chat::{
    ChatMessage, ChatRequest, ChatResponse, ChatRole, ChatStreamChunk, EmbeddingRequest,
    EmbeddingResponse, EmbeddingVector, MultimodalAttachmentKind, UsageStats,
};
use flm_core::domain::engine::{HealthStatus, ModelInfo};
use flm_core::domain::models::{EngineCapabilities, EngineId, EngineKind, ModelCapabilities};
use flm_core::error::EngineError;
use flm_core::ports::LlmEngine;
use futures::Stream;
use serde::{Deserialize, Serialize};
use serde_json::Value;
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
            tools: false,         // Model-specific
            reasoning: false,     // Model-specific
            vision_inputs: false, // Model-specific
            audio_inputs: false,  // Model-specific
            audio_outputs: false,
            max_image_bytes: None,
            max_audio_bytes: None,
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
            .map(|model| {
                let model_name = &model.id;
                let capabilities = Some(ModelCapabilities {
                    reasoning: detect_reasoning_support(model_name),
                    tools: detect_tool_use_support(model_name),
                    vision: detect_vision_support(model_name),
                    audio_inputs: detect_audio_support(model_name),
                    audio_outputs: detect_audio_support(model_name),
                });

                ModelInfo {
                engine_id: self.engine_id.clone(),
                model_id: format!("flm://{}/{}", self.engine_id, model.id),
                display_name: model.id.clone(),
                context_length: None, // llama.cpp API doesn't always provide this
                supports_streaming: true,
                supports_embeddings: true,
                    capabilities,
                }
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
                .map(convert_to_openai_message)
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

        let openai_req = OpenAiChatRequest {
            model: model.to_string(),
            messages: req
                .messages
                .into_iter()
                .map(convert_to_openai_message)
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
                                                    attachments: Vec::new(),
                                                },
                                                usage: if delta.finish_reason.is_some() {
                                                    final_usage = chunk.usage.clone();
                                                    final_usage.clone()
                                                } else {
                                                    None
                                                },
                                                is_done: delta.finish_reason.is_some(),
                                                audio: Vec::new(),
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
    content: Value, // String or array of content objects
}

/// Convert ChatMessage (OpenAI-compatible format) to OpenAiMessageRequest format
///
/// This function converts the abstract ChatRequest format to OpenAI's API format.
/// Image attachments are converted to OpenAI's `image_url` format.
/// Audio attachments are converted to OpenAI's `input_audio` format.
fn convert_to_openai_message(msg: ChatMessage) -> OpenAiMessageRequest {
    let role = match msg.role {
        ChatRole::User => "user".to_string(),
        ChatRole::Assistant => "assistant".to_string(),
        ChatRole::System => "system".to_string(),
        ChatRole::Tool => "user".to_string(), // Fallback to user
    };

    // If there are no attachments, use simple string content
    if msg.attachments.is_empty() {
        return OpenAiMessageRequest {
            role,
            content: Value::String(msg.content),
        };
    }

    // Build content array with text and attachments
    let mut content_parts: Vec<Value> = Vec::new();

    // Add text content if not empty
    if !msg.content.is_empty() {
        content_parts.push(serde_json::json!({
            "type": "text",
            "text": msg.content
        }));
    }

    // Add image attachments
    for att in &msg.attachments {
        if matches!(att.kind, MultimodalAttachmentKind::InputImage) {
            let base64_data = general_purpose::STANDARD.encode(&att.data);
            let data_url = format!("data:{};base64,{}", att.mime_type, base64_data);
            content_parts.push(serde_json::json!({
                "type": "image_url",
                "image_url": {
                    "url": data_url
                }
            }));
        } else if matches!(att.kind, MultimodalAttachmentKind::InputAudio) {
            let base64_data = general_purpose::STANDARD.encode(&att.data);
            let data_url = format!("data:{};base64,{}", att.mime_type, base64_data);
            content_parts.push(serde_json::json!({
                "type": "input_audio",
                "audio_url": {
                    "url": data_url
                }
            }));
        }
    }

    OpenAiMessageRequest {
        role,
        content: Value::Array(content_parts),
    }
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

/// Detect if a model supports reasoning capabilities based on model name
fn detect_reasoning_support(model_name: &str) -> bool {
    let name = model_name.to_lowercase();
    name.contains("reasoning")
        || name.contains("o1")
        || name.contains("deepseek-r1")
        || name.contains("deepseek-r")
        || name.contains("qwen-reasoning")
        || name.contains("qwen2.5-reasoning")
        || name.contains("reason")
        || name.contains("cot")
}

/// Detect if a model supports tool use/function calling based on model name
fn detect_tool_use_support(model_name: &str) -> bool {
    let name = model_name.to_lowercase();
    name.contains("tool")
        || name.contains("function")
        || name.contains("agent")
        || name.contains("api")
        || (name.contains("mistral") && (name.contains("large") || name.contains("small")))
        || name.contains("claude")
        || name.contains("gpt-4")
        || name.contains("gpt-3.5-turbo")
}

/// Detect if a model supports vision capabilities based on model name
fn detect_vision_support(model_name: &str) -> bool {
    let name = model_name.to_lowercase();
    name.contains("vision")
        || name.contains("llava")
        || name.contains("clip")
        || name.contains("blip")
        || name.contains("multimodal")
        || (name.contains("llama") && name.contains("vision"))
}

/// Detect if a model supports audio capabilities based on model name
fn detect_audio_support(model_name: &str) -> bool {
    let name = model_name.to_lowercase();
    name.contains("whisper")
        || name.contains("audio")
        || name.contains("speech")
        || name.contains("tts")
        || name.contains("asr")
        || name.contains("transcription")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_reasoning_support() {
        // Positive cases
        assert!(detect_reasoning_support("o1"));
        assert!(detect_reasoning_support("O1")); // Case insensitive
        assert!(detect_reasoning_support("deepseek-r1"));
        assert!(detect_reasoning_support("deepseek-r"));
        assert!(detect_reasoning_support("qwen-reasoning"));
        assert!(detect_reasoning_support("qwen2.5-reasoning"));
        assert!(detect_reasoning_support("model-cot"));
        assert!(detect_reasoning_support("model-reasoning"));
        
        // Negative cases
        assert!(!detect_reasoning_support("llama2"));
        assert!(!detect_reasoning_support("gpt-3.5"));
        assert!(!detect_reasoning_support(""));
    }

    #[test]
    fn test_detect_tool_use_support() {
        // Positive cases
        assert!(detect_tool_use_support("mistral-large"));
        assert!(detect_tool_use_support("mistral-small"));
        assert!(detect_tool_use_support("gpt-4"));
        assert!(detect_tool_use_support("gpt-3.5-turbo"));
        assert!(detect_tool_use_support("claude-3"));
        assert!(detect_tool_use_support("model-tool"));
        assert!(detect_tool_use_support("model-function"));
        assert!(detect_tool_use_support("model-agent"));
        
        // Negative cases
        assert!(!detect_tool_use_support("llama2"));
        assert!(!detect_tool_use_support("mistral-tiny"));
        assert!(!detect_tool_use_support(""));
    }

    #[test]
    fn test_detect_vision_support() {
        // Positive cases
        assert!(detect_vision_support("llava"));
        assert!(detect_vision_support("LLAVA")); // Case insensitive
        assert!(detect_vision_support("clip"));
        assert!(detect_vision_support("blip"));
        assert!(detect_vision_support("vision-model"));
        assert!(detect_vision_support("llama-vision"));
        assert!(detect_vision_support("multimodal-model"));
        
        // Negative cases
        assert!(!detect_vision_support("llama2"));
        assert!(!detect_vision_support("gpt-3.5"));
        assert!(!detect_vision_support(""));
    }

    #[test]
    fn test_detect_audio_support() {
        // Positive cases
        assert!(detect_audio_support("whisper"));
        assert!(detect_audio_support("WHISPER")); // Case insensitive
        assert!(detect_audio_support("audio-model"));
        assert!(detect_audio_support("speech-model"));
        assert!(detect_audio_support("tts-model"));
        assert!(detect_audio_support("asr-model"));
        assert!(detect_audio_support("transcription-model"));
        
        // Negative cases
        assert!(!detect_audio_support("llama2"));
        assert!(!detect_audio_support("gpt-3.5"));
        assert!(!detect_audio_support(""));
    }

    #[test]
    fn test_detect_edge_cases() {
        // Edge cases for model name detection
        assert!(!detect_reasoning_support(""));
        assert!(!detect_reasoning_support("   "));
        assert!(!detect_reasoning_support("model"));
        assert!(!detect_reasoning_support("123"));
        
        // Partial matches should not trigger
        assert!(!detect_reasoning_support("model-o"));
        assert!(!detect_reasoning_support("o-model"));
        
        // Case variations
        assert!(detect_reasoning_support("O1"));
        assert!(detect_reasoning_support("O1-PREVIEW"));
        assert!(detect_reasoning_support("DEEPSEEK-R1"));
        
        // Special characters
        assert!(detect_reasoning_support("o1:latest"));
        assert!(detect_reasoning_support("o1-v2.0"));
        assert!(detect_reasoning_support("deepseek-r1:7b"));
    }

    #[test]
    fn test_detect_all_capabilities_combinations() {
        // Test models that might have multiple capabilities
        let multimodal_model = "gpt-4-vision-tool";
        assert!(detect_tool_use_support(multimodal_model));
        assert!(detect_vision_support(multimodal_model));
        
        // Test that detection is independent
        let reasoning_only = "o1";
        assert!(detect_reasoning_support(reasoning_only));
        assert!(!detect_tool_use_support(reasoning_only));
        assert!(!detect_vision_support(reasoning_only));
        assert!(!detect_audio_support(reasoning_only));
    }
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
