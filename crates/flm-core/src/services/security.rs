//! Security service
//!
//! See `docs/CORE_API.md` section 5 for the complete specification.

use crate::domain::security::{ApiKeyMetadata, ApiKeyRecord, PlainAndHashedApiKey, SecurityPolicy};
use crate::error::RepoError;
use crate::ports::SecurityRepository;
use chrono::Utc;
use std::sync::Arc;

/// Security service
///
/// This service provides security management functionality including
/// API key management and security policy management.
pub struct SecurityService<R>
where
    R: SecurityRepository,
{
    repo: Arc<R>,
}

impl<R> SecurityService<R>
where
    R: SecurityRepository,
{
    /// Create a new SecurityService
    ///
    /// # Arguments
    /// * `repo` - The security repository to use
    #[allow(clippy::new_without_default)]
    pub fn new(repo: R) -> Self {
        Self {
            repo: Arc::new(repo),
        }
    }

    /// List all security policies
    ///
    /// # Returns
    /// * `Ok(Vec<SecurityPolicy>)` on success
    /// * `Err(RepoError)` if an error occurs
    pub fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError> {
        self.repo.list_policies()
    }

    /// Get a specific policy
    ///
    /// # Arguments
    /// * `id` - The policy ID (Phase 1/2: always "default")
    ///
    /// # Returns
    /// * `Ok(Some(policy))` if the policy exists
    /// * `Ok(None)` if the policy does not exist
    /// * `Err(RepoError)` if an error occurs
    pub fn get_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError> {
        self.repo.fetch_policy(id)
    }

    /// Set/update a security policy
    ///
    /// # Arguments
    /// * `policy` - The security policy to save
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(RepoError)` if an error occurs
    pub fn set_policy(&self, policy: SecurityPolicy) -> Result<(), RepoError> {
        self.repo.save_policy(policy)
    }

    /// Create a new API key
    ///
    /// # Arguments
    /// * `label` - A human-readable label for the API key
    ///
    /// # Returns
    /// * `Ok(PlainAndHashedApiKey)` containing the plain text key and record
    /// * `Err(RepoError)` if an error occurs
    ///
    /// # Note
    /// The plain text key is only returned once on creation.
    /// It should be displayed to the user and then discarded.
    pub fn create_api_key(&self, label: &str) -> Result<PlainAndHashedApiKey, RepoError> {
        // Generate a random API key
        let plain_key = generate_api_key();

        // Hash the key using Argon2
        let hash = hash_api_key(&plain_key)?;

        // Create the API key record
        let id = generate_key_id();
        let created_at = Utc::now().to_rfc3339();
        let record = ApiKeyRecord {
            id: id.clone(),
            label: label.to_string(),
            hash,
            created_at,
            revoked_at: None,
        };

        // Save to repository
        self.repo.save_api_key(record.clone())?;

        Ok(PlainAndHashedApiKey {
            plain: plain_key,
            record,
        })
    }

    /// Revoke an API key
    ///
    /// # Arguments
    /// * `id` - The API key ID to revoke
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(RepoError)` if an error occurs
    pub fn revoke_api_key(&self, id: &str) -> Result<(), RepoError> {
        let revoked_at = Utc::now().to_rfc3339();
        self.repo.mark_api_key_revoked(id, &revoked_at)
    }

    /// List all API keys (metadata only, no hashes)
    ///
    /// # Returns
    /// * `Ok(Vec<ApiKeyMetadata>)` on success
    /// * `Err(RepoError)` if an error occurs
    pub fn list_api_keys(&self) -> Result<Vec<ApiKeyMetadata>, RepoError> {
        let records = self.repo.list_api_keys()?;
        Ok(records
            .into_iter()
            .map(|record| ApiKeyMetadata {
                id: record.id,
                label: record.label,
                created_at: record.created_at,
                revoked_at: record.revoked_at,
            })
            .collect())
    }

    /// Rotate an API key
    ///
    /// This revokes the old key and creates a new one.
    ///
    /// # Arguments
    /// * `id` - The API key ID to rotate
    /// * `new_label` - Optional new label (if None, uses the old label)
    ///
    /// # Returns
    /// * `Ok(PlainAndHashedApiKey)` containing the new plain text key and record
    /// * `Err(RepoError)` if an error occurs
    pub fn rotate_api_key(
        &self,
        id: &str,
        new_label: Option<&str>,
    ) -> Result<PlainAndHashedApiKey, RepoError> {
        // Fetch the old key to get the label
        let old_key = self.repo.fetch_api_key(id)?;
        let label = if let Some(new_label) = new_label {
            new_label.to_string()
        } else if let Some(ref old) = old_key {
            old.label.clone()
        } else {
            return Err(RepoError::NotFound {
                key: id.to_string(),
            });
        };

        // Revoke the old key
        self.revoke_api_key(id)?;

        // Create a new key with the same or new label
        self.create_api_key(&label)
    }
}

/// Generate a random API key
///
/// This generates a secure random API key string.
fn generate_api_key() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const KEY_LENGTH: usize = 32;

    let mut rng = rand::thread_rng();
    (0..KEY_LENGTH)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Generate a unique API key ID
fn generate_key_id() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"0123456789abcdef";
    const ID_LENGTH: usize = 16;

    let mut rng = rand::thread_rng();
    format!(
        "key_{}",
        (0..ID_LENGTH)
            .map(|_| {
                let idx = rng.gen_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect::<String>()
    )
}

/// Hash an API key using Argon2
///
/// # Arguments
/// * `plain_key` - The plain text API key to hash
///
/// # Returns
/// * `Ok(String)` containing the hashed key
/// * `Err(RepoError)` if hashing fails
fn hash_api_key(plain_key: &str) -> Result<String, RepoError> {
    use argon2::password_hash::{rand_core::OsRng, PasswordHasher, SaltString};
    use argon2::Argon2;

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let password_hash = argon2
        .hash_password(plain_key.as_bytes(), &salt)
        .map_err(|e| RepoError::IoError {
            reason: format!("Failed to hash API key: {e}"),
        })?;

    Ok(password_hash.to_string())
}
