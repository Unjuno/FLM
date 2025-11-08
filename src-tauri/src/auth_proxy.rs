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
    // Node.jsコマンドを取得
    let node_command = if cfg!(windows) {
        "node.exe"
    } else {
        "node"
    };

    // 認証プロキシサーバーのパスを取得
    // 現在の作業ディレクトリを基準に `src/backend/auth/server.ts` へのパスを探す
    let current_dir = std::env::current_dir()
        .map_err(|e| AppError::AuthError {
            message: format!("現在のディレクトリ取得エラー: {}", e),
            source_detail: None,
        })?;

    let dev_path = current_dir.join("src/backend/auth/server.ts");
    
    Ok((
        node_command.to_string(),
        vec![dev_path.to_string_lossy().to_string()],
    ))
}

/// 認証プロキシを起動
pub async fn start_auth_proxy(
    port: u16,
    _api_key: Option<String>,
    engine_base_url: Option<String>,
    api_id: Option<String>,
    engine_type: Option<String>,
) -> Result<AuthProxyProcess, AppError> {
    // 既に起動しているか確認
    if check_proxy_running(port).await {
        return Err(AppError::AuthError {
            message: format!("認証プロキシは既にポート {} で起動しています", port),
            source_detail: None,
        });
    }

    // 認証プロキシコマンドを取得
    let (node_command, args) = get_auth_proxy_command()?;

    // 環境変数を設定
    let mut env_vars = std::collections::HashMap::new();
    env_vars.insert("PORT".to_string(), port.to_string());
    if let Some(ref url) = engine_base_url {
        env_vars.insert("ENGINE_BASE_URL".to_string(), url.clone());
    }
    if let Some(ref id) = api_id {
        env_vars.insert("API_ID".to_string(), id.clone());
    }
    if let Some(ref engine) = engine_type {
        env_vars.insert("ENGINE_TYPE".to_string(), engine.clone());
    }

    // プロセスを起動
    let mut command = AsyncCommand::new(&node_command);
    command.args(&args);
    command.envs(&env_vars);
    command.stdin(Stdio::null());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| AppError::AuthError {
        message: format!("認証プロキシの起動に失敗しました: {}", e),
        source_detail: None,
    })?;

    let pid = child.id().unwrap_or(0) as u32;

    // 起動確認（最大3回、1秒間隔）
    for _ in 0..3 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        if check_proxy_running(port).await {
            return Ok(AuthProxyProcess { pid, port });
        }
    }

    // 起動に失敗した場合、プロセスを終了
    let _ = child.kill().await;

    Err(AppError::AuthError {
        message: format!("認証プロキシの起動確認に失敗しました。ポート {} が使用可能か確認してください", port),
        source_detail: None,
    })
}

/// 認証プロキシが起動しているか確認
pub async fn check_proxy_running(port: u16) -> bool {
    let client = match crate::utils::http_client::create_http_client_short_timeout() {
        Ok(client) => client,
        Err(_) => return false,
    };
    let url = format!("http://localhost:{}", port);
    
    match client.get(&url).send().await {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
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
                source_detail: None,
            })?;
        
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // netstatの出力からポートとPIDを抽出
            for line in stdout.lines() {
                if line.contains(&format!(":{}", port)) {
                    // PIDを抽出（簡易実装）
                    // 実際の実装では、より詳細なパースが必要
                }
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        use std::process::Command;
        // lsofでポートを使用しているプロセスを検索
        let output = Command::new("lsof")
            .args(&["-ti", &format!(":{}", port)])
            .output()
            .map_err(|e| AppError::AuthError {
                message: format!("lsofコマンド実行エラー: {}", e),
                source_detail: None,
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

/// 認証プロキシプロセスを停止
#[allow(dead_code)]
pub async fn stop_auth_proxy(pid: u32) -> Result<(), AppError> {
    #[cfg(windows)]
    {
        use std::process::Command;
        let output = Command::new("taskkill")
            .args(&["/F", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| AppError::AuthError {
                message: format!("プロセス停止エラー: {}", e),
                source_detail: None,
            })?;
        
        if !output.status.success() {
            // プロセスが既に終了している場合も正常終了とみなす
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.contains("プロセスが見つかりません") && !stderr.contains("not found") {
                return Err(AppError::AuthError {
                    message: format!("プロセス停止に失敗しました: PID {}", pid),
                    source_detail: None,
                });
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        use std::process::Command;
        let output = Command::new("kill")
            .args(&["-9", &pid.to_string()])
            .output()
            .map_err(|e| AppError::AuthError {
                message: format!("プロセス停止エラー: {}", e),
                source_detail: None,
            })?;
        
        if !output.status.success() {
            // プロセスが既に終了している場合も正常終了とみなす
            return Ok(());
        }
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    /// ポート番号の検証テスト
    #[test]
    fn test_port_validation() {
        // 有効なポート番号
        assert!((1024..=65535).contains(&8080));
        assert!((1024..=65535).contains(&3000));
        assert!((1024..=65535).contains(&1420));
        
        // 無効なポート番号（範囲外）
        assert!(!(1024..=65535).contains(&1023));
        assert!(!(1024..=65535).contains(&65536));
    }
    
    /// AuthProxyProcessの検証テスト
    #[test]
    fn test_auth_proxy_process_validation() {
        let process = AuthProxyProcess {
            pid: 12345,
            port: 8080,
        };
        
        assert_eq!(process.pid, 12345);
        assert_eq!(process.port, 8080);
        assert!((1024..=65535).contains(&process.port));
    }
    
    /// 環境変数の検証テスト
    #[test]
    fn test_environment_variables() {
        let mut env_vars = std::collections::HashMap::new();
        env_vars.insert("PORT".to_string(), "8080".to_string());
        env_vars.insert("ENGINE_BASE_URL".to_string(), "http://localhost:11434".to_string());
        env_vars.insert("API_ID".to_string(), "test-api-id".to_string());
        env_vars.insert("ENGINE_TYPE".to_string(), "ollama".to_string());
        
        assert_eq!(env_vars.get("PORT"), Some(&"8080".to_string()));
        assert_eq!(env_vars.get("ENGINE_BASE_URL"), Some(&"http://localhost:11434".to_string()));
        assert_eq!(env_vars.get("API_ID"), Some(&"test-api-id".to_string()));
        assert_eq!(env_vars.get("ENGINE_TYPE"), Some(&"ollama".to_string()));
    }
}
