// vLLM Engine Implementation
// vLLMエンジンのLLMEngineトレイト実装

use super::models::{EngineConfig, EngineDetectionResult, ModelInfo};
use super::traits::LLMEngine;
use crate::utils::error::AppError;
use std::process::Command;
use tokio::process::Command as AsyncCommand;
use std::process::Stdio;

pub struct VLLMEngine;

impl VLLMEngine {
    pub fn new() -> Self {
        VLLMEngine
    }

    /// vLLMがインストールされているかチェック
    /// 戻り値: (vLLMのパス, 使用したPythonコマンド)
    async fn check_vllm_installed() -> Option<(String, String)> {
        // 複数のPython環境をチェック
        // 1. 仮想環境（アプリデータディレクトリ）
        // 2. python3
        // 3. python
        
        // 方法1: 仮想環境をチェック
        if let Ok(app_data_dir) = crate::database::connection::get_app_data_dir() {
            let venv_path = app_data_dir.join("vllm_venv");
            let venv_python = if cfg!(target_os = "windows") {
                venv_path.join("Scripts").join("python.exe")
            } else {
                venv_path.join("bin").join("python")
            };
            
            if venv_python.exists() {
                let venv_python_str = venv_python.to_string_lossy().to_string();
                eprintln!("[DEBUG] vLLM検出: 仮想環境のPythonをチェック: {}", venv_python_str);
                
                if let Ok(output) = Command::new(&venv_python_str)
                    .arg("-c")
                    .arg("import vllm; print(vllm.__file__)")
                    .output()
                {
                    if output.status.success() {
                        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                        
                        if !stderr.is_empty() && !stderr.contains("Warning") {
                            eprintln!("[DEBUG] vLLM検出: 仮想環境でエラー出力あり - {}", stderr);
                        } else if !stdout.is_empty() {
                            eprintln!("[DEBUG] vLLM検出: 仮想環境でインストール確認成功 - {}", stdout);
                            return Some((stdout, venv_python_str));
                        }
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        eprintln!("[DEBUG] vLLM検出: 仮想環境でコマンド失敗 - 終了コード: {:?}, エラー: {}", output.status.code(), stderr);
                    }
                } else {
                    eprintln!("[DEBUG] vLLM検出: 仮想環境のPythonコマンド実行エラー");
                }
            }
        }
        
        // 方法2: python3を試す
        eprintln!("[DEBUG] vLLM検出: python3をチェック");
        let (output, python_cmd_used) = match Command::new("python3")
            .arg("-c")
            .arg("import vllm; print(vllm.__file__)")
            .output()
        {
            Ok(o) => (o, "python3".to_string()),
            Err(e) => {
                eprintln!("[DEBUG] vLLM検出: python3コマンド実行エラー: {}", e);
                // pythonを試す
                match Command::new("python")
                    .arg("-c")
                    .arg("import vllm; print(vllm.__file__)")
                    .output()
                {
                    Ok(o) => (o, "python".to_string()),
                    Err(e2) => {
                        eprintln!("[DEBUG] vLLM検出: pythonコマンド実行エラー: {}", e2);
                        return None;
                    }
                }
            }
        };

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            
            // エラー出力がある場合は失敗とみなす
            if !stderr.is_empty() && !stderr.contains("Warning") {
                eprintln!("[DEBUG] vLLM検出: エラー出力あり - {}", stderr);
                return None;
            }
            
            // 標準出力が空の場合は失敗とみなす
            if stdout.is_empty() {
                eprintln!("[DEBUG] vLLM検出: 標準出力が空");
                return None;
            }
            
            eprintln!("[DEBUG] vLLM検出: インストール確認成功 - {}", stdout);
            return Some((stdout, python_cmd_used));
        }

        // エラー出力を確認
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[DEBUG] vLLM検出: コマンド失敗 - 終了コード: {:?}, エラー: {}", output.status.code(), stderr);
        
        None
    }

    /// PythonパッケージからvLLMのバージョンを取得
    async fn get_version_from_python() -> Result<String, AppError> {
        let output = Command::new("python")
            .arg("-c")
            .arg("import vllm; print(vllm.__version__)")
            .output()
            .map_err(|e| AppError::ProcessError {
                message: format!("vLLMバージョン取得エラー:  {}", e),
                source_detail: None,
            })?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok(version);
        }

        Err(AppError::ApiError {
            message: "vLLMのバージョン取得に失敗しました".to_string(),
            code: "VERSION_ERROR".to_string(),
            source_detail: None,
        })
    }

    /// vLLM APIからバージョンを取得
    async fn get_version_from_api() -> Result<String, AppError> {
        let client = crate::utils::http_client::create_http_client_short_timeout()?;
        let response = client
            .get("http://localhost:8000/v1/models")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("vLLM API接続エラー: {}", e),
                code: "CONNECTION_ERROR".to_string(),
                source_detail: None,
            })?;

        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("vLLM APIエラー: HTTP {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }

        // バージョン情報はレスポンスから取得できないため、デフォルト値を返す
        Ok("unknown".to_string())
    }

    /// Dockerコンテナとして実行中かチェック
    async fn check_docker_container() -> bool {
        // Dockerコマンドの標準エラー出力を抑制（Docker Desktop未起動時のエラーを抑制）
        let output = match Command::new("docker")
            .arg("ps")
            .arg("--filter")
            .arg("name=vllm")
            .arg("--format")
            .arg("{{.Names}}")
            .stderr(Stdio::null()) // 標準エラー出力を抑制
            .output()
        {
            Ok(o) => o,
            Err(e) => {
                // Dockerコマンドが見つからない、またはDocker Desktopが起動していない
                eprintln!("[DEBUG] vLLM検出: Docker未利用 (コマンド実行エラー: {})", e);
                return false;
            }
        };

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let is_running = !stdout.trim().is_empty();
            if is_running {
                eprintln!("[DEBUG] vLLM検出: Dockerコンテナ実行中");
            }
            return is_running;
        }

        // Dockerコマンドは実行できたが、コンテナが見つからない（正常な状態）
        false
    }

    /// Pythonコマンドを取得（pythonまたはpython3）
    fn get_python_command() -> String {
        // python3を優先的に試す
        if Command::new("python3")
            .arg("--version")
            .output()
            .is_ok()
        {
            return "python3".to_string();
        }
        "python".to_string()
    }

    /// vLLMプロセスを起動
    /// 
    /// # Arguments
    /// * `model_name` - 使用するモデル名
    /// * `port` - サーバーのポート番号
    /// * `timeout_secs` - 起動待機のタイムアウト（秒）。初回起動時（モデルダウンロード中）は長めに設定
    async fn launch_vllm_server(model_name: &str, port: u16, timeout_secs: u64) -> Result<u32, AppError> {
        // vLLMがインストールされているPythonを取得
        let python_cmd = match Self::check_vllm_installed().await {
            Some((_vllm_path, python_cmd)) => {
                // vLLM検出時に使用したPythonコマンドを使用
                eprintln!("[DEBUG] vLLM起動: vLLM検出時に使用したPythonを使用: {}", python_cmd);
                python_cmd
            }
            None => {
                // vLLMが見つからない場合は、システムのPythonを使用（エラーになるが、一応試す）
                eprintln!("[WARN] vLLM起動: vLLMが見つかりませんが、システムのPythonを使用して起動を試みます");
                Self::get_python_command()
            }
        };
        
        eprintln!("[DEBUG] vLLMサーバーを起動します: モデル={}, ポート={}, Python={}", model_name, port, python_cmd);

        let mut cmd = AsyncCommand::new(&python_cmd);
        cmd.arg("-m")
            .arg("vllm.entrypoints.openai.api_server")
            .arg("--model")
            .arg(model_name)
            .arg("--port")
            .arg(port.to_string());

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

        let mut child = cmd.spawn().map_err(|e| AppError::ProcessError {
            message: format!("vLLMサーバーの起動に失敗しました: {}", e),
            source_detail: Some(format!("コマンド: {} -m vllm.entrypoints.openai.api_server --model {} --port {}", python_cmd, model_name, port)),
        })?;

        let pid = child.id().unwrap_or(0);
        eprintln!("[DEBUG] vLLMサーバープロセスを起動しました (PID: {})", pid);

        // プロセスをバックグラウンドで実行（所有権を放棄）
        tokio::spawn(async move {
            if let Err(e) = child.wait().await {
                eprintln!("[WARN] vLLMプロセス監視エラー: {}", e);
            }
        });

        // サーバーが起動するまで待機
        // タイムアウトは引数で指定（デフォルト: 1分、初回起動時: 5分）
        let mut waited = 0;
        let max_wait = (timeout_secs * 2) as usize; // 0.5秒間隔で待機
        eprintln!("[DEBUG] vLLM起動待機: タイムアウト={}秒 (最大{}回のチェック)", timeout_secs, max_wait);
        while waited < max_wait {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            
            match crate::utils::http_client::create_http_client_short_timeout() {
                Ok(client) => {
                    let response = client
                        .get(&format!("http://localhost:{}/v1/models", port))
                        .send()
                        .await;
                    
                    match response {
                        Ok(resp) if resp.status().is_success() => {
                            eprintln!("[DEBUG] vLLMサーバーが起動しました (PID: {}, 待機時間: {}秒)", pid, waited * 500 / 1000);
                            return Ok(pid);
                        }
                        Ok(resp) => {
                            // エラーステータスでもサーバーは起動しているとみなす
                            eprintln!("[DEBUG] vLLMサーバーが起動しました (PID: {}, HTTP {}, 待機時間: {}秒)", pid, resp.status(), waited * 500 / 1000);
                            return Ok(pid);
                        }
                        Err(e) => {
                            // 接続エラーはまだ起動していない可能性がある
                            if waited % 10 == 0 {
                                eprintln!("[DEBUG] vLLM起動確認中 (待機時間: {}秒): まだ応答なし - {}", waited * 500 / 1000, e);
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[WARN] vLLM起動確認中にHTTPクライアント作成エラー: {}", e);
                }
            }
            waited += 1;
        }

        // タイムアウトした場合でも、プロセスは起動している可能性があるため、PIDを返す
        eprintln!("[WARN] vLLMサーバーの起動確認がタイムアウトしましたが、プロセスは起動しています (PID: {})", pid);
        Ok(pid)
    }
}

impl LLMEngine for VLLMEngine {
    fn name(&self) -> &str {
        "vLLM"
    }

    fn engine_type(&self) -> &str {
        "vllm"
    }

    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        eprintln!("[DEBUG] vLLM検出: 検出処理を開始します");
        
        // 詳細な診断情報を収集
        let mut diagnostic_messages = Vec::new();
        
        // Python環境のチェック
        let python_check_result = Self::check_vllm_installed().await;
        let python_path = python_check_result.as_ref().map(|(path, _)| path.clone());
        let python_installed_bool = python_check_result.is_some();
        
        // Python環境の詳細チェック
        let mut python_envs_checked = Vec::new();
        
        // 仮想環境をチェック
        if let Ok(app_data_dir) = crate::database::connection::get_app_data_dir() {
            let venv_path = app_data_dir.join("vllm_venv");
            let venv_python = if cfg!(target_os = "windows") {
                venv_path.join("Scripts").join("python.exe")
            } else {
                venv_path.join("bin").join("python")
            };
            
            if venv_python.exists() {
                python_envs_checked.push(format!("仮想環境: {} (存在)", venv_python.display()));
            } else {
                python_envs_checked.push(format!("仮想環境: {} (不存在)", venv_python.display()));
            }
        }
        
        // システムPythonをチェック
        let python3_exists = Command::new("python3").arg("--version").output().is_ok();
        let python_exists = Command::new("python").arg("--version").output().is_ok();
        
        python_envs_checked.push(format!("python3: {}", if python3_exists { "利用可能" } else { "利用不可" }));
        python_envs_checked.push(format!("python: {}", if python_exists { "利用可能" } else { "利用不可" }));
        
        let docker_running = Self::check_docker_container().await;
        
        eprintln!("[DEBUG] vLLM検出: インストール状態 - Python={}, Docker={}", python_installed_bool, docker_running);
        eprintln!("[DEBUG] vLLM検出: Python環境チェック結果: {:?}", python_envs_checked);
        
        // 診断メッセージの構築
        if !python_installed_bool && !docker_running {
            let mut msg = "vLLMがインストールされていません。".to_string();
            
            // 詳細な診断情報を追加
            if !python3_exists && !python_exists {
                msg.push_str("\n\n【診断情報】\n");
                msg.push_str("• Pythonがインストールされていません。Python 3.8以上をインストールしてください。");
            } else {
                msg.push_str("\n\n【診断情報】\n");
                msg.push_str("• Python環境は利用可能ですが、vLLMパッケージが見つかりません。\n");
                msg.push_str("• チェックした環境:\n");
                for env_info in &python_envs_checked {
                    msg.push_str(&format!("  - {}\n", env_info));
                }
                msg.push_str("\n• インストール方法:\n");
                msg.push_str("  1. このアプリの「インストール」ボタンを使用する\n");
                msg.push_str("  2. または、手動でインストール: pip install vllm\n");
                if let Some(path) = &python_path {
                    msg.push_str(&format!("  3. 検出されたPythonパス: {}\n", path));
                }
            }
            
            diagnostic_messages.push(msg);
        }
        
        // 起動状態を確認（リトライ付き）
        let running = match self.is_running().await {
            Ok(r) => {
                eprintln!("[DEBUG] vLLM検出: 起動状態確認成功 - running={}", r);
                r
            }
            Err(e) => {
                eprintln!("[WARN] vLLM検出: 起動状態の確認に失敗しました: {}", e);
                // エラー時は慎重に扱う: 既に起動している可能性があるため、falseを返す
                // ただし、エラー情報はログに記録されている
                false
            }
        };
        
        eprintln!("[DEBUG] vLLM検出: 起動状態 - running={}", running);

        // バージョン取得: Pythonパッケージから取得を試みる
        let version = if python_installed_bool {
            Self::get_version_from_python().await.ok()
        } else if running {
            Self::get_version_from_api().await.ok()
        } else {
            None
        };

        // メッセージの構築
        let message = if !python_installed_bool && !docker_running {
            diagnostic_messages.first().cloned()
        } else if python_installed_bool && !running {
            Some(format!(
                "vLLMはインストールされていますが、起動していません。\n\n【診断情報】\n• インストールパス: {}\n• 起動方法: このアプリの「起動」ボタンを使用するか、手動で起動してください。",
                python_path.as_ref().map(|p| p.as_str()).unwrap_or("不明")
            ))
        } else if !running {
            Some("vLLMが起動していません。".to_string())
        } else {
            None
        };

        let result = EngineDetectionResult {
            engine_type: "vllm".to_string(),
            installed: python_installed_bool || docker_running,
            running,
            version,
            path: python_path,
            message,
            portable: None,
        };
        
        eprintln!("[DEBUG] vLLM検出: 検出結果 - installed={}, running={}, version={:?}, message={:?}", 
            result.installed, result.running, result.version, result.message);
        
        Ok(result)
    }

    // 注意: get_version_from_apiはLLMEngineトレイトに定義されていないため削除
    // 必要に応じて、将来的にトレイトに追加するか、別の関数として実装

    async fn start(&self, config: &EngineConfig) -> Result<u32, AppError> {
        // 既に起動しているか確認
        let already_running = match self.is_running().await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[WARN] vLLM起動前の状態確認に失敗しました: {}", e);
                // エラー時は起動を続行（既に起動している可能性があるが、重複起動のチェックは後で行う）
                false
            }
        };
        
        if already_running {
            eprintln!("[DEBUG] vLLMは既に起動しています");
            // 既に起動している場合、プロセスIDを取得できないため、0を返す
            return Ok(0);
        }

        // vLLMがインストールされているか確認
        let (vllm_path, _) = match Self::check_vllm_installed().await {
            Some((path, _cmd)) => (path, _cmd),
            #[allow(non_snake_case)]
            None => {
                return Err(AppError::ApiError {
                    message: "vLLMが見つかりません。先にインストールしてください。".to_string(),
                    code: "NOT_INSTALLED".to_string(),
                    source_detail: None,
                });
            }
        };

        eprintln!("[DEBUG] vLLMインストール確認: {}", vllm_path);

        // モデル名を取得
        let model_name = config.model_name.as_ref().ok_or_else(|| {
            AppError::ApiError {
                message: "vLLMを起動するにはモデル名が必要です。例: python -m vllm.entrypoints.openai.api_server --model <model_name>".to_string(),
                code: "MODEL_NAME_REQUIRED".to_string(),
                source_detail: None,
            }
        })?;

        // デフォルトモデル（gpt2）の場合は、事前にダウンロードを試みる（オプション）
        // 注意: vLLMは起動時に自動的にモデルをダウンロードするため、これは最適化のためのオプション処理
        if model_name == "gpt2" {
            eprintln!("[DEBUG] vLLM: デフォルトモデル「gpt2」を使用します。vLLMが起動時に自動的にダウンロードします。");
        }

        // ポートを取得（デフォルトは8000）
        let port = config.port.unwrap_or(8000);

        // タイムアウトを決定: 初回起動時（モデルダウンロード中）は長めに設定
        // デフォルトモデル（gpt2）や小さいモデルの場合は初回起動の可能性が高いため、長めのタイムアウトを使用
        let timeout_secs = if model_name == "gpt2" || model_name.contains("gpt") {
            eprintln!("[DEBUG] vLLM: 初回起動の可能性があるため、タイムアウトを5分に設定します（モデル: {}）", model_name);
            300 // 5分（初回起動時、モデルダウンロード中）
        } else {
            60 // 1分（通常時）
        };

        // vLLMサーバーを起動
        // 注意: vLLMは起動時にモデルが存在しない場合、自動的にHugging Faceからダウンロードします
        Self::launch_vllm_server(model_name, port, timeout_secs).await
    }

    async fn stop(&self) -> Result<(), AppError> {
        eprintln!("[DEBUG] vLLM停止処理を開始します");
        
        // まず、vLLMが実行中かどうかを確認
        let was_running = match self.is_running().await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[WARN] vLLMの実行状態確認に失敗しました: {}", e);
                // エラー時は停止処理を続行（既に停止している可能性がある）
                false
            }
        };
        
        if !was_running {
            eprintln!("[DEBUG] vLLMは既に停止しています");
            return Ok(());
        }
        
        eprintln!("[DEBUG] vLLMプロセスを停止します");
        
        // vLLMプロセスを停止
        // Windows環境ではPowerShellを使用してポート8000を使用しているプロセスを停止
        #[cfg(target_os = "windows")]
        {
            let ps_cmd = r#"
                $port = 8000
                $stopped = $false
                $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
                if ($connections) {
                    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
                    foreach ($pid in $pids) {
                        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                        if ($proc) {
                            try {
                                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $pid" -ErrorAction SilentlyContinue).CommandLine
                                if ($cmdLine -and ($cmdLine -like '*vllm*' -or $cmdLine -like '*vllm.entrypoints.openai.api_server*' -or $cmdLine -like '*python*api_server*')) {
                                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                                    Write-Output "Stopped process $pid"
                                    $stopped = $true
                                }
                            } catch {
                                # コマンドライン取得に失敗した場合、プロセス名で判定
                                $procName = $proc.ProcessName
                                if ($procName -like '*python*' -or $procName -like '*vllm*') {
                                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                                    Write-Output "Stopped process $pid (by name)"
                                    $stopped = $true
                                }
                            }
                        }
                    }
                }
                # プロセスが見つからない場合は既に停止している可能性があるため、エラーを返さない
                if (-not $stopped) {
                    Write-Output "No vLLM process found on port $port (may already be stopped)"
                }
            "#;

            let output = Command::new("powershell")
                .arg("-Command")
                .arg(ps_cmd)
                .output();

            match output {
                Ok(output) => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    if output.status.success() || stdout.contains("Stopped") || stdout.contains("already be stopped") {
                        eprintln!("[DEBUG] vLLM停止処理完了: {}", stdout.trim());
                    } else if !stderr.is_empty() {
                        eprintln!("[WARN] vLLM停止コマンドの警告: {}", stderr.trim());
                    }
                    // プロセスが見つからない場合も既に停止している可能性があるため、続行
                }
                Err(e) => {
                    eprintln!("[ERROR] vLLM停止コマンドの実行に失敗しました: {}", e);
                    // PowerShellコマンドの実行自体が失敗した場合のみエラーを返す
                    return Err(AppError::ProcessError {
                        message: format!("vLLMプロセスの停止に失敗しました: {}", e),
                        source_detail: Some(format!("PowerShellコマンド実行エラー: {}", e)),
                    });
                }
            }
        }

        // Linux/macOS環境ではpkillまたはkillコマンドを使用
        #[cfg(not(target_os = "windows"))]
        {
            let output = Command::new("pkill")
                .arg("-f")
                .arg("vllm.entrypoints.openai.api_server")
                .output();

            match output {
                Ok(output) if output.status.success() => {
                    eprintln!("[DEBUG] vLLMプロセスを停止しました");
                }
                Ok(_) => {
                    // pkillはプロセスが見つからない場合、終了コード1を返す（正常な状態）
                    eprintln!("[DEBUG] vLLMプロセスが見つかりませんでした（既に停止している可能性があります）");
                }
                Err(e) => {
                    eprintln!("[ERROR] vLLM停止コマンドの実行に失敗しました: {}", e);
                    return Err(AppError::ProcessError {
                        message: format!("vLLMプロセスの停止に失敗しました: {}", e),
                        source_detail: Some(format!("pkillコマンド実行エラー: {}", e)),
                    });
                }
            }
        }

        // 停止後に実際に停止したかを確認（最大3秒間、0.5秒間隔で確認）
        eprintln!("[DEBUG] vLLM停止確認を開始します");
        for i in 0..6 {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            match self.is_running().await {
                Ok(false) => {
                    eprintln!("[DEBUG] vLLMの停止が確認できました");
                    return Ok(());
                }
                Ok(true) => {
                    eprintln!("[DEBUG] vLLM停止確認試行 {}/6: まだ実行中", i + 1);
                }
                Err(e) => {
                    eprintln!("[WARN] vLLM停止確認中にエラーが発生しました: {}", e);
                }
            }
        }

        // 3秒経過してもまだ実行中の場合は警告を出すが、停止コマンドは実行済みなので成功として扱う
        eprintln!("[WARN] vLLM停止コマンドは実行しましたが、3秒経過後もまだ実行中の可能性があります");
        Ok(())
    }

    async fn is_running(&self) -> Result<bool, AppError> {
        // vLLMのAPIサーバーが起動しているかチェック（最大3回リトライ、各回で1秒待機）
        let mut retries = 3;
        while retries > 0 {
            let client = match crate::utils::http_client::create_http_client_short_timeout() {
                Ok(c) => c,
                Err(_) => {
                    retries -= 1;
                    if retries > 0 {
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                        continue;
                    }
                    return Ok(false);
                }
            };
            
            let response = client.get("http://localhost:8000/v1/models").send().await;

            match response {
                Ok(resp) if resp.status().is_success() => {
                    eprintln!("[DEBUG] vLLM検出: APIサーバーが応答しています (HTTP {})", resp.status());
                    return Ok(true);
                }
                Ok(resp) => {
                    eprintln!("[DEBUG] vLLM検出: APIサーバーは応答していますが、エラーステータス: HTTP {}", resp.status());
                    // エラーステータスでもサーバーは起動しているとみなす
                    return Ok(true);
                }
                Err(_) => {
                    // タイムアウトや接続エラーは正常な状態（サーバーが起動していない）なので、詳細ログは最後のリトライ時のみ
                    if retries == 1 {
                        eprintln!("[DEBUG] vLLM検出: APIサーバー未起動 (localhost:8000 に接続できません)");
                    }
                    retries -= 1;
                    if retries > 0 {
                        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                    }
                }
            }
        }
        
        Ok(false)
    }

    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        let client = crate::utils::http_client::create_http_client()?;
        let response = client
            .get("http://localhost:8000/v1/models")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("vLLM APIリクエストエラー: {}", e),
                code: "API_ERROR".to_string(),
                source_detail: None,
            })?;

        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("vLLM APIエラー: {}", response.status()),
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
        "http://localhost:8000".to_string()
    }

    fn default_port(&self) -> u16 {
        8000
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
