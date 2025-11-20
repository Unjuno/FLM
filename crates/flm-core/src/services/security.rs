//! Security service
//!
//! See `docs/CORE_API.md` section 5 for the complete specification.

use crate::domain::security::{ApiKeyMetadata, PlainAndHashedApiKey, SecurityPolicy};
use crate::error::RepoError;
use crate::ports::SecurityRepository;

/// Security service
pub struct SecurityService {
    // TODO: Add security repository field
}

impl SecurityService {
    /// Create a new SecurityService
    #[allow(clippy::new_without_default)]
    pub fn new(// TODO: Add security repository parameter
    ) -> Self {
        // TODO: Initialize with injected dependencies
        Self {}
    }

    /// List all security policies
    pub fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError> {
        // TODO: Implement policy listing
        todo!("Implement policy listing")
    }

    /// Get a specific policy
    pub fn get_policy(&self, _id: &str) -> Result<Option<SecurityPolicy>, RepoError> {
        // TODO: Implement policy retrieval
        todo!("Implement policy retrieval")
    }

    /// Set/update a security policy
    pub fn set_policy(&self, _policy: SecurityPolicy) -> Result<(), RepoError> {
        // TODO: Implement policy update
        todo!("Implement policy update")
    }

    /// Create a new API key
    pub fn create_api_key(&self, _label: &str) -> Result<PlainAndHashedApiKey, RepoError> {
        // TODO: Implement API key creation with Argon2 hashing
        todo!("Implement API key creation")
    }

    /// Revoke an API key
    pub fn revoke_api_key(&self, _id: &str) -> Result<(), RepoError> {
        // TODO: Implement API key revocation
        todo!("Implement API key revocation")
    }

    /// List all API keys (metadata only, no hashes)
    pub fn list_api_keys(&self) -> Result<Vec<ApiKeyMetadata>, RepoError> {
        // TODO: Implement API key listing
        todo!("Implement API key listing")
    }

    /// Rotate an API key
    pub fn rotate_api_key(
        &self,
        _id: &str,
        _new_label: Option<&str>,
    ) -> Result<PlainAndHashedApiKey, RepoError> {
        // TODO: Implement API key rotation
        todo!("Implement API key rotation")
    }
}
