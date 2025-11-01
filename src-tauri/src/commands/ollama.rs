// FLM - Ollama関連のIPCコマンド実装
// バックエンドエージェント (BE) 実装
// F009: Ollama自動インストール機能（最優先）

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::utils::error::AppError;
use crate::ollama::{self, OllamaDetectionResult};

/// Ollama状態レスポンス（IPC用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub installed: bool,
    pub running: bool,
    pub portable: bool,
    pub version: Option<String>,
    pub portable_path: Option<String>,
    pub system_path: Option<String>,
}

impl From<OllamaDetectionResult> for OllamaStatus {
    fn from(result: OllamaDetectionResult) -> Self {
        OllamaStatus {
            installed: result.installed,
            running: result.running,
            portable: result.portable,
            version: result.version,
            portable_path: result.portable_path,
            system_path: result.system_path,
        }
    }
}

/// Ollamaの検出・状態確認
/// 
/// システムパス上、実行中のプロセス、ポータブル版の順に検出を試みます
#[tauri::command]
pub async fn detect_ollama() -> Result<OllamaStatus, AppError> {
    let result = ollama::detect_ollama().await?;
    Ok(OllamaStatus::from(result))
}

/// Ollamaの自動ダウンロード
/// 
/// GitHub Releases APIから最新版を取得し、ダウンロードします
/// 進捗はイベント経由で送信されます
#[tauri::command]
pub async fn download_ollama(
    app: AppHandle,
    _platform: Option<String>,
) -> Result<String, AppError> {
    let app_handle = app.clone();
    
    let path = ollama::download_ollama(move |progress| {
        // 進捗をイベントとして送信
        let _ = app_handle.emit("ollama_download_progress", &progress);
        Ok(())
    }).await?;
    
    Ok(path)
}

/// Ollamaプロセスの起動
#[tauri::command]
pub async fn start_ollama(ollama_path: Option<String>) -> Result<u32, AppError> {
    let pid = ollama::start_ollama(ollama_path).await?;
    Ok(pid)
}

/// Ollamaプロセスの停止
#[tauri::command]
pub async fn stop_ollama() -> Result<(), AppError> {
    ollama::stop_ollama().await?;
    Ok(())
}

