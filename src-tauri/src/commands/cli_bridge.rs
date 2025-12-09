//! Bridges Tauri IPC commands to the new Rust CLI (`flm` binary).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tokio::fs;
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use log::warn;

const CLI_BIN: &str = "flm";
const CLI_TIMEOUT_SECS: u64 = 60;

/// Finds the flm CLI binary path.
/// Searches in the following order:
/// 1. FLM_CLI_PATH environment variable
/// 2. Current working directory (target/release/ and target/debug/)
/// 3. Relative paths from the executable directory
/// 4. System PATH
fn find_flm_binary() -> Result<PathBuf, CliBridgeError> {
    let binary_name = if cfg!(windows) { "flm.exe" } else { "flm" };
    
    // 1. Check environment variable (for development/testing)
    if let Ok(path) = std::env::var("FLM_CLI_PATH") {
        let path = PathBuf::from(path);
        if path.exists() {
            return Ok(path);
        }
    }

    // 2. Check current working directory (for development)
    if let Ok(cwd) = std::env::current_dir() {
        let cwd_release = cwd.join("target").join("release").join(&binary_name);
        if cwd_release.exists() {
            return Ok(cwd_release);
        }
        let cwd_debug = cwd.join("target").join("debug").join(&binary_name);
        if cwd_debug.exists() {
            return Ok(cwd_debug);
        }
    }

    // 3. Check relative paths from the executable directory
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_dir(&exe_path) {
            // Check in the same directory as the executable (for bundled binaries)
            let same_dir = exe_dir.join(&binary_name);
            if same_dir.exists() {
                return Ok(same_dir);
            }
            
            // Check in parent directory (Tauri may place externalBin binaries there)
            if let Some(parent_dir) = exe_dir.parent() {
                let parent_binary = parent_dir.join(&binary_name);
                if parent_binary.exists() {
                    return Ok(parent_binary);
                }
            }
            
            // Check workspace root target/ (from src-tauri/target/release/ to workspace root target/)
            // exe_dir is typically: <workspace>/src-tauri/target/release/
            // We need: <workspace>/target/release/flm.exe
            if let Some(target_dir) = exe_dir.parent() {
                if let Some(src_tauri_dir) = target_dir.parent() {
                    if let Some(workspace_root) = src_tauri_dir.parent() {
                        let workspace_release = workspace_root.join("target").join("release").join(&binary_name);
                        if workspace_release.exists() {
                            return Ok(workspace_release);
                        }
                        let workspace_debug = workspace_root.join("target").join("debug").join(&binary_name);
                        if workspace_debug.exists() {
                            return Ok(workspace_debug);
                        }
                    }
                }
            }
        }
    }

    // 4. Check system PATH using which crate
    which::which(CLI_BIN).map_err(|_| CliBridgeError {
        code: "CLI_BINARY_NOT_FOUND".into(),
        message: format!(
            "flm CLI binary not found. Please ensure 'flm' is in your PATH, or set FLM_CLI_PATH environment variable.\n\
            Expected locations:\n\
            - FLM_CLI_PATH environment variable\n\
            - Current working directory: target/release/flm{} or target/debug/flm{}\n\
            - Same directory as the application\n\
            - Workspace root: target/release/flm{} or target/debug/flm{}\n\
            - System PATH",
            if cfg!(windows) { ".exe" } else { "" },
            if cfg!(windows) { ".exe" } else { "" },
            if cfg!(windows) { ".exe" } else { "" },
            if cfg!(windows) { ".exe" } else { "" }
        ),
        stderr: None,
    })
}

fn exe_dir(exe_path: &PathBuf) -> Option<PathBuf> {
    exe_path.parent().map(|p| p.to_path_buf())
}

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
    let mut args: Vec<String> = vec!["engines".to_string(), "detect".to_string(), "--format".to_string(), "json".to_string()];
    if fresh {
        args.push("--fresh".to_string());
    }
    run_cli_json(args).await
}

#[tauri::command]
pub async fn ipc_list_models(engine: Option<String>) -> Result<Value, CliBridgeError> {
    let mut args: Vec<String> = vec!["models".to_string(), "list".to_string(), "--format".to_string(), "json".to_string()];
    if let Some(engine_id) = engine {
        args.push("--engine".to_string());
        args.push(engine_id);
    }
    run_cli_json(args).await
}

#[derive(Debug, Deserialize)]
pub struct EngineHealthHistoryRequest {
    pub engine: Option<String>,
    pub model: Option<String>,
    pub hours: Option<u32>,
    pub limit: Option<u32>,
}

#[tauri::command]
pub async fn ipc_engines_health_history(
    payload: Option<EngineHealthHistoryRequest>,
) -> Result<Value, CliBridgeError> {
    let mut args: Vec<String> = vec![
        "engines".to_string(),
        "health-history".to_string(),
        "--format".to_string(),
        "json".to_string(),
    ];

    if let Some(p) = payload {
        if let Some(engine) = p.engine {
            args.push("--engine".to_string());
            args.push(engine);
        }
        if let Some(model) = p.model {
            args.push("--model".to_string());
            args.push(model);
        }
        if let Some(hours) = p.hours {
            args.push("--hours".to_string());
            args.push(hours.to_string());
        }
        if let Some(limit) = p.limit {
            args.push("--limit".to_string());
            args.push(limit.to_string());
        }
    }

    run_cli_json(args).await
}

#[tauri::command]
pub async fn ipc_proxy_start(config: ProxyStartRequest) -> Result<Value, CliBridgeError> {
    let mut args: Vec<String> = vec![
        "proxy".to_string(),
        "start".to_string(),
        "--mode".to_string(),
        config.mode,
        "--port".to_string(),
        config.port.to_string(),
    ];

    if let Some(bind) = config.bind {
        args.push("--bind".to_string());
        args.push(bind);
    }

    if let Some(engine_url) = config.engine_base_url {
        args.push("--engine-base-url".to_string());
        args.push(engine_url);
    }

    if let Some(email) = config.acme_email {
        args.push("--acme-email".to_string());
        args.push(email);
    }

    if let Some(domain) = config.acme_domain {
        args.push("--acme-domain".to_string());
        args.push(domain);
    }

    if config.no_daemon {
        args.push("--no-daemon".to_string());
    }

    args.push("--format".to_string());
    args.push("json".to_string());

    run_cli_json(args).await
}

#[tauri::command]
pub async fn ipc_proxy_status() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["proxy".to_string(), "status".to_string(), "--format".to_string(), "json".to_string()]).await
}

#[derive(Debug, Deserialize)]
pub struct ProxyStopRequest {
    pub port: Option<u16>,
    pub handle_id: Option<String>,
}

#[tauri::command]
pub async fn ipc_proxy_stop(payload: ProxyStopRequest) -> Result<Value, CliBridgeError> {
    let mut args: Vec<String> = vec!["proxy".to_string(), "stop".to_string(), "--format".to_string(), "json".to_string()];
    if let Some(port) = payload.port {
        args.push("--port".to_string());
        args.push(port.to_string());
    } else if let Some(handle_id) = payload.handle_id {
        args.push("--handle-id".to_string());
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

#[tauri::command]
pub async fn ipc_security_policy_show() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["security".to_string(), "policy".to_string(), "show".to_string(), "--format".to_string(), "json".to_string()]).await
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
        "security".to_string(),
        "policy".to_string(),
        "set".to_string(),
        "--json".to_string(),
        policy_string,
        "--format".to_string(),
        "json".to_string(),
    ])
    .await
}

#[derive(Debug, Deserialize)]
pub struct ApiKeyCreateInput {
    pub label: String,
}

#[tauri::command]
pub async fn ipc_api_keys_list() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["api-keys".to_string(), "list".to_string(), "--format".to_string(), "json".to_string()]).await
}

#[tauri::command]
pub async fn ipc_api_keys_create(payload: ApiKeyCreateInput) -> Result<Value, CliBridgeError> {
    run_cli_json(vec![
        "api-keys".to_string(),
        "create".to_string(),
        "--label".to_string(),
        payload.label,
        "--format".to_string(),
        "json".to_string(),
    ])
    .await
}

#[derive(Debug, Deserialize)]
pub struct ApiKeyRevokeRequest {
    pub id: String,
}

#[tauri::command]
pub async fn ipc_api_keys_revoke(payload: ApiKeyRevokeRequest) -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["api-keys".to_string(), "revoke".to_string(), payload.id, "--format".to_string(), "json".to_string()]).await
}

#[tauri::command]
pub async fn ipc_config_list() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["config".to_string(), "list".to_string(), "--format".to_string(), "json".to_string()]).await
}

#[derive(Debug, Deserialize)]
pub struct ConfigGetRequest {
    pub key: String,
}

#[tauri::command]
pub async fn ipc_config_get(payload: ConfigGetRequest) -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["config".to_string(), "get".to_string(), payload.key, "--format".to_string(), "json".to_string()]).await
}

#[derive(Debug, Deserialize)]
pub struct ConfigSetRequest {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub async fn ipc_config_set(payload: ConfigSetRequest) -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["config".to_string(), "set".to_string(), payload.key, payload.value, "--format".to_string(), "json".to_string()]).await
}

#[tauri::command]
pub fn get_platform() -> Result<Value, CliBridgeError> {
    let platform = std::env::consts::OS;
    Ok(serde_json::json!({
        "platform": platform
    }))
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
    let mut args: Vec<String> = vec!["model-profiles".to_string(), "list".to_string(), "--format".to_string(), "json".to_string()];
    if let Some(p) = payload {
        if let Some(engine) = p.engine {
            args.push("--engine".to_string());
            args.push(engine);
        }
        if let Some(model) = p.model {
            args.push("--model".to_string());
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

    let temp_file_str = temp_file.to_str().ok_or_else(|| CliBridgeError {
            code: "PATH_CONVERSION_FAILED".into(),
            message: "Failed to convert temp file path to string".into(),
            stderr: None,
    })?.to_string();
    let result = run_cli_json(vec![
        "model-profiles".to_string(),
        "save".to_string(),
        "--engine".to_string(),
        payload.engine,
        "--model".to_string(),
        payload.model,
        "--label".to_string(),
        payload.label,
        "--params".to_string(),
        temp_file_str,
        "--format".to_string(),
        "json".to_string(),
    ])
    .await;

    // why: 一時ファイルの削除失敗は致命的ではないが、ログに記録する
    // alt: エラーを無視する（リソースリークの可能性）
    // evidence: 一時ファイルはOSが自動削除するが、明示的な削除が推奨される
    if let Err(e) = std::fs::remove_file(&temp_file) {
        warn!("Failed to remove temporary file {}: {}", temp_file.display(), e);
    }
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
        "model-profiles".to_string(),
        "delete".to_string(),
        "--id".to_string(),
        payload.id,
        "--format".to_string(),
        "json".to_string(),
    ])
    .await
}

#[tauri::command]
pub async fn ipc_api_prompts_list() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["api".to_string(), "prompts".to_string(), "list".to_string(), "--format".to_string(), "json".to_string()]).await
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
        "api".to_string(),
        "prompts".to_string(),
        "show".to_string(),
        "--api-id".to_string(),
        payload.api_id,
        "--format".to_string(),
        "json".to_string(),
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

    let temp_file_str = temp_file.to_str().ok_or_else(|| CliBridgeError {
            code: "PATH_CONVERSION_FAILED".into(),
            message: "Failed to convert temp file path to string".into(),
            stderr: None,
    })?.to_string();
    let result = run_cli_json(vec![
        "api".to_string(),
        "prompts".to_string(),
        "set".to_string(),
        "--api-id".to_string(),
        payload.api_id,
        "--file".to_string(),
        temp_file_str,
        "--format".to_string(),
        "json".to_string(),
    ])
    .await;

    // why: 一時ファイルの削除失敗は致命的ではないが、ログに記録する
    // alt: エラーを無視する（リソースリークの可能性）
    // evidence: 一時ファイルはOSが自動削除するが、明示的な削除が推奨される
    if let Err(e) = std::fs::remove_file(&temp_file) {
        warn!("Failed to remove temporary file {}: {}", temp_file.display(), e);
    }
    result
}

// Security commands

#[tauri::command]
pub async fn ipc_security_ip_blocklist_list() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["security".to_string(), "ip-blocklist".to_string(), "list".to_string(), "--format".to_string(), "json".to_string()]).await
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
        "security".to_string(),
        "ip-blocklist".to_string(),
        "unblock".to_string(),
        payload.ip,
        "--format".to_string(),
        "json".to_string(),
    ])
    .await
}

#[tauri::command]
pub async fn ipc_security_ip_blocklist_clear() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["security".to_string(), "ip-blocklist".to_string(), "clear".to_string(), "--format".to_string(), "json".to_string()]).await
}

// IP Whitelist commands

#[tauri::command]
pub async fn ipc_security_ip_whitelist_list() -> Result<Value, CliBridgeError> {
    run_cli_json(vec!["security".to_string(), "ip-whitelist".to_string(), "list".to_string(), "--format".to_string(), "json".to_string()]).await
}

#[derive(Debug, Deserialize)]
pub struct IpWhitelistAddRequest {
    pub ip: String,
}

#[tauri::command]
pub async fn ipc_security_ip_whitelist_add(
    payload: IpWhitelistAddRequest,
) -> Result<Value, CliBridgeError> {
    run_cli_json(vec![
        "security".to_string(),
        "ip-whitelist".to_string(),
        "add".to_string(),
        payload.ip,
        "--format".to_string(),
        "json".to_string(),
    ])
    .await
}

#[derive(Debug, Deserialize)]
pub struct IpWhitelistRemoveRequest {
    pub ip: String,
}

#[tauri::command]
pub async fn ipc_security_ip_whitelist_remove(
    payload: IpWhitelistRemoveRequest,
) -> Result<Value, CliBridgeError> {
    run_cli_json(vec![
        "security".to_string(),
        "ip-whitelist".to_string(),
        "remove".to_string(),
        payload.ip,
        "--format".to_string(),
        "json".to_string(),
    ])
    .await
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
    let mut args: Vec<String> = vec!["security".to_string(), "audit-logs".to_string(), "--format".to_string(), "json".to_string()];

    if let Some(p) = payload {
        if let Some(event_type) = p.event_type {
            args.push("--event-type".to_string());
            args.push(event_type);
        }
        if let Some(severity) = p.severity {
            args.push("--severity".to_string());
            args.push(severity);
        }
        if let Some(ip) = p.ip {
            args.push("--ip".to_string());
            args.push(ip);
        }
        if let Some(limit) = p.limit {
            args.push("--limit".to_string());
            args.push(limit.to_string());
        }
        if let Some(offset) = p.offset {
            args.push("--offset".to_string());
            args.push(offset.to_string());
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
    let mut args: Vec<String> = vec!["security".to_string(), "intrusion".to_string(), "--format".to_string(), "json".to_string()];

    if let Some(p) = payload {
        if let Some(ip) = p.ip {
            args.push("--ip".to_string());
            args.push(ip);
        }
        if let Some(min_score) = p.min_score {
            args.push("--min-score".to_string());
            args.push(min_score.to_string());
        }
        if let Some(limit) = p.limit {
            args.push("--limit".to_string());
            args.push(limit.to_string());
        }
        if let Some(offset) = p.offset {
            args.push("--offset".to_string());
            args.push(offset.to_string());
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
    let mut args: Vec<String> = vec!["security".to_string(), "anomaly".to_string(), "--format".to_string(), "json".to_string()];

    if let Some(p) = payload {
        if let Some(ip) = p.ip {
            args.push("--ip".to_string());
            args.push(ip);
        }
        if let Some(anomaly_type) = p.anomaly_type {
            args.push("--anomaly-type".to_string());
            args.push(anomaly_type);
        }
        if let Some(limit) = p.limit {
            args.push("--limit".to_string());
            args.push(limit.to_string());
        }
        if let Some(offset) = p.offset {
            args.push("--offset".to_string());
            args.push(offset.to_string());
        }
    }

    run_cli_json(args).await
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

    tokio::task::spawn_blocking(move || {
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

    Ok(())
}

fn resolve_packaged_ca_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        // why: APPDATA環境変数が設定されていない場合、より適切なフォールバックを使用
        // alt: "." を使用（現在のディレクトリに依存し、予期しない動作を引き起こす可能性）
        // evidence: Windowsでは通常APPDATAが設定されているが、設定されていない場合の処理が必要
        let base = std::env::var("APPDATA").unwrap_or_else(|_| {
            // フォールバック: ユーザープロファイルディレクトリを使用
            std::env::var("USERPROFILE")
                .unwrap_or_else(|_| {
                    warn!("Neither APPDATA nor USERPROFILE is set, using current directory");
                    ".".to_string()
                })
        });
        return PathBuf::from(base).join("flm").join("certs").join("flm-ca.crt");
    }

    #[cfg(not(target_os = "windows"))]
    {
        // why: HOME環境変数が設定されていない場合、より適切なフォールバックを使用
        // alt: "." を使用（現在のディレクトリに依存し、予期しない動作を引き起こす可能性）
        // evidence: Unix系OSでは通常HOMEが設定されているが、設定されていない場合の処理が必要
        let home = std::env::var("HOME").unwrap_or_else(|_| {
            warn!("HOME environment variable is not set, using current directory");
            ".".to_string()
        });
        return PathBuf::from(home)
            .join(".flm")
            .join("certs")
            .join("flm-ca.crt");
    }
}

async fn run_cli_json<I, S>(args: I) -> Result<Value, CliBridgeError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let arg_vec: Vec<String> = args.into_iter().map(|s| s.as_ref().to_string()).collect();
    let binary_path = find_flm_binary()?;
    let mut command = Command::new(&binary_path);
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
            let stderr_str = String::from_utf8_lossy(&stderr).to_string();
            return CliBridgeError {
                code,
                message,
                stderr: if stderr_str.trim().is_empty() {
                    None
                } else {
                    Some(stderr_str)
                },
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

