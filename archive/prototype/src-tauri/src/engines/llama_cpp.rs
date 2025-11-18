// llama.cpp Engine Implementation
// llama.cppエンジンのLLMEngineトレイト実装

use super::models::{EngineConfig, EngineDetectionResult, ModelInfo};
use super::traits::LLMEngine;
use crate::utils::error::AppError;
use std::process::Command;

pub struct LlamaCppEngine;

#[allow(dead_code)] // LLMEngineトレイト実装で使用されるメソッドを含む
impl LlamaCppEngine {
    pub fn new() -> Self {
        LlamaCppEngine
    }

    /// 実行ファイルからllama.cppのバージョンを取得
    #[allow(dead_code)] // 将来のバージョン検証機能で使用予定
    async fn get_version_from_executable(exe_path: &str) -> Result<String, AppError> {
        let output = Command::new(exe_path)
            .arg("--version")
            .output()
            .map_err(|e| AppError::ProcessError {
                message: format!("llama.cppバージョン取得エラー: {}", e),
                source_detail: None,
            })?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout);
            Ok(version.trim().to_string())
        } else {
            // バージョン情報が取得できない場合はデフォルト値を返す
            Ok("unknown".to_string())
        }
    }

}

#[allow(dead_code)] // トレイト実装メソッドは将来の使用のために保持
impl LLMEngine for LlamaCppEngine {
    fn name(&self) -> &str {
        "llama.cpp"
    }

    fn engine_type(&self) -> &str {
        "llama_cpp"
    }

    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        use crate::database::connection::get_app_data_dir;
        use std::path::PathBuf;
        
        // インストールされた実行ファイルを確認
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

        // 実行ファイルを探す（詳細な診断情報を収集）
        let mut installed_path: Option<PathBuf> = None;
        let mut checked_paths = Vec::new();
        
        for exe_name in &exe_candidates {
            let candidate = llama_cpp_dir.join(exe_name);
            checked_paths.push(candidate.clone());
            
            if candidate.exists() && candidate.is_file() {
                installed_path = Some(candidate);
                eprintln!("[DEBUG] llama.cpp検出: 実行ファイルを発見 - {}", installed_path.as_ref().unwrap().display());
                break;
            }
        }

        let installed = installed_path.is_some();
        
        // 起動状態を確認
        let running = match self.is_running().await {
            Ok(r) => {
                eprintln!("[DEBUG] llama.cpp検出: 起動状態確認成功 - running={}", r);
                r
            }
            Err(e) => {
                eprintln!("[WARN] llama.cpp検出: 起動状態の確認に失敗しました: {}", e);
                false
            }
        };
        
        // 診断情報の構築
        let message = if !installed {
            let mut msg = "llama.cppがインストールされていません。".to_string();
            msg.push_str("\n\n【診断情報】\n");
            msg.push_str(&format!("• 検索ディレクトリ: {}\n", llama_cpp_dir.display()));
            msg.push_str("• 検索した実行ファイル:\n");
            for (i, exe_name) in exe_candidates.iter().enumerate() {
                let checked_path = &checked_paths[i];
                let exists = checked_path.exists();
                msg.push_str(&format!("  - {}: {}\n", 
                    exe_name, 
                    if exists { "存在する" } else { "存在しない" }
                ));
            }
            msg.push_str("\n• インストール方法:\n");
            msg.push_str("  1. このアプリの「インストール」ボタンを使用する\n");
            msg.push_str("  2. または、手動でllama.cppをダウンロードして、上記のディレクトリに配置してください\n");
            Some(msg)
        } else if !running {
            Some(format!(
                "llama.cppはインストールされていますが、起動していません。\n\n【診断情報】\n• インストールパス: {}\n• 起動方法: このアプリの「起動」ボタンを使用するか、手動で起動してください。",
                installed_path.as_ref().unwrap().display()
            ))
        } else {
            None
        };

        Ok(EngineDetectionResult {
            engine_type: "llama_cpp".to_string(),
            installed,
            running,
            version: None,
            path: installed_path.map(|p| p.to_string_lossy().to_string()),
            message,
            portable: Some(true), // アプリデータディレクトリにインストールされているためポータブル版として扱う
        })
    }

    async fn start(&self, config: &EngineConfig) -> Result<u32, AppError> {
        use crate::database::connection::get_app_data_dir;
        use std::path::PathBuf;
        use tokio::process::Command as AsyncCommand;
        use std::process::Stdio;

        // インストールされた実行ファイルを確認
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
        let mut executable_path: Option<PathBuf> = None;
        for exe_name in &exe_candidates {
            let candidate = llama_cpp_dir.join(exe_name);
            if candidate.exists() && candidate.is_file() {
                executable_path = Some(candidate);
                break;
            }
        }

        let exe_path = executable_path.ok_or_else(|| AppError::ApiError {
            message: "llama.cppの実行ファイルが見つかりません。先にインストールしてください。".to_string(),
            code: "EXECUTABLE_NOT_FOUND".to_string(),
            source_detail: None,
        })?;

        // ポートを取得（デフォルト: 8080）
        let port = config.port.unwrap_or(8080);
        let host = "0.0.0.0"; // すべてのインターフェースでリッスン

        eprintln!("[DEBUG] llama.cppサーバーを起動します: 実行ファイル={:?}, ポート={}", exe_path, port);

        // 既に起動しているか確認
        let already_running = match self.is_running().await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[WARN] llama.cpp起動前の状態確認に失敗しました: {}", e);
                false
            }
        };
        
        if already_running {
            eprintln!("[DEBUG] llama.cppサーバーは既に起動しています");
            return Ok(0); // PIDは取得できないため0を返す
        }

        // コマンドを構築
        let mut cmd = AsyncCommand::new(&exe_path);
        cmd.arg("--host").arg(host);
        cmd.arg("--port").arg(port.to_string());

        // モデル名が指定されている場合は追加
        if let Some(ref model_name) = config.model_name {
            cmd.arg("--model").arg(model_name);
        }

        // Windows環境ではウィンドウを表示しない
        #[cfg(target_os = "windows")]
        {
            #[allow(unused_imports)]
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // プロセスを起動
        let mut child = cmd.spawn().map_err(|e| AppError::ProcessError {
            message: format!("llama.cppサーバーの起動に失敗しました: {}", e),
            source_detail: Some(format!("実行ファイル: {:?}, ポート: {}", exe_path, port)),
        })?;

        let pid = child.id().unwrap_or(0);
        eprintln!("[DEBUG] llama.cppサーバープロセスを起動しました (PID: {})", pid);

        // プロセスをバックグラウンドで実行（所有権を放棄）
        tokio::spawn(async move {
            if let Err(e) = child.wait().await {
                eprintln!("[WARN] llama.cppプロセス監視エラー: {}", e);
            }
        });

        // サーバーが起動するまで待機
        // タイムアウト: モデルが指定されている場合は長め（初回起動の可能性）、それ以外は通常
        let timeout_secs = if config.model_name.is_some() {
            eprintln!("[DEBUG] llama.cpp: モデルが指定されているため、タイムアウトを5分に設定します（初回起動の可能性）");
            300 // 5分（初回起動時、モデルロード中）
        } else {
            60 // 1分（通常時）
        };
        let mut waited = 0;
        let max_wait = (timeout_secs * 2) as usize; // 0.5秒間隔で待機
        eprintln!("[DEBUG] llama.cpp起動待機: タイムアウト={}秒 (最大{}回のチェック)", timeout_secs, max_wait);
        while waited < max_wait {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            match self.is_running().await {
                Ok(true) => {
                    eprintln!("[DEBUG] llama.cppサーバーが起動しました (待機時間: {}秒)", waited * 500 / 1000);
                    return Ok(pid);
                }
                Ok(false) => {
                    // まだ起動していない
                }
                Err(e) => {
                    eprintln!("[DEBUG] llama.cpp起動確認中にエラー (待機時間: {}秒): {}", waited * 500 / 1000, e);
                    // エラーでも続行（ネットワークの問題かもしれない）
                }
            }
            waited += 1;
        }

        // タイムアウトした場合でも、プロセスは起動している可能性がある
        eprintln!("[WARN] llama.cppサーバーの起動確認がタイムアウトしましたが、プロセスは起動しています (PID: {})", pid);
        Ok(pid)
    }

    async fn stop(&self) -> Result<(), AppError> {
        eprintln!("[DEBUG] llama.cpp停止処理を開始します");
        
        // まず、llama.cppが実行中かどうかを確認
        let was_running = match self.is_running().await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[WARN] llama.cppの実行状態確認に失敗しました: {}", e);
                // エラー時は停止処理を続行（既に停止している可能性がある）
                false
            }
        };
        
        if !was_running {
            eprintln!("[DEBUG] llama.cppは既に停止しています");
            return Ok(());
        }
        
        // llama.cppサーバーはHTTP APIで停止できないため、
        // ポートを使用しているプロセスを終了させる
        let port = self.default_port();
        eprintln!("[DEBUG] llama.cppサーバーを停止します: ポート={}", port);
        
        let mut process_found = false;
        
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            // Windows: PowerShellを使用してポートを使用しているプロセスを検索・停止
            let ps_cmd = format!(
                r#"
                $port = {}
                $stopped = $false
                $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
                if ($connections) {{
                    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
                    foreach ($pid in $pids) {{
                        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                        if ($proc) {{
                            try {{
                                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $pid" -ErrorAction SilentlyContinue).CommandLine
                                $procName = $proc.ProcessName
                                if ($cmdLine -and ($cmdLine -like '*llama-server*' -or $cmdLine -like '*llama_cpp*' -or $procName -like '*llama*')) {{
                                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                                    Write-Output "Stopped process $pid"
                                    $stopped = $true
                                }}
                            }} catch {{
                                # コマンドライン取得に失敗した場合、プロセス名で判定
                                $procName = $proc.ProcessName
                                if ($procName -like '*llama*') {{
                                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                                    Write-Output "Stopped process $pid (by name)"
                                    $stopped = $true
                                }}
                            }}
                        }}
                    }}
                }}
                # プロセスが見つからない場合は既に停止している可能性があるため、エラーを返さない
                if (-not $stopped) {{
                    Write-Output "No llama.cpp process found on port $port (may already be stopped)"
                }}
                "#,
                port
            );

            let output = Command::new("powershell")
                .arg("-Command")
                .arg(ps_cmd)
                .output();

            match output {
                Ok(output) => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    if output.status.success() || stdout.contains("Stopped") || stdout.contains("already be stopped") {
                        eprintln!("[DEBUG] llama.cpp停止処理完了: {}", stdout.trim());
                        if stdout.contains("Stopped") {
                            process_found = true;
                        }
                    } else if !stderr.is_empty() {
                        eprintln!("[WARN] llama.cpp停止コマンドの警告: {}", stderr.trim());
                    }
                }
                Err(e) => {
                    eprintln!("[ERROR] llama.cpp停止コマンドの実行に失敗しました: {}", e);
                    // PowerShellコマンドの実行自体が失敗した場合のみエラーを返す
                    return Err(AppError::ProcessError {
                        message: format!("llama.cppプロセスの停止に失敗しました: {}", e),
                        source_detail: Some(format!("PowerShellコマンド実行エラー: {}", e)),
                    });
                }
            }
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            use std::process::Command;
            // Unix系: lsofを使用してポートを使用しているプロセスを検索
            let output = Command::new("lsof")
                .args(&["-ti", &format!(":{}", port)])
                .output();
            
            match output {
                Ok(output) if output.status.success() => {
                    let pid_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        eprintln!("[DEBUG] llama.cppプロセスを終了します: PID={}", pid);
                        let kill_output = Command::new("kill")
                            .arg("-9")
                            .arg(&pid.to_string())
                            .output();
                        
                        match kill_output {
                            Ok(kill_output) if kill_output.status.success() => {
                                eprintln!("[DEBUG] llama.cppプロセス (PID: {}) を停止しました", pid);
                                process_found = true;
                            }
                            Ok(_) => {
                                eprintln!("[WARN] llama.cppプロセス (PID: {}) の停止に失敗しました", pid);
                            }
                            Err(e) => {
                                eprintln!("[ERROR] killコマンドの実行に失敗しました: {}", e);
                            }
                        }
                    }
                }
                Ok(_) => {
                    // lsofはプロセスが見つからない場合、終了コード1を返す（正常な状態）
                    eprintln!("[DEBUG] llama.cppプロセスが見つかりませんでした（既に停止している可能性があります）");
                }
                Err(e) => {
                    eprintln!("[ERROR] lsofコマンドの実行に失敗しました: {}", e);
                    return Err(AppError::ProcessError {
                        message: format!("llama.cppプロセスの検索に失敗しました: {}", e),
                        source_detail: Some(format!("lsofコマンド実行エラー: {}", e)),
                    });
                }
            }
        }
        
        // 停止後に実際に停止したかを確認（最大3秒間、0.5秒間隔で確認）
        eprintln!("[DEBUG] llama.cpp停止確認を開始します");
        for i in 0..6 {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            match self.is_running().await {
                Ok(false) => {
                    eprintln!("[DEBUG] llama.cppの停止が確認できました");
                    return Ok(());
                }
                Ok(true) => {
                    eprintln!("[DEBUG] llama.cpp停止確認試行 {}/6: まだ実行中", i + 1);
                }
                Err(e) => {
                    eprintln!("[WARN] llama.cpp停止確認中にエラーが発生しました: {}", e);
                }
            }
        }
        
        // プロセスが見つからなかった場合、既に停止している可能性が高い
        if !process_found {
            eprintln!("[DEBUG] llama.cppプロセスが見つかりませんでした（既に停止している可能性があります）");
            return Ok(());
        }
        
        // 3秒経過してもまだ実行中の場合は警告を出すが、停止コマンドは実行済みなので成功として扱う
        eprintln!("[WARN] llama.cpp停止コマンドは実行しましたが、3秒経過後もまだ実行中の可能性があります");
        Ok(())
    }

    async fn is_running(&self) -> Result<bool, AppError> {
        // llama.cppのAPIサーバーが起動しているかチェック（最大3回リトライ、各回で1秒待機）
        let mut retries = 3;
        while retries > 0 {
            let client = match crate::utils::http_client::create_http_client_short_timeout() {
                Ok(c) => c,
                Err(_) => {
                    retries -= 1;
                    if retries > 0 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                        continue;
                    }
                    return Ok(false);
                }
            };
            
            let response = client.get("http://localhost:8080/v1/models").send().await;

            match response {
                Ok(resp) if resp.status().is_success() => {
                    eprintln!("[DEBUG] llama.cpp検出: APIサーバーが応答しています (HTTP {})", resp.status());
                    return Ok(true);
                }
                Ok(resp) => {
                    eprintln!("[DEBUG] llama.cpp検出: APIサーバーは応答していますが、エラーステータス: HTTP {}", resp.status());
                    // エラーステータスでもサーバーは起動しているとみなす
                    return Ok(true);
                }
                Err(_) => {
                    // タイムアウトや接続エラーは正常な状態（サーバーが起動していない）なので、詳細ログは最後のリトライ時のみ
                    if retries == 1 {
                        eprintln!("[DEBUG] llama.cpp検出: APIサーバー未起動 (localhost:8080 に接続できません)");
                    }
                    retries -= 1;
                    if retries > 0 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    }
                }
            }
        }
        
        Ok(false)
    }

    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        let client = crate::utils::http_client::create_http_client()?;
        let response = client
            .get("http://localhost:8080/v1/models")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("llama.cpp APIリクエストエラー: {}", e),
                code: "API_ERROR".to_string(),
                source_detail: None,
            })?;

        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("llama.cpp APIエラー: {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }

        let json: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: None,
        })?;

        let models = json["data"]
            .as_array()
            .ok_or_else(|| AppError::ModelError {
                message: "モデル一覧の形式が不正です".to_string(),
                source_detail: None,
            })?
            .iter()
            .filter_map(|m| {
                let name = m["id"].as_str().or_else(|| m["name"].as_str())?.to_string();
                let parameter_size = extract_parameter_size(&name);

                Some(ModelInfo {
                    name,
                    size: None,
                    modified_at: None,
                    parameter_size,
                })
            })
            .collect();

        Ok(models)
    }

    fn get_base_url(&self) -> String {
        "http://localhost:8080".to_string()
    }

    fn default_port(&self) -> u16 {
        8080
    }

    fn supports_openai_compatible_api(&self) -> bool {
        true
    }
}

/// モデル名からパラメータサイズを抽出
fn extract_parameter_size(model_name: &str) -> Option<String> {
    let re = regex::Regex::new(r"(\d+)[bB]").ok()?;
    if let Some(captures) = re.captures(model_name) {
        if let Some(size) = captures.get(1) {
            return Some(format!("{}B", size.as_str()));
        }
    }
    None
}
