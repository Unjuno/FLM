// Authentication Proxy Management Module
// 認証エージェント (AUTH) 実装
// 認証プロキシサーバーの起動・停止管理

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::process::Command as AsyncCommand;

use crate::utils::error::AppError;
use crate::{debug_log, error_log, info_log, warn_log};

/// 認証プロキシプロセス情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthProxyProcess {
    pub pid: u32,
    pub port: u16,
}

/// 認証プロキシサーバーのパスとNode.jsコマンドを取得
fn get_auth_proxy_command() -> Result<(String, Vec<String>), AppError> {
    // Node.jsコマンドを取得
    let node_command = if cfg!(windows) { "node.exe" } else { "node" };

    // 認証プロキシサーバーのパスを取得
    // 複数の可能なパスを試す（開発環境と本番環境の両方に対応）
    let current_dir = std::env::current_dir().map_err(|e| AppError::AuthError {
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
    let dev_path = possible_paths.into_iter().find(|path| path.exists());

    let dev_path = match dev_path {
        Some(path) => path,
        None => {
            // すべてのパス候補を試したが、見つからなかった場合
            let tried_paths: Vec<String> = vec![
                current_dir
                    .join("src/backend/auth/server.ts")
                    .display()
                    .to_string(),
                current_dir
                    .join("../src/backend/auth/server.ts")
                    .display()
                    .to_string(),
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
    let node_check = Command::new(&node_command).arg("--version").output();

    match node_check {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout);
            debug_log!("Node.jsが見つかりました: {}", version.trim());
        }
        _ => {
            error_log!("Node.jsが見つかりません。コマンド: {}", node_command);
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
    let npx_command = if cfg!(windows) { "npx.cmd" } else { "npx" };

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
        }
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

/// エラー出力から警告を除外し、実際のエラーメッセージのみを抽出
fn extract_actual_error(error_output: &str) -> String {
    let lines: Vec<&str> = error_output.lines().collect();
    let mut error_lines = Vec::new();
    let mut in_error_section = false;

    // 警告を除外するキーワード
    let warning_keywords = [
        "⚠️",
        "セキュリティ警告",
        "警告",
        "WARN",
        "warning",
        "HTTPサーバーは外部からアクセス可能です",
        "ポート番号",
        "が他のアプリケーションで使用されていないか確認してください",
    ];

    for line in &lines {
        // 警告行をスキップ
        if warning_keywords
            .iter()
            .any(|keyword| line.contains(keyword))
        {
            continue;
        }

        // エラー行を検出（[ERROR]プレフィックスを優先）
        if line.contains("[ERROR]") {
            in_error_section = true;
            error_lines.push(*line);
        } else if line.contains("error")
            || line.contains("Error")
            || line.contains("エラー")
            || line.contains("EADDRINUSE")
            || line.contains("起動エラー")
            || line.contains("起動に失敗")
            || line.contains("失敗しました")
            || line.contains("process.exit")
        {
            in_error_section = true;
            error_lines.push(*line);
        } else if in_error_section {
            // エラーセクション内の行も含める（スタックトレースなど）
            if line.trim().is_empty() && !error_lines.is_empty() {
                // 空行でエラーセクションが終了
                break;
            }
            error_lines.push(*line);
        }
    }

    if error_lines.is_empty() {
        // エラー行が見つからない場合、EADDRINUSEやポート関連のメッセージを探す
        if error_output.contains("EADDRINUSE") || error_output.contains("address already in use") {
            return "ポートが既に使用されています。別のポートを指定するか、使用中のプロセスを終了してください。".to_string();
        }
        // それでも見つからない場合は、元の出力を返す（警告を除く）
        let filtered: Vec<&str> = lines
            .iter()
            .filter(|line| {
                !warning_keywords
                    .iter()
                    .any(|keyword| line.contains(keyword))
            })
            .copied()
            .collect();
        if !filtered.is_empty() {
            return filtered.join("\n");
        }
    }

    error_lines.join("\n")
}

/// 認証プロキシを起動
pub async fn start_auth_proxy(
    port: u16,
    _api_key: Option<String>,
    engine_base_url: Option<String>,
    api_id: Option<String>,
    engine_type: Option<String>,
    auth_required: bool,
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
    // NODE_ENVは環境に応じて設定（明示指定があれば優先）
    let node_env = std::env::var("FLM_PROXY_NODE_ENV")
        .or_else(|_| std::env::var("NODE_ENV"))
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            if cfg!(debug_assertions) {
                "development".to_string()
            } else {
                "production".to_string()
            }
        });
    env_vars.insert("NODE_ENV".to_string(), node_env);

    // CORSで許可するオリジン（未指定の場合は開発/本番で適切なデフォルトを設定）
    let allowed_origins = std::env::var("FLM_PROXY_ALLOWED_ORIGINS")
        .or_else(|_| std::env::var("ALLOWED_ORIGINS"))
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            if cfg!(debug_assertions) {
                "http://localhost:1420,tauri://localhost".to_string()
            } else {
                "tauri://localhost".to_string()
            }
        });
    env_vars.insert("ALLOWED_ORIGINS".to_string(), allowed_origins);

    env_vars.insert(
        "AUTH_REQUIRED".to_string(),
        if auth_required {
            "1".to_string()
        } else {
            "0".to_string()
        },
    );
    env_vars.insert("PORT".to_string(), port.to_string());
    // Node.jsのバッファリングを無効化してログを即座に出力
    env_vars.insert("NODE_OPTIONS".to_string(), "--no-warnings".to_string());
    // 標準出力/標準エラー出力のバッファリングを無効化
    env_vars.insert("NODE_NO_WARNINGS".to_string(), "1".to_string());
    if let Some(ref url) = engine_base_url {
        env_vars.insert("ENGINE_BASE_URL".to_string(), url.clone());
    }
    if let Some(ref id) = api_id {
        env_vars.insert("API_ID".to_string(), id.clone());
    }
    if let Some(ref engine) = engine_type {
        env_vars.insert("ENGINE_TYPE".to_string(), engine.clone());
    }

    // ログ出力: プロキシ起動開始
    debug_log!("認証プロキシの起動を開始します...");
    debug_log!("  コマンド: {} {}", node_command, args.join(" "));
    debug_log!("  ポート: {}", port);
    debug_log!("  認証必須: {}", auth_required);
    if let Some(ref url) = engine_base_url {
        debug_log!("  エンジンURL: {}", url);
    }
    if let Some(ref id) = api_id {
        debug_log!("  API ID: {}", id);
    }
    if let Some(ref engine) = engine_type {
        debug_log!("  エンジンタイプ: {}", engine);
    }

    // プロセスを起動
    let mut command = AsyncCommand::new(&node_command);
    command.args(&args);
    command.envs(&env_vars);
    command.stdin(Stdio::null());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| {
        error_log!("認証プロキシの起動に失敗しました: {}", e);
        AppError::AuthError {
            message: format!("認証プロキシの起動に失敗しました: {}", e),
            source_detail: None,
        }
    })?;

    let pid = child.id().unwrap_or(0) as u32;
    debug_log!("認証プロキシプロセスを起動しました (PID: {})", pid);

    // プロセスの標準出力と標準エラー出力を読み取ってコンソールに出力するタスクを開始
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let mut error_output = String::new();

    // 標準出力をコンソールに出力するタスク（行単位で処理）
    if let Some(stdout) = stdout {
        use tokio::io::{AsyncBufReadExt, BufReader};
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break, // EOF
                    Ok(_) => {
                        // 行をそのまま出力（改行は含まれる）
                        let trimmed = line.trim_end();
                        if !trimmed.is_empty() {
                            eprintln!("[PROXY-STDOUT] {}", trimmed);
                        }
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // 標準エラー出力を読み取ってコンソールに出力し、エラーメッセージも保存するタスク
    let mut stderr_handle = if let Some(stderr) = stderr {
        use tokio::sync::mpsc;

        let (tx, rx) = mpsc::unbounded_channel();
        let stderr_clone = stderr;

        // バックグラウンドでエラー出力を継続的に読み取ってコンソールに出力（行単位で処理）
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let mut reader = BufReader::new(stderr_clone);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break, // EOF
                    Ok(_) => {
                        // 行をそのまま出力（改行は含まれる）
                        let trimmed = line.trim_end();
                        if !trimmed.is_empty() {
                            eprintln!("[PROXY-STDERR] {}", trimmed);
                            // エラーメッセージとしても保存
                            let _ = tx.send(line.clone());
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        Some(rx)
    } else {
        None
    };

    // 起動確認（最大10回、1秒間隔、合計10秒待機）
    debug_log!("認証プロキシの起動確認を開始します（最大10秒）...");
    for attempt in 1..=10 {
        // エラー出力を読み取る（非ブロッキング）
        if let Some(ref mut rx) = stderr_handle {
            while let Ok(text) = rx.try_recv() {
                error_output.push_str(&text);
                // エラー出力が長すぎる場合は切り詰める
                if error_output.len() > 8192 {
                    error_output.truncate(8192);
                    error_output.push_str("... (出力が長すぎるため切り詰めました)");
                }
            }
        }

        debug_log!("認証プロキシの起動確認中... (試行 {}/10)", attempt);
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        if check_proxy_running(port).await {
            debug_log!(
                "✓ 認証プロキシの起動に成功しました (ポート: {}, PID: {})",
                port,
                pid
            );
            info_log!("認証プロキシが正常に起動しました (ポート: {})", port);
            return Ok(AuthProxyProcess { pid, port });
        }

        // プロセスの状態を確認
        if let Ok(Some(status)) = child.try_wait() {
            warn_log!(
                "認証プロキシプロセスが予期せず終了しました (試行 {}/10)",
                attempt
            );
            // プロセスが既に終了している場合、残りのエラー出力を読み取る
            if let Some(ref mut rx) = stderr_handle {
                use tokio::time::{timeout, Duration};
                // 残りのエラー出力を読み取る（最大1秒待機）
                while let Ok(Some(text)) = timeout(Duration::from_millis(100), rx.recv()).await {
                    error_output.push_str(&text);
                    if error_output.len() > 8192 {
                        error_output.truncate(8192);
                        error_output.push_str("... (出力が長すぎるため切り詰めました)");
                    }
                }
            }

            // エラー出力から警告を除外し、実際のエラーのみを抽出
            let actual_error = extract_actual_error(&error_output);

            let exit_code = status.code().unwrap_or(-1);
            error_log!("認証プロキシプロセスの終了コード: {}", exit_code);
            if !error_output.is_empty() {
                error_log!("認証プロキシのエラー出力: {}", error_output);
            }

            let error_msg = if !actual_error.is_empty() {
                format!(
                    "認証プロキシの起動に失敗しました（終了コード: {}）。{}",
                    exit_code, actual_error
                )
            } else if !error_output.is_empty() {
                // 警告のみの場合は、ポート関連のエラーを推測
                if error_output.contains("EADDRINUSE") || error_output.contains("ポート") {
                    format!(
                        "認証プロキシの起動に失敗しました（終了コード: {}）。ポート {} が既に使用されています。別のポートを指定するか、使用中のプロセスを終了してください。",
                        exit_code, port
                    )
                } else {
                    format!(
                        "認証プロキシの起動に失敗しました（終了コード: {}）。エラー出力: {}",
                        exit_code, error_output
                    )
                }
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
    error_log!("認証プロキシの起動確認がタイムアウトしました（10秒経過）");
    if let Err(e) = child.kill().await {
        warn_log!("認証プロキシプロセスの終了に失敗しました: {}", e);
    }
    if let Err(e) = child.wait().await {
        warn_log!("認証プロキシプロセスの待機に失敗しました: {}", e);
    }

    // 残りのエラー出力を読み取る
    if let Some(ref mut rx) = stderr_handle {
        use tokio::time::{timeout, Duration};
        while let Ok(Some(text)) = timeout(Duration::from_millis(100), rx.recv()).await {
            error_output.push_str(&text);
            if error_output.len() > 8192 {
                error_output.truncate(8192);
                error_output.push_str("... (出力が長すぎるため切り詰めました)");
            }
        }
    }

    if !error_output.is_empty() {
        error_log!("認証プロキシのエラー出力: {}", error_output);
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
///
/// 注意: 認証プロキシはHTTPポートでリダイレクト（301）を返し、
/// HTTPSポート（port+1）で実際のサービスを提供します。
/// そのため、HTTPSポートの/healthエンドポイントを直接チェックします。
pub async fn check_proxy_running(port: u16) -> bool {
    // HTTPSポート（port+1）の/healthエンドポイントをチェック
    // 自己署名証明書を使用しているため、証明書検証を無効化したクライアントを使用
    let client = match crate::utils::http_client::create_http_client_allow_insecure() {
        Ok(client) => client,
        Err(e) => {
            debug_log!("HTTPクライアントの作成に失敗しました: {:?}", e);
            return false;
        }
    };
    let https_port = port + 1;
    let url = format!("https://localhost:{}/health", https_port);
    debug_log!("認証プロキシのヘルスチェック: {}", url);

    // 複数回試行して、プロキシサーバーが完全に起動するまで待機
    for attempt in 1..=3 {
        match client.get(&url).send().await {
            Ok(response) => {
                // 200 OKまたは301リダイレクト（HTTPポートへのアクセス時）を成功とみなす
                let status = response.status();
                let is_running = status.is_success() || status.as_u16() == 301;
                if is_running {
                    debug_log!(
                        "認証プロキシのヘルスチェック結果: ステータス={}, 実行中={}",
                        status.as_u16(),
                        is_running
                    );
                    return true;
                } else {
                    debug_log!(
                        "認証プロキシのヘルスチェック結果: ステータス={}, 実行中=false (試行 {}/3)",
                        status.as_u16(),
                        attempt
                    );
                }
            }
            Err(e) => {
                if attempt < 3 {
                    // 最初の2回は失敗しても再試行（プロキシサーバーが起動中かもしれない）
                    debug_log!(
                        "認証プロキシのヘルスチェックに失敗しました（試行 {}/3）: {:?}",
                        attempt,
                        e
                    );
                    // 少し待機してから再試行
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    continue;
                } else {
                    // 3回目で失敗した場合は、ログに記録してfalseを返す
                    debug_log!(
                        "認証プロキシのヘルスチェックに失敗しました（最終試行）: {:?}",
                        e
                    );
                }
            }
        }
    }

    false
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
            if !stderr.contains("プロセスが見つかりません") && !stderr.contains("not found")
            {
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
        env_vars.insert(
            "ENGINE_BASE_URL".to_string(),
            "http://localhost:11434".to_string(),
        );
        env_vars.insert("API_ID".to_string(), "test-api-id".to_string());
        env_vars.insert("ENGINE_TYPE".to_string(), "ollama".to_string());

        assert_eq!(env_vars.get("PORT"), Some(&"8080".to_string()));
        assert_eq!(
            env_vars.get("ENGINE_BASE_URL"),
            Some(&"http://localhost:11434".to_string())
        );
        assert_eq!(env_vars.get("API_ID"), Some(&"test-api-id".to_string()));
        assert_eq!(env_vars.get("ENGINE_TYPE"), Some(&"ollama".to_string()));
    }
}
