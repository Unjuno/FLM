// Engine Installer Module
// 各エンジンの自動インストール機能

use crate::utils::error::AppError;
use crate::database::connection::get_app_data_dir;
use std::path::PathBuf;
use std::fs;
use std::io::Write;
use std::process::Command;
use tokio::process::Command as AsyncCommand;
use futures_util::StreamExt;
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
        })?;

    let lm_studio_dir = app_data_dir.join("lm_studio");
    fs::create_dir_all(&lm_studio_dir).map_err(|e| AppError::IoError {
        message: format!("ディレクトリ作成エラー: {}", e),
    })?;

    // ダウンロードファイルのパス
    #[cfg(target_os = "windows")]
    let download_file = lm_studio_dir.join("lm-studio-setup.exe");
    
    #[cfg(target_os = "macos")]
    let download_file = lm_studio_dir.join("lm-studio.dmg");
    
    #[cfg(target_os = "linux")]
    let download_file = lm_studio_dir.join("lm-studio.AppImage");

    // ダウンロード実行
    download_file_with_progress(&download_url, &download_file, &mut progress_callback).await?;

    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 90.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("LM Studioのインストールを実行しています...".to_string()),
    })?;

    // インストール実行
    #[cfg(target_os = "windows")]
    {
        // Windows: インストーラーを実行（管理者権限が必要な場合がある）
        let output = AsyncCommand::new(&download_file)
            .arg("/S")  // サイレントインストール
            .output()
            .await
            .map_err(|e| AppError::ProcessError {
                message: format!("LM Studioインストールエラー: {}", e),
            })?;

        if !output.status.success() {
            return Err(AppError::ProcessError {
                message: format!("LM Studioインストールに失敗しました: {}", 
                    String::from_utf8_lossy(&output.stderr)),
            });
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: DMGをマウントしてインストール
        let output = AsyncCommand::new("hdiutil")
            .arg("attach")
            .arg(&download_file)
            .output()
            .await
            .map_err(|e| AppError::ProcessError {
                message: format!("DMGマウントエラー: {}", e),
            })?;

        if !output.status.success() {
            return Err(AppError::ProcessError {
                message: "DMGのマウントに失敗しました".to_string(),
            });
        }

        // アプリケーションをコピー
        let mount_path = PathBuf::from("/Volumes/LM Studio");
        let app_path = mount_path.join("LM Studio.app");
        let dest_path = PathBuf::from("/Applications/LM Studio.app");

        fs::copy(&app_path, &dest_path).map_err(|e| AppError::IoError {
            message: format!("アプリケーションコピーエラー: {}", e),
        })?;
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: AppImageに実行権限を付与
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&download_file)
            .map_err(|e| AppError::IoError {
                message: format!("ファイル情報取得エラー: {}", e),
            })?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&download_file, perms).map_err(|e| AppError::IoError {
            message: format!("実行権限設定エラー: {}", e),
        })?;
    }

    progress_callback(EngineDownloadProgress {
        status: "completed".to_string(),
        progress: 100.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("LM Studioのインストールが完了しました".to_string()),
    })?;

    Ok(download_file.to_string_lossy().to_string())
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
        })?;

    if !output.status.success() {
        return Err(AppError::ProcessError {
            message: format!("vLLMインストールに失敗しました: {}", 
                String::from_utf8_lossy(&output.stderr)),
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
    // llama.cppはビルドが必要なため、事前にビルドされたバイナリをダウンロードする方式を採用
    progress_callback(EngineDownloadProgress {
        status: "downloading".to_string(),
        progress: 0.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("llama.cppのバイナリをダウンロードしています...".to_string()),
    })?;

    // llama.cppの最新版バイナリURLを取得
    let download_url = get_llama_cpp_download_url().await?;

    // アプリデータディレクトリを取得
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
        })?;

    let llama_cpp_dir = app_data_dir.join("llama_cpp");
    fs::create_dir_all(&llama_cpp_dir).map_err(|e| AppError::IoError {
        message: format!("ディレクトリ作成エラー: {}", e),
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
            })?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&download_file, perms).map_err(|e| AppError::IoError {
            message: format!("実行権限設定エラー: {}", e),
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
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.github.com/repos/ggerganov/llama.cpp/releases/latest")
        .header("User-Agent", "FLM/1.0")
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("GitHub API接続エラー: {}", e),
            code: "API_ERROR".to_string(),
        })?;

    if !response.status().is_success() {
        return Err(AppError::ApiError {
            message: format!("GitHub APIエラー: HTTP {}", response.status()),
            code: response.status().as_str().to_string(),
        });
    }

    let json: serde_json::Value = response.json().await
        .map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
        })?;

    // プラットフォームに応じたアセットを検索
    let assets = json["assets"].as_array()
        .ok_or_else(|| AppError::ApiError {
            message: "リリース情報にアセットが見つかりません".to_string(),
            code: "NO_ASSETS".to_string(),
        })?;

    #[cfg(target_os = "windows")]
    let target_asset = assets.iter().find(|a| {
        let name = a["name"].as_str().unwrap_or("");
        name.contains("windows") && name.contains("server") && name.ends_with(".exe")
    });

    #[cfg(target_os = "macos")]
    let target_asset = assets.iter().find(|a| {
        let name = a["name"].as_str().unwrap_or("");
        (name.contains("macos") || name.contains("darwin")) && name.contains("server")
    });

    #[cfg(target_os = "linux")]
    let target_asset = assets.iter().find(|a| {
        let name = a["name"].as_str().unwrap_or("");
        name.contains("linux") && name.contains("server")
    });

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let target_asset = None;

    if let Some(asset) = target_asset {
        Ok(asset["browser_download_url"].as_str()
            .ok_or_else(|| AppError::ApiError {
                message: "ダウンロードURLが見つかりません".to_string(),
                code: "NO_URL".to_string(),
            })?
            .to_string())
    } else {
        Err(AppError::ApiError {
            message: "このプラットフォーム用のバイナリが見つかりませんでした".to_string(),
            code: "PLATFORM_NOT_SUPPORTED".to_string(),
        })
    }
}

/// ファイルをダウンロードして進捗をコールバックで通知
async fn download_file_with_progress<F>(
    url: &str,
    file_path: &PathBuf,
    progress_callback: &mut F,
) -> Result<(), AppError>
where
    F: FnMut(EngineDownloadProgress) -> Result<(), AppError>,
{
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("ダウンロード開始エラー: {}", e),
            code: "DOWNLOAD_ERROR".to_string(),
        })?;

    if !response.status().is_success() {
        return Err(AppError::ApiError {
            message: format!("ダウンロードエラー: HTTP {}", response.status()),
            code: response.status().as_str().to_string(),
        });
    }

    let total_bytes = response
        .content_length()
        .ok_or_else(|| AppError::ApiError {
            message: "ファイルサイズが取得できませんでした".to_string(),
            code: "NO_CONTENT_LENGTH".to_string(),
        })?;

    let mut file = fs::File::create(file_path).map_err(|e| AppError::IoError {
        message: format!("ファイル作成エラー: {}", e),
    })?;

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| AppError::ApiError {
            message: format!("ダウンロードチャンクエラー: {}", e),
            code: "CHUNK_ERROR".to_string(),
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

