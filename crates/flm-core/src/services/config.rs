//! Config service
//!
//! See `docs/CORE_API.md` section 5 for the complete specification.

use crate::error::RepoError;
use crate::ports::ConfigRepository;

/// Config service
///
/// This service provides configuration management functionality.
/// It delegates to a ConfigRepository for persistence.
pub struct ConfigService<R>
where
    R: ConfigRepository,
{
    repo: R,
}

impl<R> ConfigService<R>
where
    R: ConfigRepository,
{
    /// Create a new ConfigService
    ///
    /// # Arguments
    /// * `repo` - The configuration repository to use
    #[allow(clippy::new_without_default)]
    pub fn new(repo: R) -> Self {
        Self { repo }
    }

    /// Get a config value
    ///
    /// # Arguments
    /// * `key` - The configuration key
    ///
    /// # Returns
    /// * `Ok(Some(value))` if the key exists
    /// * `Ok(None)` if the key does not exist
    /// * `Err(RepoError)` if an error occurs
    pub async fn get(&self, key: &str) -> Result<Option<String>, RepoError> {
        self.repo.get(key).await
    }

    /// Set a config value
    ///
    /// # Arguments
    /// * `key` - The configuration key
    /// * `value` - The configuration value
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(RepoError)` if an error occurs
    pub async fn set(&self, key: &str, value: &str) -> Result<(), RepoError> {
        self.repo.set(key, value).await
    }

    /// List all config values
    ///
    /// # Returns
    /// * `Ok(Vec<(key, value)>)` on success
    /// * `Err(RepoError)` if an error occurs
    pub async fn list(&self) -> Result<Vec<(String, String)>, RepoError> {
        self.repo.list().await
    }
}
