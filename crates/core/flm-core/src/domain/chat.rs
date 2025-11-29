//! Chat-related domain models
//!
//! See `docs/CORE_API.md` section 2 for the complete specification.

use super::models::{EngineId, ModelId};
use serde::{Deserialize, Serialize};

/// Chat message role
///
/// Defines the role of a message in a chat conversation.
/// Used in `ChatMessage` to indicate the sender's role.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    /// System message (instructions, context)
    System,
    /// User message
    User,
    /// Assistant response
    Assistant,
    /// Tool/function call result
    Tool,
}

/// Chat message
///
/// Represents a single message in a chat conversation.
/// Used in `ChatRequest` and `ChatResponse`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    /// Message role (system, user, assistant, tool)
    pub role: ChatRole,
    /// Message content
    pub content: String,
    /// Optional multimodal attachments associated with this message
    #[serde(default)]
    pub attachments: Vec<MultimodalAttachment>,
}

/// Multimodal attachment kind
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MultimodalAttachmentKind {
    /// Image input (Vision)
    InputImage,
    /// Audio input (transcription / multimodal chat)
    InputAudio,
}

/// Multimodal attachment payload
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MultimodalAttachment {
    /// Attachment kind
    pub kind: MultimodalAttachmentKind,
    /// Raw bytes (already decoded)
    pub data: Vec<u8>,
    /// MIME type (e.g., image/png, audio/wav)
    pub mime_type: String,
    /// Optional filename for logging/debug
    pub filename: Option<String>,
    /// Optional size hint in bytes
    pub size_bytes: Option<u64>,
    /// Vision detail (low/high) or other hint
    pub detail: Option<String>,
    /// Optional audio duration in milliseconds
    pub duration_ms: Option<u32>,
}

impl MultimodalAttachment {
    /// Convenience constructor for image attachments
    pub fn image(data: Vec<u8>, mime_type: String) -> Self {
        let size_bytes = Some(data.len() as u64);
        Self {
            kind: MultimodalAttachmentKind::InputImage,
            data,
            mime_type,
            filename: None,
            size_bytes,
            detail: None,
            duration_ms: None,
        }
    }
}

/// Chat request
///
/// Request to generate a chat completion.
/// Used by `LlmEngine::chat()` and `LlmEngine::chat_stream()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    /// Target engine ID
    pub engine_id: EngineId,
    /// Model identifier (normalized as `flm://{engine_id}/{model_name}`)
    pub model_id: ModelId,
    /// Conversation messages
    pub messages: Vec<ChatMessage>,
    /// Whether to stream the response
    pub stream: bool,
    /// Sampling temperature (0.0-2.0, higher = more creative)
    pub temperature: Option<f32>,
    /// Maximum tokens to generate
    pub max_tokens: Option<u32>,
    /// Stop sequences
    pub stop: Vec<String>,
    /// Requested output modalities (text default, audio optional)
    #[serde(default)]
    pub requested_modalities: Vec<ResponseModality>,
}

/// Requested response modality
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResponseModality {
    /// Default text output
    #[default]
    Text,
    /// Audio response
    Audio {
        /// Desired output format
        format: AudioResponseFormat,
        /// Preferred voice or speaker label
        voice: Option<String>,
    },
}

/// Audio response format options
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AudioResponseFormat {
    Wav,
    Mp3,
    Ogg,
    Flac,
}

/// Usage statistics
///
/// Token usage information for a chat completion or embedding request.
/// Included in `ChatResponse`, `EmbeddingResponse`, and `ChatStreamChunk`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UsageStats {
    /// Number of tokens in the prompt
    pub prompt_tokens: u32,
    /// Number of tokens in the completion
    pub completion_tokens: u32,
    /// Total tokens used
    pub total_tokens: u32,
}

/// Chat response
///
/// Non-streaming chat completion response.
/// Returned by `LlmEngine::chat()` and `EngineService::chat()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    /// Token usage statistics
    pub usage: UsageStats,
    /// Generated messages (typically one assistant message)
    pub messages: Vec<ChatMessage>,
    /// Optional audio outputs (Responses API)
    #[serde(default)]
    pub audio: Vec<AudioResponseChunk>,
}

/// Chat stream chunk
///
/// Incremental update in a streaming chat completion.
/// Emitted by `LlmEngine::chat_stream()` stream.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatStreamChunk {
    /// Message delta (incremental content)
    pub delta: ChatMessage,
    /// Usage statistics (present in final chunk)
    pub usage: Option<UsageStats>,
    /// Whether this is the final chunk
    pub is_done: bool,
    /// Optional audio output emitted during streaming
    #[serde(default)]
    pub audio: Vec<AudioResponseChunk>,
}

/// Audio response chunk (non-streaming or streaming)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AudioResponseChunk {
    /// Audio format
    pub format: AudioResponseFormat,
    /// Raw bytes
    pub data: Vec<u8>,
    /// Optional transcript
    pub transcript: Option<String>,
}

/// Embedding request
///
/// Request to generate embeddings for text input(s).
/// Used by `LlmEngine::embeddings()` and `EngineService::embeddings()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    /// Target engine ID
    pub engine_id: EngineId,
    /// Model identifier (normalized as `flm://{engine_id}/{model_name}`)
    pub model_id: ModelId,
    /// Input texts (OpenAI-compatible: supports single item as array)
    pub input: Vec<String>,
}

/// Embedding vector
///
/// A single embedding vector with its index.
/// Part of `EmbeddingResponse` for multi-input requests.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingVector {
    /// Index in the input array
    pub index: usize,
    /// Embedding values (floating-point vector)
    pub values: Vec<f32>,
}

/// Embedding response
///
/// Response containing embedding vectors for input texts.
/// Returned by `LlmEngine::embeddings()` and `EngineService::embeddings()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    /// Token usage statistics
    pub usage: UsageStats,
    /// Generated embedding vectors (one per input)
    pub vectors: Vec<EmbeddingVector>,
}

/// Transcription request
///
/// Request to transcribe audio to text.
/// Used by `LlmEngine::transcribe_audio()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TranscriptionRequest {
    /// Target engine ID
    pub engine_id: EngineId,
    /// Model identifier (normalized as `flm://{engine_id}/{model_name}`)
    pub model_id: ModelId,
    /// Audio file data (raw bytes)
    pub audio_data: Vec<u8>,
    /// Audio MIME type (e.g., "audio/wav", "audio/mp3")
    pub mime_type: String,
    /// Optional language code (e.g., "en", "ja")
    pub language: Option<String>,
    /// Optional temperature for transcription (0.0-1.0)
    pub temperature: Option<f64>,
    /// Optional prompt to guide transcription
    pub prompt: Option<String>,
}

/// Transcription response
///
/// Response containing transcribed text from audio.
/// Returned by `LlmEngine::transcribe_audio()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TranscriptionResponse {
    /// Transcribed text
    pub text: String,
    /// Optional language detected
    pub language: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chat_role_serialization() {
        let roles = vec![
            ChatRole::System,
            ChatRole::User,
            ChatRole::Assistant,
            ChatRole::Tool,
        ];

        for role in roles {
            let json = serde_json::to_string(&role).unwrap();
            let deserialized: ChatRole = serde_json::from_str(&json).unwrap();
            assert_eq!(role, deserialized);
        }
    }

    #[test]
    fn test_chat_message_serialization() {
        let message = ChatMessage {
            role: ChatRole::User,
            content: "Hello, world!".to_string(),
            attachments: Vec::new(),
        };

        let json = serde_json::to_string(&message).unwrap();
        let deserialized: ChatMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(message.role, deserialized.role);
        assert_eq!(message.content, deserialized.content);
        assert_eq!(message.attachments.len(), deserialized.attachments.len());
    }

    #[test]
    fn test_chat_message_with_attachments() {
        let attachment = MultimodalAttachment::image(vec![1, 2, 3, 4], "image/png".to_string());
        let message = ChatMessage {
            role: ChatRole::User,
            content: "Look at this image".to_string(),
            attachments: vec![attachment.clone()],
        };

        let json = serde_json::to_string(&message).unwrap();
        let deserialized: ChatMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(message.attachments.len(), deserialized.attachments.len());
        assert_eq!(
            message.attachments[0].kind,
            deserialized.attachments[0].kind
        );
    }

    #[test]
    fn test_multimodal_attachment_image() {
        let data = vec![1, 2, 3, 4, 5];
        let attachment = MultimodalAttachment::image(data.clone(), "image/png".to_string());

        assert_eq!(attachment.kind, MultimodalAttachmentKind::InputImage);
        assert_eq!(attachment.data, data);
        assert_eq!(attachment.mime_type, "image/png");
        assert_eq!(attachment.size_bytes, Some(data.len() as u64));
    }

    #[test]
    fn test_multimodal_attachment_serialization() {
        let attachment = MultimodalAttachment {
            kind: MultimodalAttachmentKind::InputAudio,
            data: vec![1, 2, 3],
            mime_type: "audio/wav".to_string(),
            filename: Some("test.wav".to_string()),
            size_bytes: Some(3),
            detail: None,
            duration_ms: Some(1000),
        };

        let json = serde_json::to_string(&attachment).unwrap();
        let deserialized: MultimodalAttachment = serde_json::from_str(&json).unwrap();
        assert_eq!(attachment.kind, deserialized.kind);
        assert_eq!(attachment.data, deserialized.data);
        assert_eq!(attachment.mime_type, deserialized.mime_type);
        assert_eq!(attachment.filename, deserialized.filename);
        assert_eq!(attachment.duration_ms, deserialized.duration_ms);
    }

    #[test]
    fn test_chat_request_serialization() {
        let request = ChatRequest {
            engine_id: "ollama".to_string(),
            model_id: "flm://ollama/llama2:latest".to_string(),
            messages: vec![ChatMessage {
                role: ChatRole::User,
                content: "Hello".to_string(),
                attachments: Vec::new(),
            }],
            stream: false,
            temperature: Some(0.7),
            max_tokens: Some(100),
            stop: Vec::new(),
            requested_modalities: Vec::new(),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: ChatRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(request.engine_id, deserialized.engine_id);
        assert_eq!(request.model_id, deserialized.model_id);
        assert_eq!(request.stream, deserialized.stream);
        assert_eq!(request.temperature, deserialized.temperature);
    }

    #[test]
    fn test_response_modality_serialization() {
        let text = ResponseModality::Text;
        let json = serde_json::to_string(&text).unwrap();
        assert_eq!(json, r#"{"type":"text"}"#);

        let audio = ResponseModality::Audio {
            format: AudioResponseFormat::Mp3,
            voice: Some("alloy".to_string()),
        };
        let json = serde_json::to_string(&audio).unwrap();
        assert!(json.contains("audio"));
        assert!(json.contains("mp3"));
    }

    #[test]
    fn test_audio_response_format_serialization() {
        let formats = vec![
            AudioResponseFormat::Wav,
            AudioResponseFormat::Mp3,
            AudioResponseFormat::Ogg,
            AudioResponseFormat::Flac,
        ];

        for format in formats {
            let json = serde_json::to_string(&format).unwrap();
            let deserialized: AudioResponseFormat = serde_json::from_str(&json).unwrap();
            // Compare by serializing again since we can't derive PartialEq
            assert_eq!(json, serde_json::to_string(&deserialized).unwrap());
        }
    }

    #[test]
    fn test_usage_stats_serialization() {
        let usage = UsageStats {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
        };

        let json = serde_json::to_string(&usage).unwrap();
        let deserialized: UsageStats = serde_json::from_str(&json).unwrap();
        assert_eq!(usage.prompt_tokens, deserialized.prompt_tokens);
        assert_eq!(usage.completion_tokens, deserialized.completion_tokens);
        assert_eq!(usage.total_tokens, deserialized.total_tokens);
    }

    #[test]
    fn test_chat_response_serialization() {
        let response = ChatResponse {
            usage: UsageStats {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
            messages: vec![ChatMessage {
                role: ChatRole::Assistant,
                content: "Hello!".to_string(),
                attachments: Vec::new(),
            }],
            audio: Vec::new(),
        };

        let json = serde_json::to_string(&response).unwrap();
        let deserialized: ChatResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(response.usage.total_tokens, deserialized.usage.total_tokens);
        assert_eq!(response.messages.len(), deserialized.messages.len());
    }

    #[test]
    fn test_chat_stream_chunk_serialization() {
        let chunk = ChatStreamChunk {
            delta: ChatMessage {
                role: ChatRole::Assistant,
                content: "Hello".to_string(),
                attachments: Vec::new(),
            },
            usage: Some(UsageStats {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            }),
            is_done: false,
            audio: Vec::new(),
        };

        let json = serde_json::to_string(&chunk).unwrap();
        let deserialized: ChatStreamChunk = serde_json::from_str(&json).unwrap();
        assert_eq!(chunk.is_done, deserialized.is_done);
        assert!(deserialized.usage.is_some());
    }

    #[test]
    fn test_audio_response_chunk_serialization() {
        let chunk = AudioResponseChunk {
            format: AudioResponseFormat::Mp3,
            data: vec![1, 2, 3, 4],
            transcript: Some("Hello".to_string()),
        };

        let json = serde_json::to_string(&chunk).unwrap();
        let deserialized: AudioResponseChunk = serde_json::from_str(&json).unwrap();
        assert_eq!(chunk.data, deserialized.data);
        assert_eq!(chunk.transcript, deserialized.transcript);
    }

    #[test]
    fn test_embedding_request_serialization() {
        let request = EmbeddingRequest {
            engine_id: "ollama".to_string(),
            model_id: "flm://ollama/nomic-embed".to_string(),
            input: vec!["Hello".to_string(), "World".to_string()],
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: EmbeddingRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(request.engine_id, deserialized.engine_id);
        assert_eq!(request.input.len(), deserialized.input.len());
    }

    #[test]
    fn test_embedding_vector_serialization() {
        let vector = EmbeddingVector {
            index: 0,
            values: vec![0.1, 0.2, 0.3],
        };

        let json = serde_json::to_string(&vector).unwrap();
        let deserialized: EmbeddingVector = serde_json::from_str(&json).unwrap();
        assert_eq!(vector.index, deserialized.index);
        assert_eq!(vector.values, deserialized.values);
    }

    #[test]
    fn test_embedding_response_serialization() {
        let response = EmbeddingResponse {
            usage: UsageStats {
                prompt_tokens: 5,
                completion_tokens: 0,
                total_tokens: 5,
            },
            vectors: vec![EmbeddingVector {
                index: 0,
                values: vec![0.1, 0.2],
            }],
        };

        let json = serde_json::to_string(&response).unwrap();
        let deserialized: EmbeddingResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(response.vectors.len(), deserialized.vectors.len());
    }

    #[test]
    fn test_transcription_request_serialization() {
        let request = TranscriptionRequest {
            engine_id: "ollama".to_string(),
            model_id: "flm://ollama/whisper".to_string(),
            audio_data: vec![1, 2, 3, 4],
            mime_type: "audio/wav".to_string(),
            language: Some("en".to_string()),
            temperature: Some(0.0),
            prompt: Some("Hello".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: TranscriptionRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(request.engine_id, deserialized.engine_id);
        assert_eq!(request.mime_type, deserialized.mime_type);
        assert_eq!(request.language, deserialized.language);
    }

    #[test]
    fn test_transcription_response_serialization() {
        let response = TranscriptionResponse {
            text: "Hello, world!".to_string(),
            language: Some("en".to_string()),
        };

        let json = serde_json::to_string(&response).unwrap();
        let deserialized: TranscriptionResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(response.text, deserialized.text);
        assert_eq!(response.language, deserialized.language);
    }
}
