// Ollama関連のIPCコマンド実装
// バックエンドエージェント (BE) 実装
// F009: Ollama自動インストール機能（最優先）

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::utils::error::AppError;
use crate::ollama::{self, OllamaDetectionResult};
// ログマクロをインポート
use crate::{debug_log, error_log, log_pid};

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

#[derive(Debug, Serialize)]
pub struct OllamaHealthStatus {
    pub running: bool,
    pub port_available: bool,
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
    eprintln!("=== [IPC] detect_ollamaコマンドが呼び出されました ===");
    let result = match ollama::detect_ollama().await {
        Ok(r) => {
            eprintln!("✓ Ollama検出が成功しました");
            eprintln!("検出結果: installed={}, running={}, portable={:?}", 
                     r.installed, r.running, r.portable);
            r
        },
        Err(e) => {
            eprintln!("✗ Ollama検出が失敗しました: {e:?}");
            return Err(e);
        }
    };
    let status = OllamaStatus::from(result);
    eprintln!("=== [IPC] detect_ollamaコマンド完了 ===");
    Ok(status)
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
    debug_log!("=== [IPC] start_ollamaコマンドが呼び出されました ===");
    if let Some(ref path) = ollama_path {
        debug_log!("指定されたパス: {:?}", path);
    }
    let pid = match ollama::start_ollama(ollama_path).await {
        Ok(pid) => {
            log_pid!(pid, "✓ Ollama起動が成功しました (PID: {})");
            pid
        },
        Err(e) => {
            error_log!("✗ Ollama起動が失敗しました: {:?}", e);
            error_log!("エラー詳細: {}", e);
            return Err(e);
        }
    };
    debug_log!("=== [IPC] start_ollamaコマンド完了 ===");
    Ok(pid)
}

/// Ollamaプロセスの停止
#[tauri::command]
pub async fn stop_ollama() -> Result<(), AppError> {
    ollama::stop_ollama().await?;
    Ok(())
}

/// Ollamaのヘルスチェック
#[tauri::command]
pub async fn check_ollama_health() -> Result<OllamaHealthStatus, AppError> {
    let running = ollama::check_ollama_running().await.unwrap_or(false);
    let port_available = crate::commands::port::is_port_available(11434);

    Ok(OllamaHealthStatus {
        running,
        port_available,
    })
}

/// Ollamaのアップデート確認
/// 現在のバージョンと最新版を比較して、アップデートが利用可能かチェック
#[tauri::command]
pub async fn check_ollama_update() -> Result<OllamaUpdateCheck, AppError> {
    let (is_newer_available, current_version, latest_version) = ollama::check_ollama_update_available().await?;
    
    Ok(OllamaUpdateCheck {
        update_available: is_newer_available,
        current_version,
        latest_version,
    })
}

/// Ollamaアップデートチェック結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaUpdateCheck {
    pub update_available: bool,
    pub current_version: Option<String>,
    pub latest_version: String,
}

/// Ollamaのアップデート実行
/// 既存のOllamaを停止し、最新版をダウンロードして更新します
#[tauri::command]
pub async fn update_ollama(
    app: AppHandle,
) -> Result<String, AppError> {
    // 1. 既存のOllamaを停止
    let was_running = ollama::check_ollama_running().await.unwrap_or(false);
    if was_running {
        ollama::stop_ollama().await?;
        // 停止確認のため少し待機
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }

    // 2. 最新版をダウンロード
    let app_handle = app.clone();
    let new_path = ollama::download_ollama(move |progress| {
        // 進捗をイベントとして送信
        let _ = app_handle.emit("ollama_update_progress", &progress);
        Ok(())
    }).await?;

    // 3. 更新前のバックアップ（オプション、将来実装）
    // 現在は既存のファイルを上書きするため、バックアップは実装していない

    // 4. 更新後のOllamaを起動（元々実行中だった場合）
    if was_running {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        ollama::start_ollama(Some(new_path.clone())).await?;
    }

    Ok(new_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    /// OllamaStatusの構造体テスト
    #[test]
    fn test_ollama_status_struct() {
        let status = OllamaStatus {
            installed: true,
            running: false,
            portable: true,
            version: Some("0.1.0".to_string()),
            portable_path: Some("/path/to/ollama".to_string()),
            system_path: None,
        };
        
        assert!(status.installed);
        assert!(!status.running);
        assert!(status.portable);
        assert_eq!(status.version, Some("0.1.0".to_string()));
        assert_eq!(status.portable_path, Some("/path/to/ollama".to_string()));
    }
    
    /// OllamaHealthStatusの構造体テスト
    #[test]
    fn test_ollama_health_status_struct() {
        let health = OllamaHealthStatus {
            running: true,
            port_available: true,
        };
        
        assert!(health.running);
        assert!(health.port_available);
    }
    
    /// OllamaStatusの境界値テスト
    #[test]
    fn test_ollama_status_boundaries() {
        // インストールされていない状態
        let not_installed = OllamaStatus {
            installed: false,
            running: false,
            portable: false,
            version: None,
            portable_path: None,
            system_path: None,
        };
        assert!(!not_installed.installed);
        assert!(!not_installed.running);
        
        // 実行中の状態
        let running = OllamaStatus {
            installed: true,
            running: true,
            portable: false,
            version: Some("0.1.0".to_string()),
            portable_path: None,
            system_path: Some("/usr/bin/ollama".to_string()),
        };
        assert!(running.installed);
        assert!(running.running);
    }
}

