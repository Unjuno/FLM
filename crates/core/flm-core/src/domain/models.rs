//! Core domain models
//!
//! These types are the foundation of the FLM domain layer.
//! All types must match the specification in `docs/CORE_API.md` section 2.

use serde::{Deserialize, Serialize};

/// Engine identifier
///
/// Unique identifier for an LLM engine instance.
/// Format: arbitrary string (e.g., "ollama", "vllm-local").
pub type EngineId = String;

/// Model identifier (normalized as `flm://{engine_id}/{model_name}`)
///
/// Normalized model identifier used throughout the system.
/// Format: `flm://{engine_id}/{model_name}` (e.g., "flm://ollama/llama2:latest").
pub type ModelId = String;

/// Engine kind enumeration
///
/// Supported LLM engine types.
/// Each variant corresponds to an engine adapter crate (e.g., `flm-engine-ollama`).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EngineKind {
    /// Ollama engine
    Ollama,
    /// vLLM engine
    Vllm,
    /// LM Studio engine
    LmStudio,
    /// llama.cpp engine
    LlamaCpp,
}

/// Engine capabilities
///
/// Defines which features an engine supports.
/// Returned by `LlmEngine::capabilities()`.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct EngineCapabilities {
    /// Whether the engine supports non-streaming chat
    pub chat: bool,
    /// Whether the engine supports streaming chat
    pub chat_stream: bool,
    /// Whether the engine supports embeddings
    pub embeddings: bool,
    /// Whether the engine supports content moderation
    pub moderation: bool,
    /// Whether the engine supports function/tool calling
    pub tools: bool,
    /// Whether the engine supports reasoning capabilities (chain-of-thought, step-by-step reasoning)
    pub reasoning: bool,
    /// Whether the engine accepts vision inputs (images in chat/responses API)
    pub vision_inputs: bool,
    /// Whether the engine accepts audio inputs (transcriptions / audio content)
    pub audio_inputs: bool,
    /// Whether the engine can emit audio outputs (Responses/audio.speech)
    pub audio_outputs: bool,
    /// Maximum image payload size accepted by the engine (bytes)
    pub max_image_bytes: Option<u64>,
    /// Maximum audio payload size accepted by the engine (bytes)
    pub max_audio_bytes: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_kind_serialization() {
        let kinds = vec![
            EngineKind::Ollama,
            EngineKind::Vllm,
            EngineKind::LmStudio,
            EngineKind::LlamaCpp,
        ];

        for kind in kinds {
            let json = serde_json::to_string(&kind).unwrap();
            let deserialized: EngineKind = serde_json::from_str(&json).unwrap();
            assert_eq!(kind, deserialized);
        }
    }

    #[test]
    fn test_engine_capabilities_default() {
        let caps = EngineCapabilities::default();
        assert!(!caps.chat);
        assert!(!caps.chat_stream);
        assert!(!caps.embeddings);
        assert!(!caps.moderation);
        assert!(!caps.tools);
        assert!(!caps.reasoning);
        assert!(!caps.vision_inputs);
        assert!(!caps.audio_inputs);
        assert!(!caps.audio_outputs);
        assert!(caps.max_image_bytes.is_none());
        assert!(caps.max_audio_bytes.is_none());
    }

    #[test]
    fn test_engine_capabilities_serialization() {
        let mut caps = EngineCapabilities::default();
        caps.chat = true;
        caps.chat_stream = true;
        caps.embeddings = true;
        caps.max_image_bytes = Some(10_000_000);
        caps.max_audio_bytes = Some(5_000_000);

        let json = serde_json::to_string(&caps).unwrap();
        let deserialized: EngineCapabilities = serde_json::from_str(&json).unwrap();
        assert_eq!(caps.chat, deserialized.chat);
        assert_eq!(caps.chat_stream, deserialized.chat_stream);
        assert_eq!(caps.embeddings, deserialized.embeddings);
        assert_eq!(caps.max_image_bytes, deserialized.max_image_bytes);
        assert_eq!(caps.max_audio_bytes, deserialized.max_audio_bytes);
    }

    #[test]
    fn test_engine_capabilities_all_features() {
        let caps = EngineCapabilities {
            chat: true,
            chat_stream: true,
            embeddings: true,
            moderation: true,
            tools: true,
            reasoning: true,
            vision_inputs: true,
            audio_inputs: true,
            audio_outputs: true,
            max_image_bytes: Some(20_000_000),
            max_audio_bytes: Some(10_000_000),
        };

        let json = serde_json::to_string(&caps).unwrap();
        let deserialized: EngineCapabilities = serde_json::from_str(&json).unwrap();
        assert!(deserialized.chat);
        assert!(deserialized.chat_stream);
        assert!(deserialized.embeddings);
        assert!(deserialized.moderation);
        assert!(deserialized.tools);
        assert!(deserialized.reasoning);
        assert!(deserialized.vision_inputs);
        assert!(deserialized.audio_inputs);
        assert!(deserialized.audio_outputs);
        assert_eq!(deserialized.max_image_bytes, Some(20_000_000));
        assert_eq!(deserialized.max_audio_bytes, Some(10_000_000));
    }
}
