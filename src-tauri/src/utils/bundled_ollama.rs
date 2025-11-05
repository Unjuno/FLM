// Bundled Ollama Module
// アプリバンドル方式: FLMインストーラーにOllamaバイナリを含める機能

use crate::utils::error::AppError;
use std::path::PathBuf;
use std::fs;

/// バンドルされたOllamaバイナリのパスを取得
/// TauriアプリのリソースディレクトリからOllamaバイナリを探す
pub fn get_bundled_ollama_path() -> Result<Option<PathBuf>, AppError> {
    // Tauriアプリの実行可能ファイルのディレクトリを取得
    let exe_path = std::env::current_exe()
        .map_err(|e| AppError::IoError {
            message: format!("実行ファイルパス取得エラー: {}", e),
        })?;
    
    let exe_dir = exe_path.parent()
        .ok_or_else(|| AppError::IoError {
            message: "実行ファイルの親ディレクトリが取得できませんでした".to_string(),
        })?;
    
    // バンドルされたOllamaバイナリのパスを構築
    // Windows: exe_dir/ollama/ollama.exe
    // macOS/Linux: exe_dir/ollama/ollama
    let ollama_dir = exe_dir.join("ollama");
    
    if !ollama_dir.exists() {
        return Ok(None);
    }
    
    #[cfg(target_os = "windows")]
    {
        let ollama_path = ollama_dir.join("ollama.exe");
        if ollama_path.exists() {
            return Ok(Some(ollama_path));
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        let ollama_path = ollama_dir.join("ollama");
        if ollama_path.exists() {
            // 実行権限を確認
            let metadata = fs::metadata(&ollama_path).map_err(|e| AppError::IoError {
                message: format!("Ollamaバイナリのメタデータ取得エラー: {}", e),
            })?;
            
            // 実行権限がない場合は設定を試みる
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = metadata.permissions();
                perms.set_mode(0o755); // rwxr-xr-x
                fs::set_permissions(&ollama_path, perms).map_err(|e| AppError::IoError {
                    message: format!("Ollamaバイナリの実行権限設定エラー: {}", e),
                })?;
            }
            
            return Ok(Some(ollama_path));
        }
    }
    
    Ok(None)
}

/// バンドルされたOllamaバイナリのバージョンを取得
pub fn get_bundled_ollama_version() -> Result<Option<String>, AppError> {
    if let Some(ollama_path) = get_bundled_ollama_path()? {
        // Ollamaバイナリのバージョンを取得
        let output = std::process::Command::new(&ollama_path)
            .arg("--version")
            .output()
            .map_err(|e| AppError::IoError {
                message: format!("Ollamaバージョン取得エラー: {}", e),
            })?;
        
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Ok(Some(version));
        }
    }
    
    Ok(None)
}

/// バンドルされたOllamaバイナリが利用可能かチェック
pub fn is_bundled_ollama_available() -> bool {
    get_bundled_ollama_path().map(|opt| opt.is_some()).unwrap_or(false)
}

/// バンドルされたOllamaバイナリを使用する優先度を取得
/// バンドル版は最優先で使用される
pub fn get_ollama_priority() -> Vec<OllamaSource> {
    vec![
        OllamaSource::Bundled,  // 最優先: バンドル版
        OllamaSource::Portable, // 次: ポータブル版
        OllamaSource::System,   // 最後: システムインストール版
    ]
}

/// Ollamaのソースタイプ
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OllamaSource {
    Bundled,  // バンドル版（アプリに同梱）
    Portable, // ポータブル版（アプリデータディレクトリ）
    System,   // システムインストール版
}

impl OllamaSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            OllamaSource::Bundled => "bundled",
            OllamaSource::Portable => "portable",
            OllamaSource::System => "system",
        }
    }
}

/// Ollamaの検出結果
#[derive(Debug, Clone)]
pub struct OllamaDetectionResult {
    pub source: OllamaSource,
    pub path: PathBuf,
    pub version: Option<String>,
    pub available: bool,
}

/// 優先順位に従ってOllamaを検出
pub fn detect_ollama_by_priority() -> Result<Option<OllamaDetectionResult>, AppError> {
    let priorities = get_ollama_priority();
    
    for source in priorities {
        match source {
            OllamaSource::Bundled => {
                if let Some(path) = get_bundled_ollama_path()? {
                    let version = get_bundled_ollama_version().ok().flatten();
                    return Ok(Some(OllamaDetectionResult {
                        source,
                        path,
                        version,
                        available: true,
                    }));
                }
            },
            OllamaSource::Portable => {
                // ポータブル版の検出はollama.rsで実装済み
                // ここではスキップ（既存の実装を使用）
            },
            OllamaSource::System => {
                // システムインストール版の検出はollama.rsで実装済み
                // ここではスキップ（既存の実装を使用）
            },
        }
    }
    
    Ok(None)
}

