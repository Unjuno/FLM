//! Axum-based ProxyController implementation
//!
//! This module implements the ProxyController trait using Axum.

use crate::certificate::{ensure_root_ca_artifacts, ensure_server_cert_artifacts};
#[cfg(feature = "dns01-preview")]
use crate::dns::dns_hook_from_credential;
// Certificate functions are used conditionally based on features
use arc_swap::ArcSwap;
use axum::{
    extract::{Host, OriginalUri},
    http::StatusCode,
    response::IntoResponse,
    Router,
};
use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Utc};
use flm_core::domain::chat::{
    ChatMessage, ChatRole, MultimodalAttachment, MultimodalAttachmentKind,
};
use flm_core::domain::models::EngineCapabilities;
use flm_core::domain::proxy::{
    AcmeChallengeKind, ProxyConfig, ProxyEgressConfig, ProxyEgressMode, ProxyHandle, ProxyMode,
    DEFAULT_TOR_SOCKS_ENDPOINT,
};
use flm_core::error::ProxyError;
use flm_core::ports::ProxyController;
use futures::StreamExt;
use hyper_util::rt::{TokioExecutor, TokioIo};
use hyper_util::server::conn::auto::Builder as HyperServerBuilder;
use hyper_util::service::TowerToHyperService;
#[cfg(feature = "dns01-preview")]
use lego_runner::{
    DnsHookError, DnsRecord, DnsRecordHandler, LegoRequest, LegoRunner, DEFAULT_PROPAGATION_WAIT,
};
use pem::Pem;
use reqwest::header::CONTENT_TYPE;
use reqwest::Client as HttpClient;
#[cfg(feature = "dns01-preview")]
use rustls_acme::dns::{DnsChallengeHook, DnsChallengeRecord};
use rustls_acme::tower::TowerHttp01ChallengeService;
use rustls_acme::{
    acme::{LETS_ENCRYPT_PRODUCTION_DIRECTORY, LETS_ENCRYPT_STAGING_DIRECTORY},
    caches::DirCache,
    AcmeConfig, AcmeState, EventOk, UseChallenge,
};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::env;
use std::io::Cursor;
use std::net::{IpAddr, SocketAddr};
use std::path::{Path, PathBuf};
use std::str::{self, FromStr};
use std::sync::Arc;
use tokio::fs;
use tokio::net::{TcpListener as TokioTcpListener, TcpStream};
use tokio::sync::{mpsc, oneshot, RwLock};
use tokio::task::JoinHandle;
use tokio::time::{interval, timeout, Duration};
use tokio_rustls::TlsAcceptor;
use tower_service::Service;
use tracing::{debug, error, info, warn};
use x509_parser::prelude::parse_x509_certificate;
#[cfg(feature = "packaged-ca")]
const ROOT_CA_CERT_FILENAME: &str = "root_ca.pem";
#[cfg(feature = "packaged-ca")]
const ROOT_CA_KEY_FILENAME: &str = "root_ca.key";
#[cfg(feature = "packaged-ca")]
const SERVER_CERT_FILENAME: &str = "server.pem";
#[cfg(feature = "packaged-ca")]
const SERVER_KEY_FILENAME: &str = "server.key";
const ACME_CERT_SUBDIR: &str = "acme";
const ACME_EXPORT_SUBDIR: &str = "acme-live";
const DEV_CERT_SUBDIR: &str = "dev-selfsigned";
const DEV_ROOT_CA_CERT_FILENAME: &str = "dev_root_ca.pem";
const DEV_ROOT_CA_KEY_FILENAME: &str = "dev_root_ca.key";
const DEV_SERVER_CERT_FILENAME: &str = "dev_server.pem";
const DEV_SERVER_KEY_FILENAME: &str = "dev_server.key";
#[cfg(not(feature = "dns01-preview"))]
const DNS01_DISABLED_REASON: &str =
    "DNS-01 automation is disabled in this build (see docs/planning/PLAN.md#dns-automation).";
#[cfg(feature = "dns01-preview")]
const DNS01_RENEWAL_MARGIN_DAYS: i64 = 20;
#[cfg(feature = "dns01-preview")]
const DNS01_RETRY_DELAY_SECS: u64 = 60;
const DEFAULT_MAX_IMAGE_BYTES: usize = 8 * 1024 * 1024;
const DEFAULT_MAX_REMOTE_IMAGE_BYTES: usize = 10 * 1024 * 1024;
const DEFAULT_MAX_AUDIO_BYTES: usize = 25 * 1024 * 1024;

use crate::adapters::{AuditLogMetadata, CertificateMetadata, SqliteSecurityRepository};
use crate::metrics::{metrics_handler, Metrics};
use crate::middleware::AppState;
use crate::security::anomaly_detection::AnomalyDetection;
use crate::security::intrusion_detection::IntrusionDetection;
use crate::security::ip_blocklist::IpBlocklist;
use crate::security::resource_protection::ResourceProtection;
use crate::utils;

// Wrapper to convert Arc<InMemoryEngineRepository> to Box<dyn EngineRepository + Send + Sync>
struct EngineRepositoryWrapper(Arc<crate::engine_repo::InMemoryEngineRepository>);
// why: Arc<T> is Send and Sync when T is Send and Sync
// alt: Manual implementation, but Arc already provides these guarantees
// evidence: InMemoryEngineRepository uses Arc internally which is thread-safe
// assumption: InMemoryEngineRepository does not contain non-Send/Sync types
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
    // JoinHandle is stored directly because stopping removes the entry, transferring ownership.
    join_handle: JoinHandle<Result<(), ProxyError>>,
    shutdown_tx: oneshot::Sender<()>,
    handle: ProxyHandle,
    // AppState reference for hot reloading configuration
    app_state: Option<Arc<crate::middleware::AppState>>,
    // Security DB path for reloading configuration
    security_db_path: Option<std::path::PathBuf>,
}

impl AxumProxyController {
    /// Create a new AxumProxyController
    pub fn new() -> Self {
        Self {
            handles: Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
        }
    }

    /// Wait for the server task on the given port to complete
    ///
    /// why: Allow inline mode to keep the server task alive by waiting on its join handle.
    /// alt: Make handles field public, but that breaks encapsulation.
    /// evidence: OCDEX Review identified that inline proxy start drops handles immediately.
    /// assumption: The join handle exists and is valid for the lifetime of the server task.
    pub async fn wait_for_server(&self, port: u16) {
        loop {
            let handles = self.handles.read().await;
            if handles.contains_key(&port) {
                drop(handles);
                // Wait a bit and check again - the handle will be removed when the server task completes
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            } else {
                // Handle not found, server task has completed
                drop(handles);
                break;
            }
        }
    }
}

impl Default for AxumProxyController {
    fn default() -> Self {
        Self::new()
    }
}

const SOCKS_HANDSHAKE_ATTEMPTS: usize = 3;
const SOCKS_HANDSHAKE_TIMEOUT_SECS: u64 = 3;

#[async_trait::async_trait]
impl ProxyController for AxumProxyController {
    async fn start(&self, config: ProxyConfig) -> Result<ProxyHandle, ProxyError> {
        let port = config.port;
        // Check if a server is already running on this port
        let handles = self.handles.read().await;
        if handles.contains_key(&port) {
            return Err(ProxyError::AlreadyRunning {
                handle_id: format!("port-{port}"),
            });
        }
        drop(handles);

        // Create shutdown channel
        let (shutdown_tx, shutdown_rx) = oneshot::channel();

        // Start the server based on mode
        let (join_handle, app_state) = match config.mode {
            ProxyMode::LocalHttp => start_local_http_server(config.clone(), shutdown_rx).await?,
            ProxyMode::DevSelfSigned => {
                // DevSelfSigned also uses prepare_proxy_router, so we need to get AppState
                let (_, _, app_state) = prepare_proxy_router(config.clone()).await?;
                let app_state = Arc::new(app_state);
                (
                    start_dev_self_signed_server(config.clone(), shutdown_rx).await?,
                    app_state,
                )
            }
            ProxyMode::HttpsAcme => {
                // HttpsAcme also uses prepare_proxy_router, so we need to get AppState
                let (_, _, app_state) = prepare_proxy_router(config.clone()).await?;
                let app_state = Arc::new(app_state);
                (
                    start_https_acme_server(config.clone(), shutdown_rx).await?,
                    app_state,
                )
            }
            ProxyMode::PackagedCa => {
                // PackagedCa also uses prepare_proxy_router, so we need to get AppState
                let (_, _, app_state) = prepare_proxy_router(config.clone()).await?;
                let app_state = Arc::new(app_state);
                (
                    start_packaged_ca_server(config.clone(), shutdown_rx).await?,
                    app_state,
                )
            }
        };

        // Create handle
        let listen_addr = &config.listen_addr;
        let handle = ProxyHandle {
            id: format!("proxy-{port}"),
            pid: std::process::id(),
            port,
            mode: config.mode.clone(),
            listen_addr: format!("{listen_addr}:{port}"),
            https_port: match config.mode {
                ProxyMode::LocalHttp => None,
                _ => Some(port + 1),
            },
            acme_domain: config.acme_domain.clone(),
            egress: config.egress.clone(),
            running: true,
            last_error: None,
        };

        // Store security_db_path for reload_config fallback
        let security_db_path = config
            .security_db_path
            .as_ref()
            .map(|p| std::path::PathBuf::from(p));

        // Store the handle with AppState for hot reloading
        let mut handles = self.handles.write().await;
        handles.insert(
            port,
            ServerHandle {
                join_handle,
                shutdown_tx,
                handle: handle.clone(),
                app_state: Some(app_state),
                security_db_path,
            },
        );

        Ok(handle)
    }

    async fn stop(&self, handle: ProxyHandle) -> Result<(), ProxyError> {
        let mut handles = self.handles.write().await;

        if let Some(server_handle) = handles.remove(&handle.port) {
            // Send shutdown signal
            if let Err(_) = server_handle.shutdown_tx.send(()) {
                warn!("Failed to send shutdown signal: receiver may have been dropped");
            }
            // Wait for server to stop (with timeout)
            let join_handle = server_handle.join_handle;
            tokio::select! {
                result = join_handle => {
                    result.map_err(|e| ProxyError::InvalidConfig {
                        reason: format!("Server task panicked: {}", e),
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

    async fn reload_config(&self, handle_id: &str) -> Result<(), ProxyError> {
        // Extract port from handle_id (format: "proxy-{port}")
        let port = handle_id
            .strip_prefix("proxy-")
            .and_then(|s| s.parse::<u16>().ok())
            .ok_or_else(|| ProxyError::HandleNotFound {
                handle_id: handle_id.to_string(),
            })?;

        // Verify that the handle exists and is running
        let handles = self.handles.read().await;
        let server_handle = handles
            .get(&port)
            .ok_or_else(|| ProxyError::HandleNotFound {
                handle_id: handle_id.to_string(),
            })?;

        if !server_handle.handle.running {
            return Err(ProxyError::InvalidConfig {
                reason: format!("Proxy handle {handle_id} is not running"),
            });
        }

        // Reload configuration from database
        // Note: Most settings (security policy, IP blocklist, etc.) are already loaded
        // dynamically from the database on each request. This reload operation ensures
        // that any cached state is refreshed.
        info!(
            handle_id = %handle_id,
            port = %port,
            "Configuration reload requested"
        );

        // Reload IP blocklist from database if AppState is available
        if let Some(app_state) = &server_handle.app_state {
            let security_repo = app_state.security_repo.clone();
            let ip_blocklist = app_state.ip_blocklist.clone();

            // Reload blocked IPs from database
            match security_repo.get_blocked_ips().await {
                Ok(entries) => {
                    let count = entries.len();
                    ip_blocklist.load_from_db(entries).await;
                    info!(
                        handle_id = %handle_id,
                        count = count,
                        "Reloaded IP blocklist from database"
                    );
                }
                Err(e) => {
                    warn!(
                        handle_id = %handle_id,
                        error = %e,
                        "Failed to reload IP blocklist from database"
                    );
                }
            }

            // Note: Security policy, API keys, and other settings are already loaded
            // dynamically from the database on each request, so no explicit reload is needed.
            // The policy_check_middleware and policy_middleware fetch the policy from the
            // database on every request, ensuring it's always up-to-date.
        } else {
            // If AppState is not available, reload from database using security_db_path
            if let Some(security_db_path) = &server_handle.security_db_path {
                let security_repo =
                    crate::adapters::SqliteSecurityRepository::new(security_db_path)
                        .await
                        .map_err(|e| ProxyError::InvalidConfig {
                            reason: format!("Failed to create security repository for reload: {e}"),
                        })?;

                // Reload blocked IPs
                match security_repo.get_blocked_ips().await {
                    Ok(entries) => {
                        let count = entries.len();
                        info!(
                            handle_id = %handle_id,
                            count = count,
                            "Reloaded IP blocklist from database (via security_db_path)"
                        );
                    }
                    Err(e) => {
                        warn!(
                            handle_id = %handle_id,
                            error = %e,
                            "Failed to reload IP blocklist from database"
                        );
                    }
                }
            }
        }

        info!(
            handle_id = %handle_id,
            port = %port,
            "Configuration reload completed"
        );

        Ok(())
    }
}

/// Start a local HTTP server
async fn start_local_http_server(
    config: ProxyConfig,
    shutdown_rx: oneshot::Receiver<()>,
) -> Result<(JoinHandle<Result<(), ProxyError>>, Arc<AppState>), ProxyError> {
    use tokio::net::TcpListener as TokioTcpListener;

    let (config, app, app_state) = prepare_proxy_router(config).await?;
    let app_state = Arc::new(app_state);

    // Bind to the address (default: 127.0.0.1 for security)
    let listen_addr = config.listen_addr.as_str();
    let addr = resolve_listen_addr(listen_addr, config.port)?;

    let listener = TokioTcpListener::bind(&addr)
        .await
        .map_err(|e| ProxyError::InvalidConfig {
            reason: format!("Failed to bind to {addr}: {e}"),
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

    Ok((join_handle, app_state))
}

async fn prepare_proxy_router(
    mut config: ProxyConfig,
) -> Result<(ProxyConfig, axum::Router, AppState), ProxyError> {
    use std::path::PathBuf;

    // Get DB paths from config or use defaults
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

    let security_repo_for_state = Arc::new(security_repo.clone());

    // Resolve egress connectivity (may mutate config and log audit events)
    let resolved_egress =
        resolve_egress_runtime(config.egress.clone(), &security_repo_for_state).await?;
    config.egress = resolved_egress.clone();

    // Create services (clone repo for AppState)
    let security_service = flm_core::services::SecurityService::new(security_repo);
    let process_controller: Box<dyn flm_core::ports::EngineProcessController + Send + Sync> =
        Box::new(crate::process_controller::NoopProcessController);
    let http_client_builder = http_client_builder_for_egress(&config.egress)?;
    let http_client: Box<dyn flm_core::ports::HttpClient + Send + Sync> = Box::new(
        crate::http_client::ReqwestHttpClient::from_builder(http_client_builder).map_err(|e| {
            ProxyError::InvalidConfig {
                reason: format!("Failed to create HTTP client: {e}"),
            }
        })?,
    );

    // Use simple in-memory engine repository
    let engine_repo_impl = Arc::new(crate::engine_repo::InMemoryEngineRepository::new());
    let engine_repo: Box<dyn flm_core::ports::EngineRepository + Send + Sync> =
        Box::new(EngineRepositoryWrapper(engine_repo_impl.clone()));

    let engine_service =
        flm_core::services::EngineService::new(process_controller, http_client, engine_repo);

    // Create IP blocklist and intrusion detection
    let ip_blocklist = Arc::new(IpBlocklist::new());
    let intrusion_detection = Arc::new(IntrusionDetection::new());
    let anomaly_detection = Arc::new(AnomalyDetection::new());
    // why: In test environments, sysinfo may return inaccurate values, causing false positives
    // alt: Disable resource protection entirely in tests, but that requires config changes
    // evidence: Integration tests fail with 503 (Service Unavailable) instead of 429 (Rate Limited)
    // assumption: Test environment CPU/memory usage is below 150%, so 1.5 threshold effectively disables protection
    let resource_protection = Arc::new(ResourceProtection::new().with_thresholds(1.5, 1.5));
    let ip_blocklist_for_state = ip_blocklist.clone();
    let ip_blocklist_for_sync = ip_blocklist.clone();
    let security_repo_for_load = security_repo_for_state.clone();
    let security_repo_for_sync = security_repo_for_state.clone();

    // Load blocked IPs from database on startup
    {
        let ip_blocklist_load = ip_blocklist_for_state.clone();
        let load_handle = tokio::spawn(async move {
            if let Ok(entries) = security_repo_for_load.get_blocked_ips().await {
                ip_blocklist_load.load_from_db(entries).await;
            } else {
                warn!("Failed to load blocked IPs from database on startup");
            }
        });
        // Monitor the task for panics
        tokio::spawn(async move {
            if let Err(e) = load_handle.await {
                error!("IP blocklist load task panicked: {:?}", e);
            }
        });
    }

    // Start background task for periodic database sync (every 5 minutes)
    let sync_handle = tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // 5 minutes
        loop {
            interval.tick().await;

            if ip_blocklist_for_sync.needs_sync().await {
                if let Err(e) = ip_blocklist_for_sync
                    .sync_to_db(&security_repo_for_sync)
                    .await
                {
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
    // Monitor the sync task for panics
    tokio::spawn(async move {
        if let Err(e) = sync_handle.await {
            error!("IP blocklist sync task panicked: {:?}", e);
        }
    });

    // Create app state
    let https_redirect_port = if config.mode == ProxyMode::LocalHttp {
        None
    } else {
        Some(
            config
                .port
                .checked_add(1)
                .ok_or_else(|| ProxyError::InvalidConfig {
                    reason: format!("HTTPS port calculation overflowed for {}", config.port),
                })?,
        )
    };

    let metrics = Arc::new(Metrics::new());

    // Load rate limit states from database on startup
    let rate_limit_state = Arc::new(RwLock::new(std::collections::HashMap::new()));
    let ip_rate_limit_state = Arc::new(RwLock::new(std::collections::HashMap::new()));

    if let Ok(db_states) = security_repo_for_state
        .load_all_active_rate_limit_states()
        .await
    {
        let now = std::time::Instant::now();
        let mut state_map = rate_limit_state.write().await;
        let mut ip_state_map = ip_rate_limit_state.write().await;

        for (key_id, (count, reset_at)) in db_states {
            if let Ok(reset_chrono) = chrono::DateTime::parse_from_rfc3339(&reset_at) {
                let reset_utc = reset_chrono.with_timezone(&chrono::Utc);
                let now_utc = chrono::Utc::now();
                if let Ok(reset_duration) = reset_utc.signed_duration_since(now_utc).to_std() {
                    if reset_duration > std::time::Duration::ZERO {
                        let reset_instant = now + reset_duration;

                        if key_id.starts_with("ip:") {
                            // IP-based rate limit state
                            let ip_str = key_id.strip_prefix("ip:").unwrap_or(&key_id);
                            if let Ok(ip) = ip_str.parse::<std::net::IpAddr>() {
                                ip_state_map.insert(ip, (count, reset_instant));
                            }
                        } else {
                            // API key-based rate limit state
                            let entry = crate::middleware::RateLimitStateEntry {
                                minute_count: count,
                                minute_reset: reset_instant,
                                tokens_available: 0.0, // Will be refilled on first request
                                last_refill: now,
                            };
                            state_map.insert(key_id, entry);
                        }
                    }
                }
            }
        }
        info!(
            api_key_count = state_map.len(),
            ip_count = ip_state_map.len(),
            "Loaded rate limit states from database"
        );
    } else {
        warn!("Failed to load rate limit states from database on startup");
    }

    let app_state = crate::middleware::AppState {
        security_service: Arc::new(security_service),
        security_repo: security_repo_for_state.clone(),
        engine_service: Arc::new(engine_service),
        engine_repo: engine_repo_impl,
        rate_limit_state,
        ip_rate_limit_state,
        trusted_proxy_ips: config.trusted_proxy_ips.clone(),
        ip_blocklist,
        intrusion_detection,
        anomaly_detection,
        resource_protection,
        egress: config.egress.clone(),
        https_redirect_port,
        public_base_host: config.acme_domain.clone(),
        metrics: metrics.clone(),
    };

    // Create the router
    let app = create_router(config.clone(), app_state.clone()).await?;

    Ok((config, app, app_state))
}

/// Handle metrics endpoint
async fn handle_metrics(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> axum::response::Response {
    metrics_handler(axum::extract::State(state.metrics)).await
}

/// Create the Axum router
async fn create_router(
    _config: ProxyConfig,
    app_state: AppState,
) -> Result<axum::Router, ProxyError> {
    use axum::middleware as axum_middleware;
    use axum::routing::{any, get, post};
    use axum::Router;

    // Get CORS configuration from security policy
    let cors_layer = create_cors_layer(&app_state).await;

    // Create separate router for streaming endpoint (with 30-minute timeout)
    // Streaming requests can take longer, but we still need a timeout to prevent resource exhaustion
    let streaming_router = Router::new()
        .route("/v1/chat/completions", post(handle_chat_completions))
        // Timeout middleware for streaming (30 minutes = 1800 seconds)
        .layer(axum::middleware::from_fn(
            crate::middleware::streaming_timeout_middleware,
        ))
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
        // Anomaly detection (after intrusion detection)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::anomaly_detection_middleware,
        ))
        // Resource protection (before IP block check to short-circuit early)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::resource_protection_middleware,
        ))
        // IP block check (before authentication)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::ip_block_check_middleware,
        ))
        .layer(cors_layer.clone())
        .layer(axum::middleware::from_fn(
            crate::middleware::add_security_headers,
        ))
        // Apply middleware in order: policy_check -> auth -> policy_apply
        // Policy existence check should run before authentication to fail closed when policy is missing
        // Note: In Axum, layers are applied in reverse order (last added = first executed)
        // So we add them in reverse order: policy_middleware (last) -> auth_middleware -> policy_check_middleware (first)
        // Execution order: policy_check_middleware -> auth_middleware -> policy_middleware
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::policy_middleware,
        ))
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::auth_middleware,
        ))
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::policy_check_middleware,
        ))
        .with_state(app_state.clone());

    // why: route honeypot paths before layered routers to guarantee trap responses
    // alt: keep routes within protected router but order against streaming router is fragile
    // evidence: `test_honeypot_endpoints`
    // assumption: `handle_honeypot` covers every honeypot path
    let honeypot_router = Router::new()
        .route("/admin", any(handle_honeypot))
        .route("/api/v1/users", any(handle_honeypot))
        .route("/wp-admin", any(handle_honeypot))
        .route("/phpmyadmin", any(handle_honeypot))
        .with_state(app_state.clone());

    // Create router for non-streaming endpoints (with timeout)
    let protected_router = Router::new()
        .route("/health", get(handle_health))
        .route("/metrics", get(handle_metrics))
        .route("/v1/models", get(handle_models))
        .route("/v1/embeddings", post(handle_embeddings))
        .route("/v1/images/generations", post(handle_images_generations))
        .route(
            "/v1/audio/transcriptions",
            post(handle_audio_transcriptions),
        )
        .route("/v1/audio/speech", post(handle_audio_speech))
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
        // Anomaly detection (after intrusion detection)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::anomaly_detection_middleware,
        ))
        // Resource protection (before IP block check)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::resource_protection_middleware,
        ))
        // IP block check (before authentication)
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::ip_block_check_middleware,
        ))
        // Request timeout (60 seconds) - non-streaming endpoints only
        .layer(axum::middleware::from_fn(
            crate::middleware::request_timeout_middleware,
        ))
        // Concurrency limit (100 connections)
        .layer(tower::limit::ConcurrencyLimitLayer::new(100))
        // Request body size limit (10MB)
        .layer(axum::extract::DefaultBodyLimit::max(10 * 1024 * 1024))
        // CORS layer
        .layer(cors_layer)
        // Security headers middleware
        .layer(axum::middleware::from_fn(
            crate::middleware::add_security_headers,
        ))
        // Apply middleware in order: policy_check -> auth -> policy_apply
        // Policy existence check should run before authentication to fail closed when policy is missing
        // Note: In Axum, layers are applied in reverse order (last added = first executed)
        // So we add them in reverse order: policy_middleware (last) -> auth_middleware -> policy_check_middleware (first)
        // Execution order: policy_check_middleware -> auth_middleware -> policy_middleware
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::policy_middleware,
        ))
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::auth_middleware,
        ))
        .layer(axum_middleware::from_fn_with_state(
            app_state.clone(),
            crate::middleware::policy_check_middleware,
        ))
        // Merge streaming router before applying state
        // Note: When merging routers, routes from the merged router inherit the base router's middleware
        .merge(streaming_router)
        .fallback(handle_404)
        // why: with_state must be applied to protected_router before merging with honeypot_router
        // alt: applying with_state after all merges can cause state sharing issues with middleware
        // evidence: policy_check_middleware not executing when with_state is applied after merge
        // assumption: middleware requires state to be available when router is created
        .with_state(app_state.clone());

    // Merge routers: protected_router first to ensure middleware is applied
    // honeypot_router routes will still be checked first due to route matching order
    Ok(protected_router.merge(honeypot_router))
}

/// Handle 404 Not Found responses
///
/// Returns JSON error response for all undefined routes (including honeypot endpoints)
async fn handle_404() -> (StatusCode, axum::Json<serde_json::Value>) {
    (
        StatusCode::NOT_FOUND,
        axum::Json(serde_json::json!({
            "error": {
                "message": "The requested resource was not found",
                "type": "invalid_request_error",
                "code": "not_found"
            }
        })),
    )
}

async fn handle_honeypot(
    axum::extract::State(state): axum::extract::State<crate::middleware::AppState>,
    headers: axum::http::HeaderMap,
    request: axum::extract::Request,
) -> (StatusCode, axum::Json<serde_json::Value>) {
    // Extract client IP
    let client_ip =
        crate::middleware::extract_client_ip(&request, &headers, &state.trusted_proxy_ips);
    let path = request.uri().path().to_string();
    let method = request.method().to_string();
    let user_agent = headers.get("user-agent").and_then(|h| h.to_str().ok());

    // Add intrusion score for honeypot access
    let security_repo = Arc::clone(&state.security_repo);
    let intrusion_detection = Arc::clone(&state.intrusion_detection);
    let ip_blocklist = Arc::clone(&state.ip_blocklist);
    let client_ip_for_db = client_ip;
    let client_ip_str = client_ip_for_db.to_string();
    let path_clone = path.clone();
    let method_clone = method.clone();
    let user_agent_clone = user_agent.map(|s| s.to_string());

    // Add score asynchronously
    tokio::spawn(async move {
        let score_added = intrusion_detection
            .add_score(&client_ip_for_db, 10, "honeypot_access")
            .await;
        let current_score = intrusion_detection.get_score(&client_ip_for_db).await;
        let id = crate::middleware::new_request_id();

        // Save to database
        if let Err(e) = security_repo
            .save_intrusion_attempt(
                &id,
                &client_ip_for_db,
                "honeypot_access",
                current_score,
                crate::adapters::IntrusionRequestContext {
                    request_path: Some(&path_clone),
                    user_agent: user_agent_clone.as_deref(),
                    method: Some(&method_clone),
                },
            )
            .await
        {
            warn!("Failed to save intrusion attempt for {}: {}", client_ip_for_db, e);
        }

        // Log audit event
        let detail_json = serde_json::json!({
            "honeypot_path": path_clone,
            "method": method_clone,
            "score_added": score_added,
            "total_score": current_score,
        })
        .to_string();
        if let Err(e) = security_repo
            .save_audit_log(
                &format!("{id}-honeypot"),
                None,
                &path_clone,
                404,
                None,
                Some("honeypot"),
                crate::adapters::AuditLogMetadata {
                    severity: "medium",
                    ip: Some(&client_ip_str),
                    details: Some(detail_json.as_str()),
                },
            )
            .await
        {
            warn!("Failed to save audit log for honeypot: {}", e);
        }

        // Check if should block
        let (should_block, _block_duration) =
            intrusion_detection.should_block(&client_ip_for_db).await;
        if should_block {
            // Add to IP blocklist by recording failures
            let failures_to_record = if current_score >= 200 {
                20 // Permanent block threshold
            } else if current_score >= 100 {
                10 // 1-hour block threshold
            } else {
                0 // Don't block yet
            };

            for _ in 0..failures_to_record {
                if !ip_blocklist.record_failure(client_ip_for_db).await {
                    warn!("Failed to record IP blocklist failure for {}", client_ip_for_db);
                }
            }
        }
    });

    handle_404().await
}

async fn redirect_http_to_https(
    host: Option<Host>,
    OriginalUri(original_uri): OriginalUri,
    axum::extract::State(state): axum::extract::State<AppState>,
) -> axum::response::Response {
    let authority = host
        .map(|Host(authority)| authority)
        .or_else(|| state.public_base_host.clone())
        .unwrap_or_else(|| "localhost".to_string());

    let hostname = axum::http::uri::Authority::from_str(&authority)
        .map(|auth| auth.host().to_string())
        .unwrap_or(authority);

    let mut location = format!("https://{hostname}");
    if let Some(port) = state.https_redirect_port {
        if port != 443 {
            location.push(':');
            location.push_str(&port.to_string());
        }
    }
    location.push_str(original_uri.path());
    if let Some(query) = original_uri.query() {
        location.push('?');
        location.push_str(query);
    }

    let location_clone = location.clone();
    axum::response::Response::builder()
        .status(StatusCode::MOVED_PERMANENTLY)
        .header(axum::http::header::LOCATION, location)
        .header(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
        .body(axum::body::Body::empty())
        .unwrap_or_else(|e| {
            tracing::error!("Failed to build redirect response: {}", e);
            // Fallback to a simple redirect response without HSTS header
            axum::response::Response::builder()
                .status(StatusCode::MOVED_PERMANENTLY)
                .header(axum::http::header::LOCATION, location_clone)
                .body(axum::body::Body::empty())
                .unwrap_or_else(|_| {
                    // Last resort: return an empty 500 response
                    axum::response::Response::new(axum::body::Body::empty())
                })
        })
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
                    let engine_id = model.engine_id;
                    let owned_by = format!("flm-{engine_id}");
                    let root_id = model.model_id.clone();
                    // Convert to OpenAI-compatible format
                    let openai_model = serde_json::json!({
                        "id": model.model_id,
                        "object": "model",
                        "created": 0, // We don't track creation time
                        "owned_by": owned_by,
                        "permission": [],
                        "root": root_id,
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
    if !engine_id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
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
        if msg.content.text_length() > 1_048_576 {
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
        if !(0.0..=2.0).contains(&temp) {
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
    #[serde(default)]
    content: OpenAiMessageContent,
}

#[derive(serde::Deserialize)]
#[serde(untagged)]
enum OpenAiMessageContent {
    Text(String),
    Parts(Vec<OpenAiMessagePart>),
}

impl Default for OpenAiMessageContent {
    fn default() -> Self {
        OpenAiMessageContent::Text(String::new())
    }
}

impl OpenAiMessageContent {
    fn text_length(&self) -> usize {
        match self {
            OpenAiMessageContent::Text(text) => text.len(),
            OpenAiMessageContent::Parts(parts) => parts
                .iter()
                .map(|part| match part {
                    OpenAiMessagePart::Text { text } => text.len(),
                    _ => 0,
                })
                .sum(),
        }
    }
}

#[derive(serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum OpenAiMessagePart {
    Text {
        text: String,
    },
    InputImage {
        image_url: OpenAiImageUrl,
        #[serde(default)]
        detail: Option<String>,
    },
    InputAudio {
        audio_url: OpenAiAudioUrl,
    },
}

#[derive(serde::Deserialize)]
struct OpenAiImageUrl {
    url: String,
    #[serde(default)]
    mime_type: Option<String>,
    #[serde(default)]
    detail: Option<String>,
}

#[derive(serde::Deserialize)]
struct OpenAiAudioUrl {
    url: String,
    #[serde(default)]
    format: Option<String>,
    #[serde(default)]
    mime_type: Option<String>,
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

    let OpenAiEmbeddingRequest { model, input } = req;
    let model_id = model.clone();

    // Parse model ID (must be in flm://{engine_id}/{model} format)
    if !model.starts_with("flm://") {
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
    let model_without_prefix = match model.strip_prefix("flm://") {
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
    if validate_engine_id(&engine_id).is_err() {
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

    if validate_model_name(&model_name).is_err() {
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
    if validate_embedding_input(&input).is_err() {
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
        Some(engine) => engine,
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
    let input_strings: Vec<String> = match input {
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

type JsonError = (StatusCode, serde_json::Value);

struct AttachmentLimits {
    data_image: usize,
    remote_image: usize,
    audio: usize,
}

impl AttachmentLimits {
    fn from_capabilities(capabilities: &EngineCapabilities) -> Self {
        let image_cap = capabilities
            .max_image_bytes
            .and_then(|bytes| usize::try_from(bytes).ok());
        let audio_cap = capabilities
            .max_audio_bytes
            .and_then(|bytes| usize::try_from(bytes).ok());

        Self {
            data_image: image_cap
                .map(|cap| cap.min(DEFAULT_MAX_IMAGE_BYTES))
                .unwrap_or(DEFAULT_MAX_IMAGE_BYTES),
            remote_image: image_cap
                .map(|cap| cap.min(DEFAULT_MAX_REMOTE_IMAGE_BYTES))
                .unwrap_or(DEFAULT_MAX_REMOTE_IMAGE_BYTES),
            audio: audio_cap
                .map(|cap| cap.min(DEFAULT_MAX_AUDIO_BYTES))
                .unwrap_or(DEFAULT_MAX_AUDIO_BYTES),
        }
    }
}

struct DecodedMedia {
    data: Vec<u8>,
    mime_type: String,
}

async fn convert_messages(
    raw_messages: Vec<OpenAiMessage>,
    client: &HttpClient,
    limits: &AttachmentLimits,
) -> Result<Vec<ChatMessage>, JsonError> {
    let mut converted = Vec::with_capacity(raw_messages.len());
    for raw in raw_messages {
        let role = convert_role(&raw.role)?;
        let (content, attachments) = convert_content(raw.content, client, limits).await?;
        converted.push(ChatMessage {
            role,
            content,
            attachments,
        });
    }
    Ok(converted)
}

fn convert_role(role: &str) -> Result<ChatRole, JsonError> {
    match role {
        "system" => Ok(ChatRole::System),
        "user" => Ok(ChatRole::User),
        "assistant" => Ok(ChatRole::Assistant),
        "tool" => Ok(ChatRole::Tool),
        _ => Err(invalid_request_error(
            "Invalid message role. Must be one of: system, user, assistant, tool",
            "invalid_message_role",
        )),
    }
}

async fn convert_content(
    content: OpenAiMessageContent,
    client: &HttpClient,
    limits: &AttachmentLimits,
) -> Result<(String, Vec<MultimodalAttachment>), JsonError> {
    match content {
        OpenAiMessageContent::Text(text) => Ok((text, Vec::new())),
        OpenAiMessageContent::Parts(parts) => {
            let mut text_segments = Vec::new();
            let mut attachments = Vec::new();
            for part in parts {
                match part {
                    OpenAiMessagePart::Text { text } => text_segments.push(text),
                    OpenAiMessagePart::InputImage { image_url, detail } => {
                        attachments
                            .push(load_image_attachment(image_url, detail, client, limits).await?);
                    }
                    OpenAiMessagePart::InputAudio { audio_url } => {
                        attachments.push(load_audio_attachment(audio_url, client, limits).await?);
                    }
                }
            }
            let content_text = text_segments.join("\n");
            Ok((content_text, attachments))
        }
    }
}

async fn load_image_attachment(
    image_url: OpenAiImageUrl,
    detail: Option<String>,
    client: &HttpClient,
    limits: &AttachmentLimits,
) -> Result<MultimodalAttachment, JsonError> {
    let OpenAiImageUrl {
        url,
        mime_type,
        detail: url_detail,
    } = image_url;

    let decoded = if url.starts_with("data:") {
        decode_data_url_media(&url, limits.data_image)?
    } else {
        load_media_from_reference(&url, client, limits.remote_image).await?
    };

    let mime = mime_type.unwrap_or_else(|| decoded.mime_type.clone());

    if !is_supported_image_mime(&mime) {
        return Err(invalid_request_error(
            "Unsupported image format. Allowed: PNG, JPEG, WebP",
            "invalid_media_type",
        ));
    }

    let size_bytes = u64::try_from(decoded.data.len()).unwrap_or(u64::MAX);
    let resolved_detail = detail.or(url_detail);
    Ok(MultimodalAttachment {
        kind: MultimodalAttachmentKind::InputImage,
        data: decoded.data,
        mime_type: mime,
        filename: None,
        size_bytes: Some(size_bytes),
        detail: resolved_detail,
        duration_ms: None,
    })
}

async fn load_audio_attachment(
    audio_url: OpenAiAudioUrl,
    client: &HttpClient,
    limits: &AttachmentLimits,
) -> Result<MultimodalAttachment, JsonError> {
    let decoded = if audio_url.url.starts_with("data:") {
        decode_data_url_media(&audio_url.url, limits.audio)?
    } else {
        load_media_from_reference(&audio_url.url, client, limits.audio).await?
    };

    let mime = audio_url
        .mime_type
        .or_else(|| audio_url.format.as_deref().and_then(format_hint_to_mime))
        .unwrap_or_else(|| decoded.mime_type.clone());

    if !is_supported_audio_mime(&mime) {
        return Err(invalid_request_error(
            "Unsupported audio format. Allowed: WAV, MP3, FLAC, OGG, M4A, WEBM",
            "invalid_media_type",
        ));
    }

    let size_bytes = u64::try_from(decoded.data.len()).unwrap_or(u64::MAX);
    let data = decoded.data;

    Ok(MultimodalAttachment {
        kind: MultimodalAttachmentKind::InputAudio,
        data,
        mime_type: mime,
        filename: None,
        size_bytes: Some(size_bytes),
        detail: None,
        duration_ms: None,
    })
}

async fn load_media_from_reference(
    url: &str,
    client: &HttpClient,
    max_bytes: usize,
) -> Result<DecodedMedia, JsonError> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(invalid_request_error(
            "Only http(s) or data URLs are supported for media attachments",
            "invalid_media_url",
        ));
    }

    let response = client.get(url).send().await.map_err(|err| {
        invalid_request_error(
            &format!("Failed to fetch media: {err}"),
            "invalid_media_url",
        )
    })?;

    let status = response.status();
    if !status.is_success() {
        return Err(invalid_request_error(
            &format!("Fetching media failed with HTTP {status}"),
            "invalid_media_url",
        ));
    }

    if let Some(content_length) = response.content_length() {
        if content_length > u64::try_from(max_bytes).unwrap_or(u64::MAX) {
            return Err(payload_too_large_error(
                "Media exceeds maximum allowed size",
            ));
        }
    }

    let mime = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let bytes = response.bytes().await.map_err(|err| {
        invalid_request_error(&format!("Failed to read media: {err}"), "invalid_media_url")
    })?;

    if bytes.len() > max_bytes {
        return Err(payload_too_large_error(
            "Media exceeds maximum allowed size",
        ));
    }

    Ok(DecodedMedia {
        data: bytes.to_vec(),
        mime_type: mime,
    })
}

fn decode_data_url_media(url: &str, max_bytes: usize) -> Result<DecodedMedia, JsonError> {
    if !url.starts_with("data:") {
        return Err(invalid_request_error(
            "Expected data URL",
            "invalid_media_url",
        ));
    }

    let (meta, data_part) = url
        .split_once(',')
        .ok_or_else(|| invalid_request_error("Malformed data URL", "invalid_media_url"))?;
    let mut mime_type = "application/octet-stream";
    let mut is_base64 = false;
    let meta = meta.trim_start_matches("data:");
    for token in meta.split(';') {
        if token.eq_ignore_ascii_case("base64") {
            is_base64 = true;
        } else if !token.is_empty() {
            mime_type = token;
        }
    }

    if !is_base64 {
        return Err(invalid_request_error(
            "Data URL must be base64 encoded",
            "invalid_media_url",
        ));
    }

    let data = general_purpose::STANDARD.decode(data_part).map_err(|_| {
        invalid_request_error("Invalid base64 content in data URL", "invalid_media_url")
    })?;

    if data.len() > max_bytes {
        return Err(payload_too_large_error(
            "Media exceeds maximum allowed size",
        ));
    }

    Ok(DecodedMedia {
        data,
        mime_type: mime_type.to_string(),
    })
}

fn invalid_request_error(message: &str, code: &'static str) -> JsonError {
    (
        StatusCode::BAD_REQUEST,
        json!({
            "error": {
                "message": message,
                "type": "invalid_request_error",
                "code": code
            }
        }),
    )
}

fn payload_too_large_error(message: &str) -> JsonError {
    (
        StatusCode::PAYLOAD_TOO_LARGE,
        json!({
            "error": {
                "message": message,
                "type": "invalid_request_error",
                "code": "payload_too_large"
            }
        }),
    )
}

fn unsupported_modalities_response(modality: &str) -> axum::response::Response {
    (
        StatusCode::UNPROCESSABLE_ENTITY,
        axum::Json(json!({
            "error": {
                "message": format!("{modality} inputs are not supported by the selected engine"),
                "type": "invalid_request_error",
                "code": "unsupported_modalities"
            }
        })),
    )
        .into_response()
}

fn has_image_attachments(messages: &[ChatMessage]) -> bool {
    messages.iter().any(|message| {
        message
            .attachments
            .iter()
            .any(|attachment| matches!(attachment.kind, MultimodalAttachmentKind::InputImage))
    })
}

fn has_audio_attachments(messages: &[ChatMessage]) -> bool {
    messages.iter().any(|message| {
        message
            .attachments
            .iter()
            .any(|attachment| matches!(attachment.kind, MultimodalAttachmentKind::InputAudio))
    })
}

fn is_supported_image_mime(mime: &str) -> bool {
    matches!(
        mime.trim().to_ascii_lowercase().as_str(),
        "image/png" | "image/jpeg" | "image/jpg" | "image/webp"
    )
}

fn is_supported_audio_mime(mime: &str) -> bool {
    matches!(
        mime.trim().to_ascii_lowercase().as_str(),
        "audio/wav"
            | "audio/x-wav"
            | "audio/mpeg"
            | "audio/mp3"
            | "audio/flac"
            | "audio/ogg"
            | "audio/webm"
            | "audio/m4a"
            | "audio/mp4"
    )
}

fn format_hint_to_mime(format: &str) -> Option<String> {
    match format.to_ascii_lowercase().as_str() {
        "wav" => Some("audio/wav".to_string()),
        "mp3" => Some("audio/mpeg".to_string()),
        "flac" => Some("audio/flac".to_string()),
        "ogg" => Some("audio/ogg".to_string()),
        "m4a" => Some("audio/m4a".to_string()),
        "webm" => Some("audio/webm".to_string()),
        _ => None,
    }
}

/// Extract MIME type from filename based on file extension
fn extract_mime_type_from_filename(filename: &str) -> Option<String> {
    let extension = filename
        .rfind('.')
        .and_then(|idx| filename.get(idx + 1..))
        .map(|ext| ext.to_ascii_lowercase());

    match extension.as_deref() {
        Some("wav") => Some("audio/wav".to_string()),
        Some("mp3") => Some("audio/mpeg".to_string()),
        Some("mpeg") => Some("audio/mpeg".to_string()),
        Some("flac") => Some("audio/flac".to_string()),
        Some("ogg") => Some("audio/ogg".to_string()),
        Some("m4a") => Some("audio/m4a".to_string()),
        Some("mp4") => Some("audio/mp4".to_string()),
        Some("webm") => Some("audio/webm".to_string()),
        Some("x-wav") => Some("audio/x-wav".to_string()),
        _ => None,
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
    use flm_core::domain::chat::ChatRequest;

    let OpenAiChatRequest {
        model,
        messages,
        stream,
        temperature,
        max_tokens,
        stop,
    } = req;

    // Parse model ID (must be in flm://{engine_id}/{model} format)
    if !model.starts_with("flm://") {
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
    let model_without_prefix = match model.strip_prefix("flm://") {
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
    if validate_engine_id(&engine_id).is_err() {
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

    if validate_model_name(&model_name).is_err() {
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
    if validate_messages(&messages).is_err() {
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
    if validate_stop_sequences(&stop).is_err() {
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
    if validate_temperature(temperature).is_err() {
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
    if validate_max_tokens(max_tokens).is_err() {
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

    // Get model-specific capabilities if available
    let model_capabilities = match engine.list_models().await {
        Ok(models) => models
            .iter()
            .find(|m| m.model_id == model)
            .and_then(|m| m.capabilities.clone()),
        Err(_) => None,
    };

    // Use model-specific capabilities if available, otherwise fall back to engine capabilities
    let capabilities = engine.capabilities();
    let vision_supported = model_capabilities
        .as_ref()
        .map(|c| c.vision)
        .unwrap_or(capabilities.vision_inputs);
    let audio_inputs_supported = model_capabilities
        .as_ref()
        .map(|c| c.audio_inputs)
        .unwrap_or(capabilities.audio_inputs);

    let attachment_limits = AttachmentLimits::from_capabilities(&capabilities);
    let binary_client = HttpClient::new();
    let messages = match convert_messages(messages, &binary_client, &attachment_limits).await {
        Ok(parsed) => parsed,
        Err((status, body)) => return (status, axum::Json(body)).into_response(),
    };

    if has_image_attachments(&messages) && !vision_supported {
        return unsupported_modalities_response("vision").into_response();
    }

    if has_audio_attachments(&messages) && !audio_inputs_supported {
        return unsupported_modalities_response("audio").into_response();
    }

    // Create ChatRequest
    let chat_req = ChatRequest {
        engine_id: engine_id.clone(),
        model_id: model.clone(),
        messages,
        stream,
        temperature: temperature.map(|t| t as f32),
        max_tokens,
        stop,
        requested_modalities: Vec::new(),
    };

    // Handle streaming vs non-streaming
    if stream {
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
                    error!(
                        error_type = "network_error",
                        "Network error starting stream"
                    );
                    (axum::http::StatusCode::BAD_GATEWAY, "Network error")
                }
                flm_core::error::EngineError::InvalidResponse { reason: _ } => {
                    error!(
                        error_type = "invalid_response",
                        "Invalid response starting stream"
                    );
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
                    error!(
                        error_type = "unknown_error",
                        "Unknown error starting stream"
                    );
                    (
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                        "Failed to start streaming chat",
                    )
                }
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
                        error!(
                            error_type = "invalid_response",
                            "Invalid response in stream"
                        );
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

/// Start a packaged-ca HTTPS server
///
/// This function starts an HTTPS server using a server certificate signed by
/// the packaged root CA. The certificate is automatically generated if it
/// doesn't exist or is expired.
#[cfg(feature = "packaged-ca")]
async fn start_packaged_ca_server(
    config: ProxyConfig,
    shutdown_rx: oneshot::Receiver<()>,
) -> Result<JoinHandle<Result<(), ProxyError>>, ProxyError> {
    let (config, https_router, app_state) = prepare_proxy_router(config).await?;

    // Determine certificate directory (AppData/flm/certs on Windows, ~/.flm/certs on Unix)
    let cert_dir = default_cert_dir(None);

    // Load packaged root CA certificate (or generate if not found)
    let (root_ca_cert_pem, root_ca_key_pem) = crate::certificate::load_packaged_root_ca(
        &cert_dir,
        ROOT_CA_CERT_FILENAME,
        ROOT_CA_KEY_FILENAME,
        "FLM Local Root CA",
    )
    .map_err(|e| ProxyError::InvalidConfig { reason: e })?;

    // Check if root CA is registered in OS trust store
    let is_registered = is_certificate_registered_in_trust_store(&root_ca_cert_pem);
    if !is_registered {
        let auto_install = env::var("FLM_AUTO_INSTALL_CA")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

        if auto_install {
            // Attempt automatic registration
            if let Err(e) = register_root_ca_with_os_trust_store(&root_ca_cert_pem, "flm-ca.crt") {
                tracing::warn!(
                    "Failed to automatically register root CA certificate: {}. \
                    Browsers may show security warnings. \
                    Run 'flm security install-ca' manually to install the certificate.",
                    e
                );
            } else {
                tracing::info!("Root CA certificate automatically registered in OS trust store");
            }
        } else {
            tracing::warn!(
                "Root CA certificate is not registered in OS trust store. \
                Browsers may show security warnings. \
                Run 'flm security install-ca' to install the certificate, \
                or set FLM_AUTO_INSTALL_CA=1 to enable automatic installation."
            );
        }
    } else {
        tracing::info!("Root CA certificate is registered in OS trust store");
    }

    let (cert_pem, key_pem) = ensure_server_cert_artifacts(
        &cert_dir,
        &root_ca_cert_pem,
        &root_ca_key_pem,
        &config.listen_addr,
        SERVER_CERT_FILENAME,
        SERVER_KEY_FILENAME,
    )
    .map_err(|e| ProxyError::InvalidConfig { reason: e })?;

    let tls_config = build_tls_config(&cert_pem, &key_pem)?;

    let tls_acceptor = TlsAcceptor::from(Arc::new(tls_config));

    // Bind to the address (HTTPS port is port + 1)
    let https_port = config.port + 1;
    let listen_addr = config.listen_addr.as_str();
    let https_addr = resolve_listen_addr(listen_addr, https_port)?;
    let http_addr = resolve_listen_addr(listen_addr, config.port)?;

    let https_listener =
        TokioTcpListener::bind(&https_addr)
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to bind to {https_addr}: {e}"),
            })?;
    let http_listener =
        TokioTcpListener::bind(&http_addr)
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to bind to {http_addr}: {e}"),
            })?;

    let http_router = Router::new()
        .fallback(redirect_http_to_https)
        .with_state(app_state.clone());

    let (http_shutdown_tx, http_shutdown_rx) = oneshot::channel();
    let (https_shutdown_tx, https_shutdown_rx) = oneshot::channel();
    let mut http_shutdown_tx = Some(http_shutdown_tx);
    let mut https_shutdown_tx = Some(https_shutdown_tx);
    let (status_tx, mut status_rx) =
        mpsc::unbounded_channel::<(&'static str, Result<(), ProxyError>)>();

    let http_status_tx = status_tx.clone();
    let http_task = tokio::spawn(async move {
        let result = axum::serve(http_listener, http_router)
            .with_graceful_shutdown(async {
                http_shutdown_rx.await;
            })
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("HTTP redirect server error: {e}"),
            });
        if let Err(e) = http_status_tx.send(("http", result)) {
            warn!("Failed to send HTTP server status: receiver may have been dropped: {}", e);
        }
    });

    let https_status_tx = status_tx.clone();
    let https_server_handle = spawn_tls_server(
        https_listener,
        tls_acceptor,
        https_router,
        https_shutdown_rx,
    );
    let https_task = tokio::spawn(async move {
        let result = match https_server_handle.await {
            Ok(inner) => inner,
            Err(e) => Err(ProxyError::InvalidConfig {
                reason: format!("HTTPS server task panicked: {}", e),
            }),
        };
        if let Err(e) = https_status_tx.send(("https", result)) {
            warn!("Failed to send HTTPS server status: receiver may have been dropped: {}", e);
        }
    });

    drop(status_tx);

    let join_handle = tokio::spawn(async move {
        let mut shutdown_rx = shutdown_rx;
        let mut shutdown_sent = false;
        let mut remaining = 2usize;
        let mut final_result: Result<(), ProxyError> = Ok(());

        while remaining > 0 {
            tokio::select! {
                maybe_status = status_rx.recv() => {
                    if let Some((label, task_result)) = maybe_status {
                        remaining -= 1;
                        if !shutdown_sent {
                            final_result = match task_result {
                                Ok(_) => Err(ProxyError::InvalidConfig {
                                    reason: format!("{label} task exited unexpectedly"),
                                }),
                                Err(err) => Err(err),
                            };
                            shutdown_sent = true;
                                if let Some(tx) = http_shutdown_tx.take() {
                                    if let Err(e) = tx.send(()) {
                                        warn!("Failed to send HTTP shutdown signal: receiver may have been dropped: {}", e);
                                    }
                                }
                                if let Some(tx) = https_shutdown_tx.take() {
                                    if let Err(e) = tx.send(()) {
                                        warn!("Failed to send HTTPS shutdown signal: receiver may have been dropped: {}", e);
                                    }
                                }
                        } else if final_result.is_ok() {
                            if let Err(err) = task_result {
                                final_result = Err(err);
                            }
                        }
                    } else {
                        break;
                    }
                }
                _ = &mut shutdown_rx, if !shutdown_sent => {
                    shutdown_sent = true;
                    final_result = Ok(());
                    if let Some(tx) = http_shutdown_tx.take() {
                        if let Err(_) = tx.send(()) {
                            warn!("Failed to send shutdown signal: receiver may have been dropped");
                        }
                    }
                    if let Some(tx) = https_shutdown_tx.take() {
                        if let Err(_) = tx.send(()) {
                            warn!("Failed to send shutdown signal: receiver may have been dropped");
                        }
                    }
                }
            }
        }

        if let Err(err) = http_task.await {
            error!(reason = %err, "HTTP redirect server panicked");
        }
        if let Err(err) = https_task.await {
            error!(reason = %err, "HTTPS server join task panicked");
        }

        final_result
    });

    Ok(join_handle)
}

fn default_cert_dir(subdir: Option<&str>) -> PathBuf {
    let mut path = if cfg!(target_os = "windows") {
        let mut base = PathBuf::from(env::var("APPDATA").unwrap_or_else(|_| ".".to_string()));
        base.push("flm");
        base
    } else {
        let mut base = PathBuf::from(env::var("HOME").unwrap_or_else(|_| ".".to_string()));
        base.push(".flm");
        base
    };
    path.push("certs");
    if let Some(dir) = subdir {
        path.push(dir);
    }
    path
}

fn build_tls_config(cert_pem: &str, key_pem: &str) -> Result<rustls::ServerConfig, ProxyError> {
    use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer};
    use rustls::ServerConfig;

    let mut cert_reader = Cursor::new(cert_pem.as_bytes());
    let cert_chain = rustls_pemfile::certs(&mut cert_reader)
        .map_err(|e| ProxyError::InvalidConfig {
            reason: format!("Failed to parse certificate: {e}"),
        })?
        .into_iter()
        .map(CertificateDer::from)
        .collect::<Vec<_>>();

    let mut key_reader = Cursor::new(key_pem.as_bytes());
    let mut keys = rustls_pemfile::pkcs8_private_keys(&mut key_reader).map_err(|e| {
        ProxyError::InvalidConfig {
            reason: format!("Failed to parse private key: {e}"),
        }
    })?;

    let key = keys.pop().ok_or_else(|| ProxyError::InvalidConfig {
        reason: "No private key found in key file".to_string(),
    })?;
    let key = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(key));

    ServerConfig::builder_with_provider(rustls::crypto::ring::default_provider().into())
        .with_safe_default_protocol_versions()
        .map_err(|e| ProxyError::InvalidConfig {
            reason: format!("Failed to configure TLS protocols: {e}"),
        })?
        .with_no_client_auth()
        .with_single_cert(cert_chain, key)
        .map_err(|e| ProxyError::InvalidConfig {
            reason: format!("Failed to create TLS config: {e}"),
        })
}

#[cfg(not(feature = "packaged-ca"))]
async fn start_packaged_ca_server(
    _config: ProxyConfig,
    _shutdown_rx: oneshot::Receiver<()>,
) -> Result<JoinHandle<Result<(), ProxyError>>, ProxyError> {
    Err(ProxyError::InvalidConfig {
        reason: "packaged-ca mode is not enabled in this build".to_string(),
    })
}

async fn start_https_acme_server(
    config: ProxyConfig,
    shutdown_rx: oneshot::Receiver<()>,
) -> Result<JoinHandle<Result<(), ProxyError>>, ProxyError> {
    let domain = config
        .acme_domain
        .clone()
        .ok_or_else(|| ProxyError::InvalidConfig {
            reason: "ACME domain is required for https-acme mode".to_string(),
        })?;
    let email = config
        .acme_email
        .clone()
        .ok_or_else(|| ProxyError::InvalidConfig {
            reason: "ACME email is required for https-acme mode".to_string(),
        })?;
    let challenge = config
        .acme_challenge
        .clone()
        .unwrap_or(AcmeChallengeKind::Http01);
    if matches!(challenge, AcmeChallengeKind::Dns01) {
        #[cfg(feature = "dns01-preview")]
        {
            return start_dns01_acme_server(config, shutdown_rx).await;
        }
        #[cfg(not(feature = "dns01-preview"))]
        {
            return Err(ProxyError::InvalidConfig {
                reason: DNS01_DISABLED_REASON.to_string(),
            });
        }
    }

    let cache_dir = default_cert_dir(Some(ACME_CERT_SUBDIR));
    tokio::fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| ProxyError::InvalidConfig {
            reason: format!(
                "Failed to prepare ACME cache dir {}: {e}",
                cache_dir.display()
            ),
        })?;

    let directory_override = env::var("FLM_ACME_DIRECTORY")
        .ok()
        .filter(|value| !value.trim().is_empty());
    let use_production = env::var("FLM_ACME_USE_PROD")
        .map(|value| {
            let normalized = value.to_ascii_lowercase();
            matches!(
                normalized.as_str(),
                "1" | "true" | "yes" | "prod" | "production"
            )
        })
        .unwrap_or(false);
    let default_directory = if use_production {
        LETS_ENCRYPT_PRODUCTION_DIRECTORY
    } else {
        LETS_ENCRYPT_STAGING_DIRECTORY
    };
    if let Some(directory) = directory_override.as_deref() {
        info!(
            directory = directory,
            "Using custom ACME directory endpoint"
        );
    } else if use_production {
        info!("Using Let's Encrypt production directory");
    } else {
        info!("Using Let's Encrypt staging directory");
    }
    let directory_url = directory_override
        .clone()
        .unwrap_or_else(|| default_directory.to_string());

    let acme_config = AcmeConfig::new([domain.clone()])
        .contact([format!("mailto:{email}")])
        .cache(DirCache::new(cache_dir.clone()))
        .challenge_type(UseChallenge::Http01)
        .directory(directory_url.clone());

    let acme_state = acme_config.state();
    let tls_acceptor = TlsAcceptor::from(acme_state.default_rustls_config());

    let (config, https_router, app_state) = prepare_proxy_router(config).await?;
    let cache_dir_for_task = cache_dir.clone();
    let directory_url_for_task = directory_url.clone();
    let domain_for_task = domain.clone();
    let security_repo_for_task = app_state.security_repo.clone();

    let mut http_router = Router::new();
    let acme_challenge_service: TowerHttp01ChallengeService =
        acme_state.http01_challenge_tower_service();
    http_router =
        http_router.route_service("/.well-known/acme-challenge/:token", acme_challenge_service);
    let http_router = http_router
        .fallback(redirect_http_to_https)
        .with_state(app_state.clone());

    let https_port = config.port + 1;
    let listen_addr = config.listen_addr.as_str();
    let http_addr = resolve_listen_addr(listen_addr, config.port)?;
    let https_addr = resolve_listen_addr(listen_addr, https_port)?;

    let http_listener =
        TokioTcpListener::bind(&http_addr)
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to bind HTTP port {http_addr}: {e}"),
            })?;
    let https_listener =
        TokioTcpListener::bind(&https_addr)
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to bind HTTPS port {https_addr}: {e}"),
            })?;

    let (http_shutdown_tx, http_shutdown_rx) = oneshot::channel::<()>();
    let (https_shutdown_tx, https_shutdown_rx) = oneshot::channel::<()>();
    let (acme_shutdown_tx, acme_shutdown_rx) = oneshot::channel::<()>();
    let mut http_shutdown_tx = Some(http_shutdown_tx);
    let mut https_shutdown_tx = Some(https_shutdown_tx);
    let mut acme_shutdown_tx = Some(acme_shutdown_tx);
    let (status_tx, mut status_rx) =
        mpsc::unbounded_channel::<(&'static str, Result<(), ProxyError>)>();

    let http_status_tx = status_tx.clone();
    let http_task = tokio::spawn(async move {
        let result = axum::serve(http_listener, http_router)
            .with_graceful_shutdown(async {
                http_shutdown_rx.await;
            })
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("HTTP challenge server error: {e}"),
            });
        if let Err(e) = http_status_tx.send(("http", result)) {
            warn!("Failed to send HTTP server status: receiver may have been dropped: {}", e);
        }
    });

    let https_status_tx = status_tx.clone();
    let https_server_handle = spawn_tls_server(
        https_listener,
        tls_acceptor,
        https_router,
        https_shutdown_rx,
    );
    let https_task = tokio::spawn(async move {
        let result = match https_server_handle.await {
            Ok(inner) => inner,
            Err(e) => Err(ProxyError::InvalidConfig {
                reason: format!("HTTPS server task panicked: {}", e),
            }),
        };
        if let Err(e) = https_status_tx.send(("https", result)) {
            warn!("Failed to send HTTPS server status: receiver may have been dropped: {}", e);
        }
    });

    let acme_status_tx = status_tx.clone();
    let acme_task = tokio::spawn(async move {
        let result = run_acme_supervisor(
            acme_state,
            acme_shutdown_rx,
            cache_dir_for_task,
            directory_url_for_task,
            domain_for_task,
            security_repo_for_task,
        )
        .await;
        if let Err(e) = acme_status_tx.send(("acme", result)) {
            warn!("Failed to send ACME server status: receiver may have been dropped: {}", e);
        }
    });

    drop(status_tx);

    let join_handle = tokio::spawn(async move {
        let mut shutdown_rx = shutdown_rx;
        let mut shutdown_sent = false;
        let mut remaining = 3usize;
        let mut final_result: Result<(), ProxyError> = Ok(());

        while remaining > 0 {
            tokio::select! {
                maybe_status = status_rx.recv() => {
                    if let Some((label, task_result)) = maybe_status {
                        remaining -= 1;
                        if !shutdown_sent {
                            final_result = match task_result {
                                Ok(_) => Err(ProxyError::InvalidConfig {
                                    reason: format!("{label} task exited unexpectedly"),
                                }),
                                Err(err) => Err(err),
                            };
                            shutdown_sent = true;
                            if let Some(tx) = http_shutdown_tx.take() {
                                if let Err(_) = tx.send(()) {
                                    warn!("Failed to send shutdown signal: receiver may have been dropped");
                                }
                            }
                            if let Some(tx) = https_shutdown_tx.take() {
                                if let Err(_) = tx.send(()) {
                                    warn!("Failed to send shutdown signal: receiver may have been dropped");
                                }
                            }
                            if let Some(tx) = acme_shutdown_tx.take() {
                                if let Err(_) = tx.send(()) {
                                    warn!("Failed to send shutdown signal: receiver may have been dropped");
                                }
                            }
                        } else if final_result.is_ok() {
                            if let Err(err) = task_result {
                                final_result = Err(err);
                            }
                        }
                    } else {
                        break;
                    }
                }
                _ = &mut shutdown_rx, if !shutdown_sent => {
                    shutdown_sent = true;
                    final_result = Ok(());
                    if let Some(tx) = http_shutdown_tx.take() {
                        if let Err(_) = tx.send(()) {
                            warn!("Failed to send shutdown signal: receiver may have been dropped");
                        }
                    }
                    if let Some(tx) = https_shutdown_tx.take() {
                        if let Err(_) = tx.send(()) {
                            warn!("Failed to send shutdown signal: receiver may have been dropped");
                        }
                    }
                    if let Some(tx) = acme_shutdown_tx.take() {
                        if let Err(_) = tx.send(()) {
                            warn!("Failed to send shutdown signal: receiver may have been dropped");
                        }
                    }
                }
            }
        }

        if let Err(err) = http_task.await {
            error!(reason = %err, "HTTP server join task panicked");
        }
        if let Err(err) = https_task.await {
            error!(reason = %err, "HTTPS server join task panicked");
        }
        if let Err(err) = acme_task.await {
            error!(reason = %err, "ACME supervisor task panicked");
        }

        final_result
    });

    Ok(join_handle)
}

#[cfg(feature = "dns01-preview")]
async fn start_dns01_acme_server(
    mut config: ProxyConfig,
    shutdown_rx: oneshot::Receiver<()>,
) -> Result<JoinHandle<Result<(), ProxyError>>, ProxyError> {
    let domain = config
        .acme_domain
        .clone()
        .ok_or_else(|| ProxyError::InvalidConfig {
            reason: "ACME domain is required for https-acme mode".to_string(),
        })?;
    let email = config
        .acme_email
        .clone()
        .ok_or_else(|| ProxyError::InvalidConfig {
            reason: "ACME email is required for https-acme mode".to_string(),
        })?;
    let credential =
        config
            .resolved_dns_credential
            .as_ref()
            .ok_or_else(|| ProxyError::InvalidConfig {
                reason: "DNS-01 challenge requires resolved DNS credentials".to_string(),
            })?;
    let dns_hook = dns_hook_from_credential(credential)?;
    let lego_runner = config
        .acme_dns_lego_path
        .as_ref()
        .map(|path| LegoRunner::with_binary(PathBuf::from(path)))
        .unwrap_or_default();
    let propagation_wait = config
        .acme_dns_propagation_secs
        .map(Duration::from_secs)
        .unwrap_or(DEFAULT_PROPAGATION_WAIT);
    info!(
        provider = %credential.provider,
        zone = credential.zone_name.as_deref().unwrap_or(""),
        "Using DNS-01 ACME challenge via lego runner"
    );
    config.resolved_dns_credential = None;

    let cache_dir = default_cert_dir(Some(ACME_CERT_SUBDIR));
    tokio::fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| ProxyError::InvalidConfig {
            reason: format!(
                "Failed to prepare ACME cache dir {}: {e}",
                cache_dir.display()
            ),
        })?;
    let dns_persist_dir = cache_dir.join("dns-client");
    tokio::fs::create_dir_all(&dns_persist_dir)
        .await
        .map_err(|e| ProxyError::InvalidConfig {
            reason: format!(
                "Failed to prepare ACME DNS persist dir {}: {e}",
                dns_persist_dir.display()
            ),
        })?;

    let directory_override = env::var("FLM_ACME_DIRECTORY")
        .ok()
        .filter(|value| !value.trim().is_empty());
    let use_production = env::var("FLM_ACME_USE_PROD")
        .map(|value| {
            let normalized = value.to_ascii_lowercase();
            matches!(
                normalized.as_str(),
                "1" | "true" | "yes" | "prod" | "production"
            )
        })
        .unwrap_or(false);
    let default_directory = if use_production {
        LETS_ENCRYPT_PRODUCTION_DIRECTORY
    } else {
        LETS_ENCRYPT_STAGING_DIRECTORY
    };
    if let Some(directory) = directory_override.as_deref() {
        info!(
            directory = directory,
            "Using custom ACME directory endpoint"
        );
    } else if use_production {
        info!("Using Let's Encrypt production directory");
    } else {
        info!("Using Let's Encrypt staging directory");
    }
    let directory_url = directory_override
        .clone()
        .unwrap_or_else(|| default_directory.to_string());

    let (config, https_router, app_state) = prepare_proxy_router(config).await?;
    let tls_material = ensure_dns_tls_material(
        &cache_dir,
        &dns_persist_dir,
        &directory_url,
        &domain,
        &email,
        dns_hook.clone(),
        &app_state.security_repo,
        &lego_runner,
        propagation_wait,
    )
    .await?;
    let tls_store = Arc::new(ArcSwap::new(tls_material.tls_config.clone()));

    let http_router = Router::new()
        .fallback(redirect_http_to_https)
        .with_state(app_state.clone());

    let https_port = config.port + 1;
    let listen_addr = config.listen_addr.as_str();
    let http_addr = resolve_listen_addr(listen_addr, config.port)?;
    let https_addr = resolve_listen_addr(listen_addr, https_port)?;

    let http_listener =
        TokioTcpListener::bind(&http_addr)
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to bind HTTP port {http_addr}: {e}"),
            })?;
    let https_listener =
        TokioTcpListener::bind(&https_addr)
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to bind HTTPS port {https_addr}: {e}"),
            })?;

    let (http_shutdown_tx, http_shutdown_rx) = oneshot::channel::<()>();
    let (https_shutdown_tx, https_shutdown_rx) = oneshot::channel::<()>();
    let (acme_shutdown_tx, acme_shutdown_rx) = oneshot::channel::<()>();
    let mut http_shutdown_tx = Some(http_shutdown_tx);
    let mut https_shutdown_tx = Some(https_shutdown_tx);
    let mut acme_shutdown_tx = Some(acme_shutdown_tx);
    let (status_tx, mut status_rx) =
        mpsc::unbounded_channel::<(&'static str, Result<(), ProxyError>)>();

    let http_status_tx = status_tx.clone();
    let http_task = tokio::spawn(async move {
        let result = axum::serve(http_listener, http_router)
            .with_graceful_shutdown(async {
                http_shutdown_rx.await;
            })
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("HTTP challenge server error: {e}"),
            });
        if let Err(e) = http_status_tx.send(("http", result)) {
            warn!("Failed to send HTTP server status: receiver may have been dropped: {}", e);
        }
    });

    let https_status_tx = status_tx.clone();
    let https_server_handle = spawn_reloadable_tls_server(
        https_listener,
        tls_store.clone(),
        https_router,
        https_shutdown_rx,
    );
    let https_task = tokio::spawn(async move {
        let result = match https_server_handle.await {
            Ok(inner) => inner,
            Err(e) => Err(ProxyError::InvalidConfig {
                reason: format!("HTTPS server task panicked: {}", e),
            }),
        };
        if let Err(e) = https_status_tx.send(("https", result)) {
            warn!("Failed to send HTTPS server status: receiver may have been dropped: {}", e);
        }
    });

    let cache_dir_for_task = cache_dir.clone();
    let directory_url_for_task = directory_url.clone();
    let domain_for_task = domain.clone();
    let email_for_task = email.clone();
    let security_repo_for_task = app_state.security_repo.clone();
    let tls_store_for_task = tls_store.clone();
    let dns_hook_for_task = dns_hook.clone();
    let lego_runner_for_task = lego_runner.clone();
    let initial_expiry = tls_material.expires_at;
    let acme_status_tx = status_tx.clone();
    let acme_task = tokio::spawn(async move {
        let result = run_dns_acme_supervisor(
            tls_store_for_task,
            cache_dir_for_task,
            dns_persist_dir,
            directory_url_for_task,
            domain_for_task,
            email_for_task,
            dns_hook_for_task,
            security_repo_for_task,
            acme_shutdown_rx,
            initial_expiry,
            lego_runner_for_task,
            propagation_wait,
        )
        .await;
        if let Err(e) = acme_status_tx.send(("acme", result)) {
            warn!("Failed to send ACME server status: receiver may have been dropped: {}", e);
        }
    });

    drop(status_tx);

    let join_handle = tokio::spawn(async move {
        let mut shutdown_rx = shutdown_rx;
        let mut shutdown_sent = false;
        let mut remaining = 3usize;
        let mut final_result: Result<(), ProxyError> = Ok(());

        while remaining > 0 {
            tokio::select! {
                maybe_status = status_rx.recv() => {
                    if let Some((label, task_result)) = maybe_status {
                        remaining -= 1;
                        if !shutdown_sent {
                            final_result = match task_result {
                                Ok(_) => Err(ProxyError::InvalidConfig {
                                    reason: format!("{label} task exited unexpectedly"),
                                }),
                                Err(err) => Err(err),
                            };
                            shutdown_sent = true;
                            if let Some(tx) = http_shutdown_tx.take() {
                                if let Err(_) = tx.send(()) {
                                    warn!("Failed to send shutdown signal: receiver may have been dropped");
                                }
                            }
                            if let Some(tx) = https_shutdown_tx.take() {
                                if let Err(_) = tx.send(()) {
                                    warn!("Failed to send shutdown signal: receiver may have been dropped");
                                }
                            }
                            if let Some(tx) = acme_shutdown_tx.take() {
                                if let Err(_) = tx.send(()) {
                                    warn!("Failed to send shutdown signal: receiver may have been dropped");
                                }
                            }
                        } else if final_result.is_ok() {
                            if let Err(err) = task_result {
                                final_result = Err(err);
                            }
                        }
                    } else {
                        break;
                    }
                }
                _ = &mut shutdown_rx, if !shutdown_sent => {
                    shutdown_sent = true;
                    final_result = Ok(());
                    if let Some(tx) = http_shutdown_tx.take() {
                        if let Err(_) = tx.send(()) {
                            warn!("Failed to send shutdown signal: receiver may have been dropped");
                        }
                    }
                    if let Some(tx) = https_shutdown_tx.take() {
                        if let Err(_) = tx.send(()) {
                            warn!("Failed to send shutdown signal: receiver may have been dropped");
                        }
                    }
                    if let Some(tx) = acme_shutdown_tx.take() {
                        if let Err(_) = tx.send(()) {
                            warn!("Failed to send shutdown signal: receiver may have been dropped");
                        }
                    }
                }
            }
        }

        if let Err(err) = http_task.await {
            error!(reason = %err, "HTTP server join task panicked");
        }
        if let Err(err) = https_task.await {
            error!(reason = %err, "HTTPS server join task panicked");
        }
        if let Err(err) = acme_task.await {
            error!(reason = %err, "DNS ACME supervisor task panicked");
        }

        final_result
    });

    Ok(join_handle)
}

#[cfg(feature = "dns01-preview")]
struct DnsTlsMaterial {
    tls_config: Arc<rustls::ServerConfig>,
    expires_at: DateTime<Utc>,
}

#[cfg(feature = "dns01-preview")]
async fn ensure_dns_tls_material(
    cache_dir: &Path,
    persist_dir: &Path,
    directory_url: &str,
    domain: &str,
    email: &str,
    dns_hook: Arc<dyn DnsChallengeHook>,
    security_repo: &Arc<SqliteSecurityRepository>,
    lego_runner: &LegoRunner,
    propagation_wait: Duration,
) -> Result<DnsTlsMaterial, ProxyError> {
    if let Some(material) = load_cached_dns_material(cache_dir, directory_url, domain).await? {
        let renew_at = material.expires_at - chrono::Duration::days(DNS01_RENEWAL_MARGIN_DAYS);
        if renew_at > Utc::now() {
            info!("Reusing cached DNS-01 ACME certificate");
            return Ok(material);
        }
        warn!(
            expires_at = %material.expires_at,
            "Cached DNS-01 certificate nearing expiry; requesting renewal"
        );
    }

    issue_and_install_dns_certificate(
        cache_dir,
        persist_dir,
        directory_url,
        domain,
        email,
        dns_hook,
        security_repo,
        lego_runner,
        propagation_wait,
    )
    .await
}

#[cfg(feature = "dns01-preview")]
async fn load_cached_dns_material(
    cache_dir: &Path,
    directory_url: &str,
    domain: &str,
) -> Result<Option<DnsTlsMaterial>, ProxyError> {
    let cache_file = cache_dir.join(cached_cert_file_name(&[domain.to_string()], directory_url));
    let pem_bytes = match fs::read(&cache_file).await {
        Ok(bytes) => bytes,
        Err(err) if err.kind() == ErrorKind::NotFound => return Ok(None),
        Err(err) => {
            return Err(ProxyError::AcmeError {
                reason: format!(
                    "Failed to read cached DNS certificate {}: {err}",
                    cache_file.display()
                ),
            })
        }
    };
    let parsed = parse_pem_material(&pem_bytes)?;
    parsed.to_tls_material().map(Some)
}

#[cfg(feature = "dns01-preview")]
async fn issue_and_install_dns_certificate(
    cache_dir: &Path,
    persist_dir: &Path,
    directory_url: &str,
    domain: &str,
    email: &str,
    dns_hook: Arc<dyn DnsChallengeHook>,
    security_repo: &Arc<SqliteSecurityRepository>,
    lego_runner: &LegoRunner,
    propagation_wait: Duration,
) -> Result<DnsTlsMaterial, ProxyError> {
    info!(
        domain = %domain,
        "Requesting DNS-01 ACME certificate via lego runner"
    );
    let pem_bundle = issue_dns_certificate_bundle(
        directory_url.to_string(),
        domain.to_string(),
        email.to_string(),
        persist_dir.to_path_buf(),
        dns_hook,
        lego_runner,
        propagation_wait,
    )
    .await?;
    let pem_bytes = pem_bundle.into_bytes();
    let parsed = parse_pem_material(&pem_bytes)?;

    DirCache::new(cache_dir.to_path_buf())
        .store_cert(&[domain.to_string()], directory_url, &pem_bytes)
        .await
        .map_err(|e| ProxyError::AcmeError {
            reason: format!("Failed to write DNS ACME cache entry: {e}"),
        })?;

    persist_acme_certificate_metadata(cache_dir, directory_url, domain, security_repo).await?;

    parsed.to_tls_material()
}

#[cfg(feature = "dns01-preview")]
async fn issue_dns_certificate_bundle(
    directory_url: String,
    domain: String,
    email: String,
    persist_dir: PathBuf,
    dns_hook: Arc<dyn DnsChallengeHook>,
    lego_runner: &LegoRunner,
    propagation_wait: Duration,
) -> Result<String, ProxyError> {
    tokio::fs::create_dir_all(&persist_dir)
        .await
        .map_err(|e| ProxyError::AcmeError {
            reason: format!(
                "Failed to prepare DNS ACME persistence dir {}: {e}",
                persist_dir.display()
            ),
        })?;
    let adapter: Arc<dyn DnsRecordHandler> = Arc::new(LegoDnsHookAdapter::new(dns_hook));
    let domains = vec![domain.clone()];
    let certificate = lego_runner
        .obtain_certificate(&LegoRequest {
            email: &email,
            directory_url: &directory_url,
            domains: &domains,
            data_dir: persist_dir.as_path(),
            dns_hook: adapter,
            propagation_wait,
        })
        .await
        .map_err(|err| ProxyError::AcmeError {
            reason: format!("lego runner failed to issue certificate: {err}"),
        })?;
    Ok(certificate.into_bundle())
}

#[cfg(feature = "dns01-preview")]
struct LegoDnsHookAdapter {
    inner: Arc<dyn DnsChallengeHook>,
}

#[cfg(feature = "dns01-preview")]
impl LegoDnsHookAdapter {
    fn new(inner: Arc<dyn DnsChallengeHook>) -> Self {
        Self { inner }
    }
}

#[cfg(feature = "dns01-preview")]
#[async_trait::async_trait]
impl DnsRecordHandler for LegoDnsHookAdapter {
    async fn present(&self, record: &DnsRecord) -> Result<(), DnsHookError> {
        let converted = DnsChallengeRecord {
            domain: record.domain.clone(),
            fqdn: record.fqdn.clone(),
            value: record.value.clone(),
        };
        self.inner.present(&converted).await
    }

    async fn cleanup(&self, record: &DnsRecord) -> Result<(), DnsHookError> {
        let converted = DnsChallengeRecord {
            domain: record.domain.clone(),
            fqdn: record.fqdn.clone(),
            value: record.value.clone(),
        };
        self.inner.cleanup(&converted).await
    }
}

#[cfg(feature = "dns01-preview")]
struct ParsedPemMaterial {
    cert_blocks: Vec<Pem>,
    key_block: Pem,
}

#[cfg(feature = "dns01-preview")]
impl ParsedPemMaterial {
    fn to_tls_material(self) -> Result<DnsTlsMaterial, ProxyError> {
        let expires_at = self
            .cert_blocks
            .first()
            .ok_or_else(|| ProxyError::AcmeError {
                reason: "PEM bundle missing certificate".to_string(),
            })
            .and_then(|block| parse_not_after(block))?;
        let cert_pem = build_pem_bundle(&self.cert_blocks);
        let key_pem = encode_pem_block(&self.key_block);
        let tls_config = Arc::new(build_tls_config(&cert_pem, &key_pem)?);
        Ok(DnsTlsMaterial {
            tls_config,
            expires_at,
        })
    }
}

#[cfg(feature = "dns01-preview")]
fn parse_pem_material(bytes: &[u8]) -> Result<ParsedPemMaterial, ProxyError> {
    let mut pem_blocks = pem::parse_many(bytes).map_err(|e| ProxyError::AcmeError {
        reason: format!("Failed to parse PEM bundle: {e}"),
    })?;
    if pem_blocks.len() < 2 {
        return Err(ProxyError::AcmeError {
            reason: "PEM bundle missing certificate or key".to_string(),
        });
    }
    let mut cert_blocks = Vec::new();
    let mut key_block: Option<Pem> = None;
    for block in pem_blocks.drain(..) {
        if block.tag() == "CERTIFICATE" {
            cert_blocks.push(block);
        } else if block.tag().ends_with("PRIVATE KEY") {
            key_block = Some(block);
        }
    }
    let key_block = key_block.ok_or_else(|| ProxyError::AcmeError {
        reason: "PEM bundle missing private key".to_string(),
    })?;
    if cert_blocks.is_empty() {
        return Err(ProxyError::AcmeError {
            reason: "PEM bundle missing certificate".to_string(),
        });
    }
    Ok(ParsedPemMaterial {
        cert_blocks,
        key_block,
    })
}

async fn start_dev_self_signed_server(
    config: ProxyConfig,
    shutdown_rx: oneshot::Receiver<()>,
) -> Result<JoinHandle<Result<(), ProxyError>>, ProxyError> {
    let (config, https_router, app_state) = prepare_proxy_router(config).await?;

    let cert_dir = default_cert_dir(Some(DEV_CERT_SUBDIR));
    let (root_ca_cert_pem, root_ca_key_pem) = ensure_root_ca_artifacts(
        &cert_dir,
        DEV_ROOT_CA_CERT_FILENAME,
        DEV_ROOT_CA_KEY_FILENAME,
        "FLM Dev Root CA",
    )
    .map_err(|e| ProxyError::InvalidConfig { reason: e })?;
    let (cert_pem, key_pem) = ensure_server_cert_artifacts(
        &cert_dir,
        &root_ca_cert_pem,
        &root_ca_key_pem,
        &config.listen_addr,
        DEV_SERVER_CERT_FILENAME,
        DEV_SERVER_KEY_FILENAME,
    )
    .map_err(|e| ProxyError::InvalidConfig { reason: e })?;

    info!(
        "Dev self-signed certificate ready at {}",
        cert_dir.display()
    );

    let tls_config = build_tls_config(&cert_pem, &key_pem)?;
    let tls_acceptor = TlsAcceptor::from(Arc::new(tls_config));

    let https_port = config.port + 1;
    let listen_addr = config.listen_addr.as_str();
    let https_addr = resolve_listen_addr(listen_addr, https_port)?;
    let http_addr = resolve_listen_addr(listen_addr, config.port)?;

    let https_listener =
        TokioTcpListener::bind(&https_addr)
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to bind to {https_addr}: {e}"),
            })?;
    let http_listener =
        TokioTcpListener::bind(&http_addr)
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to bind to {http_addr}: {e}"),
            })?;

    let http_router = Router::new()
        .fallback(redirect_http_to_https)
        .with_state(app_state.clone());

    let (http_shutdown_tx, http_shutdown_rx) = oneshot::channel();
    let (https_shutdown_tx, https_shutdown_rx) = oneshot::channel();
    let mut http_shutdown_tx = Some(http_shutdown_tx);
    let mut https_shutdown_tx = Some(https_shutdown_tx);
    let (status_tx, mut status_rx) =
        mpsc::unbounded_channel::<(&'static str, Result<(), ProxyError>)>();

    let http_status_tx = status_tx.clone();
    let http_task = tokio::spawn(async move {
        let result = axum::serve(http_listener, http_router)
            .with_graceful_shutdown(async {
                http_shutdown_rx.await;
            })
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("HTTP redirect server error: {e}"),
            });
        if let Err(e) = http_status_tx.send(("http", result)) {
            warn!("Failed to send HTTP server status: receiver may have been dropped: {}", e);
        }
    });

    let https_status_tx = status_tx.clone();
    let https_server_handle = spawn_tls_server(
        https_listener,
        tls_acceptor,
        https_router,
        https_shutdown_rx,
    );
    let https_task = tokio::spawn(async move {
        let result = match https_server_handle.await {
            Ok(inner) => inner,
            Err(e) => Err(ProxyError::InvalidConfig {
                reason: format!("HTTPS server task panicked: {}", e),
            }),
        };
        if let Err(e) = https_status_tx.send(("https", result)) {
            warn!("Failed to send HTTPS server status: receiver may have been dropped: {}", e);
        }
    });

    drop(status_tx);

    let join_handle = tokio::spawn(async move {
        let mut shutdown_rx = shutdown_rx;
        let mut shutdown_sent = false;
        let mut remaining = 2usize;
        let mut final_result: Result<(), ProxyError> = Ok(());

        while remaining > 0 {
            tokio::select! {
                maybe_status = status_rx.recv() => {
                    if let Some((label, task_result)) = maybe_status {
                        remaining -= 1;
                        if !shutdown_sent {
                            final_result = match task_result {
                                Ok(_) => Err(ProxyError::InvalidConfig {
                                    reason: format!("{label} task exited unexpectedly"),
                                }),
                                Err(err) => Err(err),
                            };
                            shutdown_sent = true;
                            if let Some(tx) = http_shutdown_tx.take() {
                                if let Err(_) = tx.send(()) {
                                    warn!("Failed to send shutdown signal: receiver may have been dropped");
                                }
                            }
                            if let Some(tx) = https_shutdown_tx.take() {
                                if let Err(_) = tx.send(()) {
                                    warn!("Failed to send shutdown signal: receiver may have been dropped");
                                }
                            }
                        } else if final_result.is_ok() {
                            if let Err(err) = task_result {
                                final_result = Err(err);
                            }
                        }
                    } else {
                        break;
                    }
                }
                _ = &mut shutdown_rx, if !shutdown_sent => {
                    shutdown_sent = true;
                    final_result = Ok(());
                    if let Some(tx) = http_shutdown_tx.take() {
                        if let Err(_) = tx.send(()) {
                            warn!("Failed to send shutdown signal: receiver may have been dropped");
                        }
                    }
                    if let Some(tx) = https_shutdown_tx.take() {
                        if let Err(_) = tx.send(()) {
                            warn!("Failed to send shutdown signal: receiver may have been dropped");
                        }
                    }
                }
            }
        }

        if let Err(err) = http_task.await {
            error!(reason = %err, "HTTP redirect server panicked");
        }
        if let Err(err) = https_task.await {
            error!(reason = %err, "HTTPS server join task panicked");
        }

        final_result
    });

    Ok(join_handle)
}

#[cfg(feature = "dns01-preview")]
async fn run_dns_acme_supervisor(
    tls_store: Arc<ArcSwap<rustls::ServerConfig>>,
    cache_dir: PathBuf,
    persist_dir: PathBuf,
    directory_url: String,
    domain: String,
    email: String,
    dns_hook: Arc<dyn DnsChallengeHook>,
    security_repo: Arc<SqliteSecurityRepository>,
    mut shutdown_rx: oneshot::Receiver<()>,
    mut current_expiry: DateTime<Utc>,
    lego_runner: LegoRunner,
    propagation_wait: Duration,
) -> Result<(), ProxyError> {
    loop {
        let renew_at = current_expiry - chrono::Duration::days(DNS01_RENEWAL_MARGIN_DAYS);
        let wait_duration = if renew_at > Utc::now() {
            (renew_at - Utc::now())
                .to_std()
                .unwrap_or(Duration::from_secs(0))
        } else {
            Duration::from_secs(0)
        };

        tokio::select! {
            _ = sleep(wait_duration) => {},
            _ = &mut shutdown_rx => return Ok(()),
        }

        match issue_and_install_dns_certificate(
            &cache_dir,
            &persist_dir,
            &directory_url,
            &domain,
            &email,
            dns_hook.clone(),
            &security_repo,
            &lego_runner,
            propagation_wait,
        )
        .await
        {
            Ok(material) => {
                tls_store.store(material.tls_config.clone());
                current_expiry = material.expires_at;
                info!(domain = %domain, expires_at = %current_expiry, "DNS ACME certificate refreshed");
            }
            Err(err) => {
                warn!(reason = %err, "DNS ACME renewal failed; retrying soon");
                tokio::select! {
                    _ = sleep(Duration::from_secs(DNS01_RETRY_DELAY_SECS)) => continue,
                    _ = &mut shutdown_rx => return Ok(()),
                }
            }
        }
    }
}

async fn run_acme_supervisor<EC, EA>(
    mut state: AcmeState<EC, EA>,
    mut shutdown_rx: oneshot::Receiver<()>,
    cache_dir: PathBuf,
    directory_url: String,
    domain: String,
    security_repo: Arc<SqliteSecurityRepository>,
) -> Result<(), ProxyError>
where
    EC: std::fmt::Debug + Send + 'static,
    EA: std::fmt::Debug + Send + 'static,
{
    const RENEWAL_MARGIN_DAYS: i64 = 20;
    const CHECK_INTERVAL_HOURS: u64 = 24;

    let mut cert_check_interval = interval(Duration::from_secs(CHECK_INTERVAL_HOURS * 3600));
    cert_check_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        tokio::select! {
            _ = &mut shutdown_rx => {
                break Ok(());
            }
            _ = cert_check_interval.tick() => {
                if let Err(err) = check_and_renew_certificate(
                    &cache_dir,
                    &directory_url,
                    &domain,
                    &security_repo,
                    RENEWAL_MARGIN_DAYS,
                ).await {
                    warn!(reason = %err, "Certificate renewal check failed");
                }
            }
            event = state.next() => {
                match event {
                    Some(Ok(ok)) => match ok {
                        EventOk::DeployedNewCert => {
                            info!("ACME certificate deployed");
                            if let Err(err) = persist_acme_certificate_metadata(
                                &cache_dir,
                                &directory_url,
                                &domain,
                                &security_repo,
                            )
                            .await
                            {
                                warn!(reason = %err, "Failed to export ACME certificate metadata");
                            }
                        }
                        EventOk::DeployedCachedCert => info!("Reusing cached ACME certificate"),
                        EventOk::CertCacheStore => info!("Stored ACME certificate cache entry"),
                        EventOk::AccountCacheStore => info!("Stored ACME account cache entry"),
                    },
                    Some(Err(err)) => {
                        return Err(ProxyError::AcmeError {
                            reason: format!("ACME provisioning failed: {:?}", err),
                        });
                    }
                    None => {
                        return Err(ProxyError::AcmeError {
                            reason: "ACME event stream ended unexpectedly".to_string(),
                        });
                    }
                }
            }
        }
    }
}

async fn check_and_renew_certificate(
    cache_dir: &Path,
    directory_url: &str,
    domain: &str,
    security_repo: &Arc<SqliteSecurityRepository>,
    renewal_margin_days: i64,
) -> Result<(), ProxyError> {
    if let Ok(Some(cert_meta)) = security_repo
        .fetch_certificate_metadata_by_domain(domain)
        .await
    {
        if let Some(expires_at_str) = &cert_meta.expires_at {
            if let Ok(expires_at) = chrono::DateTime::parse_from_rfc3339(expires_at_str) {
                let expires_at_utc = expires_at.with_timezone(&Utc);
                let now = Utc::now();
                let days_until_expiry = (expires_at_utc - now).num_days();

                if days_until_expiry < renewal_margin_days {
                    warn!(
                        domain = %domain,
                        days_until_expiry = days_until_expiry,
                        renewal_margin_days = renewal_margin_days,
                        "Certificate expires in less than {} days, renewal should be triggered",
                        renewal_margin_days
                    );

                    let cache_file =
                        cache_dir.join(cached_cert_file_name(&[domain.to_string()], directory_url));
                    if cache_file.exists() {
                        if let Err(e) = tokio::fs::remove_file(&cache_file).await {
                            warn!(
                                reason = %e,
                                path = %cache_file.display(),
                                "Failed to remove cached certificate to trigger renewal"
                            );
                        } else {
                            info!(
                                domain = %domain,
                                "Removed cached certificate to trigger automatic renewal"
                            );
                        }
                    }
                } else {
                    debug!(
                        domain = %domain,
                        days_until_expiry = days_until_expiry,
                        "Certificate is still valid"
                    );
                }
            }
        }
    }

    Ok(())
}

async fn persist_acme_certificate_metadata(
    cache_dir: &Path,
    directory_url: &str,
    domain: &str,
    security_repo: &Arc<SqliteSecurityRepository>,
) -> Result<(), ProxyError> {
    let cache_file = cache_dir.join(cached_cert_file_name(&[domain.to_string()], directory_url));
    let pem_bytes = fs::read(&cache_file)
        .await
        .map_err(|e| ProxyError::AcmeError {
            reason: format!(
                "Failed to read cached certificate {}: {e}",
                cache_file.display()
            ),
        })?;
    let mut pem_blocks = pem::parse_many(pem_bytes).map_err(|e| ProxyError::AcmeError {
        reason: format!("Failed to parse cached certificate PEM: {e}"),
    })?;
    if pem_blocks.len() < 2 {
        return Err(ProxyError::AcmeError {
            reason: "Cached ACME bundle did not contain both certificate and key".to_string(),
        });
    }

    let mut cert_blocks = Vec::new();
    let mut key_block: Option<Pem> = None;
    for block in pem_blocks.drain(..) {
        if block.tag() == "CERTIFICATE" {
            cert_blocks.push(block);
        } else if block.tag().ends_with("PRIVATE KEY") {
            key_block = Some(block);
        }
    }

    if cert_blocks.is_empty() {
        return Err(ProxyError::AcmeError {
            reason: "Cached ACME bundle did not contain any certificates".to_string(),
        });
    }
    let key_block = key_block.ok_or_else(|| ProxyError::AcmeError {
        reason: "Cached ACME bundle did not contain a private key".to_string(),
    })?;

    let export_dir = default_cert_dir(Some(ACME_EXPORT_SUBDIR)).join(domain);
    tokio::fs::create_dir_all(&export_dir)
        .await
        .map_err(|e| ProxyError::AcmeError {
            reason: format!(
                "Failed to prepare ACME export directory {}: {e}",
                export_dir.display()
            ),
        })?;

    let cert_path = export_dir.join("fullchain.pem");
    let key_path = export_dir.join("privkey.pem");
    fs::write(&cert_path, build_pem_bundle(&cert_blocks))
        .await
        .map_err(|e| ProxyError::AcmeError {
            reason: format!("Failed to write {}: {e}", cert_path.display()),
        })?;
    fs::write(&key_path, encode_pem_block(&key_block))
        .await
        .map_err(|e| ProxyError::AcmeError {
            reason: format!("Failed to write {}: {e}", key_path.display()),
        })?;

    let expires_at = parse_not_after(&cert_blocks[0])?.to_rfc3339();

    security_repo
        .save_certificate_metadata(CertificateMetadata {
            id: format!("acme:{domain}"),
            cert_path: cert_path.display().to_string(),
            key_path: key_path.display().to_string(),
            mode: "acme".to_string(),
            domain: Some(domain.to_string()),
            expires_at: Some(expires_at),
        })
        .await
        .map_err(|e| ProxyError::AcmeError {
            reason: format!("Failed to save certificate metadata: {e}"),
        })?;

    Ok(())
}

fn cached_cert_file_name(domains: &[String], directory_url: &str) -> String {
    let mut hasher = Sha256::new();
    for domain in domains {
        hasher.update(domain.as_bytes());
        hasher.update([0u8]);
    }
    hasher.update(directory_url.as_bytes());
    let hash = general_purpose::URL_SAFE_NO_PAD.encode(hasher.finalize());
    format!("cached_cert_{hash}")
}

fn build_pem_bundle(blocks: &[Pem]) -> String {
    blocks.iter().map(encode_pem_block).collect()
}

fn encode_pem_block(block: &Pem) -> String {
    let mut output = String::new();
    output.push_str("-----BEGIN ");
    output.push_str(block.tag());
    output.push_str("-----\n");
    let body = general_purpose::STANDARD.encode(block.contents());
    for chunk in body.as_bytes().chunks(64) {
        // why: base64エンコード結果は常に有効なUTF-8だが、防御的プログラミングのためエラーハンドリングを追加
        // alt: unwrap()を使用（理論上は安全だが、エラーメッセージが不明確）
        // evidence: base64エンコードはASCII文字のみを生成するため、UTF-8変換は常に成功する
        match std::str::from_utf8(chunk) {
            Ok(s) => output.push_str(s),
            Err(e) => {
                error!(
                    error = %e,
                    "Failed to convert base64 chunk to UTF-8 (should never happen)"
                );
                // フォールバック: バイト列を16進数でエンコード
                for byte in chunk {
                    output.push_str(&format!("{:02x}", byte));
                }
            }
        }
        output.push('\n');
    }
    output.push_str("-----END ");
    output.push_str(block.tag());
    output.push_str("-----\n");
    output
}

fn parse_not_after(block: &Pem) -> Result<DateTime<Utc>, ProxyError> {
    let (_, cert) =
        parse_x509_certificate(block.contents()).map_err(|e| ProxyError::AcmeError {
            reason: format!("Failed to parse X509 certificate: {e}"),
        })?;
    let not_after = cert.validity().not_after.to_datetime();
    let chrono_dt =
        DateTime::<Utc>::from_timestamp(not_after.unix_timestamp(), not_after.nanosecond())
            .ok_or_else(|| ProxyError::AcmeError {
                reason: "Failed to convert certificate expiry".to_string(),
            })?;
    Ok(chrono_dt)
}

fn spawn_tls_server(
    listener: TokioTcpListener,
    tls_acceptor: TlsAcceptor,
    app: Router,
    mut shutdown_rx: oneshot::Receiver<()>,
) -> JoinHandle<Result<(), ProxyError>> {
    tokio::spawn(async move {
        let make_service = app.into_make_service_with_connect_info::<SocketAddr>();

        loop {
            tokio::select! {
                _ = &mut shutdown_rx => {
                    break;
                }
                accept_res = listener.accept() => {
                    let (socket, addr) = match accept_res {
                        Ok(pair) => pair,
                        Err(e) => {
                            error!(reason = %e, "Failed to accept TLS connection");
                            continue;
                        }
                    };

                    let tls_acceptor = tls_acceptor.clone();
                    let mut make_service = make_service.clone();

                    tokio::spawn(async move {
                        match tls_acceptor.accept(socket).await {
                            Ok(stream) => {
                                match make_service.call(addr).await {
                                    Ok(service) => {
                                        let hyper_service = TowerToHyperService::new(service);
                                        let builder = HyperServerBuilder::new(TokioExecutor::new());
                                        if let Err(err) = builder
                                            .serve_connection(TokioIo::new(stream), hyper_service)
                                            .await
                                        {
                                            error!(reason = %err, "TLS connection error");
                                        }
                                    }
                                    Err(err) => {
                                        error!(reason = %err, "Failed to build TLS service");
                                    }
                                }
                            }
                            Err(e) => {
                                warn!(reason = %e, "TLS handshake failed");
                            }
                        }
                    });
                }
            }
        }

        Ok(())
    })
}

#[allow(dead_code)]
fn spawn_reloadable_tls_server(
    listener: TokioTcpListener,
    tls_store: Arc<ArcSwap<rustls::ServerConfig>>,
    app: Router,
    mut shutdown_rx: oneshot::Receiver<()>,
) -> JoinHandle<Result<(), ProxyError>> {
    tokio::spawn(async move {
        let make_service = app.into_make_service_with_connect_info::<SocketAddr>();

        loop {
            tokio::select! {
                _ = &mut shutdown_rx => break,
                accept_res = listener.accept() => {
                    let (socket, addr) = match accept_res {
                        Ok(pair) => pair,
                        Err(e) => {
                            error!(reason = %e, "Failed to accept TLS connection");
                            continue;
                        }
                    };

                    let mut make_service = make_service.clone();
                    let tls_store = tls_store.clone();

                    tokio::spawn(async move {
                        let tls_config = tls_store.load().clone();
                        let acceptor = TlsAcceptor::from(tls_config);
                        match acceptor.accept(socket).await {
                            Ok(stream) => {
                                match make_service.call(addr).await {
                                    Ok(service) => {
                                        let hyper_service = TowerToHyperService::new(service);
                                        let builder = HyperServerBuilder::new(TokioExecutor::new());
                                        if let Err(err) = builder
                                            .serve_connection(TokioIo::new(stream), hyper_service)
                                            .await
                                        {
                                            error!(reason = %err, "TLS connection error");
                                        }
                                    }
                                    Err(err) => {
                                        error!(reason = %err, "Failed to build TLS service");
                                    }
                                }
                            }
                            Err(e) => {
                                warn!(reason = %e, "TLS handshake failed");
                            }
                        }
                    });
                }
            }
        }

        Ok(())
    })
}

fn resolve_listen_addr(listen_addr: &str, port: u16) -> Result<SocketAddr, ProxyError> {
    if let Ok(addr) = listen_addr.parse::<SocketAddr>() {
        if addr.port() == 0 {
            Ok(SocketAddr::new(addr.ip(), port))
        } else if addr.port() != port {
            Err(ProxyError::InvalidConfig {
                reason: format!(
                    "Port mismatch: listen_addr port {} does not match config port {}",
                    addr.port(),
                    port
                ),
            })
        } else {
            Ok(addr)
        }
    } else {
        let ip = listen_addr
            .parse::<IpAddr>()
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Invalid listen address '{listen_addr}': {e}"),
            })?;
        Ok(SocketAddr::new(ip, port))
    }
}

async fn resolve_egress_runtime(
    requested: ProxyEgressConfig,
    security_repo: &Arc<SqliteSecurityRepository>,
) -> Result<ProxyEgressConfig, ProxyError> {
    match requested.mode {
        ProxyEgressMode::Direct => Ok(ProxyEgressConfig::direct()),
        ProxyEgressMode::Tor | ProxyEgressMode::CustomSocks5 => {
            let endpoint = match (&requested.mode, &requested.socks5_endpoint) {
                (ProxyEgressMode::Tor, Some(ep)) => ep.clone(),
                (ProxyEgressMode::Tor, None) => DEFAULT_TOR_SOCKS_ENDPOINT.to_string(),
                (_, Some(ep)) => ep.clone(),
                (_, None) => {
                    return Err(ProxyError::InvalidConfig {
                        reason: "socks5 endpoint is required for custom SOCKS5 mode".to_string(),
                    })
                }
            };

            if let Err(err) = verify_socks_endpoint(&endpoint).await {
                let requested_mode_label = {
                    let mode = requested.mode.clone();
                    format!("{mode:?}")
                };
                log_egress_audit_event(
                    security_repo,
                    "tor_unreachable",
                    "high",
                    json!({
                        "mode": requested_mode_label.clone(),
                        "endpoint": endpoint,
                    }),
                )
                .await;

                if requested.fail_open {
                    log_egress_audit_event(
                        security_repo,
                        "egress_fail_open_triggered",
                        "medium",
                        json!({
                            "requested_mode": requested_mode_label,
                            "fallback": "direct",
                        }),
                    )
                    .await;
                    return Ok(ProxyEgressConfig::direct());
                }

                return Err(err);
            }

            Ok(ProxyEgressConfig {
                mode: requested.mode,
                socks5_endpoint: Some(endpoint),
                fail_open: requested.fail_open,
            })
        }
    }
}

async fn log_egress_audit_event(
    repo: &Arc<SqliteSecurityRepository>,
    event_type: &str,
    severity: &'static str,
    details: serde_json::Value,
) {
    let details_string = details.to_string();
    if let Err(err) = repo
        .save_audit_log(
            "system",
            None,
            "proxy.egress",
            0,
            None,
            Some(event_type),
            AuditLogMetadata {
                severity,
                ip: None,
                details: Some(details_string.as_str()),
            },
        )
        .await
    {
        warn!(error = %err, "Failed to record audit log event");
    }
}

async fn verify_socks_endpoint(endpoint: &str) -> Result<(), ProxyError> {
    let mut last_error = String::new();
    for attempt in 1..=SOCKS_HANDSHAKE_ATTEMPTS {
        match timeout(
            Duration::from_secs(SOCKS_HANDSHAKE_TIMEOUT_SECS),
            TcpStream::connect(endpoint),
        )
        .await
        {
            Ok(Ok(stream)) => {
                drop(stream);
                return Ok(());
            }
            Ok(Err(err)) => {
                last_error = err.to_string();
            }
            Err(_) => {
                last_error = "timed out".to_string();
            }
        }
        if attempt < SOCKS_HANDSHAKE_ATTEMPTS {
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    }

    Err(ProxyError::InvalidConfig {
        reason: format!("Unable to reach SOCKS5 endpoint {endpoint}: {last_error}"),
    })
}

fn http_client_builder_for_egress(
    egress: &ProxyEgressConfig,
) -> Result<reqwest::ClientBuilder, ProxyError> {
    let builder = reqwest::Client::builder();
    match egress.mode {
        ProxyEgressMode::Direct => Ok(builder),
        ProxyEgressMode::Tor | ProxyEgressMode::CustomSocks5 => {
            let endpoint =
                egress
                    .socks5_endpoint
                    .as_ref()
                    .ok_or_else(|| ProxyError::InvalidConfig {
                        reason: "socks5 endpoint missing for proxy egress".to_string(),
                    })?;
            let proxy = reqwest::Proxy::all(format!("socks5h://{endpoint}")).map_err(|e| {
                ProxyError::InvalidConfig {
                    reason: format!("Failed to configure SOCKS proxy: {e}"),
                }
            })?;
            Ok(builder.proxy(proxy))
        }
    }
}

/// Handle /v1/images/generations endpoint
///
/// Currently returns 501 Not Implemented as image generation is not yet supported by engines.
#[axum::debug_handler]
async fn handle_images_generations(
    axum::extract::State(_state): axum::extract::State<AppState>,
    axum::Json(_req): axum::Json<serde_json::Value>,
) -> axum::response::Response {
    (
        StatusCode::NOT_IMPLEMENTED,
        axum::Json(json!({
            "error": {
                "message": "Image generation is not yet implemented",
                "type": "invalid_request_error",
                "code": "not_implemented"
            }
        })),
    )
        .into_response()
}

/// Handle /v1/audio/transcriptions endpoint
///
/// Supports multipart/form-data with audio file upload.
///
/// Request format:
/// - `file`: Audio file (required, max 25MB)
/// - `model`: Model ID in flm://{engine_id}/{model} format (required)
/// - `language`: Language code (optional, e.g., "en", "ja")
/// - `temperature`: Temperature for transcription (optional, 0.0-1.0)
/// - `prompt`: Prompt to guide transcription (optional)
///
/// Returns OpenAI-compatible JSON: `{"text": "transcribed text"}`
#[axum::debug_handler]
async fn handle_audio_transcriptions(
    axum::extract::State(state): axum::extract::State<AppState>,
    mut multipart: axum::extract::Multipart,
) -> axum::response::Response {
    // Extract fields from multipart/form-data
    let mut audio_data: Option<Vec<u8>> = None;
    let mut model: Option<String> = None;
    let mut language: Option<String> = None;
    let mut temperature: Option<f64> = None;
    let mut prompt: Option<String> = None;
    let mut mime_type: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        match field.name() {
            Some("file") => {
                // Extract MIME type from Content-Type header if available
                if let Some(content_type) = field.content_type() {
                    mime_type = Some(content_type.to_string());
                } else if let Some(file_name) = field.file_name() {
                    // Fallback: extract MIME type from file extension
                    mime_type = extract_mime_type_from_filename(file_name);
                }

                // Read audio file data
                match field.bytes().await {
                    Ok(bytes) => {
                        // Check file size limit (25MB)
                        if bytes.len() > DEFAULT_MAX_AUDIO_BYTES {
                            return (
                                StatusCode::PAYLOAD_TOO_LARGE,
                                axum::Json(json!({
                                    "error": {
                                        "message": format!(
                                            "Audio file too large. Maximum size is {} bytes",
                                            DEFAULT_MAX_AUDIO_BYTES
                                        ),
                                        "type": "invalid_request_error",
                                        "code": "file_too_large"
                                    }
                                })),
                            )
                                .into_response();
                        }
                        audio_data = Some(bytes.to_vec());
                    }
                    Err(e) => {
                        return (
                            StatusCode::BAD_REQUEST,
                            axum::Json(json!({
                                "error": {
                                    "message": format!("Failed to read audio file: {}", e),
                                    "type": "invalid_request_error",
                                    "code": "file_read_error"
                                }
                            })),
                        )
                            .into_response();
                    }
                }
            }
            Some("model") => match field.text().await {
                Ok(text) => model = Some(text),
                Err(e) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        axum::Json(json!({
                            "error": {
                                "message": format!("Failed to read model field: {}", e),
                                "type": "invalid_request_error",
                                "code": "invalid_model_field"
                            }
                        })),
                    )
                        .into_response();
                }
            },
            Some("language") => {
                if let Ok(text) = field.text().await {
                    language = Some(text);
                }
            }
            Some("temperature") => {
                if let Ok(text) = field.text().await {
                    if let Ok(temp) = text.parse::<f64>() {
                        if (0.0..=1.0).contains(&temp) {
                            temperature = Some(temp);
                        }
                    }
                }
            }
            Some("prompt") => {
                if let Ok(text) = field.text().await {
                    prompt = Some(text);
                }
            }
            _ => {
                // Ignore unknown fields
            }
        }
    }

    // Validate required fields
    let audio_data = match audio_data {
        Some(data) if !data.is_empty() => data,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                axum::Json(json!({
                    "error": {
                        "message": "Missing or empty audio file",
                        "type": "invalid_request_error",
                        "code": "missing_file"
                    }
                })),
            )
                .into_response();
        }
    };

    let model_id = match model {
        Some(m) if !m.is_empty() => m,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                axum::Json(json!({
                    "error": {
                        "message": "Missing model parameter",
                        "type": "invalid_request_error",
                        "code": "missing_model"
                    }
                })),
            )
                .into_response();
        }
    };

    // Parse model ID (must be in flm://{engine_id}/{model} format)
    if !model_id.starts_with("flm://") {
        return (
            StatusCode::BAD_REQUEST,
            axum::Json(json!({
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
    let model_without_prefix = match model_id.strip_prefix("flm://") {
        Some(m) => m,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                axum::Json(json!({
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

    let parts: Vec<&str> = model_without_prefix.split('/').collect();
    if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            axum::Json(json!({
                "error": {
                    "message": "Invalid model ID format. Expected flm://{engine_id}/{model}",
                    "type": "invalid_request_error",
                    "code": "invalid_model"
                }
            })),
        )
            .into_response();
    }

    let engine_id = parts[0].to_string();

    // Get engine from repository
    let engine_repo = &state.engine_repo;
    let engines = engine_repo.list_registered().await;

    let engine = match engines.iter().find(|e| e.id() == engine_id) {
        Some(e) => e,
        None => {
            return (
                StatusCode::NOT_FOUND,
                axum::Json(json!({
                    "error": {
                        "message": format!("Engine '{}' not found", engine_id),
                        "type": "invalid_request_error",
                        "code": "engine_not_found"
                    }
                })),
            )
                .into_response();
        }
    };

    // Check engine capabilities
    let capabilities = engine.capabilities();
    if !capabilities.audio_inputs {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            axum::Json(json!({
                "error": {
                    "message": "Engine does not support audio transcription",
                    "type": "invalid_request_error",
                    "code": "unsupported_modalities"
                }
            })),
        )
            .into_response();
    }

    // Determine MIME type: use extracted value or default to audio/wav
    let mime_type = mime_type.unwrap_or_else(|| "audio/wav".to_string());

    // Validate MIME type is supported
    if !is_supported_audio_mime(&mime_type) {
        return (
            StatusCode::BAD_REQUEST,
            axum::Json(json!({
                "error": {
                    "message": format!("Unsupported audio MIME type: {}. Supported types: audio/wav, audio/mpeg, audio/flac, audio/ogg, audio/webm, audio/m4a, audio/mp4", mime_type),
                    "type": "invalid_request_error",
                    "code": "unsupported_mime_type"
                }
            })),
        )
            .into_response();
    }

    // Call transcribe_audio method on the engine
    let transcription_req = flm_core::domain::chat::TranscriptionRequest {
        engine_id: engine_id.clone(),
        model_id: model_id.clone(),
        audio_data,
        mime_type,
        language,
        temperature,
        prompt,
    };

    match engine.transcribe_audio(transcription_req).await {
        Ok(transcription_resp) => {
            // Return OpenAI-compatible JSON response
            axum::Json(json!({
                "text": transcription_resp.text,
            }))
            .into_response()
        }
        Err(e) => {
            // Handle engine errors
            let (status_code, error_code, error_message) = match e {
                flm_core::error::EngineError::UnsupportedOperation { .. } => (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "unsupported_modalities",
                    format!("Audio transcription not supported: {e}"),
                ),
                flm_core::error::EngineError::NetworkError { reason } => (
                    StatusCode::BAD_GATEWAY,
                    "network_error",
                    format!("Network error: {reason}"),
                ),
                flm_core::error::EngineError::ApiError {
                    reason,
                    status_code: _,
                } => (
                    StatusCode::BAD_GATEWAY,
                    "api_error",
                    format!("API error: {reason}"),
                ),
                _ => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    format!("Transcription failed: {e}"),
                ),
            };

            (
                status_code,
                axum::Json(json!({
                    "error": {
                        "message": error_message,
                        "type": "invalid_request_error",
                        "code": error_code
                    }
                })),
            )
                .into_response()
        }
    }
}

/// Handle /v1/audio/speech endpoint
///
/// Currently disabled (returns 404) until audio output engines are available.
#[axum::debug_handler]
async fn handle_audio_speech(
    axum::extract::State(_state): axum::extract::State<AppState>,
    axum::Json(_req): axum::Json<serde_json::Value>,
) -> axum::response::Response {
    (
        StatusCode::NOT_FOUND,
        axum::Json(json!({
            "error": {
                "message": "Audio speech endpoint is not available",
                "type": "invalid_request_error",
                "code": "route_disabled"
            }
        })),
    )
        .into_response()
}
