//! Security repository trait

use crate::domain::security::{ApiKeyRecord, SecurityPolicy};
use crate::error::RepoError;

/// Security repository trait
#[async_trait::async_trait(?Send)]
pub trait SecurityRepository {
    async fn save_api_key(&self, key: ApiKeyRecord) -> Result<(), RepoError>;
    async fn fetch_api_key(&self, id: &str) -> Result<Option<ApiKeyRecord>, RepoError>;
    async fn list_api_keys(&self) -> Result<Vec<ApiKeyRecord>, RepoError>;
    async fn mark_api_key_revoked(&self, id: &str, revoked_at: &str) -> Result<(), RepoError>;

    async fn save_policy(&self, policy: SecurityPolicy) -> Result<(), RepoError>;
    async fn fetch_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError>;
    async fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError>;
}
