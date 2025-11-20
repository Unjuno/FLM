//! Proxy-related domain models
//!
//! See `docs/CORE_API.md` section 2 for the complete specification.

use serde::{Deserialize, Serialize};

/// Proxy mode enumeration
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProxyMode {
    LocalHttp,
    DevSelfSigned,
    HttpsAcme,
    /// Phase 3: Package-bundled root CA certificate
    PackagedCa,
}

/// ACME challenge kind
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AcmeChallengeKind {
    Http01,
    Dns01,
}

/// Proxy configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub mode: ProxyMode,
    pub port: u16,
    pub acme_email: Option<String>,
    pub acme_domain: Option<String>,
    pub acme_challenge: Option<AcmeChallengeKind>,
    /// DNS-01 automation credential profile ID (stored in secrets store by CLI)
    pub acme_dns_profile_id: Option<String>,
}

/// Proxy profile (saved configuration)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProxyProfile {
    pub id: String,
    pub config: ProxyConfig,
    pub created_at: String, // ISO8601
}

/// Proxy handle (running instance)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProxyHandle {
    pub id: String,
    pub pid: u32,
    pub port: u16,
    pub mode: ProxyMode,
    pub listen_addr: String,
    /// HTTPS port (port + 1 for HTTPS-enabled modes)
    pub https_port: Option<u16>,
    pub acme_domain: Option<String>,
    pub running: bool,
    pub last_error: Option<String>,
}
