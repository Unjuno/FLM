// Ollama Engine Implementation
// OllamaエンジンのLLMEngineトレイト実装

use super::models::{EngineConfig, EngineDetectionResult, ModelInfo};
use super::traits::LLMEngine;
use crate::ollama::{self as ollama_module, current_ollama_base_url, current_ollama_host_port};
use crate::utils::error::AppError;
use regex::Regex;

/// デバッグビルドでのみログを出力するマクロ
#[cfg(debug_assertions)]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        eprintln!("[DEBUG] {}", format!($($arg)*))
    };
}

#[cfg(not(debug_assertions))]
macro_rules! debug_log {
    ($($arg:tt)*) => {};
}

/// 警告ログを出力するマクロ（常に出力）
macro_rules! warn_log {
    ($($arg:tt)*) => {
        eprintln!("[WARN] {}", format!($($arg)*));
    };
}

/// エラーログを出力するマクロ（常に出力）
macro_rules! error_log {
    ($($arg:tt)*) => {
        eprintln!("[ERROR] {}", format!($($arg)*))
    };
}

pub struct OllamaEngine;

impl OllamaEngine {
    pub fn new() -> Self {
        OllamaEngine
    }
}

impl LLMEngine for OllamaEngine {
    fn name(&self) -> &str {
        "Ollama"
    }

    fn engine_type(&self) -> &str {
        "ollama"
    }

    async fn detect(&self) -> Result<EngineDetectionResult, AppError> {
        debug_log!("OllamaEngine::detect 開始");

        // ollama_module::detect_ollama()を呼び出す
        let ollama_result = match ollama_module::detect_ollama().await {
            Ok(result) => {
                debug_log!("ollama_module::detect_ollama() 成功");
                result
            }
            Err(e) => {
                warn_log!("ollama_module::detect_ollama() 失敗: {:?}", e);
                // 接続エラーの場合は、インストール状態のみを確認して続行
                // エラー型で接続エラーかどうかを判定
                if e.is_connection_error() {
                    warn_log!("API接続エラーが発生しましたが、検出を続行します");
                    // 最小限の情報で続行（インストール状態は不明）
                    ollama_module::OllamaDetectionResult {
                        installed: false,
                        running: false,
                        portable: false,
                        version: None,
                        portable_path: None,
                        system_path: None,
                    }
                } else {
                    // その他のエラーはそのまま返す
                    return Err(e);
                }
            }
        };

        debug_log!("Ollama検出結果: installed={}, portable={}, running={}, portable_path={:?}, system_path={:?}", 
            ollama_result.installed, 
            ollama_result.portable, 
            ollama_result.running,
            ollama_result.portable_path,
            ollama_result.system_path);

        // バンドル版が検出されているか確認
        use crate::utils::bundled_ollama;
        match bundled_ollama::get_bundled_ollama_path() {
            Ok(Some(bundled_path)) => {
                debug_log!("バンドル版Ollamaが検出されました: {:?}", bundled_path);
            }
            Ok(_none) => {
                debug_log!("バンドル版Ollamaは見つかりませんでした");
            }
            Err(e) => {
                warn_log!("バンドル版Ollamaの検出エラー: {:?}", e);
            }
        }

        let installed = ollama_result.installed || ollama_result.portable;
        let path = ollama_result.portable_path.or(ollama_result.system_path);

        debug_log!(
            "EngineDetectionResult作成: installed={}, running={}, path={:?}",
            installed,
            ollama_result.running,
            path
        );

        // エラーメッセージの生成
        let message = if !installed {
            Some("Ollamaがインストールされていません。ホーム画面から「Ollamaセットアップ」を実行するか、Ollama公式サイト（https://ollama.ai）からインストールしてください。".to_string())
        } else if !ollama_result.running {
            // インストールされているが起動していない場合
            Some("Ollamaはインストールされていますが、起動していません。ホーム画面から「Ollamaセットアップ」を実行して起動してください。".to_string())
        } else {
            None
        };

        let result = EngineDetectionResult {
            engine_type: "ollama".to_string(),
            installed,
            running: ollama_result.running,
            version: ollama_result.version,
            path,
            message,
            portable: Some(ollama_result.portable),
        };

        debug_log!(
            "OllamaEngine::detect 完了: installed={}, running={}",
            result.installed,
            result.running
        );
        Ok(result)
    }

    async fn start(&self, config: &EngineConfig) -> Result<u32, AppError> {
        let ollama_path = config.executable_path.clone();
        debug_log!(
            "OllamaEngine::start 開始: executable_path={:?}",
            ollama_path
        );
        debug_log!("バンドル版Ollamaの検出を試みます...");

        // バンドル版が存在するか確認
        use crate::utils::bundled_ollama;
        match bundled_ollama::get_bundled_ollama_path() {
            Ok(Some(bundled_path)) => {
                debug_log!("バンドル版Ollamaが見つかりました: {:?}", bundled_path);
                if bundled_path.exists() {
                    debug_log!("バンドル版Ollamaファイルが存在します");
                    debug_log!("注意: executable_pathが指定されている場合、そのパスが優先されます");
                } else {
                    warn_log!("バンドル版Ollamaファイルが存在しません: {:?}", bundled_path);
                }
            }
            Ok(_none) => {
                debug_log!("バンドル版Ollamaが見つかりませんでした");
            }
            Err(e) => {
                warn_log!("バンドル版Ollamaの検出エラー: {:?}", e);
            }
        }

        debug_log!("start_ollamaを呼び出します: ollama_path={:?}", ollama_path);
        let result = ollama_module::start_ollama(ollama_path).await;

        match &result {
            Ok(pid) => {
                debug_log!("OllamaEngine::start 成功: PID={}", pid);
            }
            Err(e) => {
                error_log!("OllamaEngine::start 失敗: {:?}", e);
            }
        }

        result
    }

    async fn stop(&self) -> Result<(), AppError> {
        ollama_module::stop_ollama().await
    }

    async fn is_running(&self) -> Result<bool, AppError> {
        ollama_module::check_ollama_running().await
    }

    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        // Ollama APIからモデル一覧を取得
        let client = crate::utils::http_client::create_http_client()?;
        let base_url = self.get_base_url();
        let url = format!("{}/api/tags", base_url);

        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Ollama APIリクエストエラー: {}", e),
                code: "API_ERROR".to_string(),
                source_detail: Some(format!("{:?}", e)),
            })?;

        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("Ollama APIエラー: {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }

        let tags: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: Some(format!("{:?}", e)),
        })?;

        let models = tags["models"]
            .as_array()
            .ok_or_else(|| AppError::ModelError {
                message: "モデル一覧の形式が不正です".to_string(),
                source_detail: None,
            })?
            .iter()
            .filter_map(|m| {
                // モデル名が必須のため、取得できない場合はスキップ
                let name = match m["name"].as_str() {
                    Some(n) if !n.is_empty() => n.to_string(),
                    _ => {
                        warn_log!("モデル名が取得できませんでした。スキップします。");
                        return None;
                    }
                };
                let parameter_size = extract_parameter_size(&name);

                Some(ModelInfo {
                    name,
                    size: m["size"].as_u64(),
                    modified_at: m["modified_at"].as_str().map(|s| s.to_string()),
                    parameter_size,
                })
            })
            .collect();

        Ok(models)
    }

    fn get_base_url(&self) -> String {
        current_ollama_base_url()
    }

    fn default_port(&self) -> u16 {
        current_ollama_host_port().1
    }

    fn supports_openai_compatible_api(&self) -> bool {
        true
    }
}

/// モデル名からパラメータサイズを抽出
fn extract_parameter_size(model_name: &str) -> Option<String> {
    // モデル名からパラメータ数を推定（例: "llama3:8b" -> "8B", "mistral:7b" -> "7B"）
    let re = Regex::new(r"(\d+)[bB]").ok()?;
    if let Some(captures) = re.captures(model_name) {
        if let Some(size) = captures.get(1) {
            return Some(format!("{}B", size.as_str()));
        }
    }
    None
}
