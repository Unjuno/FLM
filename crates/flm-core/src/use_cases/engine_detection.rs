//! Engine detection use case

use crate::domain::*;
use crate::error::Result;

/// エンジン検出ユースケース
///
/// why: エンジン検出ロジックをドメイン層に集約。
/// assumption: 各エンジンのAPI仕様は docs/ENGINE_DETECT.md に記載された通りとする。
pub struct EngineDetectionUseCase {
    // 今後、HTTPクライアントポートを依存注入
}

impl EngineDetectionUseCase {
    pub fn new() -> Self {
        Self {}
    }

    /// エンジンを検出
    ///
    /// why: 対象エンジンのヘルスチェックエンドポイントを呼び出し、状態を判定。
    /// evidence: docs/ENGINE_DETECT.md 参照
    pub async fn detect(&self, _base_url: &str, _engine_type: EngineType) -> Result<Engine> {
        // TODO: HTTPクライアントでヘルスチェック実行
        // TODO: レスポンスから EngineStatus を判定
        todo!("Implement engine detection logic")
    }

    /// 全対応エンジンを自動検出
    pub async fn detect_all(&self) -> Result<Vec<Engine>> {
        // TODO: Ollama, vLLM, LM Studio, llama.cpp の各デフォルトポートをスキャン
        todo!("Implement auto-detection for all engines")
    }
}
