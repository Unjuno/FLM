//! Security-related domain models
//!
//! See `docs/CORE_API.md` section 2 for the complete specification.

use serde::{Deserialize, Serialize};

/// API key record (stored in security.db)
///
/// Complete API key information including hashed value.
/// Stored in `api_keys` table via `SecurityRepository`.
/// The hash field contains an Argon2 hash, never the plain text key.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApiKeyRecord {
    /// Unique key identifier
    pub id: String,
    /// Human-readable label
    pub label: String,
    /// Argon2 hash of the API key (never plain text)
    pub hash: String,
    /// Creation timestamp (ISO8601)
    pub created_at: String,
    /// Revocation timestamp (ISO8601, None if not revoked)
    pub revoked_at: Option<String>,
}

/// API key metadata (without hash, for listing)
///
/// API key information without the hash field, for safe listing.
/// Returned by `SecurityService::list_api_keys()`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApiKeyMetadata {
    /// Unique key identifier
    pub id: String,
    /// Human-readable label
    pub label: String,
    /// Creation timestamp (ISO8601)
    pub created_at: String,
    /// Revocation timestamp (ISO8601, None if not revoked)
    pub revoked_at: Option<String>,
}

/// Plain text API key with record (returned only on creation)
///
/// Returned by `SecurityService::create_api_key()` and `SecurityService::rotate_api_key()`.
/// The plain text key is only returned once and should be displayed to the user immediately.
/// After that, only the hashed value is stored.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlainAndHashedApiKey {
    /// Plain text API key (only returned on creation)
    pub plain: String,
    /// API key record with hash
    pub record: ApiKeyRecord,
}

/// Security policy
///
/// Security configuration including IP whitelist, CORS, and rate limiting.
/// Stored in `security_policies` table via `SecurityRepository`.
/// Phase 1/2: Only "default" policy is supported.
/// See `docs/CORE_API.md` section 2 for the JSON schema.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SecurityPolicy {
    /// Policy identifier (Phase 1/2: always "default")
    pub id: String,
    /// Policy JSON string (matching CORE_API.md schema)
    pub policy_json: String,
    /// Last update timestamp (ISO8601)
    pub updated_at: String,
}

/// DNS credential profile metadata
///
/// Stores non-secret information about DNS provider credentials used for ACME DNS-01 automation.
/// Secrets (API tokens, etc.) are stored in the OS keyring; only metadata lives in `security.db`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DnsCredentialProfile {
    /// Profile identifier (e.g., "dns_cf_prod01")
    pub id: String,
    /// DNS provider identifier (e.g., "cloudflare")
    pub provider: String,
    /// Human-readable label for display
    pub label: String,
    /// DNS zone identifier (provider specific)
    pub zone_id: String,
    /// Optional DNS zone name (for readability)
    pub zone_name: Option<String>,
    /// Creation timestamp (ISO8601)
    pub created_at: String,
    /// Last update timestamp (ISO8601)
    pub updated_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_key_record_serialization() {
        let record = ApiKeyRecord {
            id: "key-1".to_string(),
            label: "Test Key".to_string(),
            hash: "$argon2id$v=19$m=65536,t=3,p=4$hash".to_string(),
            created_at: "2025-01-27T00:00:00Z".to_string(),
            revoked_at: None,
        };

        let json = serde_json::to_string(&record).unwrap();
        let deserialized: ApiKeyRecord = serde_json::from_str(&json).unwrap();
        assert_eq!(record.id, deserialized.id);
        assert_eq!(record.label, deserialized.label);
        assert_eq!(record.hash, deserialized.hash);
        assert_eq!(record.created_at, deserialized.created_at);
        assert_eq!(record.revoked_at, deserialized.revoked_at);
    }

    #[test]
    fn test_api_key_record_revoked() {
        let record = ApiKeyRecord {
            id: "key-1".to_string(),
            label: "Test Key".to_string(),
            hash: "$argon2id$v=19$m=65536,t=3,p=4$hash".to_string(),
            created_at: "2025-01-27T00:00:00Z".to_string(),
            revoked_at: Some("2025-01-28T00:00:00Z".to_string()),
        };

        assert!(record.revoked_at.is_some());
        let json = serde_json::to_string(&record).unwrap();
        let deserialized: ApiKeyRecord = serde_json::from_str(&json).unwrap();
        assert_eq!(record.revoked_at, deserialized.revoked_at);
    }

    #[test]
    fn test_api_key_metadata_serialization() {
        let metadata = ApiKeyMetadata {
            id: "key-1".to_string(),
            label: "Test Key".to_string(),
            created_at: "2025-01-27T00:00:00Z".to_string(),
            revoked_at: None,
        };

        let json = serde_json::to_string(&metadata).unwrap();
        let deserialized: ApiKeyMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(metadata.id, deserialized.id);
        assert_eq!(metadata.label, deserialized.label);
        assert_eq!(metadata.created_at, deserialized.created_at);
        assert_eq!(metadata.revoked_at, deserialized.revoked_at);
    }

    #[test]
    fn test_plain_and_hashed_api_key_serialization() {
        let plain_key = PlainAndHashedApiKey {
            plain: "flm-test-key-12345".to_string(),
            record: ApiKeyRecord {
                id: "key-1".to_string(),
                label: "Test Key".to_string(),
                hash: "$argon2id$v=19$m=65536,t=3,p=4$hash".to_string(),
                created_at: "2025-01-27T00:00:00Z".to_string(),
                revoked_at: None,
            },
        };

        let json = serde_json::to_string(&plain_key).unwrap();
        let deserialized: PlainAndHashedApiKey = serde_json::from_str(&json).unwrap();
        assert_eq!(plain_key.plain, deserialized.plain);
        assert_eq!(plain_key.record.id, deserialized.record.id);
    }

    #[test]
    fn test_security_policy_serialization() {
        let policy = SecurityPolicy {
            id: "default".to_string(),
            policy_json: r#"{"ip_whitelist":[],"cors":{"allowed_origins":[]},"rate_limit":{}}"#
                .to_string(),
            updated_at: "2025-01-27T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&policy).unwrap();
        let deserialized: SecurityPolicy = serde_json::from_str(&json).unwrap();
        assert_eq!(policy.id, deserialized.id);
        assert_eq!(policy.policy_json, deserialized.policy_json);
        assert_eq!(policy.updated_at, deserialized.updated_at);
    }

    #[test]
    fn test_dns_credential_profile_serialization() {
        let profile = DnsCredentialProfile {
            id: "dns-cf-prod01".to_string(),
            provider: "cloudflare".to_string(),
            label: "Cloudflare Production".to_string(),
            zone_id: "zone123".to_string(),
            zone_name: Some("example.com".to_string()),
            created_at: "2025-01-27T00:00:00Z".to_string(),
            updated_at: "2025-01-27T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&profile).unwrap();
        let deserialized: DnsCredentialProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(profile.id, deserialized.id);
        assert_eq!(profile.provider, deserialized.provider);
        assert_eq!(profile.label, deserialized.label);
        assert_eq!(profile.zone_id, deserialized.zone_id);
        assert_eq!(profile.zone_name, deserialized.zone_name);
    }

    #[test]
    fn test_dns_credential_profile_without_zone_name() {
        let profile = DnsCredentialProfile {
            id: "dns-cf-prod01".to_string(),
            provider: "cloudflare".to_string(),
            label: "Cloudflare Production".to_string(),
            zone_id: "zone123".to_string(),
            zone_name: None,
            created_at: "2025-01-27T00:00:00Z".to_string(),
            updated_at: "2025-01-27T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&profile).unwrap();
        let deserialized: DnsCredentialProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(profile.zone_name, deserialized.zone_name);
    }
}
