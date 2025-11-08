// Engine Installer Module
// 各エンジンの自動インストール機能

use crate::utils::error::AppError;
use crate::database::connection::get_app_data_dir;
use std::path::PathBuf;
use std::fs;
use std::process::Command;
use tokio::process::Command as AsyncCommand;
use serde::{Deserialize, Serialize};

/// ダウンロード進捗情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineDownloadProgress {
    pub status: String,             // "downloading" | "extracting" | "installing" | "completed" | "error"
    pub progress: f64,              // 0.0 - 100.0
    pub downloaded_bytes: u64,      // ダウンロード済みバイト数
    pub total_bytes: u64,           // 総バイト数
    pub speed_bytes_per_sec: f64,   // ダウンロード速度（バイト/秒）
    pub message: Option<String>,    // ステータスメッセージ
}

/// LM Studioのインストール
pub async fn install_lm_studio<F>(mut progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(EngineDownloadProgress) -> Result<(), AppError>,
{
    progress_callback(EngineDownloadProgress {
        status: "downloading".to_string(),
        progress: 0.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("LM Studioのインストーラーをダウンロードしています...".to_string()),
    })?;

    // LM Studioの最新版ダウンロードURLを取得
    let download_url = get_lm_studio_download_url().await?;

    // アプリデータディレクトリを取得
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
            source_detail: None,
        })?;

    let installer_dir = app_data_dir.join("lm_studio_installer");
    fs::create_dir_all(&installer_dir).map_err(|e| AppError::IoError {
        message: format!("インストーラディレクトリ作成エラー: {}", e),
        source_detail: None,
    })?;

    let file_name = download_url.split('/').last().unwrap_or("lm_studio_installer");
    let download_file = installer_dir.join(file_name);

    // ダウンロード実行
    download_file_with_progress(&download_url, &download_file, &mut progress_callback).await?;

    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 100.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("LM Studioのインストールが完了しました".to_string()),
    })?;

    Ok("lm_studio".to_string())
}

/// LM StudioのダウンロードURLを取得
async fn get_lm_studio_download_url() -> Result<String, AppError> {
    // LM Studioの公式サイトから最新版のダウンロードURLを取得
    // 現在は固定URLを使用（将来はAPIから取得可能になる可能性がある）
    #[cfg(target_os = "windows")]
    {
        Ok("https://releases.lmstudio.ai/windows/latest".to_string())
    }
    
    #[cfg(target_os = "macos")]
    {
        Ok("https://releases.lmstudio.ai/macos/latest".to_string())
    }
    
    #[cfg(target_os = "linux")]
    {
        Ok("https://releases.lmstudio.ai/linux/latest".to_string())
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err(AppError::ApiError {
            message: "このOSではLM Studioの自動インストールはサポートされていません".to_string(),
            code: "UNSUPPORTED_OS".to_string(),
            source_detail: None,
        })
    }
}

/// vLLMのインストール（Pythonパッケージとして）
pub async fn install_vllm<F>(mut progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(EngineDownloadProgress) -> Result<(), AppError>,
{
    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 0.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("vLLMをインストールしています（pip install vllm）...".to_string()),
    })?;

    // Pythonがインストールされているか確認
    let python_cmd = if Command::new("python3").output().is_ok() {
        "python3"
    } else if Command::new("python").output().is_ok() {
        "python"
    } else {
        return Err(AppError::ApiError {
            message: "Pythonがインストールされていません。先にPythonをインストールしてください。".to_string(),
            code: "PYTHON_NOT_FOUND".to_string(),
            source_detail: None,
        });
    };

    // pip install vllmを実行
    let output = AsyncCommand::new(python_cmd)
        .arg("-m")
        .arg("pip")
        .arg("install")
        .arg("vllm")
        .output()
        .await
        .map_err(|e| AppError::ProcessError {
            message: format!("vLLMインストールエラー: {}", e),
            source_detail: None,
        })?;

    if !output.status.success() {
        return Err(AppError::ProcessError {
            message: format!("vLLMインストール失敗: {}", String::from_utf8_lossy(&output.stderr)),
            source_detail: None,
        });
    }

    progress_callback(EngineDownloadProgress {
        status: "completed".to_string(),
        progress: 100.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("vLLMのインストールが完了しました".to_string()),
    })?;

    Ok("vllm".to_string())
}

/// llama.cppのインストール
pub async fn install_llama_cpp<F>(mut progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(EngineDownloadProgress) -> Result<(), AppError>,
{
    progress_callback(EngineDownloadProgress {
        status: "downloading".to_string(),
        progress: 0.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("llama.cppをダウンロードしています...".to_string()),
    })?;

    // llama.cppのダウンロードURLを取得
    let download_url = get_llama_cpp_download_url().await?;

    // アプリデータディレクトリを取得
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
            source_detail: None,
        })?;

    let llama_cpp_dir = app_data_dir.join("llama_cpp");
    fs::create_dir_all(&llama_cpp_dir).map_err(|e| AppError::IoError {
        message: format!("llama.cppディレクトリ作成エラー: {}", e),
        source_detail: None,
    })?;

    // ダウンロードファイルのパス
    #[cfg(target_os = "windows")]
    let download_file = llama_cpp_dir.join("llama-server.exe");
    
    #[cfg(not(target_os = "windows"))]
    let download_file = llama_cpp_dir.join("llama-server");

    // ダウンロード実行
    download_file_with_progress(&download_url, &download_file, &mut progress_callback).await?;

    // 実行権限を設定（Unix系OS）
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&download_file)
            .map_err(|e| AppError::IoError {
                message: format!("ファイル情報取得エラー: {}", e),
                source_detail: None,
            })?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&download_file, perms).map_err(|e| AppError::IoError {
            message: format!("実行権限設定エラー: {}", e),
            source_detail: None,
        })?;
    }

    progress_callback(EngineDownloadProgress {
        status: "completed".to_string(),
        progress: 100.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("llama.cppのインストールが完了しました".to_string()),
    })?;

    Ok(download_file.to_string_lossy().to_string())
}

/// llama.cppのダウンロードURLを取得
async fn get_llama_cpp_download_url() -> Result<String, AppError> {
    // llama.cppのGitHub Releasesから最新版を取得
    let client = crate::utils::http_client::create_http_client()?;
    let response = client
        .get("https://api.github.com/repos/ggerganov/llama.cpp/releases/latest")
        .header("User-Agent", "FLM/1.0")
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("GitHub API接続エラー: {}", e),
            code: "DOWNLOAD_ERROR".to_string(),
            source_detail: None,
        })?;

    if !response.status().is_success() {
        return Err(AppError::ApiError {
            message: format!("GitHub APIエラー: HTTP {}", response.status()),
            code: response.status().as_str().to_string(),
            source_detail: None,
        });
    }

    let json: serde_json::Value = response.json().await
        .map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: None,
        })?;

    // アセットからプラットフォームに応じたファイルを選択
    let assets = json["assets"].as_array()
        .ok_or_else(|| AppError::ApiError {
            message: "リリース情報にアセットが見つかりません".to_string(),
            code: "ASSET_NOT_FOUND".to_string(),
            source_detail: None,
        })?;

    #[cfg(target_os = "windows")]
    let platform_ext = ".exe";
    #[cfg(target_os = "macos")]
    let platform_ext = ".dmg";
    #[cfg(target_os = "linux")]
    let platform_ext = ".AppImage";

    let download_url = assets.iter()
        .find_map(|asset| {
            let url = asset["browser_download_url"].as_str()?;
            if url.ends_with(platform_ext) {
                Some(url.to_string())
            } else {
                None
            }
        })
        .ok_or_else(|| AppError::ApiError {
            message: format!("プラットフォーム用のアセットが見つかりません: {}", platform_ext),
            code: "PLATFORM_ASSET_NOT_FOUND".to_string(),
            source_detail: None,
        })?;

    Ok(download_url)
}

/// ファイルをダウンロードして進捗をコールバック
async fn download_file_with_progress<F>(
    url: &str,
    file_path: &PathBuf,
    progress_callback: &mut F,
) -> Result<(), AppError>
where
    F: FnMut(EngineDownloadProgress) -> Result<(), AppError>,
{
    let client = crate::utils::http_client::create_http_client_long_timeout()?;
    let mut response = client.get(url).send().await
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
    let mut file = tokio::fs::File::create(file_path).await
        .map_err(|e| AppError::IoError {
            message: format!("ファイル作成エラー: {}", e),
            source_detail: None,
        })?;

    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = response.chunk().await
        .map_err(|e| AppError::ApiError {
            message: format!("ダウンロード中のエラー: {}", e),
            code: "DOWNLOAD_CHUNK_ERROR".to_string(),
            source_detail: None,
        })? {
        file.write_all(&chunk).await
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

        progress_callback(EngineDownloadProgress {
            status: "downloading".to_string(),
            progress,
            downloaded_bytes: downloaded,
            total_bytes,
            speed_bytes_per_sec: speed,
            message: None,
        })?;
    }

    Ok(())
}
