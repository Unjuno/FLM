// Engine Installer Module
// 各エンジンの自動インストール機能

use crate::database::connection::get_app_data_dir;
use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use tokio::process::Command as AsyncCommand;
use tokio::time::timeout;


/// ダウンロード進捗情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineDownloadProgress {
    pub status: String, // "downloading" | "extracting" | "installing" | "completed" | "error"
    pub progress: f64,  // 0.0 - 100.0
    pub downloaded_bytes: u64, // ダウンロード済みバイト数
    pub total_bytes: u64, // 総バイト数
    pub speed_bytes_per_sec: f64, // ダウンロード速度（バイト/秒）
    pub message: Option<String>, // ステータスメッセージ
}

/// LM Studioのインストール
pub async fn install_lm_studio<F>(mut progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(EngineDownloadProgress) -> Result<(), AppError>,
{
    progress_callback(EngineDownloadProgress {
        status: "downloading".to_string(),
        progress: 0.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("LM Studioのインストーラーをダウンロードしています...".to_string()),
    })?;

    // LM Studioの最新版ダウンロードURLを取得
    let download_url = get_lm_studio_download_url().await?;

    // アプリデータディレクトリを取得
    let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
        message: format!("アプリデータディレクトリ取得エラー: {}", e),
        source_detail: None,
    })?;

    let installer_dir = app_data_dir.join("lm_studio_installer");
    fs::create_dir_all(&installer_dir).map_err(|e| AppError::IoError {
        message: format!("インストーラディレクトリ作成エラー: {}", e),
        source_detail: None,
    })?;

    let file_name = download_url
        .split('/')
        .last()
        .unwrap_or("lm_studio_installer");
    let download_file = installer_dir.join(file_name);

    // ダウンロード実行
    download_file_with_progress(&download_url, &download_file, &mut progress_callback).await?;

    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 50.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("LM Studioのインストーラーを起動しています...".to_string()),
    })?;

    // Windowsの場合、インストーラーを実行
    #[cfg(target_os = "windows")]
    {
        let status = Command::new(&download_file)
            .spawn()
            .map_err(|e| AppError::ProcessError {
                message: format!("LM Studioインストーラーの起動に失敗しました: {}", e),
                source_detail: None,
            })?
            .wait()
            .map_err(|e| AppError::ProcessError {
                message: format!("LM Studioインストーラーの実行エラー: {}", e),
                source_detail: None,
            })?;

        if !status.success() {
            return Err(AppError::ProcessError {
                message: "LM Studioのインストールに失敗しました".to_string(),
                source_detail: None,
            });
        }
    }

    // macOSの場合、DMGをマウントしてインストール
    #[cfg(target_os = "macos")]
    {
        // DMGのマウントとインストール処理（実装が必要）
        // 現在はダウンロードのみ
    }

    // Linuxの場合、AppImageを実行可能にする
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&download_file)
            .map_err(|e| AppError::IoError {
                message: format!("ファイル情報取得エラー: {}", e),
                source_detail: None,
            })?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&download_file, perms).map_err(|e| AppError::IoError {
            message: format!("実行権限設定エラー: {}", e),
            source_detail: None,
        })?;
    }

    progress_callback(EngineDownloadProgress {
        status: "completed".to_string(),
        progress: 100.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("LM Studioのインストールが完了しました".to_string()),
    })?;

    Ok("lm_studio".to_string())
}

/// LM StudioのダウンロードURLを取得
async fn get_lm_studio_download_url() -> Result<String, AppError> {
    // LM Studioの公式サイトから最新版のダウンロードURLを取得
    // 現在は固定URLを使用（将来はAPIから取得可能になる可能性がある）
    #[cfg(target_os = "windows")]
    {
        Ok("https://releases.lmstudio.ai/windows/latest".to_string())
    }

    #[cfg(target_os = "macos")]
    {
        Ok("https://releases.lmstudio.ai/macos/latest".to_string())
    }

    #[cfg(target_os = "linux")]
    {
        Ok("https://releases.lmstudio.ai/linux/latest".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err(AppError::ApiError {
            message: "このOSではLM Studioの自動インストールはサポートされていません".to_string(),
            code: "UNSUPPORTED_OS".to_string(),
            source_detail: None,
        })
    }
}

/// vLLMのインストール（Pythonパッケージとして）
pub async fn install_vllm<F>(mut progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(EngineDownloadProgress) -> Result<(), AppError>,
{

    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 0.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("Pythonを確認しています...".to_string()),
    })?;

    // Pythonがインストールされているか確認（実際にバージョン確認コマンドを実行）
    let python_cmd = {
        let mut found_python: Option<&str> = None;
        
        // python3を試す
        let output = Command::new("python3")
            .arg("--version")
            .output();
        if let Ok(output) = output {
            if output.status.success() {
                found_python = Some("python3");
            }
        }
        
        // python3が見つからない場合、pythonを試す
        if found_python.is_none() {
            let output = Command::new("python")
                .arg("--version")
                .output();
            if let Ok(output) = output {
                if output.status.success() {
                    found_python = Some("python");
                }
            }
        }
        
        found_python.ok_or_else(|| AppError::ApiError {
            message: "Pythonがインストールされていません。先にPythonをインストールしてください。Python 3.8以上が必要です。"
                .to_string(),
            code: "PYTHON_NOT_FOUND".to_string(),
            source_detail: None,
        })?
    };

    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 5.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("pipを確認しています...".to_string()),
    })?;

    // pipが利用可能か確認
    let pip_check = AsyncCommand::new(python_cmd)
        .arg("-m")
        .arg("pip")
        .arg("--version")
        .output()
        .await;
    
    if let Err(e) = pip_check {
        return Err(AppError::ApiError {
            message: format!("pipが見つかりません。Pythonとpipをインストールしてください。エラー: {}", e),
            code: "PIP_NOT_FOUND".to_string(),
            source_detail: None,
        });
    }

    // 複数のインストール方法を順次試行
    let install_timeout = Duration::from_secs(1800); // 30分
    let mut install_success = false;
    let mut used_method = String::new();
    let mut last_error: Option<String> = None;
    let mut verify_python_cmd = python_cmd.to_string(); // 検証時に使用するPythonコマンド（仮想環境の場合は変更される）

    // 方法1: 通常のインストール（グローバル）
    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 10.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("vLLMをインストールしています（方法1/3: グローバルインストール）...".to_string()),
    })?;
    eprintln!("[DEBUG] vLLMインストール: 方法1 - グローバルインストールを試行");
    
    let install_result = timeout(
        install_timeout,
        AsyncCommand::new(python_cmd)
            .arg("-m")
            .arg("pip")
            .arg("install")
            .arg("vllm")
            .arg("--upgrade")
            .output()
    ).await;

    match install_result {
        Ok(Ok(output)) if output.status.success() => {
            eprintln!("[DEBUG] vLLMインストール: 方法1が成功しました");
            install_success = true;
            used_method = "グローバルインストール".to_string();
            // 成功時に進捗を更新
            progress_callback(EngineDownloadProgress {
                status: "installing".to_string(),
                progress: 25.0,
                downloaded_bytes: 0,
                total_bytes: 0,
                speed_bytes_per_sec: 0.0,
                message: Some("インストールが完了しました。検証中...".to_string()),
            })?;
        }
        Ok(Ok(output)) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            let error_msg = format!("方法1失敗 (終了コード: {:?}): stderr={}, stdout={}", 
                output.status.code(),
                if stderr.len() > 200 { format!("{}...", &stderr[..200]) } else { stderr.to_string() },
                if stdout.len() > 200 { format!("{}...", &stdout[..200]) } else { stdout.to_string() }
            );
            eprintln!("[DEBUG] vLLMインストール: {}", error_msg);
            last_error = Some(error_msg);
        }
        Ok(Err(e)) => {
            let error_msg = format!("方法1実行エラー: {}", e);
            eprintln!("[DEBUG] vLLMインストール: {}", error_msg);
            last_error = Some(error_msg);
        }
        Err(_) => {
            eprintln!("[DEBUG] vLLMインストール: 方法1がタイムアウト");
            last_error = Some("方法1がタイムアウトしました".to_string());
        }
    }

    // 方法2: --userオプションでのインストール
    if !install_success {
        progress_callback(EngineDownloadProgress {
            status: "installing".to_string(),
            progress: 30.0,
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bytes_per_sec: 0.0,
            message: Some("vLLMをインストールしています（方法2/3: ユーザー権限でインストール）...".to_string()),
        })?;
        eprintln!("[DEBUG] vLLMインストール: 方法2 - --userオプションでインストールを試行");
        
        let install_result = timeout(
            install_timeout,
            AsyncCommand::new(python_cmd)
                .arg("-m")
                .arg("pip")
                .arg("install")
                .arg("--user")
                .arg("vllm")
                .arg("--upgrade")
                .output()
        ).await;

        match install_result {
            Ok(Ok(output)) if output.status.success() => {
                eprintln!("[DEBUG] vLLMインストール: 方法2が成功しました");
                install_success = true;
                used_method = "ユーザー権限インストール".to_string();
                // 成功時に進捗を更新
                progress_callback(EngineDownloadProgress {
                    status: "installing".to_string(),
                    progress: 45.0,
                    downloaded_bytes: 0,
                    total_bytes: 0,
                    speed_bytes_per_sec: 0.0,
                    message: Some("インストールが完了しました。検証中...".to_string()),
                })?;
            }
            Ok(Ok(output)) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let error_msg = format!("方法2失敗 (終了コード: {:?}): stderr={}, stdout={}", 
                    output.status.code(),
                    if stderr.len() > 200 { format!("{}...", &stderr[..200]) } else { stderr.to_string() },
                    if stdout.len() > 200 { format!("{}...", &stdout[..200]) } else { stdout.to_string() }
                );
                eprintln!("[DEBUG] vLLMインストール: {}", error_msg);
                last_error = Some(error_msg);
            }
            Ok(Err(e)) => {
                let error_msg = format!("方法2実行エラー: {}", e);
                eprintln!("[DEBUG] vLLMインストール: {}", error_msg);
                last_error = Some(error_msg);
            }
            Err(_) => {
                eprintln!("[DEBUG] vLLMインストール: 方法2がタイムアウト");
                last_error = Some("方法2がタイムアウトしました".to_string());
            }
        }
    }

    // 方法3: 仮想環境（venv）を使用したインストール
    if !install_success {
        progress_callback(EngineDownloadProgress {
            status: "installing".to_string(),
            progress: 50.0,
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bytes_per_sec: 0.0,
            message: Some("vLLMをインストールしています（方法3/3: 仮想環境を使用）...".to_string()),
        })?;
        eprintln!("[DEBUG] vLLMインストール: 方法3 - 仮想環境を使用したインストールを試行");

        let app_data_dir = get_app_data_dir().map_err(|e| AppError::ProcessError {
            message: format!("アプリデータディレクトリの取得に失敗しました: {}", e),
            source_detail: None,
        })?;

        let venv_path = app_data_dir.join("vllm_venv");
        let venv_python = if cfg!(target_os = "windows") {
            venv_path.join("Scripts").join("python.exe")
        } else {
            venv_path.join("bin").join("python")
        };

        // 仮想環境が存在しない場合は作成
        if !venv_python.exists() {
            progress_callback(EngineDownloadProgress {
                status: "installing".to_string(),
                progress: 55.0,
                downloaded_bytes: 0,
                total_bytes: 0,
                speed_bytes_per_sec: 0.0,
                message: Some("仮想環境を作成しています...".to_string()),
            })?;
            eprintln!("[DEBUG] vLLMインストール: 仮想環境を作成: {:?}", venv_path);
            
            let venv_result = timeout(
                Duration::from_secs(60),
                AsyncCommand::new(python_cmd)
                    .arg("-m")
                    .arg("venv")
                    .arg(venv_path.to_string_lossy().as_ref())
                    .output()
            ).await;

            match venv_result {
                Ok(Ok(output)) if output.status.success() => {
                    eprintln!("[DEBUG] vLLMインストール: 仮想環境の作成に成功");
                }
                Ok(Ok(output)) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("[WARN] vLLMインストール: 仮想環境の作成に失敗: {}", stderr);
                }
                _ => {
                    eprintln!("[WARN] vLLMインストール: 仮想環境の作成がタイムアウトまたはエラー");
                }
            }
        }

        // 仮想環境内のPythonが存在する場合は使用
        if venv_python.exists() {
            let venv_python_str = venv_python.to_string_lossy().to_string();
            eprintln!("[DEBUG] vLLMインストール: 仮想環境のPythonを使用: {}", venv_python_str);

            let install_result = timeout(
                install_timeout,
                AsyncCommand::new(&venv_python_str)
                    .arg("-m")
                    .arg("pip")
                    .arg("install")
                    .arg("vllm")
                    .arg("--upgrade")
                    .output()
            ).await;

            match install_result {
                Ok(Ok(output)) if output.status.success() => {
                    eprintln!("[DEBUG] vLLMインストール: 方法3が成功しました");
                    install_success = true;
                    used_method = "仮想環境インストール".to_string();
                    verify_python_cmd = venv_python_str.clone(); // 検証時も仮想環境のPythonを使用
                }
                Ok(Ok(output)) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let error_msg = format!("方法3失敗 (終了コード: {:?}): stderr={}, stdout={}", 
                        output.status.code(),
                        if stderr.len() > 200 { format!("{}...", &stderr[..200]) } else { stderr.to_string() },
                        if stdout.len() > 200 { format!("{}...", &stdout[..200]) } else { stdout.to_string() }
                    );
                    eprintln!("[DEBUG] vLLMインストール: {}", error_msg);
                    last_error = Some(error_msg);
                }
                Ok(Err(e)) => {
                    let error_msg = format!("方法3実行エラー: {}", e);
                    eprintln!("[DEBUG] vLLMインストール: {}", error_msg);
                    last_error = Some(error_msg);
                }
                Err(_) => {
                    eprintln!("[DEBUG] vLLMインストール: 方法3がタイムアウト");
                    last_error = Some("方法3がタイムアウトしました".to_string());
                }
            }
        } else {
            eprintln!("[WARN] vLLMインストール: 仮想環境のPythonが見つかりません。方法3をスキップします。");
        }
    }

    // すべての方法が失敗した場合
    if !install_success {
        let error_details = last_error.unwrap_or_else(|| "不明なエラー".to_string());
        return Err(AppError::ProcessError {
            message: format!(
                "vLLMのインストールに失敗しました（3つの方法すべてを試行しました）。\n\n\
                試行した方法:\n\
                1. グローバルインストール (pip install vllm)\n\
                2. ユーザー権限インストール (pip install --user vllm)\n\
                3. 仮想環境インストール (venv使用)\n\n\
                最後のエラー: {}\n\n\
                手動でインストールするには、ターミナルで以下のコマンドを実行してください:\n\
                {} -m pip install vllm\n\
                または\n\
                {} -m pip install --user vllm",
                error_details, python_cmd, python_cmd
            ),
            source_detail: None,
        });
    }
    
    eprintln!("[DEBUG] vLLMインストール: インストール成功 (方法: {})", used_method);

    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 90.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("インストールを確認しています...".to_string()),
    })?;

    // Python環境の更新を待つ（パッケージキャッシュの更新など）
    eprintln!("[DEBUG] vLLMインストール: Python環境の更新を待機中...");
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // インストールが成功したか確認（最大3回リトライ）
    let mut verify_success = false;
    let mut last_verify_error: Option<String> = None;
    
    eprintln!("[DEBUG] vLLMインストール: 検証に使用するPython: {}", verify_python_cmd);
    
    for retry in 0..3 {
        eprintln!("[DEBUG] vLLMインストール: 検証試行 {} / 3", retry + 1);
        
        // 各リトライ時に進捗を更新
        progress_callback(EngineDownloadProgress {
            status: "installing".to_string(),
            progress: 90.0 + (retry as f64 * 3.0), // 90%, 93%, 96%
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bytes_per_sec: 0.0,
            message: Some(format!("インストールを確認しています... (試行 {}/3)", retry + 1)),
        })?;
        
        let verify_output = AsyncCommand::new(&verify_python_cmd)
            .arg("-c")
            .arg("import vllm; print('OK')")
            .output()
            .await;

        match verify_output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                eprintln!("[DEBUG] vLLMインストール: 検証成功 - {}", stdout);
                verify_success = true;
                break;
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let error_msg = format!("検証失敗 (試行 {}): stderr={}, stdout={}", retry + 1, stderr, stdout);
                eprintln!("[DEBUG] vLLMインストール: {}", error_msg);
                last_verify_error = Some(error_msg);
                
                // 最後の試行でない場合は待機してからリトライ
                if retry < 2 {
                    eprintln!("[DEBUG] vLLMインストール: {}秒待機してからリトライ...", (retry + 1) * 2);
                    tokio::time::sleep(tokio::time::Duration::from_secs((retry + 1) * 2)).await;
                }
            }
            Err(e) => {
                let error_msg = format!("検証コマンド実行エラー (試行 {}): {}", retry + 1, e);
                eprintln!("[DEBUG] vLLMインストール: {}", error_msg);
                last_verify_error = Some(error_msg);
                
                if retry < 2 {
                    tokio::time::sleep(tokio::time::Duration::from_secs((retry + 1) * 2)).await;
                }
            }
        }
    }

    if verify_success {
        progress_callback(EngineDownloadProgress {
            status: "completed".to_string(),
            progress: 100.0,
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bytes_per_sec: 0.0,
            message: Some("vLLMのインストールが完了しました".to_string()),
        })?;
        Ok("vllm".to_string())
    } else {
        // 検証に失敗した場合でも、インストールコマンド自体は成功している可能性がある
        // 詳細なエラー情報を提供
        let error_details = last_verify_error.unwrap_or_else(|| "不明なエラー".to_string());
        eprintln!("[WARN] vLLMインストール: 検証に失敗しましたが、インストールは完了している可能性があります。詳細: {}", error_details);
        
        // エラーとして返すが、メッセージには「可能性がある」ことを明記
        Err(AppError::ProcessError {
            message: format!(
                "vLLMのインストールコマンドは完了しましたが、検証に失敗しました。\n\
                インストールは成功している可能性がありますが、確認できませんでした。\n\
                詳細: {}\n\n\
                手動で確認するには、ターミナルで以下のコマンドを実行してください:\n\
                {} -c \"import vllm; print(vllm.__version__)\"",
                error_details, verify_python_cmd
            ),
            source_detail: None,
        })
    }
}

/// llama.cppのインストール
pub async fn install_llama_cpp<F>(mut progress_callback: F) -> Result<String, AppError>
where
    F: FnMut(EngineDownloadProgress) -> Result<(), AppError>,
{
    progress_callback(EngineDownloadProgress {
        status: "downloading".to_string(),
        progress: 0.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("llama.cppのダウンロードURLを取得しています...".to_string()),
    })?;

    // llama.cppのダウンロードURLを取得
    let download_url = match get_llama_cpp_download_url().await {
        Ok(url) => url,
        Err(e) => {
            return Err(AppError::ApiError {
                message: format!(
                    "llama.cppのダウンロードURL取得に失敗しました: {}\n\nGitHub APIへの接続を確認してください。",
                    e
                ),
                code: "DOWNLOAD_URL_ERROR".to_string(),
                source_detail: None,
            });
        }
    };

    progress_callback(EngineDownloadProgress {
        status: "downloading".to_string(),
        progress: 5.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("llama.cppをダウンロードしています...".to_string()),
    })?;

    // アプリデータディレクトリを取得
    let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
        message: format!("アプリデータディレクトリ取得エラー: {}", e),
        source_detail: None,
    })?;

    let llama_cpp_dir = app_data_dir.join("llama_cpp");
    fs::create_dir_all(&llama_cpp_dir).map_err(|e| AppError::IoError {
        message: format!("llama.cppディレクトリ作成エラー: {}\n\nディスク容量と書き込み権限を確認してください。", e),
        source_detail: None,
    })?;

    // 一時的なzipファイルのパス
    let zip_file = llama_cpp_dir.join("llama-cpp.zip");

    // zipファイルをダウンロード
    if let Err(e) = download_file_with_progress(&download_url, &zip_file, &mut progress_callback).await {
        // ダウンロード失敗時のエラーメッセージを改善
        let error_msg = if e.to_string().contains("timeout") || e.to_string().contains("タイムアウト") {
            format!("llama.cppのダウンロードがタイムアウトしました。ネットワーク接続を確認してください。\n\nエラー: {}", e)
        } else if e.to_string().contains("No space") || e.to_string().contains("disk full") {
            format!("ディスク容量が不足しています。空き容量を確保してから再度お試しください。\n\nエラー: {}", e)
        } else {
            format!("llama.cppのダウンロードに失敗しました: {}", e)
        };
        return Err(AppError::ApiError {
            message: error_msg,
            code: "DOWNLOAD_ERROR".to_string(),
            source_detail: None,
        });
    }

    // zipファイルを展開
    progress_callback(EngineDownloadProgress {
        status: "extracting".to_string(),
        progress: 50.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("llama.cppを展開しています...".to_string()),
    })?;

    let zip_file_handle = std::fs::File::open(&zip_file).map_err(|e| AppError::IoError {
        message: format!("zipファイルを開けません: {}\n\nダウンロードしたファイルが破損している可能性があります。", e),
        source_detail: None,
    })?;

    let mut archive = zip::ZipArchive::new(zip_file_handle).map_err(|e| AppError::IoError {
        message: format!("zipファイルの読み込みエラー: {}\n\nダウンロードしたファイルが破損している可能性があります。", e),
        source_detail: None,
    })?;

    // ZIPファイル内のファイルリストを事前に確認（デバッグ用）
    let total_files = archive.len();
    eprintln!("[DEBUG] llama.cpp ZIPファイル内のファイル数: {}", total_files);
    let mut zip_file_list = Vec::new();
    for i in 0..total_files.min(20) { // 最初の20ファイルのみ表示
        if let Ok(file) = archive.by_index(i) {
            zip_file_list.push(file.name().to_string());
        }
    }
    if total_files > 20 {
        eprintln!("[DEBUG] ZIPファイル内の最初の20ファイル: {:?}", zip_file_list);
        eprintln!("[DEBUG] ... 他{}ファイル", total_files - 20);
    } else {
        eprintln!("[DEBUG] ZIPファイル内の全ファイル: {:?}", zip_file_list);
    }

    // 一時展開ディレクトリを作成
    let extract_dir = llama_cpp_dir.join("extracted");
    fs::create_dir_all(&extract_dir).map_err(|e| AppError::IoError {
        message: format!("展開ディレクトリ作成エラー: {}", e),
        source_detail: None,
    })?;

    // ZIPファイル全体を展開
    for i in 0..total_files {
        // 展開進捗を更新（60%から80%まで）
        let extract_progress = 60.0 + ((i as f64 / total_files as f64) * 20.0);
        progress_callback(EngineDownloadProgress {
            status: "extracting".to_string(),
            progress: extract_progress,
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bytes_per_sec: 0.0,
            message: Some(format!("ファイルを展開しています... ({}/{} files)", i + 1, total_files)),
        })?;

        let mut file = archive.by_index(i).map_err(|e| AppError::IoError {
            message: format!("zipファイル内のファイル読み込みエラー: {}", e),
            source_detail: None,
        })?;

        let file_path = file.name();
        // 危険なパス（パストラバーサル）を防ぐ
        let out_path = extract_dir.join(file_path);
        if !out_path.starts_with(&extract_dir) {
            continue; // パストラバーサルをスキップ
        }

        // ディレクトリの場合は作成
        if file_path.ends_with('/') {
            fs::create_dir_all(&out_path).ok();
        } else {
            // ファイルの場合は展開
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut out_file = std::fs::File::create(&out_path).ok();
            if let Some(ref mut f) = out_file {
                std::io::copy(&mut file, f).ok();
            }
        }
    }

    // 実行ファイル名の候補を定義（より包括的なリスト）
    #[cfg(target_os = "windows")]
    let exe_candidates = vec![
        "llama-server.exe",
        "server.exe",
        "llama-cpp-server.exe",
        "llama-cli.exe",
        "llama.exe",
        "main.exe",
        "bin/llama-server.exe",
        "bin/server.exe",
        "build/bin/llama-server.exe",
        "build/bin/server.exe",
    ];
    #[cfg(not(target_os = "windows"))]
    let exe_candidates = vec![
        "llama-server",
        "server",
        "llama-cpp-server",
        "llama-cli",
        "llama",
        "main",
        "bin/llama-server",
        "bin/server",
        "build/bin/llama-server",
        "build/bin/server",
    ];

    // 展開されたディレクトリから実行ファイルを再帰的に検索
    progress_callback(EngineDownloadProgress {
        status: "extracting".to_string(),
        progress: 80.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("実行ファイルを検索しています...".to_string()),
    })?;

    eprintln!("[DEBUG] llama.cpp 実行ファイル検索開始: extract_dir={:?}", extract_dir);
    let mut found_exe: Option<PathBuf> = None;
    
    // まず、候補リストから探す（完全一致を優先）
    for exe_name in &exe_candidates {
        let candidate_path = extract_dir.join(exe_name);
        eprintln!("[DEBUG] llama.cpp 候補ファイルを確認: {:?}", candidate_path);
        if candidate_path.exists() && candidate_path.is_file() {
            eprintln!("[DEBUG] llama.cpp 実行ファイルが見つかりました: {:?}", candidate_path);
            found_exe = Some(candidate_path.clone());
            break;
        }
    }

    // 候補リストで見つからない場合、再帰的に検索
    if found_exe.is_none() {
        fn find_executable(dir: &PathBuf, candidates: &[&str]) -> Option<PathBuf> {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(found) = find_executable(&path, candidates) {
                            return Some(found);
                        }
                    } else if path.is_file() {
                        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                        #[cfg(target_os = "windows")]
                        let is_exe = file_name.ends_with(".exe");
                        #[cfg(not(target_os = "windows"))]
                        let is_exe = !file_name.contains('.') && !file_name.ends_with("/");
                        
                        if is_exe {
                            // 候補名と一致するか、または"server"や"llama"を含む実行ファイルを探す
                            let matches = candidates.iter().any(|&cand| {
                                file_name == cand || file_name.contains(cand.trim_end_matches(".exe"))
                            }) || (file_name.contains("server") || file_name.contains("llama"));
                            
                            if matches {
                                return Some(path);
                            }
                        }
                    }
                }
            }
            None
        }
        
        let exe_candidates_str: Vec<&str> = exe_candidates.iter().map(|s| s.as_ref()).collect();
        eprintln!("[DEBUG] llama.cpp 再帰的検索を開始");
        found_exe = find_executable(&extract_dir, &exe_candidates_str);
        if let Some(ref path) = found_exe {
            eprintln!("[DEBUG] llama.cpp 再帰的検索で実行ファイルが見つかりました: {:?}", path);
        }
    }

    // まだ見つからない場合、.exeファイル（Windows）または実行可能ファイル（Unix）を全て探す
    if found_exe.is_none() {
        fn find_any_executable(dir: &PathBuf) -> Option<PathBuf> {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(found) = find_any_executable(&path) {
                            return Some(found);
                        }
                    } else if path.is_file() {
                        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                        #[cfg(target_os = "windows")]
                        let is_exe = file_name.ends_with(".exe");
                        #[cfg(not(target_os = "windows"))]
                        let is_exe = !file_name.contains('.') && !file_name.ends_with("/");
                        
                        if is_exe {
                            // ファイルサイズが大きいもの（実行ファイルの可能性が高い）を優先
                            if let Ok(metadata) = fs::metadata(&path) {
                                if metadata.len() > 1000 {
                                    return Some(path);
                                }
                            }
                        }
                    }
                }
            }
            None
        }
        
        eprintln!("[DEBUG] llama.cpp 全実行ファイル検索を開始");
        found_exe = find_any_executable(&extract_dir);
        if let Some(ref path) = found_exe {
            eprintln!("[DEBUG] llama.cpp 全実行ファイル検索で実行ファイルが見つかりました: {:?}", path);
        }
    }

    let exe_path = match found_exe {
        Some(path) => path,
        None => {
            // 見つからなかった場合、展開されたディレクトリの内容をリストアップ
            let mut file_list = Vec::new();
            fn collect_files(dir: &PathBuf, prefix: &str, list: &mut Vec<String>, max_depth: usize) {
                if max_depth == 0 {
                    return;
                }
                if let Ok(entries) = fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                        let display_path = format!("{}{}", prefix, name);
                        
                        if path.is_dir() {
                            list.push(format!("{}/", display_path));
                            collect_files(&path, &format!("{}  ", prefix), list, max_depth - 1);
                        } else {
                            #[cfg(target_os = "windows")]
                            let is_exe = name.ends_with(".exe");
                            #[cfg(not(target_os = "windows"))]
                            let is_exe = !name.contains('.') && !name.ends_with("/");
                            
                            if is_exe {
                                list.push(format!("  [実行ファイル候補] {}", display_path));
                            } else {
                                list.push(format!("  {}", display_path));
                            }
                        }
                    }
                }
            }
            collect_files(&extract_dir, "", &mut file_list, 5); // 深さを5に増やしてより多くのファイルを表示
            
            // ZIPファイル内のファイルリストも追加
            let mut zip_contents = String::new();
            zip_contents.push_str("\n\nZIPファイル内のファイル構造:\n");
            for (i, file_name) in zip_file_list.iter().take(30).enumerate() {
                zip_contents.push_str(&format!("  {}. {}\n", i + 1, file_name));
            }
            if total_files > 30 {
                zip_contents.push_str(&format!("  ... 他{}ファイル\n", total_files - 30));
            }
            
            let file_list_str = if file_list.is_empty() {
                "（ファイルリストを取得できませんでした）".to_string()
            } else {
                format!("展開されたディレクトリ内のファイル:\n{}", file_list.join("\n"))
            };
            
            // 展開ディレクトリをクリーンアップ
            let _ = fs::remove_dir_all(&extract_dir);
            
            eprintln!("[ERROR] llama.cpp 実行ファイルが見つかりませんでした");
            eprintln!("[ERROR] 検索した候補: {:?}", exe_candidates);
            eprintln!("[ERROR] ZIPファイル内のファイル数: {}", total_files);
            
            return Err(AppError::IoError {
                message: format!(
                    "展開されたファイル内に実行ファイルが見つかりませんでした。\n\n\
                    検索した候補: {}\n\n\
                    {}\n\
                    {}\n\n\
                    トラブルシューティング:\n\
                    1. llama.cppのリリースファイル構造が変更された可能性があります\n\
                    2. ダウンロードしたZIPファイルが破損している可能性があります\n\
                    3. 手動でインストールする場合は、llama.cppの公式サイトからダウンロードしてください\n\
                    \n\
                    詳細なログはコンソールに出力されています。",
                    exe_candidates.join(", "),
                    file_list_str,
                    zip_contents
                ),
                source_detail: None,
            });
        }
    };

    // 見つかった実行ファイルを最終的な場所にコピー
    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 85.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("実行ファイルを配置しています...".to_string()),
    })?;

    let exe_name = exe_path.file_name().and_then(|n| n.to_str()).ok_or_else(|| AppError::IoError {
        message: "実行ファイル名を取得できませんでした".to_string(),
        source_detail: None,
    })?;
    
    eprintln!("[DEBUG] llama.cpp 実行ファイル名: {}", exe_name);
    eprintln!("[DEBUG] llama.cpp ソースパス: {:?}", exe_path);
    
    let download_file = llama_cpp_dir.join(exe_name);
    eprintln!("[DEBUG] llama.cpp コピー先パス: {:?}", download_file);
    
    // ソースファイルの存在確認
    if !exe_path.exists() {
        eprintln!("[ERROR] llama.cpp ソースファイルが存在しません: {:?}", exe_path);
        return Err(AppError::IoError {
            message: format!("ソース実行ファイルが見つかりません: {}", exe_path.display()),
            source_detail: None,
        });
    }
    
    // ファイルサイズを確認
    if let Ok(metadata) = fs::metadata(&exe_path) {
        eprintln!("[DEBUG] llama.cpp ソースファイルサイズ: {} bytes", metadata.len());
    }
    
    // コピー実行
    eprintln!("[DEBUG] llama.cpp ファイルコピーを開始...");
    fs::copy(&exe_path, &download_file).map_err(|e| {
        eprintln!("[ERROR] llama.cpp ファイルコピーエラー: {}", e);
        eprintln!("[ERROR] ソース: {:?}", exe_path);
        eprintln!("[ERROR] コピー先: {:?}", download_file);
        AppError::IoError {
            message: format!("実行ファイルのコピーエラー: {}\n\nソース: {}\nコピー先: {}\n\n書き込み権限を確認してください。", e, exe_path.display(), download_file.display()),
            source_detail: None,
        }
    })?;
    eprintln!("[DEBUG] llama.cpp ファイルコピー成功");

    // 展開ディレクトリをクリーンアップ
    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 90.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("一時ファイルをクリーンアップしています...".to_string()),
    })?;

    let _ = fs::remove_dir_all(&extract_dir);
    
    // 一時zipファイルを削除
    let _ = std::fs::remove_file(&zip_file);

    // 実行ファイルのパス

    // 実行ファイルが存在するか確認
    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 93.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("インストールを確認しています...".to_string()),
    })?;

    eprintln!("[DEBUG] llama.cpp インストール確認: コピー先ファイルの存在確認");
    if !download_file.exists() {
        eprintln!("[ERROR] llama.cpp コピー先ファイルが存在しません: {:?}", download_file);
        return Err(AppError::IoError {
            message: format!("実行ファイルが作成されませんでした: {}\n\nコピー処理は完了したはずですが、ファイルが見つかりません。", download_file.display()),
            source_detail: None,
        });
    }
    
    // ファイルサイズを確認
    if let Ok(metadata) = fs::metadata(&download_file) {
        eprintln!("[DEBUG] llama.cpp インストール完了: ファイルサイズ={} bytes, パス={:?}", metadata.len(), download_file);
    } else {
        eprintln!("[WARN] llama.cpp ファイルメタデータの取得に失敗");
    }

    // 実行権限を設定（Unix系OS）
    progress_callback(EngineDownloadProgress {
        status: "installing".to_string(),
        progress: 96.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("実行権限を設定しています...".to_string()),
    })?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&download_file)
            .map_err(|e| AppError::IoError {
                message: format!("ファイル情報取得エラー: {}", e),
                source_detail: None,
            })?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&download_file, perms).map_err(|e| AppError::IoError {
            message: format!("実行権限設定エラー: {}", e),
            source_detail: None,
        })?;
    }

    progress_callback(EngineDownloadProgress {
        status: "completed".to_string(),
        progress: 100.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bytes_per_sec: 0.0,
        message: Some("llama.cppのインストールが完了しました".to_string()),
    })?;

    Ok(download_file.to_string_lossy().to_string())
}

/// llama.cppのダウンロードURLを取得（複数のリリースを試す）
async fn get_llama_cpp_download_url() -> Result<String, AppError> {
    let client = crate::utils::http_client::create_http_client()?;
    
    // まず最新リリースを試す
    let mut releases_to_try = vec!["latest".to_string()];
    
    // 最新リリースが失敗した場合、過去のリリースも試す
    // まず最新リリースのリストを取得
    let releases_response = client
        .get("https://api.github.com/repos/ggerganov/llama.cpp/releases?per_page=5")
        .header("User-Agent", "FLM/1.0")
        .send()
        .await;
    
    if let Ok(resp) = releases_response {
        if resp.status().is_success() {
            if let Ok(releases_json) = resp.json::<serde_json::Value>().await {
                if let Some(releases_array) = releases_json.as_array() {
                    for release in releases_array.iter().take(3) {
                        if let Some(tag) = release.get("tag_name").and_then(|t| t.as_str()) {
                            if tag != "latest" {
                                releases_to_try.push(tag.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 各リリースを順番に試す
    let mut last_error: Option<AppError> = None;
    for release_tag in &releases_to_try {
        let url = if release_tag == "latest" {
            "https://api.github.com/repos/ggerganov/llama.cpp/releases/latest".to_string()
        } else {
            format!("https://api.github.com/repos/ggerganov/llama.cpp/releases/tags/{}", release_tag)
        };
        
        let response = client
            .get(&url)
            .header("User-Agent", "FLM/1.0")
            .send()
            .await;
        
        match response {
            Ok(resp) if resp.status().is_success() => {
                let json: serde_json::Value = match resp.json().await {
                    Ok(j) => j,
                    Err(e) => {
                        last_error = Some(AppError::ApiError {
                            message: format!("JSON解析エラー: {}", e),
                            code: "JSON_ERROR".to_string(),
                            source_detail: None,
                        });
                        continue;
                    }
                };
                
                // このリリースからアセットを取得を試みる
                match extract_download_url_from_release(&json) {
                    Ok(download_url) => return Ok(download_url),
                    Err(e) => {
                        last_error = Some(e);
                        continue;
                    }
                }
            }
            Ok(resp) => {
                last_error = Some(AppError::ApiError {
                    message: format!("GitHub APIエラー: HTTP {}", resp.status()),
                    code: resp.status().as_u16().to_string(),
                    source_detail: None,
                });
                continue;
            }
            Err(e) => {
                last_error = Some(AppError::ApiError {
                    message: format!("GitHub API接続エラー: {}", e),
                    code: "DOWNLOAD_ERROR".to_string(),
                    source_detail: None,
                });
                continue;
            }
        }
    }
    
    // すべてのリリースで失敗した場合
    Err(last_error.unwrap_or_else(|| AppError::ApiError {
        message: "すべてのリリースでアセットが見つかりませんでした".to_string(),
        code: "ALL_RELEASES_FAILED".to_string(),
        source_detail: None,
    }))
}

/// リリースJSONからダウンロードURLを抽出
fn extract_download_url_from_release(json: &serde_json::Value) -> Result<String, AppError> {

    // アセットからプラットフォームに応じたファイルを選択
    let assets = json["assets"]
        .as_array()
        .ok_or_else(|| AppError::ApiError {
            message: "リリース情報にアセットが見つかりません".to_string(),
            code: "ASSET_NOT_FOUND".to_string(),
            source_detail: None,
        })?;

    // プラットフォームに応じたファイル名パターンを定義（より柔軟な検索）
    // 実際のllama.cppリリースでは様々な形式があるため、多くのパターンを試す
    #[cfg(target_os = "windows")]
    let platform_patterns = vec![
        // 標準的なパターン
        "-win-cpu-x64.zip",
        "-win-x64.zip",
        "win-cpu-x64.zip",
        "win-x64.zip",
        // llama-bで始まるパターン（実際のリリースでよく見られる形式）
        "llama-b",
        "-win",
        "windows",
        // CUDA/Vulkan版
        "-win-cuda-x64.zip",
        "-win-vulkan-x64.zip",
        "win-cuda",
        "win-vulkan",
        // より柔軟な検索（最後の手段）
        ".zip",  // すべてのZIPファイルを候補に（プラットフォームフィルタリングは後で行う）
    ];
    #[cfg(target_os = "macos")]
    let platform_patterns = vec![
        "-macos-x64.zip",
        "-macos-arm64.zip",
        "macos-x64.zip",
        "macos-arm64.zip",
        "llama-b",
        "-macos",
        "macos",
        ".zip",
    ];
    #[cfg(target_os = "linux")]
    let platform_patterns = vec![
        "-ubuntu-x64.zip",
        "-ubuntu-vulkan-x64.zip",
        "ubuntu-x64.zip",
        "ubuntu-vulkan-x64.zip",
        "llama-b",
        "-linux",
        "-ubuntu",
        "linux",
        "ubuntu",
        ".zip",
    ];
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let platform_patterns = vec!["-x64.zip", "x64.zip", "llama-b", ".zip"];

    // 優先順位に従ってファイルを検索
    let mut found_assets = Vec::new();
    let mut all_zip_assets = Vec::new(); // フォールバック用に全ZIPファイルを保持
    
    // まず全ZIPファイルを収集
    for asset in assets.iter() {
        if let (Some(name), Some(url)) = (
            asset["name"].as_str(),
            asset["browser_download_url"].as_str(),
        ) {
            if name.ends_with(".zip") {
                all_zip_assets.push((name.to_string(), url.to_string()));
            }
        }
    }
    
    // パターンマッチングで検索
    for pattern in &platform_patterns {
        // ".zip"パターンの場合は、プラットフォーム固有のフィルタリングを適用
        if pattern == &".zip" {
            for (name, url) in &all_zip_assets {
                #[cfg(target_os = "windows")]
                let is_platform_match = name.contains("win") || name.contains("windows") || name.contains("x64");
                #[cfg(target_os = "macos")]
                let is_platform_match = name.contains("macos") || name.contains("darwin") || name.contains("arm64") || name.contains("x64");
                #[cfg(target_os = "linux")]
                let is_platform_match = name.contains("linux") || name.contains("ubuntu") || name.contains("x64");
                #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
                let is_platform_match = true;
                
                if is_platform_match && !name.contains("source") && !name.contains("src") {
                    found_assets.push((name.clone(), url.clone()));
                }
            }
        } else {
            for asset in assets.iter() {
                if let (Some(name), Some(url)) = (
                    asset["name"].as_str(),
                    asset["browser_download_url"].as_str(),
                ) {
                    if name.contains(pattern) && name.ends_with(".zip") {
                        // ソースコードや不要なファイルを除外
                        if !name.contains("source") && !name.contains("src") {
                            found_assets.push((name.to_string(), url.to_string()));
                        }
                    }
                }
            }
        }
        if !found_assets.is_empty() {
            break;
        }
    }

    // 見つかったアセットから最初のものを選択
    let download_url = found_assets
        .first()
        .map(|(_, url)| url.clone())
        .ok_or_else(|| {
            // エラーメッセージに利用可能なアセット名を表示
            let available_assets: Vec<String> = assets
                .iter()
                .filter_map(|asset| asset["name"].as_str().map(|s| s.to_string()))
                .collect();
            AppError::ApiError {
                message: format!(
                    "プラットフォーム用のアセットが見つかりません。\n\n\
                    検索パターン: {:?}\n\
                    利用可能なアセット: {}",
                    platform_patterns,
                    if available_assets.is_empty() {
                        "（アセット情報を取得できませんでした）".to_string()
                    } else {
                        available_assets.join(", ")
                    }
                ),
                code: "PLATFORM_ASSET_NOT_FOUND".to_string(),
                source_detail: None,
            }
        })?;

    Ok(download_url)
}

/// ファイルをダウンロードして進捗をコールバック
async fn download_file_with_progress<F>(
    url: &str,
    file_path: &PathBuf,
    progress_callback: &mut F,
) -> Result<(), AppError>
where
    F: FnMut(EngineDownloadProgress) -> Result<(), AppError>,
{
    let client = crate::utils::http_client::create_http_client_long_timeout()?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("ダウンロード開始エラー: {}", e),
            code: "DOWNLOAD_ERROR".to_string(),
            source_detail: None,
        })?;

    if !response.status().is_success() {
        return Err(AppError::ApiError {
            message: format!("ダウンロードエラー: HTTP {}", response.status()),
            code: response.status().as_u16().to_string(),
            source_detail: None,
        });
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(file_path)
        .await
        .map_err(|e| AppError::IoError {
            message: format!("ファイル作成エラー: {}", e),
            source_detail: None,
        })?;

    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = response.chunk().await.map_err(|e| AppError::ApiError {
        message: format!("ダウンロード中のエラー: {}", e),
        code: "DOWNLOAD_CHUNK_ERROR".to_string(),
        source_detail: None,
    })? {
        file.write_all(&chunk)
            .await
            .map_err(|e| AppError::IoError {
                message: format!("ファイル書き込みエラー: {}", e),
                source_detail: None,
            })?;

        downloaded += chunk.len() as u64;
        let elapsed = start_time.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 {
            downloaded as f64 / elapsed
        } else {
            0.0
        };
        let progress = if total_bytes > 0 {
            (downloaded as f64 / total_bytes as f64) * 100.0
        } else {
            0.0
        };

        progress_callback(EngineDownloadProgress {
            status: "downloading".to_string(),
            progress,
            downloaded_bytes: downloaded,
            total_bytes,
            speed_bytes_per_sec: speed,
            message: None,
        })?;
    }

    Ok(())
}
