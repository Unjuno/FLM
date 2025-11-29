//! Engine-related domain models
//!
//! See `docs/CORE_API.md` section 2 for the complete specification.

use super::models::{EngineCapabilities, EngineId, EngineKind, ModelId};
use serde::{Deserialize, Serialize};

/// Health status of an engine
///
/// Represents the current health state of an LLM engine instance.
/// Used by `LlmEngine::health_check()` to report engine availability and performance.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum HealthStatus {
    /// Engine is healthy and responding within acceptable latency
    Healthy { latency_ms: u64 },
    /// Engine is responding but with degraded performance
    Degraded { latency_ms: u64, reason: String },
    /// Engine is not reachable or not responding
    Unreachable { reason: String },
}

/// Engine status enumeration
///
/// Represents the operational state of an engine instance.
/// Used in `EngineState` to track engine lifecycle and health.
/// See `docs/CORE_API.md` section 2 for state transition rules.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum EngineStatus {
    /// Engine binary is installed but not running
    InstalledOnly,
    /// Engine is running and healthy
    RunningHealthy { latency_ms: u64 },
    /// Engine is running but with degraded performance
    RunningDegraded { latency_ms: u64, reason: String },
    /// Engine is experiencing network errors
    ErrorNetwork {
        reason: String,
        consecutive_failures: u32,
    },
    /// Engine is experiencing API errors
    ErrorApi { reason: String },
}

impl EngineStatus {
    /// Check if the engine is running (healthy or degraded)
    pub fn is_running(&self) -> bool {
        matches!(
            self,
            EngineStatus::RunningHealthy { .. } | EngineStatus::RunningDegraded { .. }
        )
    }
}

/// Engine state information
///
/// Complete state snapshot of an LLM engine instance.
/// Returned by `EngineService::detect_engines()` and cached in `engines_cache` table.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EngineState {
    /// Unique engine identifier
    pub id: EngineId,
    /// Engine type (Ollama, vLLM, etc.)
    pub kind: EngineKind,
    /// Human-readable engine name
    pub name: String,
    /// Engine version (if available)
    pub version: Option<String>,
    /// Current operational status
    pub status: EngineStatus,
    /// Supported capabilities
    pub capabilities: EngineCapabilities,
}

/// Model information
///
/// Represents a model available on an engine.
/// Returned by `LlmEngine::list_models()` and `EngineService::list_models()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelInfo {
    /// Engine that hosts this model
    pub engine_id: EngineId,
    /// Model identifier (normalized as `flm://{engine_id}/{model_name}`)
    pub model_id: ModelId,
    /// Human-readable model name
    pub display_name: String,
    /// Maximum context length in tokens (if known)
    pub context_length: Option<u32>,
    /// Whether the model supports streaming responses
    pub supports_streaming: bool,
    /// Whether the model supports embeddings
    pub supports_embeddings: bool,
}

/// Engine binary information (for process detection)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EngineBinaryInfo {
    pub engine_id: EngineId,
    pub kind: EngineKind,
    pub binary_path: String,
    pub version: Option<String>,
}

/// Engine runtime information (for API detection)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EngineRuntimeInfo {
    pub engine_id: EngineId,
    pub kind: EngineKind,
    pub base_url: String,
    pub port: Option<u16>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_status_is_running() {
        assert!(!EngineStatus::InstalledOnly.is_running());
        assert!(EngineStatus::RunningHealthy { latency_ms: 100 }.is_running());
        assert!(EngineStatus::RunningDegraded {
            latency_ms: 500,
            reason: "slow".to_string()
        }
        .is_running());
        assert!(!EngineStatus::ErrorNetwork {
            reason: "connection failed".to_string(),
            consecutive_failures: 3
        }
        .is_running());
        assert!(!EngineStatus::ErrorApi {
            reason: "invalid response".to_string()
        }
        .is_running());
    }

    #[test]
    fn test_engine_status_serialization() {
        let status = EngineStatus::RunningHealthy { latency_ms: 100 };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("running-healthy"));
        assert!(json.contains("100"));

        let deserialized: EngineStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(status, deserialized);
    }

    #[test]
    fn test_health_status_serialization() {
        let healthy = HealthStatus::Healthy { latency_ms: 50 };
        let json = serde_json::to_string(&healthy).unwrap();
        assert!(json.contains("healthy"));
        assert!(json.contains("50"));

        let degraded = HealthStatus::Degraded {
            latency_ms: 200,
            reason: "high load".to_string(),
        };
        let json = serde_json::to_string(&degraded).unwrap();
        assert!(json.contains("degraded"));
        assert!(json.contains("high load"));

        let unreachable = HealthStatus::Unreachable {
            reason: "connection timeout".to_string(),
        };
        let json = serde_json::to_string(&unreachable).unwrap();
        assert!(json.contains("unreachable"));
        assert!(json.contains("connection timeout"));
    }

    #[test]
    fn test_engine_state_serialization() {
        let state = EngineState {
            id: "test-engine".to_string(),
            kind: EngineKind::Ollama,
            name: "Test Engine".to_string(),
            version: Some("1.0.0".to_string()),
            status: EngineStatus::RunningHealthy { latency_ms: 100 },
            capabilities: EngineCapabilities::default(),
        };

        let json = serde_json::to_string(&state).unwrap();
        let deserialized: EngineState = serde_json::from_str(&json).unwrap();
        assert_eq!(state.id, deserialized.id);
        assert_eq!(state.kind, deserialized.kind);
        assert_eq!(state.name, deserialized.name);
        assert_eq!(state.version, deserialized.version);
    }

    #[test]
    fn test_model_info_serialization() {
        let model = ModelInfo {
            engine_id: "ollama".to_string(),
            model_id: "flm://ollama/llama2:latest".to_string(),
            display_name: "Llama 2".to_string(),
            context_length: Some(4096),
            supports_streaming: true,
            supports_embeddings: false,
        };

        let json = serde_json::to_string(&model).unwrap();
        let deserialized: ModelInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(model.engine_id, deserialized.engine_id);
        assert_eq!(model.model_id, deserialized.model_id);
        assert_eq!(model.display_name, deserialized.display_name);
        assert_eq!(model.context_length, deserialized.context_length);
        assert_eq!(model.supports_streaming, deserialized.supports_streaming);
        assert_eq!(model.supports_embeddings, deserialized.supports_embeddings);
    }

    #[test]
    fn test_engine_binary_info_serialization() {
        let info = EngineBinaryInfo {
            engine_id: "ollama".to_string(),
            kind: EngineKind::Ollama,
            binary_path: "/usr/bin/ollama".to_string(),
            version: Some("0.1.0".to_string()),
        };

        let json = serde_json::to_string(&info).unwrap();
        let deserialized: EngineBinaryInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(info.engine_id, deserialized.engine_id);
        assert_eq!(info.kind, deserialized.kind);
        assert_eq!(info.binary_path, deserialized.binary_path);
        assert_eq!(info.version, deserialized.version);
    }

    #[test]
    fn test_engine_runtime_info_serialization() {
        let info = EngineRuntimeInfo {
            engine_id: "vllm-local".to_string(),
            kind: EngineKind::Vllm,
            base_url: "http://localhost:8000".to_string(),
            port: Some(8000),
        };

        let json = serde_json::to_string(&info).unwrap();
        let deserialized: EngineRuntimeInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(info.engine_id, deserialized.engine_id);
        assert_eq!(info.kind, deserialized.kind);
        assert_eq!(info.base_url, deserialized.base_url);
        assert_eq!(info.port, deserialized.port);
    }
}
