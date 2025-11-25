//! Proxy-related domain models
//!
//! See `docs/CORE_API.md` section 2 for the complete specification.

use serde::{Deserialize, Serialize};

/// Proxy mode enumeration
///
/// Defines the TLS/HTTPS configuration mode for the proxy server.
/// Used in `ProxyConfig` to determine certificate handling.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProxyMode {
    /// HTTP only (no TLS)
    LocalHttp,
    /// HTTPS with self-signed certificate (development)
    DevSelfSigned,
    /// HTTPS with ACME certificate (Let's Encrypt)
    HttpsAcme,
    /// Phase 3: HTTPS with package-bundled root CA certificate
    PackagedCa,
}

/// Default Tor SOCKS endpoint (Tor daemon)
pub const DEFAULT_TOR_SOCKS_ENDPOINT: &str = "127.0.0.1:9050";

/// ACME challenge kind
///
/// Defines the ACME challenge method for certificate validation.
/// Used in `ProxyConfig` for `HttpsAcme` mode.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AcmeChallengeKind {
    /// HTTP-01 challenge (file-based)
    Http01,
    /// DNS-01 challenge (DNS record-based)
    Dns01,
}

/// Proxy configuration
///
/// Complete configuration for a proxy server instance.
/// Used by `ProxyService::start()` to configure the proxy server.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProxyConfig {
    /// TLS/HTTPS mode
    pub mode: ProxyMode,
    /// Outbound egress configuration (Direct/Tor/SOCKS5)
    #[serde(default = "ProxyEgressConfig::direct")]
    pub egress: ProxyEgressConfig,
    /// HTTP port (HTTPS port is port + 1 for HTTPS-enabled modes)
    pub port: u16,
    /// Listen address (IP address to bind to, e.g., "127.0.0.1" or "0.0.0.0")
    /// Default: "127.0.0.1" (localhost only) for security
    /// Use "0.0.0.0" only when external access is explicitly needed
    #[serde(default = "default_listen_addr")]
    pub listen_addr: String,
    /// Trusted proxy IP addresses (for X-Forwarded-For header validation)
    /// If empty, X-Forwarded-For and X-Real-IP headers are ignored (direct connection assumed)
    /// Only IPs from trusted proxies are used for client IP extraction
    #[serde(default)]
    pub trusted_proxy_ips: Vec<String>,
    /// ACME email (required for `HttpsAcme` mode)
    pub acme_email: Option<String>,
    /// ACME domain (required for `HttpsAcme` mode)
    pub acme_domain: Option<String>,
    /// ACME challenge method
    pub acme_challenge: Option<AcmeChallengeKind>,
    /// DNS-01 automation credential profile ID (stored in secrets store by CLI)
    pub acme_dns_profile_id: Option<String>,
    /// Path to config.db (for EngineService, internal use)
    #[serde(skip)]
    pub config_db_path: Option<String>,
    /// Path to security.db (for SecurityService, internal use)
    #[serde(skip)]
    pub security_db_path: Option<String>,
}

/// Default listen address (localhost only for security)
fn default_listen_addr() -> String {
    "127.0.0.1".to_string()
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            mode: ProxyMode::LocalHttp,
            egress: ProxyEgressConfig::direct(),
            port: 8080,
            listen_addr: default_listen_addr(),
            trusted_proxy_ips: Vec::new(),
            acme_email: None,
            acme_domain: None,
            acme_challenge: None,
            acme_dns_profile_id: None,
            config_db_path: None,
            security_db_path: None,
        }
    }
}

/// Proxy profile (saved configuration)
///
/// Saved proxy configuration with metadata.
/// Stored in `proxy_profiles` table via `ProxyRepository`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProxyProfile {
    /// Profile identifier
    pub id: String,
    /// Proxy configuration
    pub config: ProxyConfig,
    /// Creation timestamp (ISO8601)
    pub created_at: String,
}

/// Proxy handle (running instance)
///
/// Represents a running proxy server instance.
/// Returned by `ProxyService::start()` and `ProxyService::status()`.
/// See `docs/CORE_API.md` section 2 for user-friendly URL generation rules.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProxyHandle {
    /// Unique handle identifier
    pub id: String,
    /// Process ID (if applicable)
    pub pid: u32,
    /// HTTP port
    pub port: u16,
    /// Proxy mode
    pub mode: ProxyMode,
    /// Listen address (technical binding address, e.g., "0.0.0.0:8080")
    pub listen_addr: String,
    /// HTTPS port (port + 1 for HTTPS-enabled modes)
    pub https_port: Option<u16>,
    /// ACME domain (if using `HttpsAcme` mode)
    pub acme_domain: Option<String>,
    /// Effective egress configuration of the running handle
    #[serde(default = "ProxyEgressConfig::direct")]
    pub egress: ProxyEgressConfig,
    /// Whether the proxy is currently running
    pub running: bool,
    /// Last error message (if any)
    pub last_error: Option<String>,
}

/// Outbound proxy mode for Tor/SOCKS5 support
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProxyEgressMode {
    /// Direct network egress (default)
    Direct,
    /// Tor SOCKS5 endpoint (defaults to 127.0.0.1:9050)
    Tor,
    /// Custom SOCKS5 endpoint (user supplied)
    CustomSocks5,
}

/// Egress configuration for outbound HTTP clients
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProxyEgressConfig {
    /// Selected egress mode
    pub mode: ProxyEgressMode,
    /// Optional `host:port` for Tor/Custom SOCKS5 endpoints
    pub socks5_endpoint: Option<String>,
    /// Whether to fall back to Direct mode if the SOCKS endpoint is unreachable
    #[serde(default)]
    pub fail_open: bool,
}

impl ProxyEgressConfig {
    /// Default Direct config
    pub fn direct() -> Self {
        Self {
            mode: ProxyEgressMode::Direct,
            socks5_endpoint: None,
            fail_open: false,
        }
    }

    /// Helper for displaying the resolved endpoint with scheme.
    pub fn display_endpoint(&self) -> Option<String> {
        match self.mode {
            ProxyEgressMode::Direct => None,
            ProxyEgressMode::Tor => self
                .socks5_endpoint
                .as_ref()
                .map(|ep| format!("tor://{ep}")),
            ProxyEgressMode::CustomSocks5 => self
                .socks5_endpoint
                .as_ref()
                .map(|ep| format!("socks5://{ep}")),
        }
    }
}

impl Default for ProxyEgressConfig {
    fn default() -> Self {
        Self::direct()
    }
}
