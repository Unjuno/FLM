// LM Studio Engine Implementation
// LM StudioエンジンのLLMEngineトレイト実装

use super::models::{EngineConfig, EngineDetectionResult, ModelInfo};
use super::traits::LLMEngine;
use crate::database::connection::get_connection;
use crate::utils::error::AppError;
use chrono::Utc;
use dirs::home_dir;
use rusqlite::{params, OptionalExtension};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::Command as StdCommand;
use std::time::Instant;
use tokio::process::Command as AsyncCommand;
use tokio::time::{sleep, Duration};
use uuid::Uuid;

pub struct LMStudioEngine;

impl LMStudioEngine {
    pub fn new() -> Self {
        LMStudioEngine
    }

    /// LM Studio APIからバージョンを取得
    async fn get_version_from_api() -> Result<String, AppError> {
        let client = crate::utils::http_client::create_http_client_short_timeout()?;
        let response = client
            .get("http://localhost:1234/v1/models")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("LM Studio API接続エラー: {}", e),
                code: "CONNECTION_ERROR".to_string(),
                source_detail: None,
            })?;

        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("LM Studio APIエラー: HTTP {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }

        // バージョン情報はレスポンスから取得できないため、デフォルト値を返す
        Ok("unknown".to_string())
    }

    /// LM Studioのパスを検出
    async fn detect_lm_studio_path() -> Option<String> {
        let mut candidates: Vec<PathBuf> = Vec::new();

        // 1. 環境変数で明示的に指定されている場合
        for var in ["LM_STUDIO_PATH", "LMSTUDIO_PATH", "LM_STUDIO_EXEC"] {
            if let Ok(value) = std::env::var(var) {
                if !value.trim().is_empty() {
                    candidates.push(PathBuf::from(value));
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            let possible_roots: Vec<PathBuf> = [
                std::env::var("LOCALAPPDATA").ok(),
                std::env::var("ProgramFiles").ok(),
                std::env::var("ProgramFiles(x86)").ok(),
            ]
            .into_iter()
            .flatten()
            .map(PathBuf::from)
            .collect();

            for root in possible_roots {
                candidates.push(
                    root.join("Programs")
                        .join("LM Studio")
                        .join("LM Studio.exe"),
                );
                candidates.push(root.join("LM Studio").join("LM Studio.exe"));
            }

            // ユーザーがカスタムフォルダに入れるケース
            if let Some(home) = home_dir() {
                candidates.push(
                    home.join("AppData")
                        .join("Local")
                        .join("Programs")
                        .join("LM Studio")
                        .join("LM Studio.exe"),
                );
            }
        }

        #[cfg(target_os = "macos")]
        {
            const APP_NAME: &str = "LM Studio.app";

            candidates.push(PathBuf::from("/Applications").join(APP_NAME));
            if let Some(home) = home_dir() {
                candidates.push(home.join("Applications").join(APP_NAME));
            }
            // ユーザーが手動配置したケースも探索
            if let Some(home) = home_dir() {
                candidates.push(home.join(APP_NAME));
            }
        }

        #[cfg(target_os = "linux")]
        {
            let appimage_names = [
                "LM-Studio.AppImage",
                "lm-studio.AppImage",
                "lmstudio.AppImage",
            ];

            if let Some(home) = home_dir() {
                for name in &appimage_names {
                    candidates.push(home.join(name));
                    candidates.push(home.join(".local").join("bin").join(name));
                    candidates.push(
                        home.join(".local")
                            .join("share")
                            .join("LM Studio")
                            .join(name),
                    );
                }
                candidates.push(home.join("LM Studio").join("lm-studio"));
            }

            for name in &appimage_names {
                candidates.push(PathBuf::from("/opt").join("LMStudio").join(name));
                candidates.push(PathBuf::from("/usr/local/bin").join(name));
                candidates.push(PathBuf::from("/usr/bin").join(name));
            }
        }

        // フォールバック: 汎用的な場所をいくつか追加
        #[cfg(not(target_os = "windows"))]
        {
            candidates.push(PathBuf::from("/usr/local/bin/lmstudio"));
            candidates.push(PathBuf::from("/usr/bin/lmstudio"));
        }

        // 最初に存在するパスを返す
        for path in candidates {
            if let Ok(true) = path.try_exists() {
                return Some(path.to_string_lossy().to_string());
            }
        }

        None
    }

    /// LM Studio CLI (lms) のパスを検出
    async fn detect_lm_studio_cli_path() -> Option<String> {
        let mut candidates: Vec<PathBuf> = Vec::new();

        for var in ["LM_STUDIO_CLI_PATH", "LMSTUDIO_CLI_PATH", "LMS_PATH"] {
            if let Ok(value) = std::env::var(var) {
                if !value.trim().is_empty() {
                    candidates.push(PathBuf::from(value));
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(user_profile) = std::env::var("USERPROFILE") {
                candidates.push(
                    PathBuf::from(user_profile)
                        .join(".lmstudio")
                        .join("bin")
                        .join("lms.exe"),
                );
            }
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                candidates.push(
                    PathBuf::from(local_app_data)
                        .join("Programs")
                        .join("LM Studio")
                        .join("resources")
                        .join("app")
                        .join(".lmstudio")
                        .join("bin")
                        .join("lms.exe"),
                );
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Some(home) = home_dir() {
                candidates.push(home.join(".lmstudio").join("bin").join("lms"));
            }
        }

        if let Some(path) = Self::find_in_path(if cfg!(target_os = "windows") {
            "lms.exe"
        } else {
            "lms"
        }) {
            candidates.push(path);
        }

        for candidate in candidates {
            if let Ok(true) = candidate.try_exists() {
                return Some(candidate.to_string_lossy().to_string());
            }
        }

        None
    }

    fn find_in_path(command: &str) -> Option<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = StdCommand::new("where").arg(command).output() {
                if output.status.success() {
                    if let Ok(stdout) = String::from_utf8(output.stdout) {
                        if let Some(line) = stdout.lines().find(|l| !l.trim().is_empty()) {
                            return Some(PathBuf::from(line.trim()));
                        }
                    }
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(output) = StdCommand::new("which").arg(command).output() {
                if output.status.success() {
                    if let Ok(stdout) = String::from_utf8(output.stdout) {
                        if let Some(line) = stdout.lines().find(|l| !l.trim().is_empty()) {
                            return Some(PathBuf::from(line.trim()));
                        }
                    }
                }
            }
        }

        None
    }

    fn is_local_host(host: &str) -> bool {
        matches!(
            host.to_lowercase().as_str(),
            "localhost" | "127.0.0.1" | "0.0.0.0"
        )
    }

    fn normalize_local_host(host: &str) -> String {
        if Self::is_local_host(host) {
            "127.0.0.1".to_string()
        } else {
            host.to_string()
        }
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
        if Self::is_port_available(preferred) {
            return Some(preferred);
        }

        let mut attempts = 0;
        let mut port = preferred.saturating_add(1);
        while attempts < max_attempts {
            if port == 0 {
                port = 1024;
            }
            if Self::is_port_available(port) {
                return Some(port);
            }
            attempts += 1;
            port = port.saturating_add(1);
        }
        None
    }

    /// 基本URLを正規化
    fn normalize_base_url(raw: &str) -> String {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            "http://127.0.0.1:1234".to_string()
        } else if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            trimmed.trim_end_matches('/').to_string()
        } else {
            format!("http://{}", trimmed.trim_matches('/'))
        }
    }

    /// base_urlからホストとポートを抽出
    fn extract_host_and_port(base_url: &str, fallback_port: u16) -> (String, u16) {
        let trimmed = base_url.trim();
        let without_scheme = trimmed
            .strip_prefix("http://")
            .or_else(|| trimmed.strip_prefix("https://"))
            .unwrap_or(trimmed);
        let authority = without_scheme.split('/').next().unwrap_or("").trim();

        if authority.is_empty() {
            return ("127.0.0.1".to_string(), fallback_port);
        }

        if authority.starts_with('[') {
            if let Some(end_idx) = authority.find(']') {
                let host = authority[1..end_idx].to_string();
                let mut port = fallback_port;
                if let Some(rest) = authority[end_idx + 1..].strip_prefix(':') {
                    if let Ok(parsed) = rest.parse::<u16>() {
                        port = parsed;
                    }
                }
                return (host, port);
            }
        }

        if let Some(idx) = authority.rfind(':') {
            let host_part = &authority[..idx];
            let port_part = &authority[idx + 1..];
            if let Ok(parsed) = port_part.parse::<u16>() {
                let host = if host_part.is_empty() {
                    "127.0.0.1"
                } else {
                    host_part
                };
                return (host.trim().to_string(), parsed);
            }
        }

        (authority.to_string(), fallback_port)
    }

    /// LM Studioのヘルスチェックを実行
    async fn check_health(base_url: &str) -> Result<bool, AppError> {
        let normalized = base_url.trim_end_matches('/');
        let client = crate::utils::http_client::create_http_client_short_timeout()?;
        let url = format!("{}/v1/models", normalized);

        match client.get(&url).send().await {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(e) => {
                eprintln!(
                    "[DEBUG] LM Studioヘルスチェックに失敗しました ({}): {}",
                    normalized, e
                );
                Ok(false)
            }
        }
    }

    /// ヘルスチェックが成功するまで待機
    async fn wait_for_health(base_url: &str, timeout: Duration) -> Result<(), AppError> {
        let start = Instant::now();
        let mut has_logged = false;

        loop {
            if Self::check_health(base_url).await? {
                return Ok(());
            }

            if start.elapsed() >= timeout {
                return Err(AppError::ProcessError {
                    message: format!(
                        "LM Studioが {} 秒以内に応答しませんでした。",
                        timeout.as_secs()
                    ),
                    source_detail: Some(format!("base_url={}", base_url)),
                });
            }

            if !has_logged {
                eprintln!(
                    "[INFO] LM Studioの起動を待機しています... (base_url={}, timeout={}秒)",
                    base_url,
                    timeout.as_secs()
                );
                has_logged = true;
            }

            sleep(Duration::from_millis(500)).await;
        }
    }

    /// 自動登録用のエンジン設定をDBに保存（存在すれば更新）
    async fn ensure_engine_config(
        base_url: String,
        executable_path: Option<String>,
        auto_detect: bool,
    ) -> Result<(), AppError> {
        tokio::task::spawn_blocking(move || -> Result<(), AppError> {
            let conn = get_connection().map_err(|e| AppError::DatabaseError {
                message: format!("エンジン設定DB接続エラー: {}", e),
                source_detail: None,
            })?;

            let now = Utc::now().to_rfc3339();

            // 既存レコードを確認
            let existing: Option<(String,)> = conn
                .query_row(
                    "SELECT id FROM engine_configs WHERE engine_type = ?1 AND base_url = ?2 LIMIT 1",
                    params!["lm_studio", base_url],
                    |row| Ok((row.get::<_, String>(0)?,)),
                )
                .optional()
                .map_err(|e| AppError::DatabaseError {
                    message: format!("エンジン設定取得エラー: {}", e),
                    source_detail: None,
                })?;

            if let Some((id,)) = existing {
                conn.execute(
                    r#"
                    UPDATE engine_configs
                    SET executable_path = COALESCE(?1, executable_path),
                        auto_detect = ?2,
                        updated_at = ?3
                    WHERE id = ?4
                    "#,
                    params![executable_path, if auto_detect { 1 } else { 0 }, now, id],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("エンジン設定更新エラー: {}", e),
                    source_detail: None,
                })?;
            } else {
                let id = format!("lmstudio-auto-{}", Uuid::new_v4());

                let count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM engine_configs WHERE engine_type = ?1",
                        params!["lm_studio"],
                        |row| row.get(0),
                    )
                    .map_err(|e| AppError::DatabaseError {
                        message: format!("エンジン設定件数取得エラー: {}", e),
                        source_detail: None,
                    })?;

                let is_default = if count == 0 { 1 } else { 0 };

                conn.execute(
                    r#"
                    INSERT INTO engine_configs
                    (id, engine_type, name, base_url, auto_detect, executable_path, is_default, created_at, updated_at)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
                    "#,
                    params![
                        id,
                        "lm_studio",
                        "LM Studio (Auto)",
                        base_url,
                        if auto_detect { 1 } else { 0 },
                        executable_path,
                        is_default,
                        now
                    ],
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("エンジン設定保存エラー: {}", e),
                    source_detail: None,
                })?;
            }

            Ok(())
        })
        .await
        .map_err(|e| AppError::ProcessError {
            message: format!("LM Studio設定登録スレッドエラー: {}", e),
            source_detail: None,
        })?
    }

    /// LM Studio CLIを使用してAPIサーバーを起動
    async fn launch_cli(cli_path: &str, host: &str, port: u16) -> Result<u32, AppError> {
        let mut command = AsyncCommand::new(cli_path);
        command
            .arg("server")
            .arg("start")
            .arg("--port")
            .arg(port.to_string());
        if !host.is_empty() {
            command.arg("--host").arg(host);
        }

        let mut child = command.spawn().map_err(|e| AppError::ProcessError {
            message: format!("LM Studio CLI起動エラー: {}", e),
            source_detail: Some(format!("cli_path={}", cli_path)),
        })?;

        let pid = child.id().unwrap_or(0);
        tokio::spawn(async move {
            if let Err(e) = child.wait().await {
                eprintln!("[WARN] LM Studio CLIプロセス監視エラー: {}", e);
            }
        });

        Ok(pid)
    }

    /// LM Studioプロセスを起動
    async fn launch_process(executable_path: &str) -> Result<u32, AppError> {
        #[cfg(target_os = "windows")]
        {
            let mut child =
                AsyncCommand::new(executable_path)
                    .spawn()
                    .map_err(|e| AppError::ProcessError {
                        message: format!("LM Studio起動エラー: {}", e),
                        source_detail: Some(format!("path={}", executable_path)),
                    })?;
            let pid = child.id().unwrap_or(0);
            tokio::spawn(async move {
                if let Err(e) = child.wait().await {
                    eprintln!("[WARN] LM Studioプロセス監視エラー: {}", e);
                }
            });
            return Ok(pid);
        }

        #[cfg(target_os = "macos")]
        {
            let app_path = PathBuf::from(executable_path);
            if app_path.extension().map_or(false, |ext| ext == "app") {
                let binary_path = app_path.join("Contents").join("MacOS").join("LM Studio");
                if binary_path.exists() {
                    let mut child = AsyncCommand::new(&binary_path).spawn().map_err(|e| {
                        AppError::ProcessError {
                            message: format!("LM Studioバイナリ起動エラー: {}", e),
                            source_detail: Some(format!(
                                "binary_path={}",
                                binary_path.to_string_lossy()
                            )),
                        }
                    })?;
                    let pid = child.id().unwrap_or(0);
                    tokio::spawn(async move {
                        if let Err(e) = child.wait().await {
                            eprintln!("[WARN] LM Studioプロセス監視エラー: {}", e);
                        }
                    });
                    return Ok(pid);
                } else {
                    let mut child = AsyncCommand::new("open")
                        .arg("-a")
                        .arg(&app_path)
                        .spawn()
                        .map_err(|e| AppError::ProcessError {
                            message: format!("LM Studioアプリ起動エラー: {}", e),
                            source_detail: Some(format!("app_path={}", app_path.to_string_lossy())),
                        })?;
                    let pid = child.id().unwrap_or(0);
                    tokio::spawn(async move {
                        if let Err(e) = child.wait().await {
                            eprintln!("[WARN] openコマンド監視エラー: {}", e);
                        }
                    });
                    return Ok(pid);
                }
            } else {
                let mut child = AsyncCommand::new(executable_path).spawn().map_err(|e| {
                    AppError::ProcessError {
                        message: format!("LM Studio起動エラー: {}", e),
                        source_detail: Some(format!("path={}", executable_path)),
                    }
                })?;
                let pid = child.id().unwrap_or(0);
                tokio::spawn(async move {
                    if let Err(e) = child.wait().await {
                        eprintln!("[WARN] LM Studioプロセス監視エラー: {}", e);
                    }
                });
                return Ok(pid);
            }
        }

        #[cfg(target_os = "linux")]
        {
            // AppImageやバイナリを直接実行
            let path = std::path::Path::new(executable_path);
            let mut child =
                AsyncCommand::new(path)
                    .spawn()
                    .map_err(|e| AppError::ProcessError {
                        message: format!("LM Studio起動エラー: {}", e),
                        source_detail: Some(format!("path={}", executable_path)),
                    })?;
            let pid = child.id().unwrap_or(0);
            tokio::spawn(async move {
                if let Err(e) = child.wait().await {
                    eprintln!("[WARN] LM Studioプロセス監視エラー: {}", e);
                }
            });
            return Ok(pid);
        }

        #[allow(unreachable_code)]
        Err(AppError::ProcessError {
            message: "このプラットフォームではLM Studioの自動起動がサポートされていません。"
                .to_string(),
            source_detail: None,
        })
    }

    /// 実行ファイルのパスを決定
    async fn resolve_executable_path(config: &EngineConfig) -> Result<String, AppError> {
        if let Some(ref path) = config.executable_path {
            if !path.trim().is_empty() {
                return Ok(path.clone());
            }
        }

        Self::detect_lm_studio_path()
            .await
            .ok_or_else(|| AppError::ProcessError {
                message: "LM Studioの実行ファイルが見つかりませんでした。".to_string(),
                source_detail: None,
            })
    }
}

#[allow(dead_code)] // トレイト実装メソッドは将来の使用のために保持
impl LLMEngine for LMStudioEngine {
    fn name(&self) -> &str {
        "LM Studio"
    }

    fn engine_type(&self) -> &str {
        "lm_studio"
    }

    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        let path = Self::detect_lm_studio_path().await;
        let installed = path.is_some();
        let running = self.is_running().await.unwrap_or(false);

        // バージョン取得: LM Studio APIから取得を試みる
        let version = if running {
            Self::get_version_from_api().await.ok()
        } else {
            None
        };

        Ok(EngineDetectionResult {
            engine_type: "lm_studio".to_string(),
            installed,
            running,
            version,
            path,
            message: if installed && !running {
                Some("LM Studioがインストールされていますが、起動していません。".to_string())
            } else if !installed {
                Some("LM Studioがインストールされていません。".to_string())
            } else {
                None
            },
            portable: None,
        })
    }

    // 注意: get_version_from_apiはLLMEngineトレイトに定義されていないため削除
    // 必要に応じて、将来的にトレイトに追加するか、別の関数として実装

    async fn start(&self, config: &EngineConfig) -> Result<u32, AppError> {
        let default_port = config.port.unwrap_or_else(|| self.default_port());
        let base_url_raw = config
            .base_url
            .clone()
            .unwrap_or_else(|| format!("http://127.0.0.1:{}", default_port));
        let base_url = Self::normalize_base_url(&base_url_raw);

        let (cli_host_raw, cli_port_raw) = Self::extract_host_and_port(&base_url, default_port);
        let local_host = Self::normalize_local_host(&cli_host_raw);
        let manage_port = Self::is_local_host(&cli_host_raw);

        if let Some(cli_path) = Self::detect_lm_studio_cli_path().await {
            let mut selected_port = cli_port_raw;
            if manage_port {
                if let Some(open_port) = Self::find_available_port(cli_port_raw, 50) {
                    if open_port != cli_port_raw {
                        eprintln!(
                            "[WARN] LM Studioのデフォルトポート {} は使用中のため、ポート {} に自動で切り替えます。",
                            cli_port_raw, open_port
                        );
                    }
                    selected_port = open_port;
                } else {
                    return Err(AppError::ProcessError {
                        message: format!(
                            "LM Studio CLIを起動できません。ポート {} 付近で使用可能なポートが見つかりませんでした。",
                            cli_port_raw
                        ),
                        source_detail: None,
                    });
                }
            } else if !Self::is_port_available(cli_port_raw) {
                return Err(AppError::ProcessError {
                    message: format!(
                        "指定されたホスト {} のポート {} が使用中です。CLIで自動解決できません。",
                        cli_host_raw, cli_port_raw
                    ),
                    source_detail: Some(format!("base_url={}", base_url)),
                });
            }

            let effective_host = if manage_port {
                local_host.as_str()
            } else {
                &cli_host_raw
            };
            let effective_base_url = format!("http://{}:{}", effective_host, selected_port);

            match Self::launch_cli(&cli_path, effective_host, selected_port).await {
                Ok(pid) => {
                    if let Err(e) =
                        Self::wait_for_health(&effective_base_url, Duration::from_secs(45)).await
                    {
                        eprintln!(
                            "[ERROR] LM Studio CLIが正常に起動しませんでした (base_url={}): {}",
                            effective_base_url, e
                        );
                        return Err(e);
                    }

                    if let Err(e) = Self::ensure_engine_config(
                        effective_base_url.clone(),
                        Some(cli_path.clone()),
                        config.auto_detect,
                    )
                    .await
                    {
                        eprintln!(
                            "[WARN] LM Studio CLIのエンジン設定を自動登録できませんでした: {}",
                            e
                        );
                    }

                    return Ok(pid);
                }
                Err(e) => {
                    eprintln!(
                        "[WARN] LM Studio CLIによる起動に失敗しました。GUI起動へフォールバックします: {}",
                        e
                    );
                }
            }
        } else if manage_port && !Self::is_port_available(cli_port_raw) {
            return Err(AppError::ProcessError {
                message: format!(
                    "LM Studioのポート {} が既に使用されています。CLIが利用できないため自動解決できません。",
                    cli_port_raw
                ),
                source_detail: Some(format!("base_url={}", base_url)),
            });
        }

        let executable_path = Self::resolve_executable_path(config).await?;
        let pid = Self::launch_process(&executable_path).await?;

        if let Err(e) = Self::wait_for_health(&base_url, Duration::from_secs(45)).await {
            eprintln!(
                "[ERROR] LM Studioが正常に起動しませんでした (base_url={}): {}",
                base_url, e
            );
            return Err(e);
        }

        if let Err(e) = Self::ensure_engine_config(
            base_url.clone(),
            Some(executable_path.clone()),
            config.auto_detect,
        )
        .await
        {
            eprintln!(
                "[WARN] LM Studioのエンジン設定を自動登録できませんでした: {}",
                e
            );
        }

        Ok(pid)
    }

    fn get_base_url(&self) -> String {
        "http://localhost:1234".to_string()
    }

    fn default_port(&self) -> u16 {
        1234
    }

    fn supports_openai_compatible_api(&self) -> bool {
        true
    }

    async fn is_running(&self) -> Result<bool, AppError> {
        Self::check_health("http://localhost:1234").await
    }

    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        let client = crate::utils::http_client::create_http_client()?;
        let response = client
            .get("http://localhost:1234/v1/models")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("LM Studio APIリクエストエラー: {}", e),
                code: "API_ERROR".to_string(),
                source_detail: None,
            })?;

        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("LM Studio APIエラー: {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }

        let data: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: None,
        })?;

        let models = data["data"]
            .as_array()
            .ok_or_else(|| AppError::ModelError {
                message: "モデル一覧の形式が不正です".to_string(),
                source_detail: None,
            })?
            .iter()
            .filter_map(|m| {
                let name = m["id"].as_str()?.to_string();
                Some(ModelInfo {
                    name: name.clone(),
                    size: m["size"].as_u64(),
                    modified_at: None,
                    parameter_size: extract_parameter_size(&name),
                })
            })
            .collect();

        Ok(models)
    }

    async fn stop(&self) -> Result<(), AppError> {
        // LM Studioは手動で停止する必要がある
        // 自動停止はサポートしていない
        Ok(())
    }
}

/// モデル名からパラメータサイズを抽出
fn extract_parameter_size(model_name: &str) -> Option<String> {
    let re = regex::Regex::new(r"(\d+)[bB]").ok()?;
    if let Some(captures) = re.captures(model_name) {
        if let Some(size) = captures.get(1) {
            return Some(format!("{}B", size.as_str()));
        }
    }
    None
}
