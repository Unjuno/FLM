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
