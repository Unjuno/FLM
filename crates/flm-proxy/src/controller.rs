//! Axum-based ProxyController implementation
//!
//! This module implements the ProxyController trait using Axum.

use axum::response::IntoResponse;
use flm_core::domain::proxy::{ProxyConfig, ProxyHandle, ProxyMode};
use flm_core::error::ProxyError;
use flm_core::ports::ProxyController;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{oneshot, RwLock};
use tokio::task::JoinHandle;
use tracing::error;

use crate::middleware::AppState;
use crate::security::ip_blocklist::IpBlocklist;
use crate::security::intrusion_detection::IntrusionDetection;
use crate::utils;

// Wrapper to convert Arc<InMemoryEngineRepository> to Box<dyn EngineRepository + Send + Sync>
struct EngineRepositoryWrapper(Arc<crate::engine_repo::InMemoryEngineRepository>);
unsafe impl Send for EngineRepositoryWrapper {}
unsafe impl Sync for EngineRepositoryWrapper {}

#[async_trait::async_trait]
impl flm_core::ports::EngineRepository for EngineRepositoryWrapper {
    async fn list_registered(&self) -> Vec<Arc<dyn flm_core::ports::LlmEngine>> {
        self.0.list_registered().await
    }
    async fn register(&self, engine: Arc<dyn flm_core::ports::LlmEngine>) {
        self.0.register(engine).await;
    }
}

/// Axum-based ProxyController implementation
pub struct AxumProxyController {
    // Active server handles (port -> JoinHandle)
    handles: Arc<tokio::sync::RwLock<std::collections::HashMap<u16, ServerHandle>>>,
}

struct ServerHandle {
    join_handle: JoinHandle<Result<(), ProxyError>>,
    shutdown_tx: oneshot::Sender<()>,
    handle: ProxyHandle,
}

impl AxumProxyController {
    /// Create a new AxumProxyController
    pub fn new() -> Self {
        Self {
            handles: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
        }
    }
}

impl Default for AxumProxyController {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl ProxyController for AxumProxyController {
    async fn start(&self, config: ProxyConfig) -> Result<ProxyHandle, ProxyError> {
        // Check if a server is already running on this port
        let handles = self.handles.read().await;
        if handles.contains_key(&config.port) {
            return Err(ProxyError::AlreadyRunning {
                handle_id: format!("port-{}", config.port),
            });
        }
        drop(handles);

        // Create shutdown channel
        let (shutdown_tx, shutdown_rx) = oneshot::channel();

        // Start the server based on mode
        let join_handle = match config.mode {
            ProxyMode::LocalHttp => start_local_http_server(config.clone(), shutdown_rx).await?,
            ProxyMode::DevSelfSigned => {
                return Err(ProxyError::InvalidConfig {
                    reason: "dev-selfsigned mode not yet implemented".to_string(),
                });
            }
            ProxyMode::HttpsAcme => {
                return Err(ProxyError::InvalidConfig {
                    reason: "https-acme mode not yet implemented".to_string(),
                });
            }
            ProxyMode::PackagedCa => {
                return Err(ProxyError::InvalidConfig {
                    reason: "packaged-ca mode not yet implemented (Phase 3)".to_string(),
                });
            }
        };

        // Create handle
        let handle = ProxyHandle {
            id: format!("proxy-{}", config.port),
            pid: std::process::id(),
            port: config.port,
            mode: config.mode.clone(),
            listen_addr: format!("{}:{}", config.listen_addr, config.port),
            https_port: match config.mode {
                ProxyMode::LocalHttp => None,
                _ => Some(config.port + 1),
            },
            acme_domain: config.acme_domain.clone(),
            running: true,
            last_error: None,
        };

        // Store the handle
        let mut handles = self.handles.write().await;
        handles.insert(
            config.port,
            ServerHandle {
                join_handle,
                shutdown_tx,
                handle: handle.clone(),
            },
        );

        Ok(handle)
    }

    async fn stop(&self, handle: ProxyHandle) -> Result<(), ProxyError> {
        let mut handles = self.handles.write().await;

        if let Some(server_handle) = handles.remove(&handle.port) {
            // Send shutdown signal
            let _ = server_handle.shutdown_tx.send(());
            // Wait for server to stop (with timeout)
            tokio::select! {
                result = server_handle.join_handle => {
                    result.map_err(|e| ProxyError::InvalidConfig {
                        reason: format!("Server task panicked: {e:?}"),
                    })??;
                }
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(5)) => {
                    return Err(ProxyError::Timeout {
                        operation: "Server shutdown".to_string(),
                    });
                }
            }
        }

        Ok(())
    }

    async fn status(&self) -> Result<Vec<ProxyHandle>, ProxyError> {
        let handles = self.handles.read().await;
        Ok(handles.values().map(|sh| sh.handle.clone()).collect())
    }
}

/// Start a local HTTP server
async fn start_local_http_server(
    config: ProxyConfig,
    shutdown_rx: oneshot::Receiver<()>,
) -> Result<JoinHandle<Result<(), ProxyError>>, ProxyError> {
    use std::path::PathBuf;
    use tokio::net::TcpListener as TokioTcpListener;

    // Get DB paths from config or use defaults
    let _config_db_path = config
        .config_db_path
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("config.db"));
    let security_db_path = config
        .security_db_path
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("security.db"));

    // Create repositories
    let security_repo = crate::adapters::SqliteSecurityRepository::new(&security_db_path)
        .await
        .map_err(|e| ProxyError::InvalidConfig {
            reason: format!("Failed to create security repository: {e}"),
        })?;

    // Create services (clone repo for AppState)
    let security_repo_for_state = security_repo.clone();
    let security_service = flm_core::services::SecurityService::new(security_repo);
    let process_controller: Box<dyn flm_core::ports::EngineProcessController + Send + Sync> =
        Box::new(crate::process_controller::NoopProcessController);
    let http_client: Box<dyn flm_core::ports::HttpClient + Send + Sync> =
        Box::new(crate::http_client::ReqwestHttpClient::new().map_err(|e| {
            ProxyError::InvalidConfig {
                reason: format!("Failed to create HTTP client: {e}"),
            }
        })?);

    // Use simple in-memory engine repository
    let engine_repo_impl = Arc::new(crate::engine_repo::InMemoryEngineRepository::new());
    let engine_repo: Box<dyn flm_core::ports::EngineRepository + Send + Sync> =
        Box::new(EngineRepositoryWrapper(engine_repo_impl.clone()));

    let engine_service =
        flm_core::services::EngineService::new(process_controller, http_client, engine_repo);

    // Create IP blocklist and intrusion detection
    let ip_blocklist = Arc::new(IpBlocklist::new());
    let intrusion_detection = Arc::new(IntrusionDetection::new());
    let ip_blocklist_for_state = ip_blocklist.clone();
    let ip_blocklist_for_sync = ip_blocklist.clone();
    let security_repo_for_load = security_repo_for_state.clone();
    let security_repo_for_sync = security_repo_for_state.clone();
    
    // Load blocked IPs from database on startup
    {
        let ip_blocklist_load = ip_blocklist_for_state.clone();
        tokio::spawn(async move {
            if let Ok(entries) = security_repo_for_load.get_blocked_ips().await {
                ip_blocklist_load.load_from_db(entries).await;
            }
        });
    }
    
    // Start background task for periodic database sync (every 5 minutes)
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // 5 minutes
        loop {
            interval.tick().await;
            
            if ip_blocklist_for_sync.needs_sync().await {
                if let Err(e) = ip_blocklist_for_sync.sync_to_db(&security_repo_for_sync).await {
                    error!(error = %e, "Failed to sync IP blocklist to database");
                } else {
                    ip_blocklist_for_sync.mark_synced().await;
                }
            }
            
            // Clean up expired blocks
            if let Err(e) = security_repo_for_sync.cleanup_expired_blocks().await {
                error!(error = %e, "Failed to cleanup expired blocks");
            }
        }
    });

    // Create app state
    let app_state = crate::middleware::AppState {
        security_service: Arc::new(security_service),
        security_repo: Arc::new(security_repo_for_state),
        engine_service: Arc::new(engine_service),
        engine_repo: engine_repo_impl,
        rate_limit_state: Arc::new(RwLock::new(std::collections::HashMap::new())),
        trusted_proxy_ips: config.trusted_proxy_ips.clone(),
        ip_blocklist,
        intrusion_detection,
    };

    // Create the router
    let app = create_router(config.clone(), app_state).await?;

    // Bind to the address (default: 127.0.0.1 for security)
    let listen_addr = config.listen_addr.as_str();
    let addr: SocketAddr = listen_addr
        .parse()
        .map_err(|e| ProxyError::InvalidConfig {
            reason: format!("Invalid listen address '{}': {}", listen_addr, e),
        })?;
    
    // Validate that the address includes the port, or add it
    let addr = if addr.port() == 0 {
        SocketAddr::new(addr.ip(), config.port)
    } else if addr.port() != config.port {
        return Err(ProxyError::InvalidConfig {
            reason: format!(
                "Port mismatch: listen_addr port {} does not match config port {}",
                addr.port(),
                config.port
            ),
        });
    } else {
        addr
    };
    
    let listener = TokioTcpListener::bind(&addr)
        .await
        .map_err(|e| ProxyError::InvalidConfig {
            reason: format!("Failed to bind to {}: {}", addr, e),
        })?;

    // Spawn the server task
    let join_handle = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                shutdown_rx.await.ok();
            })
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Server error: {e}"),
            })
    });

    Ok(join_handle)
}

/// Create the Axum router
async fn create_router(
    _config: ProxyConfig,
    app_state: AppState,
) -> Result<axum::Router, ProxyError> {
    use axum::middleware as axum_middleware;
    use axum::routing::get;
    use axum::routing::post;
    use axum::Router;

    // Get CORS configuration from security policy
    let cors_layer = create_cors_layer(&app_state).await;

    // Create separate router for streaming endpoint (with 30-minute timeout)
    // Streaming requests can take longer, but we still need a timeout to prevent resource exhaustion
    let streaming_router = Router::new()
        .route("/v1/chat/completions", post(handle_chat_completions))
        // Timeout middleware for streaming (30 minutes = 1800 seconds)
        .layer(axum::middleware::from_fn(crate::middleware::streaming_timeout_middleware))
        // Audit logging (outermost layer to capture all requests)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::audit_logging_middleware,
        ))
        // Intrusion detection (before IP block check)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::intrusion_detection_middleware,
        ))
        // IP block check (before authentication)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::ip_block_check_middleware,
        ))
        .layer(cors_layer.clone())
        .layer(axum::middleware::from_fn(crate::middleware::add_security_headers))
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::auth_middleware,
        ))
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::policy_middleware,
        ))
        .with_state(app_state.clone());

    // Create router for non-streaming endpoints (with timeout)
    let router = Router::new()
        .route("/health", get(handle_health))
        .route("/v1/models", get(handle_models))
        .route("/v1/embeddings", post(handle_embeddings))
        // Apply layers in order (outermost to innermost)
        // Audit logging (outermost layer to capture all requests)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::audit_logging_middleware,
        ))
        // Intrusion detection (before IP block check)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::intrusion_detection_middleware,
        ))
        // IP block check (before authentication)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::ip_block_check_middleware,
        ))
        // Request timeout (60 seconds) - non-streaming endpoints only
        .layer(axum::middleware::from_fn(crate::middleware::request_timeout_middleware))
        // Concurrency limit (100 connections)
        .layer(tower::limit::ConcurrencyLimitLayer::new(100))
        // Request body size limit (10MB)
        .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024))
        // CORS layer
        .layer(cors_layer)
        // Security headers middleware
        .layer(axum::middleware::from_fn(crate::middleware::add_security_headers))
        // Apply middleware in order: auth -> policy
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::auth_middleware,
        ))
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::policy_middleware,
        ))
        // Merge streaming router
        .merge(streaming_router)
        .with_state(app_state);

    Ok(router)
}

/// Create CORS layer based on security policy
async fn create_cors_layer(app_state: &AppState) -> tower_http::cors::CorsLayer {
    use axum::http::HeaderValue;
    use tower_http::cors::{AllowOrigin, CorsLayer as TowerCorsLayer};

    // Get security policy
    let policy = match app_state.security_service.get_policy("default").await {
        Ok(Some(policy)) => policy,
        _ => {
            // No policy or error - deny all origins for security
            // Use predicate that always returns false to deny all origins
            return TowerCorsLayer::new()
                .allow_origin(tower_http::cors::AllowOrigin::predicate(|_, _| false))
                .allow_methods([])
                .allow_headers([]);
        }
    };

    // Parse policy JSON
    let policy_json: serde_json::Value = match serde_json::from_str(&policy.policy_json) {
        Ok(json) => json,
        _ => {
            // Invalid policy JSON - deny all origins for security
            // Use predicate that always returns false to deny all origins
            return TowerCorsLayer::new()
                .allow_origin(tower_http::cors::AllowOrigin::predicate(|_, _| false))
                .allow_methods([])
                .allow_headers([]);
        }
    };

    // Get allowed origins from policy
    if let Some(cors) = policy_json.get("cors") {
        if let Some(allowed_origins) = cors.get("allowed_origins") {
            if let Some(origins_array) = allowed_origins.as_array() {
                if origins_array.is_empty() {
                    // Empty array means deny all (fail closed for security)
                    return TowerCorsLayer::new()
                        .allow_origin(tower_http::cors::AllowOrigin::predicate(|_, _| false))
                        .allow_methods([])
                        .allow_headers([]);
                }

                // Convert to HeaderValue list
                let origins: Vec<HeaderValue> = origins_array
                    .iter()
                    .filter_map(|v| v.as_str())
                    .filter_map(|s| HeaderValue::from_str(s).ok())
                    .collect();

                if origins.is_empty() {
                    // No valid origins - deny all (fail closed for security)
                    return TowerCorsLayer::new()
                        .allow_origin(tower_http::cors::AllowOrigin::predicate(|_, _| false))
                        .allow_methods([])
                        .allow_headers([]);
                }

                return TowerCorsLayer::new()
                    .allow_origin(AllowOrigin::list(origins))
                    .allow_methods([
                        axum::http::Method::GET,
                        axum::http::Method::POST,
                        axum::http::Method::OPTIONS,
                    ])
                    .allow_headers([
                        axum::http::header::AUTHORIZATION,
                        axum::http::header::CONTENT_TYPE,
                    ]);
            }
        }
    }

    // Default: deny all (fail closed for security)
    // Explicit configuration is required to allow any origins
    TowerCorsLayer::new()
        .allow_origin(tower_http::cors::AllowOrigin::predicate(|_, _| false))
        .allow_methods([])
        .allow_headers([])
}

/// Health check endpoint
async fn handle_health() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "ok"
    }))
}

/// Handle /v1/models endpoint
///
/// Returns all models from all registered engines in OpenAI-compatible format.
#[axum::debug_handler]
async fn handle_models(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> axum::Json<serde_json::Value> {
    // Get all registered engines
    let engines = state.engine_repo.list_registered().await;

    // Collect models from all engines
    let mut all_models = Vec::new();

    for engine in engines {
        match engine.list_models().await {
            Ok(models) => {
                for model in models {
                    // Convert to OpenAI-compatible format
                    let openai_model = serde_json::json!({
                        "id": model.model_id,
                        "object": "model",
                        "created": 0, // We don't track creation time
                        "owned_by": format!("flm-{}", model.engine_id),
                        "permission": [],
                        "root": model.model_id,
                        "parent": null
                    });
                    all_models.push(openai_model);
                }
            }
            Err(_) => {
                // Skip engines that fail to list models
                continue;
            }
        }
    }

    axum::Json(serde_json::json!({
        "object": "list",
        "data": all_models
    }))
}

/// OpenAI-compatible chat request
#[derive(serde::Deserialize)]
struct OpenAiChatRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    #[serde(default)]
    stream: bool,
    #[serde(default)]
    temperature: Option<f64>,
    #[serde(default)]
    max_tokens: Option<u32>,
    #[serde(default)]
    stop: Vec<String>,
}

/// Validate engine ID
fn validate_engine_id(engine_id: &str) -> Result<(), &'static str> {
    if engine_id.is_empty() {
        return Err("Engine ID cannot be empty");
    }
    if engine_id.len() > 100 {
        return Err("Engine ID too long");
    }
    if !engine_id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("Engine ID contains invalid characters");
    }
    Ok(())
}

/// Validate model name
fn validate_model_name(model_name: &str) -> Result<(), &'static str> {
    if model_name.is_empty() {
        return Err("Model name cannot be empty");
    }
    if model_name.len() > 200 {
        return Err("Model name too long");
    }
    Ok(())
}

/// Validate messages array
fn validate_messages(messages: &[OpenAiMessage]) -> Result<(), &'static str> {
    if messages.is_empty() {
        return Err("Messages cannot be empty");
    }
    if messages.len() > 100 {
        return Err("Too many messages");
    }
    for msg in messages {
        if msg.content.len() > 1_048_576 {
            return Err("Message content too long");
        }
    }
    Ok(())
}

/// Validate stop sequences
fn validate_stop_sequences(stop: &[String]) -> Result<(), &'static str> {
    if stop.len() > 10 {
        return Err("Too many stop sequences");
    }
    for seq in stop {
        if seq.len() > 200 {
            return Err("Stop sequence too long");
        }
    }
    Ok(())
}

/// Validate temperature parameter
fn validate_temperature(temperature: Option<f64>) -> Result<(), &'static str> {
    if let Some(temp) = temperature {
        if temp < 0.0 || temp > 2.0 {
            return Err("Temperature must be between 0.0 and 2.0");
        }
        if !temp.is_finite() {
            return Err("Temperature must be a finite number");
        }
    }
    Ok(())
}

/// Validate max_tokens parameter
fn validate_max_tokens(max_tokens: Option<u32>) -> Result<(), &'static str> {
    if let Some(max) = max_tokens {
        if max == 0 {
            return Err("max_tokens must be greater than 0");
        }
        if max > 1_000_000 {
            return Err("max_tokens exceeds maximum limit (1,000,000)");
        }
    }
    Ok(())
}

/// Validate message role
fn validate_message_role(role: &str) -> Result<(), &'static str> {
    match role {
        "system" | "user" | "assistant" | "tool" => Ok(()),
        _ => Err("Invalid message role. Must be one of: system, user, assistant, tool"),
    }
}

/// Validate embedding input
fn validate_embedding_input(input: &serde_json::Value) -> Result<(), &'static str> {
    match input {
        serde_json::Value::String(s) => {
            if s.len() > 1_048_576 {
                return Err("Input string too long");
            }
        }
        serde_json::Value::Array(arr) => {
            if arr.len() > 100 {
                return Err("Too many input strings");
            }
            for item in arr {
                if let serde_json::Value::String(s) = item {
                    if s.len() > 1_048_576 {
                        return Err("Input string too long");
                    }
                } else {
                    return Err("Invalid input format");
                }
            }
        }
        _ => return Err("Invalid input format"),
    }
    Ok(())
}

/// OpenAI-compatible message
#[derive(serde::Deserialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

/// OpenAI-compatible embeddings request
#[derive(serde::Deserialize)]
struct OpenAiEmbeddingRequest {
    model: String,
    input: serde_json::Value, // Can be string or array of strings
}

/// Handle /v1/embeddings endpoint
///
/// Returns embeddings for the given input text(s) in OpenAI-compatible format.
#[axum::debug_handler]
async fn handle_embeddings(
    axum::extract::State(state): axum::extract::State<AppState>,
    axum::Json(req): axum::Json<OpenAiEmbeddingRequest>,
) -> axum::response::Response {
    use flm_core::domain::chat::EmbeddingRequest;

    // Parse model ID (must be in flm://{engine_id}/{model} format)
    if !req.model.starts_with("flm://") {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid model ID format. Expected flm://{engine_id}/{model}",
                    "type": "invalid_request_error",
                    "code": "invalid_model"
                }
            })),
        )
            .into_response();
    }

    // Extract engine_id and model_name from flm://{engine_id}/{model}
    let model_without_prefix = match req.model.strip_prefix("flm://") {
        Some(prefix) => prefix,
        None => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({
                    "error": {
                        "message": "Invalid model ID format. Expected flm://{engine_id}/{model}",
                        "type": "invalid_request_error",
                        "code": "invalid_model"
                    }
                })),
            )
                .into_response();
        }
    };
    let model_parts: Vec<&str> = model_without_prefix.splitn(2, '/').collect();
    if model_parts.len() != 2 {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid model ID format. Expected flm://{engine_id}/{model}",
                    "type": "invalid_request_error",
                    "code": "invalid_model"
                }
            })),
        )
            .into_response();
    }

    let engine_id = model_parts[0].to_string();
    let model_name = model_parts[1].to_string();
    let model_id = req.model.clone();

    // Validate engine_id and model_name
    if let Err(_) = validate_engine_id(&engine_id) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid engine ID",
                    "type": "invalid_request_error",
                    "code": "invalid_engine_id"
                }
            })),
        )
            .into_response();
    }

    if let Err(_) = validate_model_name(&model_name) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid model name",
                    "type": "invalid_request_error",
                    "code": "invalid_model_name"
                }
            })),
        )
            .into_response();
    }

    // Validate embedding input
    if let Err(_) = validate_embedding_input(&req.input) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid input",
                    "type": "invalid_request_error",
                    "code": "invalid_input"
                }
            })),
        )
            .into_response();
    }

    // Find the engine
    let engines = state.engine_repo.list_registered().await;
    let engine = match engines.iter().find(|e| e.id() == engine_id) {
        Some(e) => e,
        None => {
            return (
                axum::http::StatusCode::NOT_FOUND,
                axum::Json(serde_json::json!({
                    "error": {
                        "message": "Engine not found",
                        "type": "invalid_request_error",
                        "code": "engine_not_found"
                    }
                })),
            )
                .into_response();
        }
    };

    // Convert OpenAI input (string or array of strings) to Vec<String>
    let input_strings: Vec<String> = match req.input {
        serde_json::Value::String(s) => vec![s],
        serde_json::Value::Array(arr) => {
            let mut strings = Vec::new();
            for item in arr {
                match item {
                    serde_json::Value::String(s) => strings.push(s),
                    _ => {
                        return (
                            axum::http::StatusCode::BAD_REQUEST,
                            axum::Json(serde_json::json!({
                                "error": {
                                    "message": "Invalid input format. Expected string or array of strings",
                                    "type": "invalid_request_error",
                                    "code": "invalid_input"
                                }
                            })),
                        )
                            .into_response();
                    }
                }
            }
            strings
        }
        _ => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({
                    "error": {
                        "message": "Invalid input format. Expected string or array of strings",
                        "type": "invalid_request_error",
                        "code": "invalid_input"
                    }
                })),
            )
                .into_response();
        }
    };

    // Create EmbeddingRequest
    let embedding_req = EmbeddingRequest {
        engine_id: engine_id.clone(),
        model_id: model_id.clone(),
        input: input_strings,
    };

    // Call engine's embeddings method
    match engine.embeddings(embedding_req).await {
        Ok(response) => {
            // Convert to OpenAI-compatible format
            let data: Vec<serde_json::Value> = response
                .vectors
                .into_iter()
                .map(|v| {
                    serde_json::json!({
                        "object": "embedding",
                        "embedding": v.values,
                        "index": v.index
                    })
                })
                .collect();

            let openai_response = serde_json::json!({
                "object": "list",
                "data": data,
                "model": model_id,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "total_tokens": response.usage.total_tokens
                }
            });

            axum::Json(openai_response).into_response()
        }
        Err(e) => {
            let (status, message) = match e {
                flm_core::error::EngineError::NotFound { .. } => {
                    (axum::http::StatusCode::NOT_FOUND, "Engine not found")
                }
                flm_core::error::EngineError::NetworkError { .. } => {
                    (axum::http::StatusCode::BAD_GATEWAY, "Network error")
                }
                flm_core::error::EngineError::InvalidResponse { .. } => (
                    axum::http::StatusCode::BAD_GATEWAY,
                    "Invalid response from engine",
                ),
                _ => (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error",
                ),
            };

            (
                status,
                axum::Json(serde_json::json!({
                    "error": {
                        "message": message,
                        "type": "server_error",
                        "code": "embeddings_error"
                    }
                })),
            )
                .into_response()
        }
    }
}

/// Handle /v1/chat/completions endpoint
///
/// Supports both streaming and non-streaming modes.
#[axum::debug_handler]
async fn handle_chat_completions(
    axum::extract::State(state): axum::extract::State<AppState>,
    axum::Json(req): axum::Json<OpenAiChatRequest>,
) -> axum::response::Response {
    use flm_core::domain::chat::{ChatMessage, ChatRequest, ChatRole};

    // Parse model ID (must be in flm://{engine_id}/{model} format)
    if !req.model.starts_with("flm://") {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid model ID format. Expected flm://{engine_id}/{model}",
                    "type": "invalid_request_error",
                    "code": "invalid_model"
                }
            })),
        )
            .into_response();
    }

    // Extract engine_id and model_name from flm://{engine_id}/{model}
    let model_without_prefix = match req.model.strip_prefix("flm://") {
        Some(prefix) => prefix,
        None => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({
                    "error": {
                        "message": "Invalid model ID format. Expected flm://{engine_id}/{model}",
                        "type": "invalid_request_error",
                        "code": "invalid_model"
                    }
                })),
            )
                .into_response();
        }
    };
    let model_parts: Vec<&str> = model_without_prefix.splitn(2, '/').collect();
    if model_parts.len() != 2 {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid model ID format. Expected flm://{engine_id}/{model}",
                    "type": "invalid_request_error",
                    "code": "invalid_model"
                }
            })),
        )
            .into_response();
    }

    let engine_id = model_parts[0].to_string();
    let model_name = model_parts[1].to_string();

    // Validate engine_id and model_name
    if let Err(_) = validate_engine_id(&engine_id) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid engine ID",
                    "type": "invalid_request_error",
                    "code": "invalid_engine_id"
                }
            })),
        )
            .into_response();
    }

    if let Err(_) = validate_model_name(&model_name) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid model name",
                    "type": "invalid_request_error",
                    "code": "invalid_model_name"
                }
            })),
        )
            .into_response();
    }

    // Validate messages before processing
    if let Err(_) = validate_messages(&req.messages) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid messages",
                    "type": "invalid_request_error",
                    "code": "invalid_messages"
                }
            })),
        )
            .into_response();
    }

    // Validate stop sequences
    if let Err(_) = validate_stop_sequences(&req.stop) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Invalid stop sequences",
                    "type": "invalid_request_error",
                    "code": "invalid_stop"
                }
            })),
        )
            .into_response();
    }

    // Validate temperature
    if let Err(_) = validate_temperature(req.temperature) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Temperature must be between 0.0 and 2.0",
                    "type": "invalid_request_error",
                    "code": "invalid_temperature"
                }
            })),
        )
            .into_response();
    }

    // Validate max_tokens
    if let Err(_) = validate_max_tokens(req.max_tokens) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "max_tokens exceeds maximum limit or is invalid",
                    "type": "invalid_request_error",
                    "code": "invalid_max_tokens"
                }
            })),
        )
            .into_response();
    }

    // Find the engine
    let engines = state.engine_repo.list_registered().await;
    let engine = match engines.iter().find(|e| e.id() == engine_id) {
        Some(e) => e,
        None => {
            return (
                axum::http::StatusCode::NOT_FOUND,
                axum::Json(serde_json::json!({
                    "error": {
                        "message": "Engine not found",
                        "type": "invalid_request_error",
                        "code": "engine_not_found"
                    }
                })),
            )
                .into_response();
        }
    };

    // Validate message roles before conversion
    for msg in &req.messages {
        if let Err(_) = validate_message_role(&msg.role) {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({
                    "error": {
                        "message": "Invalid message role. Must be one of: system, user, assistant, tool",
                        "type": "invalid_request_error",
                        "code": "invalid_message_role"
                    }
                })),
            )
                .into_response();
        }
    }

    // Convert OpenAI messages to FLM messages
    let messages: Result<Vec<ChatMessage>, _> = req
        .messages
        .into_iter()
        .map(|m| {
            let role = match m.role.as_str() {
                "system" => ChatRole::System,
                "user" => ChatRole::User,
                "assistant" => ChatRole::Assistant,
                "tool" => ChatRole::Tool,
                _ => return Err(()), // This should never happen due to validation above
            };
            Ok(ChatMessage {
                role,
                content: m.content,
            })
        })
        .collect();

    let messages = match messages {
        Ok(m) => m,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({
                    "error": {
                        "message": "Invalid message role",
                        "type": "invalid_request_error",
                        "code": "invalid_message"
                    }
                })),
            )
                .into_response();
        }
    };

    // Create ChatRequest
    let chat_req = ChatRequest {
        engine_id: engine_id.clone(),
        model_id: req.model.clone(),
        messages,
        stream: req.stream,
        temperature: req.temperature.map(|t| t as f32),
        max_tokens: req.max_tokens,
        stop: req.stop,
    };

    // Handle streaming vs non-streaming
    if req.stream {
        handle_chat_stream(engine, chat_req).await
    } else {
        handle_chat_non_stream(engine, chat_req).await
    }
}

/// Handle non-streaming chat completion
async fn handle_chat_non_stream(
    engine: &std::sync::Arc<dyn flm_core::ports::LlmEngine>,
    req: flm_core::domain::chat::ChatRequest,
) -> axum::response::Response {
    let model_id = req.model_id.clone();
    match engine.chat(req).await {
        Ok(response) => {
            // Convert to OpenAI-compatible format
            let choice = serde_json::json!({
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response.messages.first().map(|m| &m.content).unwrap_or(&String::new())
                },
                "finish_reason": "stop"
            });

            let openai_response = serde_json::json!({
                "id": "chatcmpl-unknown",
                "object": "chat.completion",
                "created": 0,
                "model": model_id,
                "choices": [choice],
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }
            });

            axum::Json(openai_response).into_response()
        }
        Err(_) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({
                "error": {
                    "message": "Failed to process chat request",
                    "type": "server_error",
                    "code": "chat_error"
                }
            })),
        )
            .into_response(),
    }
}

/// Handle streaming chat completion
async fn handle_chat_stream(
    engine: &std::sync::Arc<dyn flm_core::ports::LlmEngine>,
    req: flm_core::domain::chat::ChatRequest,
) -> axum::response::Response {
    use axum::response::sse::{Event, Sse};
    use futures::StreamExt;

    let stream = match engine.chat_stream(req.clone()).await {
        Ok(s) => s,
        Err(e) => {
            // Log error type only (mask sensitive information)
            let (status, message) = match e {
                flm_core::error::EngineError::NotFound { engine_id } => {
                    let masked_id = utils::mask_identifier(&engine_id);
                    error!(engine_id = %masked_id, error_type = "engine_not_found", "Engine lookup failed");
                    (axum::http::StatusCode::NOT_FOUND, "Engine not found")
                }
                flm_core::error::EngineError::NetworkError { reason: _ } => {
                    error!(error_type = "network_error", "Network error starting stream");
                    (axum::http::StatusCode::BAD_GATEWAY, "Network error")
                }
                flm_core::error::EngineError::InvalidResponse { reason: _ } => {
                    error!(error_type = "invalid_response", "Invalid response starting stream");
                    (
                        axum::http::StatusCode::BAD_GATEWAY,
                        "Invalid response from engine",
                    )
                }
                flm_core::error::EngineError::ApiError { reason: _, .. } => {
                    error!(error_type = "api_error", "Engine API error starting stream");
                    (
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                        "Engine API error",
                    )
                }
                _ => {
                    error!(error_type = "unknown_error", "Unknown error starting stream");
                    (
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                        "Failed to start streaming chat",
                    )
                },
            };

            return (
                status,
                axum::Json(serde_json::json!({
                    "error": {
                        "message": message,
                        "type": "server_error",
                        "code": "stream_error"
                    }
                })),
            )
                .into_response();
        }
    };

    // Convert ChatStreamChunk to OpenAI SSE format
    let model_id = req.model_id.clone();
    let sse_stream = stream.map(move |chunk_result| {
        match chunk_result {
            Ok(chunk) => {
                // Handle final chunk
                if chunk.is_done {
                    // Send [DONE] marker
                    return Ok(Event::default().data("[DONE]"));
                }

                let choice = serde_json::json!({
                    "delta": {
                        "role": "assistant",
                        "content": chunk.delta.content
                    },
                    "index": 0,
                    "finish_reason": None::<String>
                });

                let mut data = serde_json::json!({
                    "id": "chatcmpl-unknown",
                    "object": "chat.completion.chunk",
                    "created": 0,
                    "model": model_id.clone(),
                    "choices": [choice]
                });

                // Add usage if available
                if let Some(usage) = chunk.usage {
                    data["usage"] = serde_json::json!({
                        "prompt_tokens": usage.prompt_tokens,
                        "completion_tokens": usage.completion_tokens,
                        "total_tokens": usage.total_tokens
                    });
                }

                // Convert to SSE event
                match Event::default().json_data(data) {
                    Ok(event) => Ok(event),
                    Err(e) => Err(axum::Error::new(std::io::Error::other(format!(
                        "Failed to serialize SSE event: {e}"
                    )))),
                }
            }
            Err(e) => {
                // Log error type only (mask sensitive information)
                let (error_msg, error_code) = match e {
                    flm_core::error::EngineError::NetworkError { reason: _ } => {
                        error!(error_type = "network_error", "Network error in stream");
                        ("Network error occurred", "network_error")
                    }
                    flm_core::error::EngineError::InvalidResponse { reason: _ } => {
                        error!(error_type = "invalid_response", "Invalid response in stream");
                        ("Invalid response from engine", "invalid_response")
                    }
                    flm_core::error::EngineError::ApiError { reason: _, .. } => {
                        error!(error_type = "api_error", "Engine API error in stream");
                        ("Engine API error", "api_error")
                    }
                    _ => {
                        error!(error_type = "unknown_error", "Unknown stream error");
                        ("Stream error", "unknown_error")
                    }
                };

                // Send error as SSE event so client can handle it gracefully
                let error_data = serde_json::json!({
                    "error": {
                        "message": error_msg,
                        "type": "server_error",
                        "code": error_code
                    }
                });

                match Event::default().json_data(error_data) {
                    Ok(event) => Ok(event),
                    Err(_) => {
                        // Fallback if JSON serialization fails
                        Err(axum::Error::new(std::io::Error::other(error_msg)))
                    }
                }
            }
        }
    });

    Sse::new(sse_stream).into_response()
}
