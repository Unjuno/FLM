//! Security repository trait

use crate::domain::security::{ApiKeyRecord, SecurityPolicy};
use crate::error::RepoError;
use async_trait::async_trait;

/// Security repository trait
#[async_trait]
pub trait SecurityRepository: Send + Sync {
    async fn save_api_key(&self, key: ApiKeyRecord) -> Result<(), RepoError>;
    async fn fetch_api_key(&self, id: &str) -> Result<Option<ApiKeyRecord>, RepoError>;
    async fn list_api_keys(&self) -> Result<Vec<ApiKeyRecord>, RepoError>;
    /// List only active (non-revoked) API keys
    ///
    /// This is an optimization for `verify_api_key()` to avoid checking revoked keys.
    /// Default implementation filters `list_api_keys()` results, but implementations
    /// can override this to use a more efficient database query.
    async fn list_active_api_keys(&self) -> Result<Vec<ApiKeyRecord>, RepoError> {
        let all_keys = self.list_api_keys().await?;
        Ok(all_keys
            .into_iter()
            .filter(|key| key.revoked_at.is_none())
            .collect())
    }
    async fn mark_api_key_revoked(&self, id: &str, revoked_at: &str) -> Result<(), RepoError>;

    async fn save_policy(&self, policy: SecurityPolicy) -> Result<(), RepoError>;
    async fn fetch_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError>;
    async fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError>;
}
