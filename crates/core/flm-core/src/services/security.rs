//! Security service
//!
//! See `docs/CORE_API.md` section 5 for the complete specification.

use crate::domain::security::{
    ApiKeyMetadata, ApiKeyRecord, DnsCredentialProfile, PlainAndHashedApiKey, SecurityPolicy,
};
use crate::error::RepoError;
use crate::ports::SecurityRepository;
use chrono::Utc;
use std::net::IpAddr;
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
    pub async fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError> {
        self.repo.list_policies().await
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
    pub async fn get_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError> {
        self.repo.fetch_policy(id).await
    }

    /// Set/update a security policy
    ///
    /// # Arguments
    /// * `policy` - The security policy to save
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(RepoError)` if an error occurs (including validation errors)
    ///
    /// # Errors
    /// Returns `RepoError::ValidationError` if the policy JSON contains invalid IP addresses or CIDR notation
    pub async fn set_policy(&self, policy: SecurityPolicy) -> Result<(), RepoError> {
        // Validate IP whitelist in policy_json
        validate_security_policy(&policy.policy_json)?;
        self.repo.save_policy(policy).await
    }

    /// Validate a domain name
    ///
    /// # Arguments
    /// * `domain` - The domain name to validate
    ///
    /// # Returns
    /// * `Ok(true)` if the domain is valid
    /// * `Ok(false)` if the domain is invalid
    /// * `Err(RepoError)` if an error occurs during validation
    ///
    /// # Validation Rules
    /// - Domain must be between 1 and 253 characters
    /// - Domain must contain only alphanumeric characters, hyphens, and dots
    /// - Domain must not start or end with a hyphen or dot
    /// - Domain must have at least one dot (for TLD)
    /// - Each label (part between dots) must be between 1 and 63 characters
    pub fn validate_domain(domain: &str) -> Result<bool, RepoError> {
        // Basic length check
        if domain.is_empty() || domain.len() > 253 {
            return Ok(false);
        }

        // Check for valid characters (alphanumeric, hyphen, dot)
        if !domain
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '.')
        {
            return Ok(false);
        }

        // Must not start or end with hyphen or dot
        if domain.starts_with('-')
            || domain.starts_with('.')
            || domain.ends_with('-')
            || domain.ends_with('.')
        {
            return Ok(false);
        }

        // Must contain at least one dot (for TLD)
        if !domain.contains('.') {
            return Ok(false);
        }

        // Split into labels and validate each
        let labels: Vec<&str> = domain.split('.').collect();
        for label in labels {
            // Each label must be 1-63 characters
            if label.is_empty() || label.len() > 63 {
                return Ok(false);
            }
            // Label must not start or end with hyphen
            if label.starts_with('-') || label.ends_with('-') {
                return Ok(false);
            }
        }

        Ok(true)
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
    pub async fn create_api_key(&self, label: &str) -> Result<PlainAndHashedApiKey, RepoError> {
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
        self.repo.save_api_key(record.clone()).await?;

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
    pub async fn revoke_api_key(&self, id: &str) -> Result<(), RepoError> {
        let revoked_at = Utc::now().to_rfc3339();
        self.repo.mark_api_key_revoked(id, &revoked_at).await
    }

    /// List all API keys (metadata only, no hashes)
    ///
    /// # Returns
    /// * `Ok(Vec<ApiKeyMetadata>)` on success
    /// * `Err(RepoError)` if an error occurs
    pub async fn list_api_keys(&self) -> Result<Vec<ApiKeyMetadata>, RepoError> {
        let records = self.repo.list_api_keys().await?;
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
    pub async fn rotate_api_key(
        &self,
        id: &str,
        new_label: Option<&str>,
    ) -> Result<PlainAndHashedApiKey, RepoError> {
        // Fetch the old key to get the label
        let old_key = self.repo.fetch_api_key(id).await?;
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
        self.revoke_api_key(id).await?;

        // Create a new key with the same or new label
        self.create_api_key(&label).await
    }

    /// Verify an API key
    ///
    /// This checks if the provided plain text API key matches any stored key.
    ///
    /// # Arguments
    /// * `plain_key` - The plain text API key to verify
    ///
    /// # Returns
    /// * `Ok(Some(ApiKeyRecord))` if the key is valid and not revoked
    /// * `Ok(None)` if the key is invalid or revoked
    /// * `Err(RepoError)` if an error occurs
    ///
    /// # Security Note
    /// To prevent timing attacks, this function verifies all keys before returning.
    /// This ensures that the verification time is constant regardless of which key matches,
    /// preventing attackers from inferring key positions or existence through timing analysis.
    pub async fn verify_api_key(&self, plain_key: &str) -> Result<Option<ApiKeyRecord>, RepoError> {
        // Get only active (non-revoked) API keys for better performance
        let records = self.repo.list_active_api_keys().await?;

        // Check all keys to prevent timing attacks
        // We verify all keys before returning to ensure constant-time verification
        // regardless of which key (if any) matches
        let mut matched_record: Option<ApiKeyRecord> = None;
        for record in records {
            // Verify the hash using Argon2 (hash is already in the record)
            // Argon2 verification itself is constant-time, but we still verify all keys
            // to prevent timing information leakage about key position
            if verify_api_key_hash(plain_key, &record.hash)? {
                matched_record = Some(record.clone());
            }
        }

        // Return result only after all keys have been verified
        Ok(matched_record)
    }

    /// Create a DNS credential profile (metadata only; secrets live in OS keyring)
    pub async fn create_dns_credential(
        &self,
        provider: &str,
        label: &str,
        zone_id: &str,
        zone_name: Option<String>,
    ) -> Result<DnsCredentialProfile, RepoError> {
        validate_dns_provider(provider)?;
        validate_dns_label(label)?;
        validate_zone_id(zone_id)?;

        let now = Utc::now().to_rfc3339();
        let profile = DnsCredentialProfile {
            id: generate_dns_profile_id(provider),
            provider: provider.to_ascii_lowercase(),
            label: label.trim().to_string(),
            zone_id: zone_id.trim().to_string(),
            zone_name: zone_name
                .map(|z| z.trim().to_string())
                .filter(|z| !z.is_empty()),
            created_at: now.clone(),
            updated_at: now,
        };

        self.repo.upsert_dns_credential(profile.clone()).await?;
        Ok(profile)
    }

    /// Update an existing DNS credential profile (metadata)
    pub async fn update_dns_credential(
        &self,
        mut profile: DnsCredentialProfile,
    ) -> Result<DnsCredentialProfile, RepoError> {
        validate_dns_provider(&profile.provider)?;
        validate_dns_label(&profile.label)?;
        validate_zone_id(&profile.zone_id)?;
        profile.provider = profile.provider.to_ascii_lowercase();
        profile.label = profile.label.trim().to_string();
        profile.zone_id = profile.zone_id.trim().to_string();
        profile.zone_name = profile.zone_name.and_then(|z| {
            let trimmed = z.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });
        profile.updated_at = Utc::now().to_rfc3339();
        self.repo.upsert_dns_credential(profile.clone()).await?;
        Ok(profile)
    }

    /// Retrieve a DNS credential profile
    pub async fn get_dns_credential(
        &self,
        id: &str,
    ) -> Result<Option<DnsCredentialProfile>, RepoError> {
        self.repo.fetch_dns_credential(id).await
    }

    /// List DNS credential profiles
    pub async fn list_dns_credentials(&self) -> Result<Vec<DnsCredentialProfile>, RepoError> {
        self.repo.list_dns_credentials().await
    }

    /// Delete DNS credential profile metadata
    pub async fn delete_dns_credential(&self, id: &str) -> Result<(), RepoError> {
        self.repo.delete_dns_credential(id).await
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

/// Verify an API key against a stored hash
///
/// # Arguments
/// * `plain_key` - The plain text API key to verify
/// * `stored_hash` - The stored Argon2 hash
///
/// # Returns
/// * `Ok(true)` if the key matches
/// * `Ok(false)` if the key does not match
/// * `Err(RepoError)` if verification fails
fn verify_api_key_hash(plain_key: &str, stored_hash: &str) -> Result<bool, RepoError> {
    use argon2::password_hash::{PasswordHash, PasswordVerifier};
    use argon2::Argon2;

    let parsed_hash = PasswordHash::new(stored_hash).map_err(|e| RepoError::IoError {
        reason: format!("Failed to parse stored hash: {e}"),
    })?;

    let argon2 = Argon2::default();
    match argon2.verify_password(plain_key.as_bytes(), &parsed_hash) {
        Ok(()) => Ok(true),
        Err(argon2::password_hash::Error::Password) => Ok(false),
        Err(e) => Err(RepoError::IoError {
            reason: format!("Failed to verify API key: {e}"),
        }),
    }
}

fn validate_dns_provider(provider: &str) -> Result<(), RepoError> {
    let normalized = provider.to_ascii_lowercase();
    match normalized.as_str() {
        "cloudflare" => Ok(()),
        _ => Err(RepoError::ValidationError {
            reason: format!(
                "Unsupported DNS provider '{provider}'. Supported providers: cloudflare"
            ),
        }),
    }
}

fn validate_dns_label(label: &str) -> Result<(), RepoError> {
    let trimmed = label.trim();
    if trimmed.is_empty() {
        return Err(RepoError::ValidationError {
            reason: "Label must not be empty".to_string(),
        });
    }
    if trimmed.len() > 80 {
        return Err(RepoError::ValidationError {
            reason: "Label must be at most 80 characters".to_string(),
        });
    }
    Ok(())
}

fn validate_zone_id(zone_id: &str) -> Result<(), RepoError> {
    if zone_id.trim().is_empty() {
        return Err(RepoError::ValidationError {
            reason: "zone_id must not be empty".to_string(),
        });
    }
    Ok(())
}

fn generate_dns_profile_id(provider: &str) -> String {
    let normalized = provider.to_ascii_lowercase();
    let short = uuid::Uuid::new_v4()
        .to_string()
        .split('-')
        .next()
        .unwrap_or_default()
        .to_string();
    format!("dns_{normalized}_{short}")
}

/// Validate security policy JSON
///
/// Validates IP whitelist entries (IP addresses and CIDR notation).
/// Returns `RepoError::ValidationError` if validation fails.
fn validate_security_policy(policy_json: &str) -> Result<(), RepoError> {
    use serde_json::Value;

    let policy: Value =
        serde_json::from_str(policy_json).map_err(|e| RepoError::ValidationError {
            reason: format!("Invalid JSON: {e}"),
        })?;

    // Validate ip_whitelist if present
    if let Some(ip_whitelist) = policy.get("ip_whitelist") {
        if let Some(ip_list) = ip_whitelist.as_array() {
            for (idx, ip_entry) in ip_list.iter().enumerate() {
                if let Some(ip_str) = ip_entry.as_str() {
                    validate_ip_or_cidr(ip_str).map_err(|e| RepoError::ValidationError {
                        reason: format!("Invalid IP whitelist entry at index {idx}: {e}"),
                    })?;
                } else {
                    return Err(RepoError::ValidationError {
                        reason: format!(
                            "Invalid IP whitelist entry at index {idx}: expected string, got {ip_entry}"
                        ),
                    });
                }
            }
        } else if !ip_whitelist.is_null() {
            return Err(RepoError::ValidationError {
                reason: "ip_whitelist must be an array or null".to_string(),
            });
        }
    }

    // Validate acme_domain if present
    if let Some(acme_domain) = policy.get("acme_domain") {
        if let Some(domain_str) = acme_domain.as_str() {
            if !domain_str.is_empty() {
                // Use validate_domain_name for validation (same as CORS validation)
                validate_domain_name(domain_str).map_err(|e| RepoError::ValidationError {
                    reason: format!("Invalid ACME domain name: {e}"),
                })?;
            }
        } else if !acme_domain.is_null() {
            return Err(RepoError::ValidationError {
                reason: "acme_domain must be a string or null".to_string(),
            });
        }
    }

    // Validate CORS allowed_origins if present
    if let Some(cors) = policy.get("cors") {
        if let Some(allowed_origins) = cors.get("allowed_origins") {
            if let Some(origins_array) = allowed_origins.as_array() {
                for (idx, origin_entry) in origins_array.iter().enumerate() {
                    if let Some(origin_str) = origin_entry.as_str() {
                        // Validate domain name format (basic validation)
                        if !origin_str.is_empty() && origin_str != "*" {
                            // CORS origin can be a URL (http://example.com:3000) or domain (example.com)
                            // Extract domain part for validation
                            let domain_part = origin_str
                                .strip_prefix("http://")
                                .or_else(|| origin_str.strip_prefix("https://"))
                                .unwrap_or(origin_str)
                                .split('/')
                                .next()
                                .unwrap_or(origin_str)
                                .split(':')
                                .next()
                                .unwrap_or(origin_str);

                            if !domain_part.is_empty() && domain_part != "*" {
                                validate_domain_name(domain_part).map_err(|e| {
                                    RepoError::ValidationError {
                                        reason: format!("Invalid CORS origin at index {idx}: {e}"),
                                    }
                                })?;
                            }
                        }
                    } else {
                        return Err(RepoError::ValidationError {
                            reason: format!(
                                "Invalid CORS origin at index {idx}: expected string, got {origin_entry}"
                            ),
                        });
                    }
                }
            } else if !allowed_origins.is_null() {
                return Err(RepoError::ValidationError {
                    reason: "cors.allowed_origins must be an array or null".to_string(),
                });
            }
        }
    }

    Ok(())
}

/// Validate a domain name
///
/// Basic validation using a simple regex pattern.
/// Supports:
/// - Standard domain names (e.g., "example.com")
/// - Subdomains (e.g., "api.example.com")
/// - Wildcard (*) - should be handled separately
/// - URLs with protocol (e.g., "https://example.com") - extracts domain
fn validate_domain_name(domain: &str) -> Result<(), String> {
    // Remove protocol if present
    let domain = domain
        .strip_prefix("http://")
        .or_else(|| domain.strip_prefix("https://"))
        .unwrap_or(domain);

    // Remove path if present
    let domain = domain.split('/').next().unwrap_or(domain);

    // Remove port if present
    let domain = domain.split(':').next().unwrap_or(domain);

    // Basic domain name validation
    // - Must not be empty
    if domain.is_empty() {
        return Err("Domain name cannot be empty".to_string());
    }

    // - Must not exceed 253 characters (RFC 1035)
    if domain.len() > 253 {
        return Err("Domain name exceeds maximum length (253 characters)".to_string());
    }

    // - Must contain at least one dot (for TLD), except for "localhost"
    if !domain.contains('.') && domain != "localhost" {
        return Err("Domain name must contain at least one dot".to_string());
    }

    // Special case: localhost is valid without TLD
    if domain == "localhost" {
        return Ok(());
    }

    // - Each label must be 1-63 characters and contain only alphanumeric and hyphens
    // - Labels cannot start or end with hyphens
    // - TLD must be at least 2 characters
    let labels: Vec<&str> = domain.split('.').collect();
    if labels.len() < 2 {
        return Err("Domain name must have at least a label and TLD".to_string());
    }

    for (idx, label) in labels.iter().enumerate() {
        // Label length check
        if label.is_empty() {
            return Err(format!("Domain label at position {idx} cannot be empty"));
        }
        if label.len() > 63 {
            return Err(format!(
                "Domain label '{label}' exceeds maximum length (63 characters)"
            ));
        }

        // Label character check (alphanumeric and hyphens only)
        if !label.chars().all(|c| c.is_alphanumeric() || c == '-') {
            return Err(format!(
                "Domain label '{label}' contains invalid characters (only alphanumeric and hyphens allowed)"
            ));
        }

        // Label cannot start or end with hyphen
        if label.starts_with('-') || label.ends_with('-') {
            return Err(format!(
                "Domain label '{label}' cannot start or end with a hyphen"
            ));
        }

        // TLD must be at least 2 characters
        if idx == labels.len() - 1 && label.len() < 2 {
            return Err("Top-level domain (TLD) must be at least 2 characters".to_string());
        }
    }

    Ok(())
}

/// Validate an IP address or CIDR notation
///
/// Supports IPv4, IPv6, and CIDR notation (e.g., "192.168.1.0/24", "2001:db8::/32").
/// For CIDR notation, validates that the IP address is a valid network address
/// (host bits are zero).
fn validate_ip_or_cidr(ip_or_cidr: &str) -> Result<(), String> {
    if ip_or_cidr.contains('/') {
        // CIDR notation
        let parts: Vec<&str> = ip_or_cidr.split('/').collect();
        if parts.len() != 2 {
            return Err(format!(
                "Invalid CIDR format: expected 'IP/prefix', got '{ip_or_cidr}'"
            ));
        }

        let ip_str = parts[0];
        let prefix_str = parts[1];

        // Validate IP address
        let ip_addr = ip_str
            .parse::<IpAddr>()
            .map_err(|e| format!("Invalid IP address in CIDR '{ip_or_cidr}': {e}"))?;

        // Validate prefix length
        let prefix: u8 = prefix_str
            .parse()
            .map_err(|e| format!("Invalid prefix length in CIDR '{ip_or_cidr}': {e}"))?;

        // Validate prefix length range and network address
        match ip_addr {
            IpAddr::V4(ipv4) => {
                // IPv4: prefix must be 0-32
                if prefix > 32 {
                    return Err(format!(
                        "Invalid IPv4 prefix length: {prefix} (must be 0-32)"
                    ));
                }

                // Validate that the IP address is a valid network address
                // (host bits must be zero)
                if prefix < 32 {
                    let mask_bits = 32 - prefix;
                    let host_mask = (1u32 << mask_bits) - 1;
                    let ip_u32 = u32::from_be_bytes(ipv4.octets());
                    if (ip_u32 & host_mask) != 0 {
                        return Err(format!(
                            "Invalid IPv4 network address in CIDR '{ip_or_cidr}': host bits must be zero for prefix length {prefix}"
                        ));
                    }
                }
            }
            IpAddr::V6(ipv6) => {
                // IPv6: prefix must be 0-128
                if prefix > 128 {
                    return Err(format!(
                        "Invalid IPv6 prefix length: {prefix} (must be 0-128)"
                    ));
                }

                // Validate that the IP address is a valid network address
                // (host bits must be zero)
                if prefix < 128 {
                    let octets = ipv6.octets();
                    let prefix_bytes = (prefix / 8) as usize;
                    let prefix_bits = prefix % 8;

                    // Check full bytes
                    for i in (prefix_bytes + 1)..16 {
                        if octets[i] != 0 {
                            return Err(format!(
                                "Invalid IPv6 network address in CIDR '{ip_or_cidr}': host bits must be zero for prefix length {prefix}"
                            ));
                        }
                    }

                    // Check partial byte
                    if prefix_bits > 0 && prefix_bytes < 16 {
                        let mask = !((1u8 << (8 - prefix_bits)) - 1);
                        if (octets[prefix_bytes] & mask) != octets[prefix_bytes] {
                            return Err(format!(
                                "Invalid IPv6 network address in CIDR '{ip_or_cidr}': host bits must be zero for prefix length {prefix}"
                            ));
                        }
                    }
                }
            }
        }
    } else {
        // Plain IP address
        ip_or_cidr
            .parse::<IpAddr>()
            .map_err(|e| format!("Invalid IP address '{ip_or_cidr}': {e}"))?;
    }

    Ok(())
}
