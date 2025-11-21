//! Configuration repository trait

use crate::error::RepoError;
use async_trait::async_trait;

/// Configuration repository trait
#[async_trait]
pub trait ConfigRepository: Send + Sync {
    async fn get(&self, key: &str) -> Result<Option<String>, RepoError>;
    async fn set(&self, key: &str, value: &str) -> Result<(), RepoError>;
    async fn list(&self) -> Result<Vec<(String, String)>, RepoError>;
}
