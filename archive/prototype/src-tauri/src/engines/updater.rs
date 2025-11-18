// Engine Updater Module
// 各エンジンの自動アップデート機能

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};

/// アップデートチェック結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineUpdateCheck {
    pub update_available: bool,
    pub current_version: Option<String>,
    pub latest_version: String,
}

/// LM Studioのアップデート確認
pub async fn check_lm_studio_update() -> Result<EngineUpdateCheck, AppError> {
    // LM Studioのバージョン取得は困難なため、インストール状態を確認して判断
    // 実際の実装では、LM Studioの公式APIから最新バージョンを取得する必要がある
    use crate::engines::manager::EngineManager;

    // LM Studioがインストールされているか確認
    let manager = EngineManager::new();
    let detection_result = manager.detect_engine("lm_studio").await?;
    let is_installed = detection_result.installed;

    if !is_installed {
        // インストールされていない場合は、アップデート不要
        return Ok(EngineUpdateCheck {
            update_available: false,
            current_version: None,
            latest_version: "latest".to_string(),
        });
    }

    // インストールされているが、バージョン取得が困難なため、
    // アップデート可能と表示（ユーザーが手動で確認できるように）
    Ok(EngineUpdateCheck {
        update_available: true,
        current_version: detection_result.version,
        latest_version: "latest".to_string(),
    })
}

/// LM Studioのアップデート実行
pub async fn update_lm_studio<F>(progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(crate::engines::installer::EngineDownloadProgress) -> Result<(), AppError>,
{
    // LM Studioのアップデートは再インストールと同じ処理
    use crate::engines::installer;
    installer::install_lm_studio(progress_callback).await
}

/// vLLMのアップデート確認
pub async fn check_vllm_update() -> Result<EngineUpdateCheck, AppError> {
    // vLLMの現在のバージョンを取得
    let current_version = get_vllm_version().await.ok();

    // 最新版を取得（pip show vllmで取得可能）
    let latest_version = get_latest_vllm_version().await?;

    // バージョン比較
    let update_available = if let Some(current) = &current_version {
        current != &latest_version
    } else {
        true // バージョンが取得できない場合はアップデート可能と見なす
    };

    Ok(EngineUpdateCheck {
        update_available,
        current_version,
        latest_version,
    })
}

/// vLLMのアップデート実行
pub async fn update_vllm<F>(mut progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(crate::engines::installer::EngineDownloadProgress) -> Result<(), AppError>,
{
    progress_callback(crate::engines::installer::EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 0.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("vLLMをアップデートしています（pip install --upgrade vllm）...".to_string()),
    })?;

    // Pythonがインストールされているか確認
    use std::process::Command;
    let python_cmd = if Command::new("python3").output().is_ok() {
        "python3"
    } else if Command::new("python").output().is_ok() {
        "python"
    } else {
        return Err(AppError::ApiError {
            message: "Pythonがインストールされていません。".to_string(),
            code: "PYTHON_NOT_FOUND".to_string(),
            source_detail: None,
        });
    };

    // pip install --upgrade vllmを実行
    use tokio::process::Command as AsyncCommand;
    let output = AsyncCommand::new(python_cmd)
        .arg("-m")
        .arg("pip")
        .arg("install")
        .arg("--upgrade")
        .arg("vllm")
        .output()
        .await
        .map_err(|e| AppError::ProcessError {
            message: format!("vLLMアップデートエラー: {}", e),
            source_detail: None,
        })?;

    if !output.status.success() {
        return Err(AppError::ProcessError {
            message: format!(
                "vLLMアップデートエラー: {}",
                String::from_utf8_lossy(&output.stderr)
            ),
            source_detail: None,
        });
    }

    progress_callback(crate::engines::installer::EngineDownloadProgress {
        status: "completed".to_string(),
        progress: 100.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("vLLMのアップデートが完了しました".to_string()),
    })?;

    Ok("vllm".to_string())
}

/// llama.cppの実行ファイルからバージョンを取得
async fn get_llama_cpp_version_from_executable(exe_path: &std::path::Path) -> Result<String, AppError> {
    use tokio::process::Command as AsyncCommand;
    
    // まず --version オプションを試す
    let output = AsyncCommand::new(exe_path)
        .arg("--version")
        .output()
        .await;
    
    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let version = stdout.trim();
            // バージョン文字列を抽出（例: "llama.cpp v1.2.3" -> "1.2.3"）
            let version = version
                .trim_start_matches("llama.cpp")
                .trim_start_matches("v")
                .trim()
                .to_string();
            if !version.is_empty() {
                return Ok(version);
            }
        }
        _ => {}
    }
    
    // --versionが失敗した場合、-v を試す
    let output = AsyncCommand::new(exe_path)
        .arg("-v")
        .output()
        .await;
    
    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let version = stdout.trim();
            let version = version
                .trim_start_matches("llama.cpp")
                .trim_start_matches("v")
                .trim()
                .to_string();
            if !version.is_empty() {
                return Ok(version);
            }
        }
        _ => {}
    }
    
    // バージョンが取得できない場合は、ファイルの更新日時から推測を試みる
    // または "unknown" を返す
    Ok("unknown".to_string())
}

/// llama.cppの最新バージョンをGitHubリリースから取得
async fn get_latest_llama_cpp_version() -> Result<String, AppError> {
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
        return Ok("latest".to_string());
    }

    let json: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
        message: format!("JSON解析エラー: {}", e),
        code: "JSON_ERROR".to_string(),
        source_detail: None,
    })?;

    // tag_nameからバージョンを取得（例: "b1234" -> "1234" または "v1.2.3" -> "1.2.3"）
    let version = json["tag_name"]
        .as_str()
        .map(|s| {
            // "b1234" 形式の場合は "1234" に変換
            // "v1.2.3" 形式の場合は "1.2.3" に変換
            s.trim_start_matches("b")
                .trim_start_matches("v")
                .trim()
                .to_string()
        })
        .unwrap_or_else(|| "latest".to_string());

    Ok(version)
}

/// llama.cppのアップデート確認
pub async fn check_llama_cpp_update() -> Result<EngineUpdateCheck, AppError> {
    use crate::database::connection::get_app_data_dir;
    use std::path::PathBuf;

    // llama.cppのインストールパスを取得
    let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
        message: format!("アプリデータディレクトリ取得エラー: {}", e),
        source_detail: None,
    })?;
    let llama_cpp_dir = app_data_dir.join("llama_cpp");

    // 実行ファイルの候補を確認
    #[cfg(target_os = "windows")]
    let exe_candidates = vec![
        "llama-server.exe",
        "server.exe",
        "llama-cpp-server.exe",
        "llama-cli.exe",
        "llama.exe",
    ];
    #[cfg(not(target_os = "windows"))]
    let exe_candidates = vec![
        "llama-server",
        "server",
        "llama-cpp-server",
        "llama-cli",
        "llama",
    ];

    // 実行ファイルを探す
    let mut exe_path: Option<PathBuf> = None;
    for exe_name in &exe_candidates {
        let candidate = llama_cpp_dir.join(exe_name);
        if candidate.exists() && candidate.is_file() {
            exe_path = Some(candidate);
            break;
        }
    }

    // 実行ファイルが見つからない場合は、インストールされていないと判断
    let current_version = if let Some(ref path) = exe_path {
        // 実行ファイルからバージョンを取得
        get_llama_cpp_version_from_executable(path).await.ok()
    } else {
        None
    };

    // 最新バージョンを取得
    let latest_version = get_latest_llama_cpp_version().await?;

    // バージョン比較
    let update_available = if let Some(ref current) = current_version {
        // バージョン文字列を比較（簡易実装：文字列比較）
        // より正確な比較が必要な場合は、セマンティックバージョニングライブラリを使用
        current != &latest_version
    } else {
        // バージョンが取得できない場合は、インストールされていないか取得に失敗したと判断
        // インストールされていない場合はアップデート不要
        exe_path.is_some() // 実行ファイルがあればアップデート可能と見なす
    };

    Ok(EngineUpdateCheck {
        update_available,
        current_version,
        latest_version,
    })
}

/// llama.cppのアップデート実行
pub async fn update_llama_cpp<F>(progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(crate::engines::installer::EngineDownloadProgress) -> Result<(), AppError>,
{
    // llama.cppのアップデートは再インストールと同じ処理
    use crate::engines::installer;
    installer::install_llama_cpp(progress_callback).await
}

/// vLLMの現在のバージョンを取得
async fn get_vllm_version() -> Result<String, AppError> {
    use std::process::Command;
    use tokio::process::Command as AsyncCommand;

    let python_cmd = if Command::new("python3").output().is_ok() {
        "python3"
    } else if Command::new("python").output().is_ok() {
        "python"
    } else {
        return Err(AppError::ApiError {
            message: "Pythonがインストールされていません。".to_string(),
            code: "PYTHON_NOT_FOUND".to_string(),
            source_detail: None,
        });
    };

    let output = AsyncCommand::new(python_cmd)
        .arg("-c")
        .arg("import vllm; print(vllm.__version__)")
        .output()
        .await
        .map_err(|e| AppError::ProcessError {
            message: format!("vLLMバージョン取得エラー: {}", e),
            source_detail: None,
        })?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.lines().collect();
        if let Some(first_line) = lines.first() {
            Ok(first_line.trim().to_string())
        } else {
            Ok("latest".to_string())
        }
    } else {
        // PyPI APIから直接取得を試みる
        let client = crate::utils::http_client::create_http_client()?;
        let response = client
            .get("https://pypi.org/pypi/vllm/json")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("PyPI API接続エラー: {}", e),
                code: "API_ERROR".to_string(),
                source_detail: None,
            })?;

        if !response.status().is_success() {
            return Ok("latest".to_string());
        }

        let json: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: None,
        })?;

        let version = json["info"]["version"]
            .as_str()
            .ok_or_else(|| AppError::ApiError {
                message: "バージョン情報が見つかりません".to_string(),
                code: "VERSION_NOT_FOUND".to_string(),
                source_detail: None,
            })?
            .to_string();

        Ok(version)
    }
}

/// vLLMの最新バージョンを取得
async fn get_latest_vllm_version() -> Result<String, AppError> {
    let client = crate::utils::http_client::create_http_client()?;
    let response = client
        .get("https://pypi.org/pypi/vllm/json")
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("PyPI API接続エラー: {}", e),
            code: "API_ERROR".to_string(),
            source_detail: None,
        })?;

    if !response.status().is_success() {
        return Ok("latest".to_string());
    }

    let json: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
        message: format!("JSON解析エラー: {}", e),
        code: "JSON_ERROR".to_string(),
        source_detail: None,
    })?;

    let version = json["info"]["version"]
        .as_str()
        .ok_or_else(|| AppError::ApiError {
            message: "バージョン情報が見つかりません".to_string(),
            code: "VERSION_NOT_FOUND".to_string(),
            source_detail: None,
        })?
        .to_string();

    Ok(version)
}
