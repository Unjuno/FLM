// Ollama Integration Module

use crate::database::connection::get_app_data_dir;
use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Ollama検出結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaDetectionResult {
    pub installed: bool,               // システムパス上にOllamaが存在するか
    pub running: bool,                 // Ollamaプロセスが実行中か
    pub portable: bool,                // ポータブル版が存在するか
    pub version: Option<String>,       // バージョン情報（存在する場合）
    pub portable_path: Option<String>, // ポータブル版のパス（存在する場合）
    pub system_path: Option<String>,   // システムパス上のOllamaのパス（存在する場合）
}

/// ダウンロード進捗情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub status: String,        // "downloading" | "extracting" | "completed" | "error"
    pub progress: f64,         // 0.0 - 100.0
    pub downloaded_bytes: u64, // ダウンロード済みバイト数
    pub total_bytes: u64,      // 総バイト数
    pub speed_bytes_per_sec: f64, // ダウンロード速度（バイト/秒）
    pub message: Option<String>, // ステータスメッセージ
}

fn default_ollama_host() -> String {
    "127.0.0.1".to_string()
}

fn default_ollama_port() -> u16 {
    11434
}

fn strip_scheme(value: &str) -> &str {
    value
        .strip_prefix("http://")
        .or_else(|| value.strip_prefix("https://"))
        .unwrap_or(value)
}

fn normalize_host(raw_host: &str) -> String {
    let host = raw_host.trim();
    if host.eq_ignore_ascii_case("localhost") || host == "0.0.0.0" {
        default_ollama_host()
    } else {
        host.trim_matches(|c| c == '[' || c == ']').to_string()
    }
}

fn parse_host_port(raw: &str) -> Option<(String, u16)> {
    let trimmed = strip_scheme(raw).trim();
    if trimmed.is_empty() {
        return None;
    }
    let authority = trimmed.split('/').next().unwrap_or("").trim();
    if authority.is_empty() {
        return None;
    }

    if authority.starts_with('[') {
        if let Some(end_idx) = authority.find(']') {
            let host = authority[1..end_idx].to_string();
            let mut port = default_ollama_port();
            if let Some(rest) = authority[end_idx + 1..].strip_prefix(':') {
                if let Ok(parsed) = rest.parse::<u16>() {
                    port = parsed;
                }
            }
            return Some((normalize_host(&host), port));
        }
    }

    if let Some(idx) = authority.rfind(':') {
        let host_part = &authority[..idx];
        let port_part = &authority[idx + 1..];
        if let Ok(port) = port_part.parse::<u16>() {
            let host = if host_part.is_empty() {
                default_ollama_host()
            } else {
                normalize_host(host_part)
            };
            return Some((host, port));
        }
    }

    Some((normalize_host(authority), default_ollama_port()))
}

fn host_to_url(host: &str, port: u16) -> String {
    if host.contains(':') && !host.starts_with('[') {
        format!("http://[{}]:{}", host, port)
    } else {
        format!("http://{}:{}", host, port)
    }
}

fn is_local_host(host: &str) -> bool {
    matches!(
        host.to_lowercase().as_str(),
        "localhost" | "127.0.0.1" | "0.0.0.0"
    )
}

fn is_port_available(port: u16) -> bool {
    let ipv4 = format!("127.0.0.1:{}", port);
    if TcpListener::bind(&ipv4).is_ok() {
        return true;
    }

    #[cfg(not(target_os = "windows"))]
    {
        if TcpListener::bind(format!("[::1]:{}", port)).is_ok() {
            return true;
        }
    }

    false
}

fn find_available_port(preferred: u16, max_attempts: u16) -> Option<u16> {
    if is_port_available(preferred) {
        return Some(preferred);
    }

    let mut attempts = 0;
    let mut port = preferred.saturating_add(1);
    while attempts < max_attempts {
        if port == 0 {
            port = 1024;
        }
        if is_port_available(port) {
            return Some(port);
        }
        attempts += 1;
        port = port.saturating_add(1);
    }
    None
}

pub fn current_ollama_host_port() -> (String, u16) {
    if let Ok(raw) = std::env::var("OLLAMA_HOST") {
        if let Some((host, port)) = parse_host_port(&raw) {
            return (host, port);
        }
    }
    (default_ollama_host(), default_ollama_port())
}

pub fn current_ollama_base_url() -> String {
    let (host, port) = current_ollama_host_port();
    host_to_url(&host, port)
}

pub fn update_ollama_host_env(host: &str, port: u16) {
    let normalized_host = if is_local_host(host) {
        default_ollama_host()
    } else {
        host.to_string()
    };
    let value = format!("{}:{}", normalized_host, port);
    std::env::set_var("OLLAMA_HOST", &value);
}

/// Ollama検出機能
/// システムパス上、実行中、ポータブル版の順に検出を試みます
pub async fn detect_ollama() -> Result<OllamaDetectionResult, AppError> {
    let mut result = OllamaDetectionResult {
        installed: false,
        running: false,
        portable: false,
        version: None,
        portable_path: None,
        system_path: None,
    };

    // 1. バンドル版Ollamaを検出（最優先）
    use crate::utils::bundled_ollama;
    if let Ok(Some(bundled_path)) = bundled_ollama::get_bundled_ollama_path() {
        result.installed = true;
        result.portable = true; // バンドル版もポータブル版として扱う
        result.portable_path = Some(bundled_path.to_string_lossy().to_string());
        // バージョン情報を取得
        if let Ok(Some(version)) = bundled_ollama::get_bundled_ollama_version() {
            result.version = Some(version);
        }
        // バンドル版が見つかった場合は、それ以降の検出をスキップして返す
        // （実行中のOllamaがバンドル版かどうかは確認する）
        match check_ollama_running().await {
            Ok(running) => {
                result.running = running;
            }
            Err(e) => {
                eprintln!("実行中Ollama検出エラー: {}", e);
            }
        }
        return Ok(result);
    }

    // 2. ポータブル版Ollamaを検出（簡易実装：アプリデータディレクトリを確認）
    match detect_portable_ollama_in_app_data().await {
        Ok(Some(path)) => {
            result.portable = true;
            result.portable_path = Some(path.clone());
            // ポータブル版が見つかった場合、バージョンも取得
            if result.version.is_none() {
                if let Ok(version) = get_ollama_version(&path).await {
                    result.version = Some(version);
                }
            }
        }
        #[allow(non_snake_case)]
        Ok(None) => {
            // ポータブル版Ollamaが見つからない場合はスキップ
        }
        Err(e) => {
            eprintln!("ポータブル版Ollama検出エラー: {}", e);
        }
    }

    // 3. システムパス上のOllamaを検出
    match detect_ollama_in_path().await {
        Ok(Some(path)) => {
            result.installed = true;
            result.system_path = Some(path.clone());
            // バージョン情報を取得
            if result.version.is_none() {
                if let Ok(version) = get_ollama_version(&path).await {
                    result.version = Some(version);
                }
            }
        }
        #[allow(non_snake_case)]
        Ok(None) => {
            // システムパス上のOllamaが見つからない場合はスキップ
        }
        Err(e) => {
            eprintln!("システムパス上のOllama検出エラー: {}", e);
        }
    }

    // 4. 実行中のOllamaを検出
    match check_ollama_running().await {
        Ok(running) => {
            result.running = running;
            // 実行中だがバージョンが未取得の場合はAPIから取得
            if result.running && result.version.is_none() {
                if let Ok(version) = get_ollama_version_from_api().await {
                    result.version = Some(version);
                }
            }
        }
        Err(e) => {
            eprintln!("実行中Ollama検出エラー: {}", e);
        }
    }

    Ok(result)
}

/// システムパス上のOllamaを検出
async fn detect_ollama_in_path() -> Result<Option<String>, AppError> {
    #[cfg(target_os = "windows")]
    {
        let output =
            Command::new("where")
                .arg("ollama")
                .output()
                .map_err(|e| AppError::OllamaError {
                    message: format!("whereコマンド実行エラー:  {}", e),

                    source_detail: None,
                })?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(Some(path));
            }
        }
    }

    Ok(None)
}

/// 実行中のOllamaを検出（HTTP API経由）
pub async fn check_ollama_running() -> Result<bool, AppError> {
    let client = crate::utils::http_client::create_http_client_short_timeout()?;
    let base_url = current_ollama_base_url();
    let url = format!("{}/api/version", base_url.trim_end_matches('/'));
    let response = client.get(&url).send().await;

    match response {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false), // タイムアウトや接続エラーは「実行中でない」と見なす
    }
}

/// API経由でOllamaのバージョン情報を取得
async fn get_ollama_version_from_api() -> Result<String, AppError> {
    let client = crate::utils::http_client::create_http_client_short_timeout()?;
    let base_url = current_ollama_base_url();
    let url = format!("{}/api/version", base_url.trim_end_matches('/'));
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::OllamaError {
            message: format!("Ollama API接続エラー: {}", e),
            source_detail: None,
        })?;

    if !response.status().is_success() {
        return Err(AppError::OllamaError {
            message: format!("Ollama APIエラー: HTTP {}", response.status()),
            source_detail: None,
        });
    }

    let json: serde_json::Value = response.json().await.map_err(|e| AppError::OllamaError {
        message: format!("JSON解析エラー: {}", e),
        source_detail: None,
    })?;

    let version = json
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::OllamaError {
            message: "バージョン情報が見つかりませんでした".to_string(),
            source_detail: None,
        })?;

    Ok(version)
}

/// コマンドラインからOllamaのバージョンを取得
async fn get_ollama_version(ollama_path: &str) -> Result<String, AppError> {
    let output = Command::new(ollama_path)
        .arg("--version")
        .output()
        .map_err(|e| AppError::OllamaError {
            message: format!("Ollamaバージョン取得エラー: {}", e),
            source_detail: None,
        })?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout);
        Ok(version.trim().to_string())
    } else {
        Err(AppError::OllamaError {
            message: "Ollamaバージョン取得に失敗しました".to_string(),
            source_detail: None,
        })
    }
}

/// Ollamaのアップデートが利用可能かチェック
pub async fn check_ollama_update_available() -> Result<(bool, Option<String>, String), AppError> {
    // 現在のバージョンを取得
    let current_version = if let Some(path) = get_ollama_executable_path_from_env().await {
        get_ollama_version(&path)
            .await
            .map_err(|e| {
                eprintln!(
                    "[WARN] Ollamaのバージョン取得に失敗しました (パス: {}): {}",
                    path, e
                );
                e
            })
            .ok()
    } else {
        None
    };

    // 最新バージョンを取得
    let latest_version = get_latest_ollama_version().await?;

    // バージョン比較（簡易実装）
    let is_newer_available = if let Some(current) = &current_version {
        current != &latest_version
    } else {
        true // 現在のバージョンが取得できない場合はアップデート可能とみなす
    };

    Ok((is_newer_available, current_version, latest_version))
}

/// 環境変数やシステムパスからOllama実行ファイルのパスを取得
async fn get_ollama_executable_path_from_env() -> Option<String> {
    if let Ok(path) = std::env::var("OLLAMA_PATH") {
        return Some(path);
    }

    // システムパスから検索
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("where").arg("ollama").output() {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    return path.lines().next().map(|s| s.trim().to_string());
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = Command::new("which").arg("ollama").output() {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    return path.lines().next().map(|s| s.trim().to_string());
                }
            }
        }
    }

    None
}

/// アプリデータディレクトリ内のポータブル版Ollamaを検出
async fn detect_portable_ollama_in_app_data() -> Result<Option<String>, AppError> {
    let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
        message: format!("アプリデータディレクトリ取得エラー: {}", e),
        source_detail: None,
    })?;

    let ollama_dir = app_data_dir.join("ollama");
    let ollama_path = get_ollama_executable_path(&ollama_dir);

    if ollama_path.exists() {
        Ok(Some(ollama_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

/// プラットフォームに応じたOllama実行ファイルのパスを取得
fn get_ollama_executable_path(ollama_dir: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        ollama_dir.join("ollama.exe")
    }

    #[cfg(target_os = "macos")]
    {
        ollama_dir.join("ollama")
    }

    #[cfg(target_os = "linux")]
    {
        ollama_dir.join("ollama")
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        ollama_dir.join("ollama")
    }
}

/// GitHub Releases APIから最新版のOllamaダウンロードURLを取得
async fn get_latest_ollama_download_url() -> Result<(String, String), AppError> {
    let client = crate::utils::http_client::create_http_client()?;
    let response = client
        .get("https://api.github.com/repos/ollama/ollama/releases/latest")
        .header("User-Agent", "FLM/1.0")
        .send()
        .await
        .map_err(|e| AppError::OllamaError {
            message: format!("GitHub API接続エラー: {}", e),
            source_detail: None,
        })?;

    if !response.status().is_success() {
        return Err(AppError::OllamaError {
            message: format!("GitHub APIエラー: {}", response.status()),
            source_detail: None,
        });
    }

    let json: serde_json::Value = response.json().await.map_err(|e| AppError::OllamaError {
        message: format!("JSON解析エラー: {}", e),
        source_detail: None,
    })?;

    // Windows用のアセットを探す
    let assets = json
        .get("assets")
        .and_then(|a| a.as_array())
        .ok_or_else(|| AppError::OllamaError {
            message: "アセット情報が見つかりませんでした".to_string(),
            source_detail: None,
        })?;

    let asset = assets
        .iter()
        .find(|a| {
            a.get("name")
                .and_then(|n| n.as_str())
                .map(|n| n.ends_with(".exe") || n.contains("windows"))
                .unwrap_or(false)
        })
        .ok_or_else(|| AppError::OllamaError {
            message: "Windows用アセットが見つかりませんでした".to_string(),
            source_detail: None,
        })?;

    let download_url = asset
        .get("browser_download_url")
        .and_then(|u| u.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::OllamaError {
            message: "ダウンロードURLが見つかりませんでした".to_string(),
            source_detail: None,
        })?;

    let version = json
        .get("tag_name")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::OllamaError {
            message: "バージョンタグが見つかりませんでした".to_string(),
            source_detail: None,
        })?;

    Ok((download_url, version))
}

/// 最新版のバージョンタグを取得（比較用）
pub async fn get_latest_ollama_version() -> Result<String, AppError> {
    let client = crate::utils::http_client::create_http_client()?;
    let response = client
        .get("https://api.github.com/repos/ollama/ollama/releases/latest")
        .header("User-Agent", "FLM/1.0")
        .send()
        .await
        .map_err(|e| AppError::OllamaError {
            message: format!("GitHub API接続エラー: {}", e),
            source_detail: None,
        })?;

    if !response.status().is_success() {
        return Err(AppError::OllamaError {
            message: format!("GitHub APIエラー: {}", response.status()),
            source_detail: None,
        });
    }

    let json: serde_json::Value = response.json().await.map_err(|e| AppError::OllamaError {
        message: format!("JSON解析エラー: {}", e),
        source_detail: None,
    })?;

    let version = json
        .get("tag_name")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::OllamaError {
            message: "バージョンタグが見つかりませんでした".to_string(),
            source_detail: None,
        })?;

    Ok(version)
}

/// Ollamaプロセスを停止
pub async fn stop_ollama() -> Result<(), AppError> {
    // HTTP API経由でシャットダウン
    let client = crate::utils::http_client::create_http_client_short_timeout()?;
    let base_url = current_ollama_base_url();
    let url = format!("{}/api/shutdown", base_url.trim_end_matches('/'));
    let _response = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| AppError::OllamaError {
            message: format!("Ollama停止API呼び出しエラー: {}", e),
            source_detail: None,
        })?;

    Ok(())
}

/// Ollamaをダウンロード
pub async fn download_ollama<F>(mut progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(DownloadProgress) -> Result<(), AppError>,
{
    let (download_url, _version) = get_latest_ollama_download_url().await?;

    let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
        message: format!("アプリデータディレクトリ取得エラー: {}", e),
        source_detail: None,
    })?;

    let ollama_dir = app_data_dir.join("ollama");
    fs::create_dir_all(&ollama_dir).map_err(|e| AppError::IoError {
        message: format!("Ollamaディレクトリ作成エラー: {}", e),
        source_detail: None,
    })?;

    #[cfg(target_os = "windows")]
    let download_file = ollama_dir.join("ollama.exe");

    #[cfg(not(target_os = "windows"))]
    let download_file = ollama_dir.join("ollama");

    // ダウンロード実行
    let client = crate::utils::http_client::create_http_client_long_timeout()?;
    let mut response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("ダウンロード開始エラー: {}", e),
            code: "DOWNLOAD_ERROR".to_string(),
            source_detail: None,
        })?;

    if !response.status().is_success() {
        return Err(AppError::ApiError {
            message: format!("ダウンロードエラー: HTTP {}", response.status()),
            code: response.status().as_str().to_string(),
            source_detail: None,
        });
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut file =
        tokio::fs::File::create(&download_file)
            .await
            .map_err(|e| AppError::IoError {
                message: format!("ファイル作成エラー: {}", e),
                source_detail: None,
            })?;

    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = response.chunk().await.map_err(|e| AppError::ApiError {
        message: format!("ダウンロード中のエラー: {}", e),
        code: "DOWNLOAD_CHUNK_ERROR".to_string(),
        source_detail: None,
    })? {
        file.write_all(&chunk)
            .await
            .map_err(|e| AppError::IoError {
                message: format!("ファイル書き込みエラー: {}", e),
                source_detail: None,
            })?;

        downloaded += chunk.len() as u64;
        let elapsed = start_time.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 {
            downloaded as f64 / elapsed
        } else {
            0.0
        };
        let progress = if total_bytes > 0 {
            (downloaded as f64 / total_bytes as f64) * 100.0
        } else {
            0.0
        };

        progress_callback(DownloadProgress {
            status: "downloading".to_string(),
            progress,
            downloaded_bytes: downloaded,
            total_bytes,
            speed_bytes_per_sec: speed,
            message: None,
        })?;
    }

    // 実行権限を設定（Unix系OS）
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&download_file)
            .map_err(|e| AppError::IoError {
                message: format!("ファイル情報取得エラー: {}", e),
                source_detail: None,
            })?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&download_file, perms).map_err(|e| AppError::IoError {
            message: format!("実行権限設定エラー: {}", e),
            source_detail: None,
        })?;
    }

    progress_callback(DownloadProgress {
        status: "completed".to_string(),
        progress: 100.0,
        downloaded_bytes: total_bytes,
        total_bytes,
        speed_bytes_per_sec: 0.0,
        message: Some("Ollamaのダウンロードが完了しました".to_string()),
    })?;

    Ok(download_file.to_string_lossy().to_string())
}

/// Ollamaを起動
pub async fn start_ollama(ollama_path: Option<String>) -> Result<u32, AppError> {
    use crate::utils::bundled_ollama;

    // Ollama実行可能ファイルのパスを決定
    let executable_path = if let Some(path) = ollama_path {
        path
    } else {
        // バンドル版を優先
        if let Ok(Some(bundled_path)) = bundled_ollama::get_bundled_ollama_path() {
            bundled_path.to_string_lossy().to_string()
        } else {
            // システムパスから検索
            get_ollama_executable_path_from_env()
                .await
                .unwrap_or_else(|| "ollama".to_string())
        }
    };

    let (configured_host, configured_port) = current_ollama_host_port();
    let manage_port = is_local_host(&configured_host);
    let (final_host, final_port) = if manage_port {
        match find_available_port(configured_port, 50) {
            Some(port) => {
                if port != configured_port {
                    eprintln!(
                        "[WARN] Ollamaのデフォルトポート {} は使用中のため、ポート {} に自動的に切り替えます。",
                        configured_port, port
                    );
                }
                (default_ollama_host(), port)
            }
            None => {
                return Err(AppError::OllamaError {
                    message: format!(
                        "Ollamaを起動できません。ポート {} 付近で使用可能なポートが見つかりませんでした。",
                        configured_port
                    ),
                    source_detail: None,
                });
            }
        }
    } else {
        if !is_port_available(configured_port) {
            return Err(AppError::OllamaError {
                message: format!(
                    "Ollamaを起動できません。指定されたホスト {} のポート {} が既に使用されています。",
                    configured_host, configured_port
                ),
                source_detail: Some("OLLAMA_HOST環境変数を別ポートに変更してください。".to_string()),
            });
        }
        (configured_host.clone(), configured_port)
    };

    update_ollama_host_env(&final_host, final_port);
    let ollama_host_env = format!("{}:{}", final_host, final_port);

    // Ollamaプロセスを起動
    let mut cmd = Command::new(&executable_path);
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());
    cmd.env("OLLAMA_HOST", &ollama_host_env);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| AppError::OllamaError {
        message: format!("Ollamaプロセスの起動に失敗しました: {}", e),
        source_detail: Some(format!("実行パス: {}", executable_path)),
    })?;

    let pid = child.id();

    // プロセスが正常に起動したか確認（少し待機してから）
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // プロセスがまだ実行中か確認
    if let Ok(Some(status)) = child.try_wait() {
        // プロセスが既に終了している場合
        return Err(AppError::OllamaError {
            message: "Ollamaプロセスがすぐに終了しました".to_string(),
            source_detail: Some(format!("PID: {}, 終了コード: {:?}", pid, status.code())),
        });
    }

    // プロセスをバックグラウンドで実行（所有権を放棄）
    drop(child);

    // APIが応答するか確認（最大5秒待機）
    let mut check_error_logged = false;
    for _ in 0..10 {
        match check_ollama_running().await {
            Ok(true) => return Ok(pid),
            Ok(false) => {
                // まだ起動していない、続行
            }
            Err(e) => {
                if !check_error_logged {
                    eprintln!("[WARN] Ollamaの起動確認中にエラーが発生しました: {}", e);
                    check_error_logged = true;
                }
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    // APIが応答しない場合でも、プロセスは起動している可能性があるため、PIDを返す
    Ok(pid)
}
