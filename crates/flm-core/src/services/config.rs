//! Config service
//!
//! See `docs/CORE_API.md` section 5 for the complete specification.

use crate::error::RepoError;
use crate::ports::ConfigRepository;

/// Config service
pub struct ConfigService {
    // TODO: Add config repository field
}

impl ConfigService {
    /// Create a new ConfigService
    #[allow(clippy::new_without_default)]
    pub fn new(// TODO: Add config repository parameter
    ) -> Self {
        // TODO: Initialize with injected dependencies
        Self {}
    }

    /// Get a config value
    pub fn get(&self, _key: &str) -> Result<Option<String>, RepoError> {
        // TODO: Implement config get
        todo!("Implement config get")
    }

    /// Set a config value
    pub fn set(&self, _key: &str, _value: &str) -> Result<(), RepoError> {
        // TODO: Implement config set
        todo!("Implement config set")
    }

    /// List all config values
    pub fn list(&self) -> Result<Vec<(String, String)>, RepoError> {
        // TODO: Implement config list
        todo!("Implement config list")
    }
}
