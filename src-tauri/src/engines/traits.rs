// LLM Engine Trait
// エンジン抽象化のためのトレイト定義

use super::models::{EngineConfig, EngineDetectionResult, ModelInfo};
use crate::utils::error::AppError;

/// LLMエンジンの統一インターフェース
#[allow(async_fn_in_trait)] // async fn in trait はこのプロジェクト内でのみ使用
pub trait LLMEngine: Send + Sync {
    /// エンジン名を取得
    fn name(&self) -> &str;

    /// エンジンタイプを取得（'ollama', 'lm_studio', 'vllm', 'llama_cpp'など）
    fn engine_type(&self) -> &str;

    /// エンジンを検出
    async fn detect(&self) -> Result<EngineDetectionResult, AppError>;

    /// エンジンを起動
    async fn start(&self, config: &EngineConfig) -> Result<u32, AppError>;

    /// エンジンを停止
    async fn stop(&self) -> Result<(), AppError>;

    /// 実行中かチェック
    async fn is_running(&self) -> Result<bool, AppError>;

    /// インストール済みモデル一覧を取得
    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError>;

    /// エンジンのベースURLを取得
    fn get_base_url(&self) -> String;

    /// デフォルトポートを取得
    fn default_port(&self) -> u16;

    /// OpenAI互換APIエンドポイントかチェック
    fn supports_openai_compatible_api(&self) -> bool;
}
