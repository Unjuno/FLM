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
