//! Configuration repository trait

use crate::error::RepoError;

/// Configuration repository trait
#[async_trait::async_trait(?Send)]
pub trait ConfigRepository {
    async fn get(&self, key: &str) -> Result<Option<String>, RepoError>;
    async fn set(&self, key: &str, value: &str) -> Result<(), RepoError>;
    async fn list(&self) -> Result<Vec<(String, String)>, RepoError>;
}
