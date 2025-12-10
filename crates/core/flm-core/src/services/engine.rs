//! Engine service
//!
//! See `docs/CORE_API.md` section 5 for the complete specification.

use crate::domain::chat::{
    ChatRequest, ChatResponse, ChatStreamChunk, EmbeddingRequest, EmbeddingResponse,
};
use crate::domain::engine::{
    EngineBinaryInfo, EngineRuntimeInfo, EngineState, EngineStatus, HealthStatus, ModelInfo,
};
use crate::domain::models::{EngineCapabilities, EngineId, EngineKind};
use crate::error::EngineError;
use crate::ports::{
    EngineHealthLogRepository, EngineProcessController, EngineRepository, HttpClient,
};
use futures::Stream;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Instant;

fn default_ollama_base_url() -> String {
    std::env::var("OLLAMA_BASE_URL").unwrap_or_else(|_| "http://localhost:11434".to_string())
}

fn join_api_url(base_url: &str, path: &str) -> String {
    let base = base_url.trim_end_matches('/');
    if path.starts_with('/') {
        format!("{base}{path}")
    } else {
        format!("{base}/{path}")
    }
}

/// Type alias for chat stream
pub type ChatStream = Pin<Box<dyn Stream<Item = Result<ChatStreamChunk, EngineError>> + Send>>;

/// Engine service
///
/// This service coordinates engine detection, model listing, and chat operations.
pub struct EngineService {
    process_controller: Box<dyn EngineProcessController + Send + Sync>,
    http_client: Box<dyn HttpClient + Send + Sync>,
    engine_repo: Box<dyn EngineRepository + Send + Sync>,
    health_log_repo: Option<Arc<dyn EngineHealthLogRepository + Send + Sync>>,
}

impl EngineService {
    /// Create a new EngineService
    #[allow(clippy::new_without_default)]
    pub fn new(
        process_controller: Box<dyn EngineProcessController + Send + Sync>,
        http_client: Box<dyn HttpClient + Send + Sync>,
        engine_repo: Box<dyn EngineRepository + Send + Sync>,
    ) -> Self {
        Self {
            process_controller,
            http_client,
            engine_repo,
            health_log_repo: None,
        }
    }

    /// Create a new EngineService with health log repository
    pub fn with_health_log_repo(
        process_controller: Box<dyn EngineProcessController + Send + Sync>,
        http_client: Box<dyn HttpClient + Send + Sync>,
        engine_repo: Box<dyn EngineRepository + Send + Sync>,
        health_log_repo: Arc<dyn EngineHealthLogRepository + Send + Sync>,
    ) -> Self {
        Self {
            process_controller,
            http_client,
            engine_repo,
            health_log_repo: Some(health_log_repo),
        }
    }

    /// Detect all available engines
    ///
    /// This method follows the detection steps in ENGINE_DETECT.md:
    /// 1. Binary/process detection
    /// 2. API ping
    /// 3. Health check with latency measurement
    pub async fn detect_engines(&self) -> Result<Vec<EngineState>, EngineError> {
        let mut states = Vec::new();

        // Step 1: Detect binaries
        let binaries = self.process_controller.detect_binaries();
        for binary in binaries {
            // For binaries, try to detect if they're running via API
            let state = self.detect_engine_from_binary(&binary).await?;
            states.push(state);
        }

        // Step 2: Detect running engines (HTTP servers)
        let runtimes = self.process_controller.detect_running();
        for runtime in runtimes {
            // Check if we already have a state for this engine
            if !states.iter().any(|s| s.id == runtime.engine_id) {
                let state = self.detect_engine_from_runtime(&runtime).await?;
                states.push(state);
            }
        }

        // Step 3: Record health logs if repository is available
        if let Some(health_log_repo) = &self.health_log_repo {
            for state in &states {
                let health_status = match &state.status {
                    EngineStatus::RunningHealthy { latency_ms } => HealthStatus::Healthy {
                        latency_ms: *latency_ms,
                    },
                    EngineStatus::RunningDegraded { latency_ms, reason } => {
                        HealthStatus::Degraded {
                            latency_ms: *latency_ms,
                            reason: reason.clone(),
                        }
                    }
                    EngineStatus::ErrorNetwork { reason, .. }
                    | EngineStatus::ErrorApi { reason } => HealthStatus::Unreachable {
                        reason: reason.clone(),
                    },
                    EngineStatus::InstalledOnly => HealthStatus::Unreachable {
                        reason: "Engine binary detected but not running".to_string(),
                    },
                };

                let error_rate = match &state.status {
                    EngineStatus::RunningHealthy { .. } => 0.0,
                    EngineStatus::RunningDegraded { .. } => 0.1,
                    EngineStatus::ErrorNetwork { .. } | EngineStatus::ErrorApi { .. } => 1.0,
                    EngineStatus::InstalledOnly => 0.0,
                };

                if let Err(e) = health_log_repo
                    .record_health_check(&state.id, None, &health_status, error_rate)
                    .await
                {
                    // Log error but don't fail detection
                    eprintln!(
                        "Warning: Failed to record health log for engine {}: {}",
                        state.id, e
                    );
                }
            }
        }

        Ok(states)
    }

    /// Detect engine state from binary info
    async fn detect_engine_from_binary(
        &self,
        binary: &EngineBinaryInfo,
    ) -> Result<EngineState, EngineError> {
        // Try to ping the API for this engine type
        let api_url = match binary.kind {
            EngineKind::Ollama => join_api_url(&default_ollama_base_url(), "/api/tags"),
            _ => {
                // For other engines, binary detection doesn't imply API availability
                return Ok(EngineState {
                    id: binary.engine_id.clone(),
                    kind: binary.kind.clone(),
                    name: format!("{:?}", binary.kind),
                    version: binary.version.clone(),
                    status: EngineStatus::InstalledOnly,
                    capabilities: EngineCapabilities::default(),
                });
            }
        };

        // Try API ping
        let start = Instant::now();
        match self.http_client.get_json(&api_url).await {
            Ok(_) => {
                let latency_ms = start.elapsed().as_millis() as u64;
                if latency_ms < 1500 {
                    Ok(EngineState {
                        id: binary.engine_id.clone(),
                        kind: binary.kind.clone(),
                        name: format!("{:?}", binary.kind),
                        version: binary.version.clone(),
                        status: EngineStatus::RunningHealthy { latency_ms },
                        capabilities: EngineCapabilities::default(),
                    })
                } else {
                    Ok(EngineState {
                        id: binary.engine_id.clone(),
                        kind: binary.kind.clone(),
                        name: format!("{:?}", binary.kind),
                        version: binary.version.clone(),
                        status: EngineStatus::RunningDegraded {
                            latency_ms,
                            reason: "High latency".to_string(),
                        },
                        capabilities: EngineCapabilities::default(),
                    })
                }
            }
            Err(_) => {
                // API ping failed, but binary is detected
                Ok(EngineState {
                    id: binary.engine_id.clone(),
                    kind: binary.kind.clone(),
                    name: format!("{:?}", binary.kind),
                    version: binary.version.clone(),
                    status: EngineStatus::InstalledOnly,
                    capabilities: EngineCapabilities::default(),
                })
            }
        }
    }

    /// Detect engine state from runtime info
    async fn detect_engine_from_runtime(
        &self,
        runtime: &EngineRuntimeInfo,
    ) -> Result<EngineState, EngineError> {
        // Determine API endpoint based on engine kind
        let api_url = match runtime.kind {
            EngineKind::Vllm => join_api_url(&runtime.base_url, "v1/models"),
            EngineKind::LmStudio => join_api_url(&runtime.base_url, "v1/models"),
            EngineKind::LlamaCpp => join_api_url(&runtime.base_url, "v1/models"),
            EngineKind::Ollama => join_api_url(&runtime.base_url, "/api/tags"),
        };

        // Try API ping with latency measurement
        let start = Instant::now();
        match self.http_client.get_json(&api_url).await {
            Ok(json) => {
                let latency_ms = start.elapsed().as_millis() as u64;

                // Validate response structure based on engine type
                let is_valid = match runtime.kind {
                    EngineKind::Ollama => json.is_array(),
                    EngineKind::Vllm => json.get("data").and_then(|v| v.as_array()).is_some(),
                    EngineKind::LmStudio => json.get("models").is_some(),
                    EngineKind::LlamaCpp => true, // Accept any valid JSON
                };

                if !is_valid {
                    return Ok(EngineState {
                        id: runtime.engine_id.clone(),
                        kind: runtime.kind.clone(),
                        name: format!("{:?}", runtime.kind),
                        version: None,
                        status: EngineStatus::ErrorApi {
                            reason: "Invalid response format".to_string(),
                        },
                        capabilities: EngineCapabilities::default(),
                    });
                }

                if latency_ms < 1500 {
                    Ok(EngineState {
                        id: runtime.engine_id.clone(),
                        kind: runtime.kind.clone(),
                        name: format!("{:?}", runtime.kind),
                        version: None,
                        status: EngineStatus::RunningHealthy { latency_ms },
                        capabilities: EngineCapabilities::default(),
                    })
                } else {
                    Ok(EngineState {
                        id: runtime.engine_id.clone(),
                        kind: runtime.kind.clone(),
                        name: format!("{:?}", runtime.kind),
                        version: None,
                        status: EngineStatus::RunningDegraded {
                            latency_ms,
                            reason: "High latency".to_string(),
                        },
                        capabilities: EngineCapabilities::default(),
                    })
                }
            }
            Err(e) => {
                // Network error - could be timeout or connection failure
                Ok(EngineState {
                    id: runtime.engine_id.clone(),
                    kind: runtime.kind.clone(),
                    name: format!("{:?}", runtime.kind),
                    version: None,
                    status: EngineStatus::ErrorNetwork {
                        reason: format!("API ping failed: {e}"),
                        consecutive_failures: 1,
                    },
                    capabilities: EngineCapabilities::default(),
                })
            }
        }
    }

    /// List models for a specific engine
    ///
    /// # Arguments
    /// * `engine_id` - The engine ID to list models for
    ///
    /// # Returns
    /// * `Ok(Vec<ModelInfo>)` if models are successfully listed
    /// * `Err(EngineError)` if the engine is not found or listing fails
    pub async fn list_models(&self, engine_id: EngineId) -> Result<Vec<ModelInfo>, EngineError> {
        // Find the registered engine with matching ID
        let engines = self.engine_repo.list_registered().await;
        let engine = engines
            .into_iter()
            .find(|e| e.id() == engine_id)
            .ok_or_else(|| EngineError::NotFound {
                engine_id: engine_id.clone(),
            })?;

        // Call the engine's list_models method
        engine.list_models().await
    }

    /// Send a chat request
    pub async fn chat(&self, req: ChatRequest) -> Result<ChatResponse, EngineError> {
        // Find the registered engine with matching ID
        let engines = self.engine_repo.list_registered().await;
        let engine = engines
            .into_iter()
            .find(|e| e.id() == req.engine_id)
            .ok_or_else(|| EngineError::NotFound {
                engine_id: req.engine_id.clone(),
            })?;

        // Delegate to the engine's chat method
        engine.chat(req).await
    }

    /// Send a streaming chat request
    pub async fn chat_stream(&self, req: ChatRequest) -> Result<ChatStream, EngineError> {
        // Find the registered engine with matching ID
        let engines = self.engine_repo.list_registered().await;
        let engine = engines
            .into_iter()
            .find(|e| e.id() == req.engine_id)
            .ok_or_else(|| EngineError::NotFound {
                engine_id: req.engine_id.clone(),
            })?;

        // Delegate to the engine's chat_stream method
        engine.chat_stream(req).await
    }

    /// Generate embeddings
    pub async fn embeddings(
        &self,
        req: EmbeddingRequest,
    ) -> Result<EmbeddingResponse, EngineError> {
        // Find the registered engine with matching ID
        let engines = self.engine_repo.list_registered().await;
        let engine = engines
            .into_iter()
            .find(|e| e.id() == req.engine_id)
            .ok_or_else(|| EngineError::NotFound {
                engine_id: req.engine_id.clone(),
            })?;

        // Delegate to the engine's embeddings method
        engine.embeddings(req).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::HttpError;
    use crate::ports::{EngineRepository, HttpClient, HttpRequest, HttpStream, LlmEngine};
    use serde_json::Value;
    use std::sync::Arc;

    struct NoopProcessController;

    impl EngineProcessController for NoopProcessController {
        fn detect_binaries(&self) -> Vec<EngineBinaryInfo> {
            Vec::new()
        }

        fn detect_running(&self) -> Vec<EngineRuntimeInfo> {
            Vec::new()
        }
    }

    struct NoopHttpClient;

    #[async_trait::async_trait]
    impl HttpClient for NoopHttpClient {
        async fn get_json(&self, _url: &str) -> Result<Value, HttpError> {
            Err(HttpError::NetworkError {
                reason: "not implemented".to_string(),
            })
        }

        async fn post_json(&self, _url: &str, _body: Value) -> Result<Value, HttpError> {
            Err(HttpError::NetworkError {
                reason: "not implemented".to_string(),
            })
        }

        async fn stream(&self, _req: HttpRequest) -> Result<HttpStream, HttpError> {
            Err(HttpError::NetworkError {
                reason: "not implemented".to_string(),
            })
        }
    }

    struct MockEngine {
        id: EngineId,
        models: Vec<ModelInfo>,
    }

    #[async_trait::async_trait]
    impl LlmEngine for MockEngine {
        fn id(&self) -> String {
            self.id.clone()
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
                tools: false,
                ..EngineCapabilities::default()
            }
        }

        async fn health_check(&self) -> Result<crate::domain::engine::HealthStatus, EngineError> {
            Err(EngineError::InvalidResponse {
                reason: "not used".to_string(),
            })
        }

        async fn list_models(&self) -> Result<Vec<ModelInfo>, EngineError> {
            Ok(self.models.clone())
        }

        async fn chat(&self, _req: ChatRequest) -> Result<ChatResponse, EngineError> {
            Err(EngineError::InvalidResponse {
                reason: "not implemented".to_string(),
            })
        }

        async fn chat_stream(&self, _req: ChatRequest) -> Result<ChatStream, EngineError> {
            Err(EngineError::InvalidResponse {
                reason: "not implemented".to_string(),
            })
        }

        async fn embeddings(
            &self,
            _req: EmbeddingRequest,
        ) -> Result<EmbeddingResponse, EngineError> {
            Err(EngineError::InvalidResponse {
                reason: "not implemented".to_string(),
            })
        }
    }

    struct MockEngineRepository {
        engines: std::sync::Mutex<Vec<Arc<dyn LlmEngine>>>,
    }

    impl MockEngineRepository {
        fn new(engines: Vec<Arc<dyn LlmEngine>>) -> Self {
            Self {
                engines: std::sync::Mutex::new(engines),
            }
        }
    }

    #[async_trait::async_trait]
    impl EngineRepository for MockEngineRepository {
        async fn list_registered(&self) -> Vec<Arc<dyn LlmEngine>> {
            self.engines
                .lock()
                .expect("mock engine repo poisoned")
                .clone()
        }

        async fn register(&self, engine: Arc<dyn LlmEngine>) {
            self.engines
                .lock()
                .expect("mock engine repo poisoned")
                .push(engine);
        }
    }

    fn make_service(engines: Vec<Arc<dyn LlmEngine>>) -> EngineService {
        let repo: Box<dyn EngineRepository + Send + Sync> =
            Box::new(MockEngineRepository::new(engines));
        EngineService::new(
            Box::new(NoopProcessController),
            Box::new(NoopHttpClient),
            repo,
        )
    }

    #[tokio::test]
    async fn list_models_returns_models() {
        let models = vec![
            ModelInfo {
                engine_id: "engine-1".to_string(),
                model_id: "flm://engine-1/model-a".to_string(),
                display_name: "model-a".to_string(),
                context_length: Some(4096),
                supports_streaming: true,
                supports_embeddings: true,
            },
            ModelInfo {
                engine_id: "engine-1".to_string(),
                model_id: "flm://engine-1/model-b".to_string(),
                display_name: "model-b".to_string(),
                context_length: None,
                supports_streaming: false,
                supports_embeddings: true,
            },
        ];
        let engine = Arc::new(MockEngine {
            id: "engine-1".to_string(),
            models: models.clone(),
        });
        let service = make_service(vec![engine]);

        let listed = service.list_models("engine-1".to_string()).await.unwrap();
        assert_eq!(listed.len(), 2);
        assert_eq!(listed[0].model_id, "flm://engine-1/model-a");
    }

    #[tokio::test]
    async fn list_models_missing_engine() {
        let service = make_service(Vec::new());

        let err = service
            .list_models("missing".to_string())
            .await
            .unwrap_err();
        match err {
            EngineError::NotFound { engine_id } => {
                assert_eq!(engine_id, "missing");
            }
            _ => panic!("Unexpected error variant"),
        }
    }

    #[tokio::test]
    async fn chat_returns_error_when_engine_not_found() {
        let service = make_service(Vec::new());

        let req = ChatRequest {
            engine_id: "missing".to_string(),
            model_id: "flm://missing/model".to_string(),
            messages: vec![],
            stream: false,
            temperature: None,
            max_tokens: None,
            stop: vec![],
            requested_modalities: Vec::new(),
        };

        let err = service.chat(req).await.unwrap_err();
        match err {
            EngineError::NotFound { engine_id } => {
                assert_eq!(engine_id, "missing");
            }
            _ => panic!("Unexpected error variant"),
        }
    }

    #[tokio::test]
    async fn chat_stream_returns_error_when_engine_not_found() {
        let service = make_service(Vec::new());

        let req = ChatRequest {
            engine_id: "missing".to_string(),
            model_id: "flm://missing/model".to_string(),
            messages: vec![],
            stream: true,
            temperature: None,
            max_tokens: None,
            stop: vec![],
            requested_modalities: Vec::new(),
        };

        let result = service.chat_stream(req).await;
        assert!(result.is_err());
        match result {
            Err(EngineError::NotFound { engine_id }) => {
                assert_eq!(engine_id, "missing");
            }
            _ => panic!("Unexpected error variant"),
        }
    }

    #[tokio::test]
    async fn embeddings_returns_error_when_engine_not_found() {
        let service = make_service(Vec::new());

        let req = EmbeddingRequest {
            engine_id: "missing".to_string(),
            model_id: "flm://missing/model".to_string(),
            input: vec!["test".to_string()],
        };

        let err = service.embeddings(req).await.unwrap_err();
        match err {
            EngineError::NotFound { engine_id } => {
                assert_eq!(engine_id, "missing");
            }
            _ => panic!("Unexpected error variant"),
        }
    }

    #[tokio::test]
    async fn detect_engines_returns_empty_when_no_engines_detected() {
        let service = make_service(Vec::new());

        let states = service.detect_engines().await.unwrap();
        assert_eq!(states.len(), 0);
    }
}
