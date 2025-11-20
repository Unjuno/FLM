//! Model listing use case

use crate::domain::*;
use crate::error::Result;
use crate::ports::ModelRepository;

/// モデル一覧取得ユースケース
pub struct ModelListUseCase<R: ModelRepository> {
    repository: R,
}

impl<R: ModelRepository> ModelListUseCase<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    /// エンジンIDでモデルを取得
    pub async fn list_by_engine(&self, engine_id: &EngineId) -> Result<Vec<Model>> {
        self.repository.find_by_engine(engine_id).await
    }

    /// 全モデルを取得
    pub async fn list_all(&self) -> Result<Vec<Model>> {
        self.repository.find_all().await
    }
}
