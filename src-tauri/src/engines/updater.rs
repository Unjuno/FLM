// Engine Updater Module
// 各エンジンの自動アップデート機能

use crate::utils::error::AppError;
use crate::engines::manager::EngineManager;
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
    // LM Studioのバージョン取得は困難なため、常にアップデート可能と表示
    // 実際の実装では、LM Studioの公式APIから最新バージョンを取得する必要がある
    Ok(EngineUpdateCheck {
        update_available: true, // 常にtrue（バージョン取得が困難なため）
        current_version: None,
        latest_version: "latest".to_string(),
    })
}

/// LM Studioのアップデート実行
pub async fn update_lm_studio<F>(mut progress_callback: F) -> Result<String, AppError>
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
    use crate::engines::installer;
    
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
        })?;

    if !output.status.success() {
        return Err(AppError::ProcessError {
            message: format!("vLLMアップデートに失敗しました: {}", 
                String::from_utf8_lossy(&output.stderr)),
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

/// llama.cppのアップデート確認
pub async fn check_llama_cpp_update() -> Result<EngineUpdateCheck, AppError> {
    // llama.cppの現在のバージョンを取得（実装が困難なため、常にアップデート可能と表示）
    Ok(EngineUpdateCheck {
        update_available: true,
        current_version: None,
        latest_version: "latest".to_string(),
    })
}

/// llama.cppのアップデート実行
pub async fn update_llama_cpp<F>(mut progress_callback: F) -> Result<String, AppError>
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
        });
    };

    let output = AsyncCommand::new(python_cmd)
        .arg("-c")
        .arg("import vllm; print(vllm.__version__)")
        .output()
        .await
        .map_err(|e| AppError::ProcessError {
            message: format!("vLLMバージョン取得エラー: {}", e),
        })?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(version)
    } else {
        Err(AppError::ApiError {
            message: "vLLMがインストールされていません。".to_string(),
            code: "VLLM_NOT_INSTALLED".to_string(),
        })
    }
}

/// vLLMの最新バージョンを取得
async fn get_latest_vllm_version() -> Result<String, AppError> {
    use tokio::process::Command as AsyncCommand;
    
    let python_cmd = if std::process::Command::new("python3").output().is_ok() {
        "python3"
    } else if std::process::Command::new("python").output().is_ok() {
        "python"
    } else {
        return Err(AppError::ApiError {
            message: "Pythonがインストールされていません。".to_string(),
            code: "PYTHON_NOT_FOUND".to_string(),
        });
    };

    // pip index versions vllmで最新版を取得
    let output = AsyncCommand::new(python_cmd)
        .arg("-m")
        .arg("pip")
        .arg("index")
        .arg("versions")
        .arg("vllm")
        .output()
        .await
        .map_err(|e| AppError::ProcessError {
            message: format!("最新バージョン取得エラー: {}", e),
        })?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // 出力から最新バージョンを抽出（簡易実装）
        // 実際の実装では、PyPI APIを使用する方が確実
        let lines: Vec<&str> = stdout.lines().collect();
        if let Some(first_line) = lines.first() {
            // 最初の行からバージョンを抽出
            Ok(first_line.trim().to_string())
        } else {
            Ok("latest".to_string())
        }
    } else {
        // PyPI APIから直接取得を試みる
        let client = reqwest::Client::new();
        let response = client
            .get("https://pypi.org/pypi/vllm/json")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("PyPI API接続エラー: {}", e),
                code: "API_ERROR".to_string(),
            })?;

        if response.status().is_success() {
            let json: serde_json::Value = response.json().await
                .map_err(|e| AppError::ApiError {
                    message: format!("JSON解析エラー: {}", e),
                    code: "JSON_ERROR".to_string(),
                })?;

            let version = json["info"]["version"]
                .as_str()
                .ok_or_else(|| AppError::ApiError {
                    message: "バージョン情報が見つかりません".to_string(),
                    code: "VERSION_NOT_FOUND".to_string(),
                })?
                .to_string();

            Ok(version)
        } else {
            Ok("latest".to_string())
        }
    }
}

