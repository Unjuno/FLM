//! Configuration repository trait

use crate::error::RepoError;

/// Configuration repository trait
pub trait ConfigRepository {
    fn get(&self, key: &str) -> Result<Option<String>, RepoError>;
    fn set(&self, key: &str, value: &str) -> Result<(), RepoError>;
    fn list(&self) -> Result<Vec<(String, String)>, RepoError>;
}
