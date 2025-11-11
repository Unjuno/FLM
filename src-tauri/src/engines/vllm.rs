// vLLM Engine Implementation
// vLLMエンジンのLLMEngineトレイト実装

use super::models::{EngineConfig, EngineDetectionResult, ModelInfo};
use super::traits::LLMEngine;
use crate::utils::error::AppError;
use std::process::Command;

pub struct VLLMEngine;

impl VLLMEngine {
    pub fn new() -> Self {
        VLLMEngine
    }

    /// vLLMがインストールされているかチェック
    async fn check_vllm_installed() -> Option<String> {
        // Python環境でvllmがインストールされているかチェック
        let output = Command::new("python")
            .arg("-c")
            .arg("import vllm; print(vllm.__file__)")
            .output()
            .ok()?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Some(path);
        }

        // Python3を試す
        let output = Command::new("python3")
            .arg("-c")
            .arg("import vllm; print(vllm.__file__)")
            .output()
            .ok()?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Some(path);
        }

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
        let output = match Command::new("docker")
            .arg("ps")
            .arg("--filter")
            .arg("name=vllm")
            .arg("--format")
            .arg("{{.Names}}")
            .output()
        {
            Ok(o) => o,
            Err(_) => return false,
        };

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return !stdout.trim().is_empty();
        }

        false
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
        let python_installed = Self::check_vllm_installed().await.is_some();
        let docker_running = Self::check_docker_container().await;
        let running = self.is_running().await.unwrap_or(false);

        // バージョン取得: Pythonパッケージから取得を試みる
        let version = if python_installed {
            Self::get_version_from_python().await.ok()
        } else if running {
            Self::get_version_from_api().await.ok()
        } else {
            None
        };

        Ok(EngineDetectionResult {
            engine_type: "vllm".to_string(),
            installed: python_installed || docker_running,
            running,
            version,
            path: if python_installed {
                Self::check_vllm_installed().await
            } else {
                None
            },
            message: if !python_installed && !docker_running {
                Some("vLLMがインストールされていません。PythonパッケージまたはDockerコンテナとしてインストールしてください。".to_string())
            } else if !running {
                Some("vLLMが起動していません。".to_string())
            } else {
                None
            },
            portable: None,
        })
    }

    // 注意: get_version_from_apiはLLMEngineトレイトに定義されていないため削除
    // 必要に応じて、将来的にトレイトに追加するか、別の関数として実装

    async fn start(&self, _config: &EngineConfig) -> Result<u32, AppError> {
        // vLLMは通常、ユーザーが手動で起動する必要がある
        // ここではDockerコンテナの起動を試みる
        if Self::check_vllm_installed().await.is_some() {
            return Err(AppError::ApiError {
                message: "vLLMは手動で起動してください。例: python -m vllm.entrypoints.openai.api_server --model <model_name>".to_string(),
                code: "MANUAL_START_REQUIRED".to_string(),
                source_detail: None,
            });
        }

        Err(AppError::ApiError {
            message: "vLLMが見つかりません。先にインストールしてください。".to_string(),
            code: "NOT_INSTALLED".to_string(),
            source_detail: None,
        })
    }

    async fn stop(&self) -> Result<(), AppError> {
        // vLLMは手動で停止する必要がある
        Err(AppError::ApiError {
            message: "vLLMは手動で停止してください。".to_string(),
            code: "MANUAL_STOP_REQUIRED".to_string(),
            source_detail: None,
        })
    }

    async fn is_running(&self) -> Result<bool, AppError> {
        // vLLMのAPIサーバーが起動しているかチェック
        let client = crate::utils::http_client::create_http_client_short_timeout()?;
        let response = client.get("http://localhost:8000/v1/models").send().await;

        match response {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => Ok(false),
        }
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
