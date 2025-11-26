use crate::adapters::SqliteSecurityRepository;
use crate::AxumProxyController;
use axum::extract::State;
use axum::http::{header::AUTHORIZATION, HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::Json;
use axum::Router;
use chrono::Utc;
use flm_core::adapters::SqliteProxyRepository;
use flm_core::domain::proxy::{ProxyConfig, ProxyHandle};
use flm_core::error::ProxyError;
use flm_core::services::ProxyService;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::signal;

pub struct DaemonConfig {
    pub config_db: PathBuf,
    pub security_db: PathBuf,
    pub state_file: PathBuf,
    pub admin_port: u16,
    pub admin_token: String,
}

#[derive(Clone)]
struct AdminState {
    proxy_service: Arc<ProxyService<AxumProxyController, SqliteProxyRepository>>,
    admin_token: String,
}

pub async fn run_daemon(config: DaemonConfig) -> anyhow::Result<()> {
    let proxy_repo = Arc::new(SqliteProxyRepository::new(&config.config_db).await?);
    let _security_repo = SqliteSecurityRepository::new(&config.security_db).await?;
    let controller = Arc::new(AxumProxyController::new());
    let service = Arc::new(ProxyService::new(controller, proxy_repo));

    let state = AdminState {
        proxy_service: service,
        admin_token: config.admin_token.clone(),
    };

    let router = Router::new()
        .route("/admin/health", get(health))
        .route("/admin/start", post(start_proxy))
        .route("/admin/stop", post(stop_proxy))
        .route("/admin/status", get(list_status))
        .with_state(state.clone());

    if let Some(parent) = config.state_file.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let listener = TcpListener::bind(("127.0.0.1", config.admin_port)).await?;
    let bound_port = listener.local_addr()?.port();
    persist_state_file(&config.state_file, bound_port, &config.admin_token)?;

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    let _ = std::fs::remove_file(&config.state_file);

    Ok(())
}

async fn health(
    State(state): State<AdminState>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    ensure_admin_authorized(&state, &headers)?;

    Ok(Json(json!({ "status": "ok" })))
}

#[derive(Deserialize)]
struct StopRequest {
    port: Option<u16>,
    handle_id: Option<String>,
}

async fn start_proxy(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(config): Json<ProxyConfig>,
) -> Result<Json<ProxyHandle>, (StatusCode, String)> {
    ensure_admin_authorized(&state, &headers)?;

    state
        .proxy_service
        .start(config)
        .await
        .map(Json)
        .map_err(map_proxy_error)
}

async fn stop_proxy(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(body): Json<StopRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    ensure_admin_authorized(&state, &headers)?;

    if body.port.is_none() && body.handle_id.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Either port or handle_id must be provided".to_string(),
        ));
    }

    let handles = state
        .proxy_service
        .status()
        .await
        .map_err(map_proxy_error)?;

    let target = if let Some(port) = body.port {
        handles
            .iter()
            .find(|h| h.port == port)
            .cloned()
            .ok_or_else(|| {
                (
                    StatusCode::NOT_FOUND,
                    format!("No proxy running on port {port}"),
                )
            })?
    } else if let Some(id) = body.handle_id {
        handles
            .iter()
            .find(|h| h.id == id)
            .cloned()
            .ok_or_else(|| (StatusCode::NOT_FOUND, format!("No proxy with ID '{id}'")))?
    } else {
        return Err((
            StatusCode::BAD_REQUEST,
            "Either port or handle_id must be provided".to_string(),
        ));
    };

    state
        .proxy_service
        .stop(target)
        .await
        .map_err(map_proxy_error)?;

    Ok(Json(json!({ "status": "stopped" })))
}

async fn list_status(
    State(state): State<AdminState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ProxyHandle>>, (StatusCode, String)> {
    ensure_admin_authorized(&state, &headers)?;

    state
        .proxy_service
        .status()
        .await
        .map(Json)
        .map_err(map_proxy_error)
}

fn map_proxy_error(err: ProxyError) -> (StatusCode, String) {
    match err {
        ProxyError::InvalidConfig { reason } => (StatusCode::BAD_REQUEST, reason),
        ProxyError::AlreadyRunning { handle_id } => (
            StatusCode::BAD_REQUEST,
            format!("Proxy already running: {handle_id}"),
        ),
        ProxyError::PortInUse { port } => (
            StatusCode::BAD_REQUEST,
            format!("Port {port} is already in use"),
        ),
        ProxyError::Timeout { operation } => (
            StatusCode::REQUEST_TIMEOUT,
            format!("Operation timed out: {operation}"),
        ),
        ProxyError::CertGenerationFailed { reason } | ProxyError::AcmeError { reason } => {
            (StatusCode::INTERNAL_SERVER_ERROR, reason)
        }
    }
}

fn ensure_admin_authorized(
    state: &AdminState,
    headers: &HeaderMap,
) -> Result<(), (StatusCode, String)> {
    let authorized = headers
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(|token| token == state.admin_token)
        .unwrap_or(false);

    if !authorized {
        return Err((
            StatusCode::UNAUTHORIZED,
            "Invalid or missing admin token".to_string(),
        ));
    }

    Ok(())
}

#[derive(Serialize)]
struct StateFileRecord<'a> {
    port: u16,
    token: &'a str,
    pid: u32,
    updated_at: String,
}

fn persist_state_file(path: &Path, port: u16, token: &str) -> anyhow::Result<()> {
    let record = StateFileRecord {
        port,
        token,
        pid: std::process::id(),
        updated_at: Utc::now().to_rfc3339(),
    };

    let tmp_path = path.with_extension("tmp");
    let data = serde_json::to_vec_pretty(&record)?;
    std::fs::write(&tmp_path, data)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&tmp_path, perms)?;
    }

    std::fs::rename(&tmp_path, path)?;
    Ok(())
}

async fn shutdown_signal() {
    let _ = signal::ctrl_c().await;
}
