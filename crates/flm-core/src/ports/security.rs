//! Security repository trait

use crate::domain::security::{ApiKeyRecord, SecurityPolicy};
use crate::error::RepoError;

/// Security repository trait
pub trait SecurityRepository {
    fn save_api_key(&self, key: ApiKeyRecord) -> Result<(), RepoError>;
    fn fetch_api_key(&self, id: &str) -> Result<Option<ApiKeyRecord>, RepoError>;
    fn list_api_keys(&self) -> Result<Vec<ApiKeyRecord>, RepoError>;
    fn mark_api_key_revoked(&self, id: &str, revoked_at: &str) -> Result<(), RepoError>;

    fn save_policy(&self, policy: SecurityPolicy) -> Result<(), RepoError>;
    fn fetch_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError>;
    fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError>;
}
