//! Security-related domain models
//!
//! See `docs/CORE_API.md` section 2 for the complete specification.

use serde::{Deserialize, Serialize};

/// API key record (stored in security.db)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApiKeyRecord {
    pub id: String,
    pub label: String,
    pub hash: String,               // Argon2 hash
    pub created_at: String,         // ISO8601
    pub revoked_at: Option<String>, // ISO8601
}

/// API key metadata (without hash, for listing)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApiKeyMetadata {
    pub id: String,
    pub label: String,
    pub created_at: String, // ISO8601
}

/// Plain text API key with record (returned only on creation)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlainAndHashedApiKey {
    pub plain: String,
    pub record: ApiKeyRecord,
}

/// Security policy
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SecurityPolicy {
    pub id: String,          // Phase 1/2: always "default"
    pub policy_json: String, // JSON string matching CORE_API.md schema
    pub updated_at: String,  // ISO8601
}
