// FLM - Ollama Integration Module
// バックエンドエージェント (BE) 実装
// F009: Ollama自動インストール機能（最優先）

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::fs;
use std::io::Write;
use tokio::process::Command as AsyncCommand;
use futures_util::StreamExt;
use crate::utils::error::AppError;
use crate::database::connection::get_app_data_dir;

/// Ollama検出結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaDetectionResult {
    pub installed: bool,           // システムパス上にOllamaが存在するか
    pub running: bool,              // Ollamaプロセスが実行中か
    pub portable: bool,             // ポータブル版が存在するか
    pub version: Option<String>,    // バージョン情報（存在する場合）
    pub portable_path: Option<String>, // ポータブル版のパス（存在する場合）
    pub system_path: Option<String>,   // システムパス上のOllamaのパス（存在する場合）
}

/// ダウンロード進捗情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub status: String,             // "downloading" | "extracting" | "completed" | "error"
    pub progress: f64,              // 0.0 - 100.0
    pub downloaded_bytes: u64,      // ダウンロード済みバイト数
    pub total_bytes: u64,           // 総バイト数
    pub speed_bytes_per_sec: f64,   // ダウンロード速度（バイト/秒）
    pub message: Option<String>,    // ステータスメッセージ
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

    // 1. システムパス上のOllamaを検出
    match detect_ollama_in_path().await {
        Ok(Some(path)) => {
            result.installed = true;
            result.system_path = Some(path.clone());
            // バージョン情報を取得
            if let Ok(version) = get_ollama_version(&path).await {
                result.version = Some(version);
            }
        }
        Ok(None) => {
            // ポータブル版Ollamaが見つからない場合はスキップ
        }
        Err(e) => {
            eprintln!("システムパス上のOllama検出エラー: {}", e);
        }
    }

    // 2. 実行中のOllamaを検出
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

    // 3. ポータブル版Ollamaを検出
    match detect_portable_ollama().await {
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
        Ok(None) => {
            // ポータブル版Ollamaが見つからない場合はスキップ
        }
        Err(e) => {
            eprintln!("ポータブル版Ollama検出エラー: {}", e);
        }
    }

    Ok(result)
}

/// システムパス上のOllamaを検出
async fn detect_ollama_in_path() -> Result<Option<String>, AppError> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("where")
            .arg("ollama")
            .output()
            .map_err(|e| AppError::OllamaError {
                message: format!("whereコマンド実行エラー: {}", e),
            })?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout)
                .trim()
                .lines()
                .next()
                .map(|s| s.to_string());
            return Ok(path);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("which")
            .arg("ollama")
            .output()
            .map_err(|e| AppError::OllamaError {
                message: format!("whichコマンド実行エラー: {}", e),
            })?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();
            if !path.is_empty() {
                return Ok(Some(path));
            }
        }
    }

    Ok(None)
}

/// 実行中のOllamaを検出（HTTP API経由）
pub async fn check_ollama_running() -> Result<bool, AppError> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/version")
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await;

    match response {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false), // タイムアウトや接続エラーは「実行中でない」と見なす
    }
}

/// API経由でOllamaのバージョン情報を取得
async fn get_ollama_version_from_api() -> Result<String, AppError> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/version")
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .map_err(|e| AppError::OllamaError {
            message: format!("Ollama API接続エラー: {}", e),
        })?;

    if !response.status().is_success() {
        return Err(AppError::OllamaError {
            message: "Ollama APIからバージョン情報を取得できませんでした".to_string(),
        });
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::OllamaError {
            message: format!("JSON解析エラー: {}", e),
        })?;

    let version = json
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::OllamaError {
            message: "バージョン情報が見つかりませんでした".to_string(),
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
        })?;

    if output.status.success() {
        let version_output = String::from_utf8_lossy(&output.stdout);
        // バージョン文字列を抽出（例: "ollama version is 0.1.0"）
        let version = version_output
            .lines()
            .find_map(|line| {
                if line.contains("version") {
                    line.split_whitespace()
                        .find(|word| word.chars().all(|c| c.is_numeric() || c == '.'))
                        .map(|s| s.to_string())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| "unknown".to_string());
        Ok(version)
    } else {
        Err(AppError::OllamaError {
            message: "Ollamaバージョン取得に失敗しました".to_string(),
        })
    }
}

/// ポータブル版Ollamaを検出
/// FLMアプリディレクトリ内のOllamaを検索します
async fn detect_portable_ollama() -> Result<Option<String>, AppError> {
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
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
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.github.com/repos/ollama/ollama/releases/latest")
        .header("User-Agent", "FLM/1.0")
        .send()
        .await
        .map_err(|e| AppError::OllamaError {
            message: format!("GitHub API接続エラー: {}", e),
        })?;

    if !response.status().is_success() {
        return Err(AppError::OllamaError {
            message: format!("GitHub APIエラー: HTTP {}", response.status()),
        });
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::OllamaError {
            message: format!("JSON解析エラー: {}", e),
        })?;

    // プラットフォームに応じたアセットを選択
    let assets = json
        .get("assets")
        .and_then(|a| a.as_array())
        .ok_or_else(|| AppError::OllamaError {
            message: "アセット情報が見つかりませんでした".to_string(),
        })?;

    #[cfg(target_os = "windows")]
    let asset_name = "windows-amd64.zip";
    
    #[cfg(target_os = "macos")]
    let asset_name = {
        // Apple Siliconかどうかを判定
        if cfg!(target_arch = "aarch64") {
            "darwin-arm64"
        } else {
            "darwin-amd64"
        }
    };

    #[cfg(target_os = "linux")]
    let asset_name = {
        if cfg!(target_arch = "aarch64") {
            "linux-arm64"
        } else {
            "linux-amd64"
        }
    };

    let asset = assets
        .iter()
        .find(|asset| {
            asset
                .get("name")
                .and_then(|n| n.as_str())
                .map(|name| name.contains(asset_name))
                .unwrap_or(false)
        })
        .ok_or_else(|| AppError::OllamaError {
            message: format!("プラットフォーム用のアセットが見つかりませんでした: {}", asset_name),
        })?;

    let download_url = asset
        .get("browser_download_url")
        .and_then(|u| u.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::OllamaError {
            message: "ダウンロードURLが見つかりませんでした".to_string(),
        })?;

    let version = json
        .get("tag_name")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::OllamaError {
            message: "バージョンタグが見つかりませんでした".to_string(),
        })?;

    Ok((download_url, version))
}

/// Ollamaをダウンロード
/// 進捗コールバックを呼び出しながらダウンロードします
pub async fn download_ollama<F>(mut progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(DownloadProgress) -> Result<(), AppError>,
{
    // 最新版のダウンロードURLを取得
    let (download_url, _version) = get_latest_ollama_download_url().await?;

    // アプリデータディレクトリを取得
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
        })?;

    let ollama_dir = app_data_dir.join("ollama");
    fs::create_dir_all(&ollama_dir).map_err(|e| AppError::IoError {
        message: format!("ディレクトリ作成エラー: {}", e),
    })?;

    // ダウンロードファイルのパス
    #[cfg(target_os = "windows")]
    let download_file = ollama_dir.join("ollama.zip");
    
    #[cfg(not(target_os = "windows"))]
    let download_file = ollama_dir.join("ollama.tar.gz");

    // ダウンロード開始
    progress_callback(DownloadProgress {
        status: "downloading".to_string(),
        progress: 0.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("ダウンロードを開始しています...".to_string()),
    })?;

    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| AppError::OllamaError {
            message: format!("ダウンロード開始エラー: {}", e),
        })?;

    if !response.status().is_success() {
        return Err(AppError::OllamaError {
            message: format!("ダウンロードエラー: HTTP {}", response.status()),
        });
    }

    let total_bytes = response
        .content_length()
        .ok_or_else(|| AppError::OllamaError {
            message: "ファイルサイズが取得できませんでした".to_string(),
        })?;

    let mut file = fs::File::create(&download_file).map_err(|e| AppError::IoError {
        message: format!("ファイル作成エラー: {}", e),
    })?;

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| AppError::OllamaError {
            message: format!("ダウンロードチャンクエラー: {}", e),
        })?;

        file.write_all(&chunk).map_err(|e| AppError::IoError {
            message: format!("ファイル書き込みエラー: {}", e),
        })?;

        downloaded += chunk.len() as u64;
        let elapsed = start_time.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 {
            downloaded as f64 / elapsed
        } else {
            0.0
        };
        let progress = (downloaded as f64 / total_bytes as f64) * 100.0;

        progress_callback(DownloadProgress {
            status: "downloading".to_string(),
            progress,
            downloaded_bytes: downloaded,
            total_bytes,
            speed_bytes_per_sec: speed,
            message: None,
        })?;
    }

    file.sync_all().map_err(|e| AppError::IoError {
        message: format!("ファイル同期エラー: {}", e),
    })?;

    // 解凍処理
    progress_callback(DownloadProgress {
        status: "extracting".to_string(),
        progress: 100.0,
        downloaded_bytes: downloaded,
        total_bytes,
        speed_bytes_per_sec: 0.0,
        message: Some("ファイルを解凍しています...".to_string()),
    })?;

    let ollama_executable_path = extract_ollama(&download_file, &ollama_dir).await?;

    // ダウンロードファイルを削除
    fs::remove_file(&download_file).ok(); // エラーは無視

    // 実行権限を設定（Unix系OS）
    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&ollama_executable_path)
            .map_err(|e| AppError::IoError {
                message: format!("メタデータ取得エラー: {}", e),
            })?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&ollama_executable_path, perms).map_err(|e| AppError::IoError {
            message: format!("実行権限設定エラー: {}", e),
        })?;
    }

    progress_callback(DownloadProgress {
        status: "completed".to_string(),
        progress: 100.0,
        downloaded_bytes: downloaded,
        total_bytes,
        speed_bytes_per_sec: 0.0,
        message: Some("ダウンロードが完了しました".to_string()),
    })?;

    Ok(ollama_executable_path.to_string_lossy().to_string())
}

/// Ollamaファイルを解凍
async fn extract_ollama(
    archive_path: &Path,
    extract_dir: &Path,
) -> Result<PathBuf, AppError> {
    #[cfg(target_os = "windows")]
    {
        // ZIPファイルを解凍
        use std::fs::File;
        use std::io::BufReader;
        let file = File::open(archive_path).map_err(|e| AppError::IoError {
            message: format!("ZIPファイルオープンエラー: {}", e),
        })?;
        let reader = BufReader::new(file);
        let mut archive = zip::ZipArchive::new(reader).map_err(|e| AppError::IoError {
            message: format!("ZIPアーカイブ読み込みエラー: {}", e),
        })?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| AppError::IoError {
                message: format!("ZIPファイルエントリ取得エラー: {}", e),
            })?;
            let outpath = extract_dir.join(file.name());

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath).map_err(|e| AppError::IoError {
                    message: format!("ディレクトリ作成エラー: {}", e),
                })?;
            } else {
                if let Some(p) = outpath.parent() {
                    fs::create_dir_all(p).map_err(|e| AppError::IoError {
                        message: format!("親ディレクトリ作成エラー: {}", e),
                    })?;
                }
                let mut outfile = fs::File::create(&outpath).map_err(|e| AppError::IoError {
                    message: format!("ファイル作成エラー: {}", e),
                })?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| AppError::IoError {
                    message: format!("ファイルコピーエラー: {}", e),
                })?;
            }
        }

        // ollama.exeを探す
        let ollama_exe = extract_dir.join("ollama.exe");
        if ollama_exe.exists() {
            Ok(ollama_exe)
        } else {
            // サブディレクトリ内を検索
            let mut walker = fs::read_dir(extract_dir).map_err(|e| AppError::IoError {
                message: format!("ディレクトリ読み込みエラー: {}", e),
            })?;
            while let Some(entry) = walker.next().transpose().map_err(|e| AppError::IoError {
                message: format!("ディレクトリエントリ読み込みエラー: {}", e),
            })? {
                let path = entry.path();
                if path.is_dir() {
                    let exe = path.join("ollama.exe");
                    if exe.exists() {
                        // ollama.exeをルートに移動
                        fs::copy(&exe, &extract_dir.join("ollama.exe")).map_err(|e| AppError::IoError {
                            message: format!("ファイル移動エラー: {}", e),
                        })?;
                        return Ok(extract_dir.join("ollama.exe"));
                    }
                }
            }
            Err(AppError::OllamaError {
                message: "ollama.exeが見つかりませんでした".to_string(),
            })
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // tar.gzファイルを解凍
        let file = fs::File::open(archive_path).map_err(|e| AppError::IoError {
            message: format!("tar.gzファイルオープンエラー: {}", e),
        })?;
        let tar = flate2::read::GzDecoder::new(file);
        let mut archive = Archive::new(tar);
        archive.unpack(extract_dir).map_err(|e| AppError::IoError {
            message: format!("tar解凍エラー: {}", e),
        })?;

        // ollama実行ファイルを探す
        let ollama_path = extract_dir.join("ollama");
        if ollama_path.exists() {
            Ok(ollama_path)
        } else {
            Err(AppError::OllamaError {
                message: "ollama実行ファイルが見つかりませんでした".to_string(),
            })
        }
    }
}

/// Ollamaプロセスを起動
pub async fn start_ollama(ollama_path: Option<String>) -> Result<u32, AppError> {
    let path = if let Some(p) = ollama_path {
        p
    } else {
        // デフォルトパスを決定
        // 1. ポータブル版を優先
        if let Ok(Some(portable)) = detect_portable_ollama().await {
            portable
        }
        // 2. システムパス上のOllama
        else if let Ok(Some(system)) = detect_ollama_in_path().await {
            system
        } else {
            return Err(AppError::OllamaError {
                message: "Ollamaが見つかりません。先にダウンロードしてください。".to_string(),
            });
        }
    };

    // 既に実行中か確認
    if check_ollama_running().await.map_err(|e| AppError::OllamaError {
        message: format!("Ollama実行状態確認エラー: {}", e),
    })? {
        return Err(AppError::OllamaError {
            message: "Ollamaは既に実行中です".to_string(),
        });
    }

    // プロセスを起動
    let mut command = AsyncCommand::new(&path);
    command.stdout(Stdio::null());
    command.stderr(Stdio::null());

    #[cfg(windows)]
    {
        #[allow(unused_imports)]
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let child = command
        .spawn()
        .map_err(|e| AppError::ProcessError {
            message: format!("Ollama起動エラー: {}", e),
        })?;

    let pid = child.id().ok_or_else(|| AppError::ProcessError {
        message: "プロセスIDの取得に失敗しました".to_string(),
    })?;

    // 起動確認（最大3回、1秒間隔でリトライ）
    for i in 0..3 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        if check_ollama_running().await.map_err(|e| AppError::OllamaError {
            message: format!("Ollama実行状態確認エラー: {}", e),
        })? {
            return Ok(pid);
        }
        if i < 2 {
            eprintln!("Ollama起動確認中... ({}/3)", i + 2);
        }
    }

    Err(AppError::OllamaError {
        message: "Ollamaの起動確認に失敗しました。手動で起動してください。".to_string(),
    })
}

/// Ollamaプロセスを停止
pub async fn stop_ollama() -> Result<(), AppError> {
    // HTTP API経由でシャットダウン
    let client = reqwest::Client::new();
    let response = client
        .delete("http://localhost:11434/api/shutdown")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| AppError::OllamaError {
            message: format!("Ollama停止API呼び出しエラー: {}", e),
        })?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(AppError::OllamaError {
            message: format!("Ollama停止エラー: HTTP {}", response.status()),
        })
    }
}

