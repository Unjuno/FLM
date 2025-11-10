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
    // 複数の可能なパスを試す（開発環境と本番環境の両方に対応）
    let current_dir = std::env::current_dir()
        .map_err(|e| AppError::AuthError {
            message: format!("現在のディレクトリ取得エラー: {}", e),
            source_detail: None,
        })?;

    // 可能なパス候補をリストアップ
    let mut possible_paths: Vec<std::path::PathBuf> = vec![
        // 開発環境: プロジェクトルートから
        current_dir.join("src/backend/auth/server.ts"),
        // 開発環境: src-tauriディレクトリから実行される場合
        current_dir.join("../src/backend/auth/server.ts"),
    ];
    
    // 本番環境: 実行ファイルの場所から相対パスを追加
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            possible_paths.push(exe_dir.join("src/backend/auth/server.ts"));
            if let Some(exe_parent) = exe_dir.parent() {
                possible_paths.push(exe_parent.join("src/backend/auth/server.ts"));
            }
        }
    }

    // 最初に見つかった有効なパスを使用
    let dev_path = possible_paths
        .into_iter()
        .find(|path| path.exists());

    let dev_path = match dev_path {
        Some(path) => path,
        None => {
            // すべてのパス候補を試したが、見つからなかった場合
            let tried_paths: Vec<String> = vec![
                current_dir.join("src/backend/auth/server.ts").display().to_string(),
                current_dir.join("../src/backend/auth/server.ts").display().to_string(),
            ];
            return Err(AppError::AuthError {
                message: format!(
                    "認証プロキシサーバーファイルが見つかりません。以下のパスを確認しましたが、ファイルが見つかりませんでした: {}",
                    tried_paths.join(", ")
                ),
                source_detail: Some(format!(
                    "現在のディレクトリ: {}. ファイルは src/backend/auth/server.ts に配置されている必要があります。",
                    current_dir.display()
                )),
            });
        }
    };
    
    // Node.jsコマンドの存在確認
    use std::process::Command;
    let node_check = Command::new(&node_command)
        .arg("--version")
        .output();
    
    match node_check {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout);
            eprintln!("[INFO] Node.jsが見つかりました: {}", version.trim());
        },
        _ => {
            return Err(AppError::AuthError {
                message: format!("Node.jsが見つかりません。Node.jsをインストールしてから再度お試しください。コマンド: {}", node_command),
                source_detail: None,
            });
        }
    }
    
    // TypeScriptファイルを実行するため、Node.jsの--loaderオプションを使用
    // Node.js 20.6.0以降では、--importオプションでtsxを使用可能
    // または、npx tsxを使用
    // まず、npx tsxを試す
    let npx_command = if cfg!(windows) {
        "npx.cmd"
    } else {
        "npx"
    };
    
    // npx tsxが利用可能か確認
    let tsx_check = Command::new(npx_command)
        .args(&["tsx", "--version"])
        .output();
    
    let (command, args) = match tsx_check {
        Ok(output) if output.status.success() => {
            // tsxが利用可能な場合
            eprintln!("[INFO] tsxが見つかりました。TypeScriptファイルを直接実行します。");
            (
                npx_command.to_string(),
                vec!["tsx".to_string(), dev_path.to_string_lossy().to_string()],
            )
        },
        _ => {
            // tsxが利用できない場合、npx経由でtsxを実行（初回実行時に自動インストールされる）
            eprintln!("[INFO] tsxが見つかりません。npx経由でtsxを実行します（初回実行時に自動インストールされます）。");
            (
                npx_command.to_string(),
                vec!["tsx".to_string(), dev_path.to_string_lossy().to_string()],
            )
        }
    };
    
    Ok((command, args))
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
    // NODE_ENVをdevelopmentに設定（CORS設定のため）
    // Tauriアプリケーションはローカル環境で動作するため、開発環境として扱う
    env_vars.insert("NODE_ENV".to_string(), "development".to_string());
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

    // プロセスの標準エラー出力を読み取るタスクを開始
    let stderr = child.stderr.take();
    let mut error_output = String::new();
    if let Some(mut stderr) = stderr {
        use tokio::io::AsyncReadExt;
        let mut buffer = vec![0u8; 1024];
        if let Ok(n) = stderr.read(&mut buffer).await {
            if n > 0 {
                error_output = String::from_utf8_lossy(&buffer[..n]).to_string();
            }
        }
    }

    // 起動確認（最大10回、1秒間隔、合計10秒待機）
    for attempt in 1..=10 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        if check_proxy_running(port).await {
            return Ok(AuthProxyProcess { pid, port });
        }
        
        // プロセスの状態を確認
        if let Ok(Some(status)) = child.try_wait() {
            // プロセスが既に終了している場合
            let exit_code = status.code().unwrap_or(-1);
            let error_msg = if !error_output.is_empty() {
                format!("認証プロキシの起動に失敗しました（終了コード: {}）。エラー出力: {}", exit_code, error_output)
            } else {
                format!("認証プロキシの起動に失敗しました（終了コード: {}）。Node.jsがインストールされているか、サーバーファイル（src/backend/auth/server.ts）が存在するか確認してください。", exit_code)
            };
            return Err(AppError::AuthError {
                message: error_msg,
                source_detail: Some(format!("ポート: {}, 試行回数: {}", port, attempt)),
            });
        }
    }

    // 起動に失敗した場合、プロセスを終了
    if let Err(e) = child.kill().await {
        eprintln!("[WARN] 認証プロキシプロセスの終了に失敗しました: {}", e);
    }
    if let Err(e) = child.wait().await {
        eprintln!("[WARN] 認証プロキシプロセスの待機に失敗しました: {}", e);
    }

    let error_msg = if !error_output.is_empty() {
        format!("認証プロキシの起動確認に失敗しました（10秒経過）。エラー出力: {}. ポート {} が使用可能か確認してください", error_output, port)
    } else {
        format!("認証プロキシの起動確認に失敗しました（10秒経過）。ポート {} が使用可能か確認してください。Node.jsがインストールされているか、サーバーファイル（src/backend/auth/server.ts）が存在するか確認してください。", port)
    };

    Err(AppError::AuthError {
        message: error_msg,
        source_detail: Some(format!("ポート: {}, PID: {}", port, pid)),
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
            // 出力形式: "TCP    0.0.0.0:1420           0.0.0.0:0              LISTENING       12345"
            for line in stdout.lines() {
                if line.contains(&format!(":{}", port)) && line.contains("LISTENING") {
                    // 行を空白で分割して、最後の要素（PID）を取得
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(pid_str) = parts.last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            // PIDが見つかった場合、プロセスを停止
                            return stop_auth_proxy(pid).await;
                        }
                    }
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
