// Authentication Proxy Management Module
// 認証エージェント (AUTH) 実装
// 認証プロキシサーバーの起動・停止管理

use std::process::Stdio;
use serde::{Deserialize, Serialize};
use tokio::process::Command as AsyncCommand;

use crate::utils::error::AppError;

/// 認証プロキシプロセス情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthProxyProcess {
    pub pid: u32,
    pub port: u16,
}

/// 認証プロキシサーバーのパスとNode.jsコマンドを取得
fn get_auth_proxy_command() -> Result<(String, Vec<String>), AppError> {
    // Node.jsコマンドを取得（将来的に使用される可能性があるため保持）
    let _node_command = if cfg!(windows) {
        "node.exe"
    } else {
        "node"
    };

    // 認証プロキシサーバーのパスを取得
    // 現在の作業ディレクトリを基準に `src/backend/auth/server.ts` へのパスを探す
    let current_dir = std::env::current_dir()
        .map_err(|e| AppError::AuthError {
            message: format!("現在のディレクトリ取得エラー: {}", e),
        })?;
    
    // 1. 現在のディレクトリから探す（開発環境）
    let dev_path = current_dir
        .join("src")
        .join("backend")
        .join("auth")
        .join("server.ts");
    
    if dev_path.exists() {
        // TypeScriptファイルを実行するため、ts-nodeまたはtsxを使用
        // 開発環境ではtsxを使用することを前提とする
        let tsx_command = if cfg!(windows) {
            "npx.cmd"
        } else {
            "npx"
        };
        return Ok((tsx_command.to_string(), vec!["tsx".to_string(), dev_path.to_string_lossy().to_string()]));
    }
    
    // 2. 実行ファイルの親ディレクトリから探す（本番環境）
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let prod_path = exe_dir
                .join("src")
                .join("backend")
                .join("auth")
                .join("server.ts");
            
            if prod_path.exists() {
                let tsx_command = if cfg!(windows) {
                    "npx.cmd"
                } else {
                    "npx"
                };
                return Ok((tsx_command.to_string(), vec!["tsx".to_string(), prod_path.to_string_lossy().to_string()]));
            }
        }
    }
    
    Err(AppError::AuthError {
        message: format!("認証プロキシサーバーが見つかりません。パスを確認してください: {:?}", dev_path),
    })
}

/// 認証プロキシが起動しているか確認
async fn check_proxy_running(port: u16) -> bool {
    let client = reqwest::Client::new();
    let url = format!("http://localhost:{}/health", port);
    
    match client
        .get(&url)
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}

/// 認証プロキシを起動
/// 
/// Node.jsプロセスとして認証プロキシサーバーを起動します
pub async fn start_auth_proxy(
    port: u16,
    api_key: Option<String>,
    ollama_url: Option<String>,
    api_id: Option<String>,
    engine_type: Option<String>,
) -> Result<AuthProxyProcess, AppError> {
    // 1. 認証プロキシサーバーのパスを取得
    let (node_command, server_args) = get_auth_proxy_command()?;
    
    // 2. 環境変数を設定
    let mut cmd = AsyncCommand::new(&node_command);
    cmd.args(&server_args);
    cmd.env("PORT", port.to_string());
    
    if let Some(key) = api_key {
        cmd.env("API_KEY", key);
    }
    
    // エンジンベースURLを設定（デフォルト: Ollama）
    if let Some(url) = ollama_url {
        let url_clone = url.clone();
        cmd.env("OLLAMA_URL", url);
        cmd.env("ENGINE_BASE_URL", url_clone); // 新しい環境変数も設定
    } else {
        cmd.env("OLLAMA_URL", "http://localhost:11434");
        cmd.env("ENGINE_BASE_URL", "http://localhost:11434");
    }
    
    // エンジンタイプを環境変数として設定（プロキシサーバーでエンドポイントを切り替えるため）
    if let Some(et) = engine_type {
        cmd.env("ENGINE_TYPE", et);
    } else {
        cmd.env("ENGINE_TYPE", "ollama"); // デフォルトはOllama
    }
    
    // API IDを環境変数として設定（リクエストログ記録用）
    if let Some(id) = api_id {
        cmd.env("API_ID", id);
    }
    
    // 3. プロセスをバックグラウンドで起動
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());
    cmd.stdin(Stdio::null());
    
    #[cfg(windows)]
    {
        #[allow(unused_imports)]
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    let child = cmd.spawn()
        .map_err(|e| AppError::AuthError {
            message: format!("認証プロキシの起動に失敗しました: {}", e),
        })?;
    
    let pid = child.id().unwrap_or(0);
    
    // 4. 起動確認（最大3回、1秒間隔）
    for _ in 0..3 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        if check_proxy_running(port).await {
            return Ok(AuthProxyProcess {
                pid,
                port,
            });
        }
    }
    
    Err(AppError::AuthError {
        message: format!("認証プロキシの起動確認に失敗しました。ポート {} で応答がありません。", port),
    })
}

/// 認証プロキシを停止
pub async fn stop_auth_proxy(pid: u32) -> Result<(), AppError> {
    #[cfg(windows)]
    {
        let output = std::process::Command::new("taskkill")
            .args(&["/F", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| AppError::AuthError {
                message: format!("プロセス停止コマンド実行エラー: {}", e),
            })?;
        
        if !output.status.success() {
            // プロセスが既に終了している場合も正常終了とみなす
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.contains("プロセスが見つかりません") && !stderr.contains("not found") {
                return Err(AppError::AuthError {
                    message: format!("プロセス停止に失敗しました: {}", stderr),
                });
            }
        }
    }
    
    #[cfg(unix)]
    {
        use std::process::Command;
        let output = Command::new("kill")
            .arg("-TERM")
            .arg(&pid.to_string())
            .output()
            .map_err(|e| AppError::AuthError {
                message: format!("プロセス停止コマンド実行エラー: {}", e),
            })?;
        
        if !output.status.success() {
            // プロセスが既に終了している場合も正常終了とみなす
            return Ok(());
        }
    }
    
    Ok(())
}

/// ポート番号で認証プロキシを検索して停止
pub async fn stop_auth_proxy_by_port(port: u16) -> Result<(), AppError> {
    #[cfg(windows)]
    {
        use std::process::Command;
        // netstatでポートを使用しているプロセスを検索
        let output = Command::new("netstat")
            .args(&["-ano"])
            .output()
            .map_err(|e| AppError::AuthError {
                message: format!("netstatコマンド実行エラー: {}", e),
            })?;
        
        let output_str = String::from_utf8_lossy(&output.stdout);
        let port_str = format!(":{} ", port);
        
        for line in output_str.lines() {
            if line.contains(&port_str) && line.contains("LISTENING") {
                // PIDを抽出
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(pid_str) = parts.last() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        return stop_auth_proxy(pid).await;
                    }
                }
            }
        }
    }
    
    #[cfg(unix)]
    {
        use std::process::Command;
        // lsofでポートを使用しているプロセスを検索
        let output = Command::new("lsof")
            .args(&["-ti", &format!(":{}", port)])
            .output()
            .map_err(|e| AppError::AuthError {
                message: format!("lsofコマンド実行エラー: {}", e),
            })?;
        
        if output.status.success() {
            let pid_str = String::from_utf8_lossy(&output.stdout);
            if let Ok(pid) = pid_str.trim().parse::<u32>() {
                return stop_auth_proxy(pid).await;
            }
        }
    }
    
    Ok(())
}
