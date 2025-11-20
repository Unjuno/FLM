//! Abstract ports (Repository, HTTP, etc.)

use crate::domain::*;
use crate::error::Result;
use async_trait::async_trait;

/// エンジンリポジトリポート
///
/// why: Domain層からインフラ層への依存を逆転させるためのtrait。
/// alt: 直接SQLiteを呼ぶ案もあったが、テスタビリティとドメイン純粋性を優先。
#[async_trait]
pub trait EngineRepository: Send + Sync {
    /// エンジンを保存
    async fn save(&self, engine: &Engine) -> Result<()>;

    /// エンジンIDで取得
    async fn find_by_id(&self, id: &EngineId) -> Result<Option<Engine>>;

    /// 全エンジンを取得
    async fn find_all(&self) -> Result<Vec<Engine>>;

    /// エンジンを削除
    async fn delete(&self, id: &EngineId) -> Result<()>;
}

/// モデルリポジトリポート
#[async_trait]
pub trait ModelRepository: Send + Sync {
    /// モデルを保存
    async fn save(&self, model: &Model) -> Result<()>;

    /// モデルIDで取得
    async fn find_by_id(&self, id: &ModelId) -> Result<Option<Model>>;

    /// エンジンIDで検索
    async fn find_by_engine(&self, engine_id: &EngineId) -> Result<Vec<Model>>;

    /// 全モデルを取得
    async fn find_all(&self) -> Result<Vec<Model>>;
}

/// プロキシリポジトリポート
#[async_trait]
pub trait ProxyRepository: Send + Sync {
    /// プロファイルを保存
    async fn save(&self, profile: &ProxyProfile) -> Result<()>;

    /// プロファイルIDで取得
    async fn find_by_id(&self, id: &str) -> Result<Option<ProxyProfile>>;

    /// 全プロファイルを取得
    async fn find_all(&self) -> Result<Vec<ProxyProfile>>;

    /// プロファイルを削除
    async fn delete(&self, id: &str) -> Result<()>;
}

/// セキュリティリポジトリポート
#[async_trait]
pub trait SecurityRepository: Send + Sync {
    /// APIキーを保存
    async fn save_api_key(&self, api_key: &ApiKey) -> Result<()>;

    /// APIキーを検索（ハッシュで）
    async fn find_api_key_by_hash(&self, hash: &str) -> Result<Option<ApiKey>>;

    /// セキュリティポリシーを保存
    async fn save_policy(&self, policy: &SecurityPolicy) -> Result<()>;

    /// セキュリティポリシーを取得
    async fn find_policy_by_id(&self, id: &str) -> Result<Option<SecurityPolicy>>;
}

// async_traitが必要なため、Cargo.tomlに追加が必要
