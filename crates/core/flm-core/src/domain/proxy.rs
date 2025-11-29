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
    /// DNS-01 challenge (DNS record-based). Requires the `dns01-preview` feature.
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
    /// DNS-01 automation credential profile ID (stored in secrets store by CLI). Ignored unless the `dns01-preview` feature is enabled.
    pub acme_dns_profile_id: Option<String>,
    /// Resolved DNS credential secret payload (not persisted; runtime only). Ignored unless the `dns01-preview` feature is enabled.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_dns_credential: Option<ResolvedDnsCredential>,
    /// Optional override for the lego binary used to fulfill DNS-01 challenges (dns01-preview only)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acme_dns_lego_path: Option<String>,
    /// Optional propagation wait (seconds) before resuming lego manual workflow (dns01-preview only)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acme_dns_propagation_secs: Option<u64>,
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
            resolved_dns_credential: None,
            acme_dns_lego_path: None,
            acme_dns_propagation_secs: None,
            config_db_path: None,
            security_db_path: None,
        }
    }
}

impl ProxyConfig {
    /// Returns a copy of the config without any runtime secrets.
    pub fn without_secrets(&self) -> Self {
        let mut clone = self.clone();
        clone.resolved_dns_credential = None;
        clone
    }
}

/// Runtime DNS credential bundle passed to the proxy process.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ResolvedDnsCredential {
    /// Credential profile identifier
    pub id: String,
    /// DNS provider (e.g., cloudflare)
    pub provider: String,
    /// Provider-specific zone identifier
    pub zone_id: String,
    /// Optional zone name for logging
    pub zone_name: Option<String>,
    /// Secret token/API key
    pub token: String,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proxy_config_default() {
        let config = ProxyConfig::default();
        assert_eq!(config.mode, ProxyMode::LocalHttp);
        assert_eq!(config.port, 8080);
        assert_eq!(config.listen_addr, "127.0.0.1");
        assert_eq!(config.egress.mode, ProxyEgressMode::Direct);
        assert!(config.trusted_proxy_ips.is_empty());
        assert!(config.acme_email.is_none());
        assert!(config.acme_domain.is_none());
    }

    #[test]
    fn test_proxy_config_without_secrets() {
        let mut config = ProxyConfig {
            mode: ProxyMode::HttpsAcme,
            port: 8443,
            resolved_dns_credential: Some(ResolvedDnsCredential {
                id: "test".to_string(),
                provider: "cloudflare".to_string(),
                zone_id: "zone123".to_string(),
                zone_name: Some("example.com".to_string()),
                token: "secret-token".to_string(),
            }),
            ..Default::default()
        };

        let without_secrets = config.without_secrets();
        assert!(without_secrets.resolved_dns_credential.is_none());
        assert_eq!(config.mode, without_secrets.mode);
        assert_eq!(config.port, without_secrets.port);
    }

    #[test]
    fn test_proxy_config_serialization() {
        let config = ProxyConfig {
            mode: ProxyMode::DevSelfSigned,
            port: 9090,
            listen_addr: "0.0.0.0".to_string(),
            ..Default::default()
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ProxyConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.mode, deserialized.mode);
        assert_eq!(config.port, deserialized.port);
        assert_eq!(config.listen_addr, deserialized.listen_addr);
    }

    #[test]
    fn test_proxy_mode_serialization() {
        let modes = vec![
            ProxyMode::LocalHttp,
            ProxyMode::DevSelfSigned,
            ProxyMode::HttpsAcme,
            ProxyMode::PackagedCa,
        ];

        for mode in modes {
            let json = serde_json::to_string(&mode).unwrap();
            let deserialized: ProxyMode = serde_json::from_str(&json).unwrap();
            assert_eq!(mode, deserialized);
        }
    }

    #[test]
    fn test_proxy_egress_config_direct() {
        let config = ProxyEgressConfig::direct();
        assert_eq!(config.mode, ProxyEgressMode::Direct);
        assert!(config.socks5_endpoint.is_none());
        assert!(!config.fail_open);
    }

    #[test]
    fn test_proxy_egress_config_display_endpoint() {
        let direct = ProxyEgressConfig::direct();
        assert!(direct.display_endpoint().is_none());

        let tor = ProxyEgressConfig {
            mode: ProxyEgressMode::Tor,
            socks5_endpoint: Some("127.0.0.1:9050".to_string()),
            fail_open: false,
        };
        assert_eq!(
            tor.display_endpoint(),
            Some("tor://127.0.0.1:9050".to_string())
        );

        let custom = ProxyEgressConfig {
            mode: ProxyEgressMode::CustomSocks5,
            socks5_endpoint: Some("proxy.example.com:1080".to_string()),
            fail_open: true,
        };
        assert_eq!(
            custom.display_endpoint(),
            Some("socks5://proxy.example.com:1080".to_string())
        );
    }

    #[test]
    fn test_proxy_egress_config_serialization() {
        let config = ProxyEgressConfig {
            mode: ProxyEgressMode::Tor,
            socks5_endpoint: Some("127.0.0.1:9050".to_string()),
            fail_open: true,
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ProxyEgressConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.mode, deserialized.mode);
        assert_eq!(config.socks5_endpoint, deserialized.socks5_endpoint);
        assert_eq!(config.fail_open, deserialized.fail_open);
    }

    #[test]
    fn test_acme_challenge_kind_serialization() {
        let http01 = AcmeChallengeKind::Http01;
        let json = serde_json::to_string(&http01).unwrap();
        assert_eq!(json, "\"http01\"");
        let deserialized: AcmeChallengeKind = serde_json::from_str(&json).unwrap();
        assert_eq!(http01, deserialized);

        let dns01 = AcmeChallengeKind::Dns01;
        let json = serde_json::to_string(&dns01).unwrap();
        assert_eq!(json, "\"dns01\"");
        let deserialized: AcmeChallengeKind = serde_json::from_str(&json).unwrap();
        assert_eq!(dns01, deserialized);
    }

    #[test]
    fn test_proxy_profile_serialization() {
        let profile = ProxyProfile {
            id: "profile-1".to_string(),
            config: ProxyConfig::default(),
            created_at: "2025-01-27T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&profile).unwrap();
        let deserialized: ProxyProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(profile.id, deserialized.id);
        assert_eq!(profile.created_at, deserialized.created_at);
    }

    #[test]
    fn test_proxy_handle_serialization() {
        let handle = ProxyHandle {
            id: "handle-1".to_string(),
            pid: 12345,
            port: 8080,
            mode: ProxyMode::LocalHttp,
            listen_addr: "0.0.0.0:8080".to_string(),
            https_port: None,
            acme_domain: None,
            egress: ProxyEgressConfig::direct(),
            running: true,
            last_error: None,
        };

        let json = serde_json::to_string(&handle).unwrap();
        let deserialized: ProxyHandle = serde_json::from_str(&json).unwrap();
        assert_eq!(handle.id, deserialized.id);
        assert_eq!(handle.port, deserialized.port);
        assert_eq!(handle.running, deserialized.running);
    }

    #[test]
    fn test_resolved_dns_credential_serialization() {
        let cred = ResolvedDnsCredential {
            id: "dns-cf-01".to_string(),
            provider: "cloudflare".to_string(),
            zone_id: "zone123".to_string(),
            zone_name: Some("example.com".to_string()),
            token: "secret-token".to_string(),
        };

        let json = serde_json::to_string(&cred).unwrap();
        let deserialized: ResolvedDnsCredential = serde_json::from_str(&json).unwrap();
        assert_eq!(cred.id, deserialized.id);
        assert_eq!(cred.provider, deserialized.provider);
        assert_eq!(cred.zone_id, deserialized.zone_id);
        assert_eq!(cred.zone_name, deserialized.zone_name);
        assert_eq!(cred.token, deserialized.token);
    }
}
