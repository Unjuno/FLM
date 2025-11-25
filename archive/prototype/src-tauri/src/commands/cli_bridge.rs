//! Bridges Tauri IPC commands to the new Rust CLI (`flm` binary).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

const CLI_BIN: &str = "flm";
const CLI_TIMEOUT_SECS: u64 = 60;

#[derive(Debug, Serialize)]
pub struct CliBridgeError {
    pub code: String,
    pub message: String,
    pub stderr: Option<String>,
}

impl std::fmt::Display for CliBridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for CliBridgeError {}

#[derive(Debug, Deserialize)]
pub struct ProxyStartRequest {
    pub mode: String,
    pub port: u16,
    pub bind: Option<String>,
    pub engine_base_url: Option<String>,
    pub acme_email: Option<String>,
    pub acme_domain: Option<String>,
    pub no_daemon: bool,
}

#[tauri::command]
pub async fn ipc_detect_engines(fresh: bool) -> Result<Value, CliBridgeError> {
    let mut args = vec!["engines", "detect", "--format", "json"];
    if fresh {
        args.push("--fresh");
    }
    run_cli_json(args).await
}

#[tauri::command]
pub async fn ipc_list_models(engine: Option<String>) -> Result<Value, CliBridgeError> {
    let mut args = vec!["models", "list", "--format", "json"];
    if let Some(engine_id) = engine.as_deref() {
        args.push("--engine");
        args.push(engine_id);
    }
    run_cli_json(args).await
}

#[tauri::command]
pub async fn ipc_proxy_start(config: ProxyStartRequest) -> Result<Value, CliBridgeError> {
    let mut args = vec!["proxy", "start", "--mode", &config.mode, "--port", &config.port.to_string()];

    if let Some(bind) = config.bind.as_deref() {
        args.push("--bind");
        args.push(bind);
    }

    if let Some(engine_url) = config.engine_base_url.as_deref() {
        args.push("--engine-base-url");
        args.push(engine_url);
    }

    if let Some(email) = config.acme_email.as_deref() {
        args.push("--acme-email");
        args.push(email);
    }

    if let Some(domain) = config.acme_domain.as_deref() {
        args.push("--acme-domain");
        args.push(domain);
    }

    if config.no_daemon {
        args.push("--no-daemon");
    }

    args.push("--format");
    args.push("json");

    run_cli_json(args).await
}

#[tauri::command]
pub async fn ipc_proxy_status() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["proxy", "status", "--format", "json"]).await
}

#[tauri::command]
pub async fn ipc_security_policy_show() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["security", "policy", "show", "--format", "json"]).await
}

#[derive(Debug, Deserialize)]
pub struct SecurityPolicyInput {
    pub policy: Value,
}

#[tauri::command]
pub async fn ipc_security_policy_set(payload: SecurityPolicyInput) -> Result<Value, CliBridgeError> {
    let policy_string = serde_json::to_string(&payload.policy).map_err(|e| CliBridgeError {
        code: "SERIALIZATION_ERROR".into(),
        message: format!("Failed to serialize policy JSON: {e}"),
        stderr: None,
    })?;

    run_cli_json(vec![
        "security",
        "policy",
        "set",
        "--json",
        &policy_string,
        "--format",
        "json",
    ])
    .await
}

#[derive(Debug, Deserialize)]
pub struct ApiKeyCreateInput {
    pub label: String,
}

#[tauri::command]
pub async fn ipc_api_keys_list() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["api-keys", "list", "--format", "json"]).await
}

#[derive(Debug, Deserialize)]
pub struct ApiKeyRevokeRequest {
    pub id: String,
}

#[tauri::command]
pub async fn ipc_api_keys_revoke(payload: ApiKeyRevokeRequest) -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["api-keys", "revoke", &payload.id, "--format", "json"]).await
}

#[tauri::command]
pub async fn ipc_config_list() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["config", "list", "--format", "json"]).await
}

#[derive(Debug, Deserialize)]
pub struct ConfigGetRequest {
    pub key: String,
}

#[tauri::command]
pub async fn ipc_config_get(payload: ConfigGetRequest) -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["config", "get", &payload.key, "--format", "json"]).await
}

#[tauri::command]
pub async fn ipc_security_install_packaged_ca() -> Result<(), CliBridgeError> {
    let cert_path = resolve_packaged_ca_path();
    if !cert_path.exists() {
        return Err(CliBridgeError {
            code: "CA_NOT_FOUND".into(),
            message: format!(
                "Packaged CA certificate was not found at {}. Place flm-ca.crt in this directory and retry.",
                cert_path.display()
            ),
            stderr: None,
        });
    }

    let cert_bytes = fs::read(&cert_path)
        .await
        .map_err(|e| CliBridgeError {
            code: "CA_READ_ERROR".into(),
            message: format!(
                "Failed to read packaged CA certificate at {}: {e}",
                cert_path.display()
            ),
            stderr: None,
        })?;
    let cert_pem = String::from_utf8(cert_bytes).map_err(|e| CliBridgeError {
        code: "CA_ENCODING_ERROR".into(),
        message: format!("CA certificate file is not valid UTF-8: {e}"),
        stderr: None,
    })?;

    let filename = cert_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("flm-ca.crt")
        .to_string();

    let install_result = tokio::task::spawn_blocking(move || {
        flm_core::services::certificate::register_root_ca_with_os_trust_store(&cert_pem, &filename)
    })
    .await
    .map_err(|e| CliBridgeError {
        code: "CA_INSTALL_TASK_ERROR".into(),
        message: format!("Failed to join trust store task: {e}"),
        stderr: None,
    })?
    .map_err(|e| CliBridgeError {
        code: "CA_INSTALL_ERROR".into(),
        message: format!("Failed to register certificate with OS trust store: {e}"),
        stderr: None,
    })?;

    install_result;
    Ok(())
}

fn resolve_packaged_ca_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
        return PathBuf::from(base).join("flm").join("certs").join("flm-ca.crt");
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        return PathBuf::from(home)
            .join(".flm")
            .join("certs")
            .join("flm-ca.crt");
    }
}

#[derive(Debug, Deserialize)]
pub struct ConfigSetRequest {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub async fn ipc_config_set(payload: ConfigSetRequest) -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["config", "set", &payload.key, &payload.value, "--format", "json"]).await
}

#[tauri::command]
pub fn get_platform() -> Result<Value, CliBridgeError> {
    let platform = std::env::consts::OS;
    Ok(serde_json::json!({
        "platform": platform
    }))
}

#[tauri::command]
pub async fn ipc_api_keys_create(payload: ApiKeyCreateInput) -> Result<Value, CliBridgeError> {
    run_cli_json(vec![
        "api-keys",
        "create",
        "--label",
        &payload.label,
        "--format",
        "json",
    ])
    .await
}

#[derive(Debug, Deserialize)]
pub struct ProxyStopRequest {
    pub port: Option<u16>,
    pub handle_id: Option<String>,
}

#[tauri::command]
pub async fn ipc_proxy_stop(payload: ProxyStopRequest) -> Result<Value, CliBridgeError> {
    let mut args = vec!["proxy", "stop", "--format", "json"];
    if let Some(port) = payload.port {
        args.push("--port");
        args.push(&port.to_string());
    } else if let Some(handle_id) = payload.handle_id.as_deref() {
        args.push("--handle-id");
        args.push(handle_id);
    } else {
        return Err(CliBridgeError {
            code: "INVALID_INPUT".into(),
            message: "Either port or handle_id must be specified".into(),
            stderr: None,
        });
    }
    run_cli_json(args).await
}

#[derive(Debug, Deserialize)]
pub struct ModelProfilesListRequest {
    pub engine: Option<String>,
    pub model: Option<String>,
}

#[tauri::command]
pub async fn ipc_model_profiles_list(
    payload: Option<ModelProfilesListRequest>,
) -> Result<Value, CliBridgeError> {
    let mut args = vec!["model-profiles", "list", "--format", "json"];
    if let Some(p) = payload {
        if let Some(engine) = p.engine.as_deref() {
            args.push("--engine");
            args.push(engine);
        }
        if let Some(model) = p.model.as_deref() {
            args.push("--model");
            args.push(model);
        }
    }
    run_cli_json(args).await
}

#[derive(Debug, Deserialize)]
pub struct ModelProfileSaveRequest {
    pub engine: String,
    pub model: String,
    pub label: String,
    pub params_json: String,
}

#[tauri::command]
pub async fn ipc_model_profiles_save(
    payload: ModelProfileSaveRequest,
) -> Result<Value, CliBridgeError> {
    use std::io::Write;
    use std::path::PathBuf;

    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("flm_profile_{}.json", uuid::Uuid::new_v4()));
    let mut file = std::fs::File::create(&temp_file).map_err(|e| CliBridgeError {
        code: "FILE_CREATE_FAILED".into(),
        message: format!("Failed to create temporary file: {e}"),
        stderr: None,
    })?;
    file.write_all(payload.params_json.as_bytes())
        .map_err(|e| CliBridgeError {
            code: "FILE_WRITE_FAILED".into(),
            message: format!("Failed to write to temporary file: {e}"),
            stderr: None,
        })?;
    drop(file);

    let result = run_cli_json(vec![
        "model-profiles",
        "save",
        "--engine",
        &payload.engine,
        "--model",
        &payload.model,
        "--label",
        &payload.label,
        "--params",
        temp_file.to_str().ok_or_else(|| CliBridgeError {
            code: "PATH_CONVERSION_FAILED".into(),
            message: "Failed to convert temp file path to string".into(),
            stderr: None,
        })?,
        "--format",
        "json",
    ])
    .await;

    let _ = std::fs::remove_file(&temp_file);
    result
}

#[derive(Debug, Deserialize)]
pub struct ModelProfileDeleteRequest {
    pub id: String,
}

#[tauri::command]
pub async fn ipc_model_profiles_delete(
    payload: ModelProfileDeleteRequest,
) -> Result<Value, CliBridgeError> {
    run_cli_json(vec![
        "model-profiles",
        "delete",
        "--id",
        &payload.id,
        "--format",
        "json",
    ])
    .await
}

#[tauri::command]
pub async fn ipc_api_prompts_list() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["api", "prompts", "list", "--format", "json"]).await
}

#[derive(Debug, Deserialize)]
pub struct ApiPromptShowRequest {
    pub api_id: String,
}

#[tauri::command]
pub async fn ipc_api_prompts_show(
    payload: ApiPromptShowRequest,
) -> Result<Value, CliBridgeError> {
    run_cli_json(vec![
        "api",
        "prompts",
        "show",
        "--api-id",
        &payload.api_id,
        "--format",
        "json",
    ])
    .await
}

#[derive(Debug, Deserialize)]
pub struct ApiPromptSetRequest {
    pub api_id: String,
    pub template_text: String,
}

#[tauri::command]
pub async fn ipc_api_prompts_set(payload: ApiPromptSetRequest) -> Result<Value, CliBridgeError> {
    use std::io::Write;
    use std::path::PathBuf;

    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("flm_prompt_{}.txt", uuid::Uuid::new_v4()));
    let mut file = std::fs::File::create(&temp_file).map_err(|e| CliBridgeError {
        code: "FILE_CREATE_FAILED".into(),
        message: format!("Failed to create temporary file: {e}"),
        stderr: None,
    })?;
    file.write_all(payload.template_text.as_bytes())
        .map_err(|e| CliBridgeError {
            code: "FILE_WRITE_FAILED".into(),
            message: format!("Failed to write to temporary file: {e}"),
            stderr: None,
        })?;
    drop(file);

    let result = run_cli_json(vec![
        "api",
        "prompts",
        "set",
        "--api-id",
        &payload.api_id,
        "--file",
        temp_file.to_str().ok_or_else(|| CliBridgeError {
            code: "PATH_CONVERSION_FAILED".into(),
            message: "Failed to convert temp file path to string".into(),
            stderr: None,
        })?,
        "--format",
        "json",
    ])
    .await;

    let _ = std::fs::remove_file(&temp_file);
    result
}

async fn run_cli_json<I, S>(args: I) -> Result<Value, CliBridgeError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let arg_vec: Vec<String> = args.into_iter().map(|s| s.as_ref().to_string()).collect();
    let mut command = Command::new(CLI_BIN);
    command.args(&arg_vec);
    let output = timeout(Duration::from_secs(CLI_TIMEOUT_SECS), command.output())
        .await
        .map_err(|_| CliBridgeError {
            code: "CLI_TIMEOUT".into(),
            message: format!(
                "CLI command exceeded timeout of {} seconds",
                CLI_TIMEOUT_SECS
            ),
            stderr: None,
        })?
        .map_err(|e| CliBridgeError {
            code: "CLI_EXECUTION_FAILED".into(),
            message: format!("Failed to spawn CLI binary '{CLI_BIN}': {e}"),
            stderr: None,
        })?;

    if output.status.success() {
        let value: Value = serde_json::from_slice(&output.stdout).map_err(|e| CliBridgeError {
            code: "CLI_OUTPUT_PARSE_FAILED".into(),
            message: format!("CLI output was not valid JSON: {e}"),
            stderr: Some(String::from_utf8_lossy(&output.stdout).to_string()),
        })?;
        Ok(value)
    } else {
        Err(parse_cli_error(output.stdout, output.stderr))
    }
}

fn parse_cli_error(stdout: Vec<u8>, stderr: Vec<u8>) -> CliBridgeError {
    if let Ok(value) = serde_json::from_slice::<Value>(&stdout) {
        if let Some(err) = value.get("error") {
            let code = err
                .get("code")
                .and_then(Value::as_str)
                .unwrap_or("CLI_ERROR")
                .to_string();
            let message = err
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("CLI returned an error")
                .to_string();
            return CliBridgeError {
                code,
                message,
                stderr: Some(String::from_utf8_lossy(&stderr).to_string()).filter(|s| !s.trim().is_empty()),
            };
        }
    }

    CliBridgeError {
        code: "CLI_ERROR".into(),
        message: String::from_utf8_lossy(if !stdout.is_empty() { &stdout } else { &stderr })
            .trim()
            .to_string(),
        stderr: if stderr.is_empty() {
            None
        } else {
            Some(String::from_utf8_lossy(&stderr).to_string())
        },
    }
}

// Security commands

#[tauri::command]
pub async fn ipc_security_ip_blocklist_list() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["security", "ip-blocklist", "list", "--format", "json"]).await
}

#[derive(Debug, Deserialize)]
pub struct IpBlocklistUnblockRequest {
    pub ip: String,
}

#[tauri::command]
pub async fn ipc_security_ip_blocklist_unblock(
    payload: IpBlocklistUnblockRequest,
) -> Result<Value, CliBridgeError> {
    run_cli_json(vec![
        "security",
        "ip-blocklist",
        "unblock",
        &payload.ip,
        "--format",
        "json",
    ])
    .await
}

#[tauri::command]
pub async fn ipc_security_ip_blocklist_clear() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["security", "ip-blocklist", "clear", "--format", "json"]).await
}

#[derive(Debug, Deserialize)]
pub struct AuditLogsRequest {
    pub event_type: Option<String>,
    pub severity: Option<String>,
    pub ip: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[tauri::command]
pub async fn ipc_security_audit_logs(
    payload: Option<AuditLogsRequest>,
) -> Result<Value, CliBridgeError> {
    let mut args = vec!["security", "audit-logs", "--format", "json"];

    if let Some(p) = payload {
        if let Some(event_type) = p.event_type.as_deref() {
            args.push("--event-type");
            args.push(event_type);
        }
        if let Some(severity) = p.severity.as_deref() {
            args.push("--severity");
            args.push(severity);
        }
        if let Some(ip) = p.ip.as_deref() {
            args.push("--ip");
            args.push(ip);
        }
        if let Some(limit) = p.limit {
            args.push("--limit");
            args.push(&limit.to_string());
        }
        if let Some(offset) = p.offset {
            args.push("--offset");
            args.push(&offset.to_string());
        }
    }

    run_cli_json(args).await
}

#[derive(Debug, Deserialize)]
pub struct IntrusionRequest {
    pub ip: Option<String>,
    pub min_score: Option<u32>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[tauri::command]
pub async fn ipc_security_intrusion(
    payload: Option<IntrusionRequest>,
) -> Result<Value, CliBridgeError> {
    let mut args = vec!["security", "intrusion", "--format", "json"];

    if let Some(p) = payload {
        if let Some(ip) = p.ip.as_deref() {
            args.push("--ip");
            args.push(ip);
        }
        if let Some(min_score) = p.min_score {
            args.push("--min-score");
            args.push(&min_score.to_string());
        }
        if let Some(limit) = p.limit {
            args.push("--limit");
            args.push(&limit.to_string());
        }
        if let Some(offset) = p.offset {
            args.push("--offset");
            args.push(&offset.to_string());
        }
    }

    run_cli_json(args).await
}

#[derive(Debug, Deserialize)]
pub struct AnomalyRequest {
    pub ip: Option<String>,
    pub anomaly_type: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[tauri::command]
pub async fn ipc_security_anomaly(
    payload: Option<AnomalyRequest>,
) -> Result<Value, CliBridgeError> {
    let mut args = vec!["security", "anomaly", "--format", "json"];

    if let Some(p) = payload {
        if let Some(ip) = p.ip.as_deref() {
            args.push("--ip");
            args.push(ip);
        }
        if let Some(anomaly_type) = p.anomaly_type.as_deref() {
            args.push("--anomaly-type");
            args.push(anomaly_type);
        }
        if let Some(limit) = p.limit {
            args.push("--limit");
            args.push(&limit.to_string());
        }
        if let Some(offset) = p.offset {
            args.push("--offset");
            args.push(&offset.to_string());
        }
    }

    run_cli_json(args).await
}

