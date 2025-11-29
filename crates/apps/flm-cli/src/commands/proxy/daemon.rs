use crate::utils::get_daemon_state_path;
use flm_core::domain::proxy::{ProxyConfig, ProxyHandle};
use rand::{distributions::Alphanumeric, Rng};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::process::{Child, Command};
use tokio::time::{sleep, Instant};
use which::which;

type DynResult<T> = Result<T, Box<dyn Error>>;

const HEALTH_TIMEOUT: Duration = Duration::from_secs(10);
const STATE_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone)]
pub(super) struct AdminClient {
    http: Client,
    base_url: String,
    token: String,
}

impl AdminClient {
    fn new(port: u16, token: String) -> DynResult<Self> {
        let http = Client::builder().timeout(Duration::from_secs(15)).build()?;
        Ok(Self {
            http,
            base_url: format!("http://127.0.0.1:{port}"),
            token,
        })
    }

    fn url(&self, path: &str) -> String {
        format!("{}/admin{path}", self.base_url)
    }

    pub async fn health(&self) -> Result<(), reqwest::Error> {
        self.http
            .get(self.url("/health"))
            .bearer_auth(&self.token)
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    pub async fn start_proxy(&self, config: &ProxyConfig) -> DynResult<ProxyHandle> {
        let handle = self
            .http
            .post(self.url("/start"))
            .bearer_auth(&self.token)
            .json(config)
            .send()
            .await?
            .error_for_status()?
            .json::<ProxyHandle>()
            .await?;
        Ok(handle)
    }

    pub async fn stop_proxy(&self, port: Option<u16>, handle_id: Option<String>) -> DynResult<()> {
        let payload = StopRequest { port, handle_id };
        self.http
            .post(self.url("/stop"))
            .bearer_auth(&self.token)
            .json(&payload)
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    pub async fn status(&self) -> DynResult<Vec<ProxyHandle>> {
        let handles = self
            .http
            .get(self.url("/status"))
            .bearer_auth(&self.token)
            .send()
            .await?
            .error_for_status()?
            .json::<Vec<ProxyHandle>>()
            .await?;
        Ok(handles)
    }
}

#[derive(Serialize)]
struct StopRequest {
    port: Option<u16>,
    handle_id: Option<String>,
}

#[derive(Deserialize)]
struct DaemonStateRecord {
    port: u16,
    token: String,
}

pub(super) async fn ensure_daemon_client(
    config_db_path: &Path,
    security_db_path: &Path,
) -> DynResult<AdminClient> {
    if let Some(client) = load_existing_client().await? {
        return Ok(client);
    }

    spawn_daemon_and_connect(config_db_path, security_db_path).await
}

pub(super) async fn load_existing_client() -> DynResult<Option<AdminClient>> {
    let state_path = get_daemon_state_path();
    let record = match read_state_file(&state_path)? {
        Some(record) => record,
        None => return Ok(None),
    };

    let client = AdminClient::new(record.port, record.token)?;
    if client.health().await.is_ok() {
        return Ok(Some(client));
    }

    let _ = fs::remove_file(state_path);
    Ok(None)
}

async fn spawn_daemon_and_connect(
    config_db_path: &Path,
    security_db_path: &Path,
) -> DynResult<AdminClient> {
    let state_path = get_daemon_state_path();
    if let Some(parent) = state_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let _ = fs::remove_file(&state_path);

    let admin_port = pick_free_port()?;
    let admin_token = generate_admin_token();

    let mut child = launch_daemon_process(
        config_db_path,
        security_db_path,
        &state_path,
        admin_port,
        &admin_token,
    )
    .await?;

    let client = AdminClient::new(admin_port, admin_token)?;
    wait_for_daemon_ready(&mut child, &client).await?;
    wait_for_state_file(&state_path).await?;

    Ok(client)
}

async fn launch_daemon_process(
    config_db_path: &Path,
    security_db_path: &Path,
    state_path: &Path,
    admin_port: u16,
    admin_token: &str,
) -> DynResult<Child> {
    let binary = resolve_daemon_binary()?;
    let mut command = Command::new(binary);
    command
        .arg("--daemon")
        .arg("--config-db")
        .arg(config_db_path)
        .arg("--security-db")
        .arg(security_db_path)
        .arg("--state-file")
        .arg(state_path)
        .arg("--admin-port")
        .arg(admin_port.to_string())
        .arg("--admin-token")
        .arg(admin_token)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    Ok(command.spawn()?)
}

fn pick_free_port() -> DynResult<u16> {
    let socket = std::net::TcpListener::bind(("127.0.0.1", 0))?;
    let port = socket.local_addr()?.port();
    drop(socket);
    Ok(port)
}

fn generate_admin_token() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect()
}

fn resolve_daemon_binary() -> DynResult<PathBuf> {
    let name = if cfg!(windows) {
        "flm-proxy.exe"
    } else {
        "flm-proxy"
    };

    if let Ok(current) = std::env::current_exe() {
        if let Some(dir) = current.parent() {
            let candidate = dir.join(name);
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    if let Ok(found) = which(name) {
        return Ok(found);
    }

    let fallback = PathBuf::from(name);
    if fallback.exists() {
        return Ok(fallback);
    }

    Err(format!("Unable to locate {name} binary").into())
}

async fn wait_for_daemon_ready(child: &mut Child, client: &AdminClient) -> DynResult<()> {
    let deadline = Instant::now() + HEALTH_TIMEOUT;

    loop {
        if Instant::now() > deadline {
            child.kill().await.ok();
            return Err("Timed out while waiting for proxy daemon to become ready".into());
        }

        if let Some(status) = child.try_wait()? {
            return Err(format!("Proxy daemon exited early with status {status}").into());
        }

        if client.health().await.is_ok() {
            return Ok(());
        }

        sleep(Duration::from_millis(200)).await;
    }
}

async fn wait_for_state_file(path: &Path) -> DynResult<()> {
    let deadline = Instant::now() + STATE_TIMEOUT;
    loop {
        if path.exists() {
            return Ok(());
        }
        if Instant::now() > deadline {
            return Err("Timed out waiting for daemon state file".into());
        }
        sleep(Duration::from_millis(100)).await;
    }
}

fn read_state_file(path: &Path) -> DynResult<Option<DaemonStateRecord>> {
    if !path.exists() {
        return Ok(None);
    }

    let data = fs::read_to_string(path)?;
    let record: DaemonStateRecord = serde_json::from_str(&data)?;
    Ok(Some(record))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::routing::get;
    use axum::{http::StatusCode, Json, Router};
    use serde_json::json;
    use std::sync::OnceLock;
    use tempfile::TempDir;
    use tokio::net::TcpListener;
    use tokio::sync::Mutex;

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn write_state_file(dir: &TempDir, port: u16, token: &str) -> PathBuf {
        std::env::set_var("FLM_DATA_DIR", dir.path());
        let path = crate::utils::get_daemon_state_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        let record = json!({
            "port": port,
            "token": token,
            "pid": std::process::id(),
            "updated_at": chrono::Utc::now().to_rfc3339(),
        });
        std::fs::write(&path, serde_json::to_vec(&record).unwrap()).unwrap();
        path
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn load_existing_client_returns_some_when_health_ok() {
        let _guard = env_lock().lock().await;
        let temp_dir = tempfile::tempdir().unwrap();
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let token = "test-token".to_string();
        let router = Router::new().route(
            "/admin/health",
            get({
                let token = token.clone();
                move |headers: axum::http::HeaderMap| {
                    let expected = format!("Bearer {token}");
                    async move {
                        let auth = headers
                            .get(axum::http::header::AUTHORIZATION)
                            .and_then(|h| h.to_str().ok())
                            .unwrap_or_default();
                        if auth == expected {
                            (StatusCode::OK, Json(json!({ "status": "ok" })))
                        } else {
                            (
                                StatusCode::UNAUTHORIZED,
                                Json(json!({ "status": "unauthorized" })),
                            )
                        }
                    }
                }
            }),
        );
        let server = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        let path = write_state_file(&temp_dir, port, token.as_str());

        let result = load_existing_client().await.unwrap();
        assert!(result.is_some(), "client should be loaded");
        server.abort();
        std::fs::remove_file(path).ok();
        std::env::remove_var("FLM_DATA_DIR");
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn load_existing_client_clears_state_when_unreachable() {
        let _guard = env_lock().lock().await;
        let temp_dir = tempfile::tempdir().unwrap();
        let port = 59999; // no server started
        let path = write_state_file(&temp_dir, port, "token");

        let result = load_existing_client().await.unwrap();
        assert!(
            result.is_none(),
            "client should be None when daemon unreachable"
        );
        assert!(
            !path.exists(),
            "state file should be removed after failed health check"
        );
        std::env::remove_var("FLM_DATA_DIR");
    }
}
