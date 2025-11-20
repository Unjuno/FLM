//! Engine-related domain models
//!
//! See `docs/CORE_API.md` section 2 for the complete specification.

use super::models::{EngineCapabilities, EngineId, EngineKind, ModelId};
use serde::{Deserialize, Serialize};

/// Health status of an engine
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum HealthStatus {
    Healthy { latency_ms: u64 },
    Degraded { latency_ms: u64, reason: String },
    Unreachable { reason: String },
}

/// Engine status enumeration
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum EngineStatus {
    InstalledOnly,
    RunningHealthy {
        latency_ms: u64,
    },
    RunningDegraded {
        latency_ms: u64,
        reason: String,
    },
    ErrorNetwork {
        reason: String,
        consecutive_failures: u32,
    },
    ErrorApi {
        reason: String,
    },
}

/// Engine state information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EngineState {
    pub id: EngineId,
    pub kind: EngineKind,
    pub name: String,
    pub version: Option<String>,
    pub status: EngineStatus,
    pub capabilities: EngineCapabilities,
}

/// Model information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelInfo {
    pub engine_id: EngineId,
    pub model_id: ModelId,
    pub display_name: String,
    pub context_length: Option<u32>,
    pub supports_streaming: bool,
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
