//! Proxy service
//!
//! See `docs/CORE_API.md` section 5 for the complete specification.

use crate::domain::proxy::{
    AcmeChallengeKind, ProxyConfig, ProxyEgressConfig, ProxyEgressMode, ProxyHandle, ProxyMode,
    ProxyProfile, DEFAULT_TOR_SOCKS_ENDPOINT,
};
use crate::error::ProxyError;
use crate::ports::{ProxyController, ProxyRepository};
use chrono::Utc;
use std::sync::Arc;

const DNS01_DISABLED_REASON: &str =
    "DNS-01 automation is disabled in this build (see docs/planning/PLAN.md#dns-automation).";

/// Proxy service
pub struct ProxyService<C, R>
where
    C: ProxyController,
    R: ProxyRepository,
{
    controller: Arc<C>,
    repository: Arc<R>,
}

impl<C, R> ProxyService<C, R>
where
    C: ProxyController,
    R: ProxyRepository,
{
    /// Create a new ProxyService
    ///
    /// # Arguments
    /// * `controller` - Proxy controller implementation
    /// * `repository` - Proxy repository implementation
    #[allow(clippy::new_without_default)]
    pub fn new(controller: Arc<C>, repository: Arc<R>) -> Self {
        Self {
            controller,
            repository,
        }
    }

    /// Start a proxy instance
    ///
    /// # Arguments
    /// * `config` - Proxy configuration
    ///
    /// # Returns
    /// * `Ok(ProxyHandle)` if the proxy started successfully
    /// * `Err(ProxyError)` if startup failed
    ///
    /// # Errors
    /// Returns `ProxyError::PortInUse` if the port is already in use
    /// Returns `ProxyError::InvalidConfig` if the configuration is invalid
    pub async fn start(&self, config: ProxyConfig) -> Result<ProxyHandle, ProxyError> {
        // Validate and normalize configuration
        let config = Self::normalize_config(config)?;

        // why: docs/status/active/UNIMPLEMENTED_REPORT.md §1.3 calls out missing deterministic
        //      port conflict errors before spawning proxy processes.
        // alt: Rely on ProxyController to surface OS errors, but that obscures which port failed.
        // evidence: docs/status/active/UNIMPLEMENTED_ANALYSIS.md §1.3 enumerates the gap.
        // assumption: OS binding semantics remain stable between the preflight check and actual startup.
        Self::ensure_port_available(&config.listen_addr, config.port)?;

        if config.mode != ProxyMode::LocalHttp {
            let https_port =
                config
                    .port
                    .checked_add(1)
                    .ok_or_else(|| ProxyError::InvalidConfig {
                        reason: format!(
                            "HTTPS port calculation overflowed for base port {}",
                            config.port
                        ),
                    })?;
            Self::ensure_port_available(&config.listen_addr, https_port)?;
        }

        // Start the proxy via controller
        let handle = self.controller.start(config.clone()).await?;

        // Save profile if this is a new instance
        // For now, we'll create a profile with a generated ID
        let profile = ProxyProfile {
            id: format!("proxy-{}", handle.id),
            config: config.without_secrets(),
            created_at: Utc::now().to_rfc3339(),
        };
        self.repository
            .save_profile(profile)
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to save proxy profile: {e}"),
            })?;

        // Save active handle to repository for persistence across CLI invocations
        self.repository
            .save_active_handle(handle.clone())
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to save active proxy handle: {e}"),
            })?;

        Ok(handle)
    }

    /// Stop a proxy instance
    ///
    /// # Arguments
    /// * `handle` - Proxy handle to stop
    ///
    /// # Returns
    /// * `Ok(())` if the proxy stopped successfully
    /// * `Err(ProxyError)` if stop failed
    pub async fn stop(&self, handle: ProxyHandle) -> Result<(), ProxyError> {
        // Stop the proxy via controller
        self.controller.stop(handle.clone()).await?;

        // Remove active handle from repository
        self.repository
            .remove_active_handle(&handle.id)
            .await
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to remove active proxy handle: {e}"),
            })?;

        Ok(())
    }

    /// Reload configuration for a running proxy instance
    ///
    /// # Arguments
    /// * `handle_id` - ID of the proxy handle to reload
    ///
    /// # Returns
    /// * `Ok(())` if the configuration was reloaded successfully
    /// * `Err(ProxyError)` if reload failed
    ///
    /// # Errors
    /// Returns `ProxyError::HandleNotFound` if the handle doesn't exist
    /// Returns `ProxyError::InvalidConfig` if the new configuration is invalid
    ///
    /// # Notes
    /// This method reloads hot-reloadable settings (SecurityPolicy, certificates, rate limits)
    /// without restarting the proxy server. Settings that require a restart (mode, port, bind address)
    /// are not affected by this method.
    pub async fn reload_config(&self, handle_id: &str) -> Result<(), ProxyError> {
        // Verify that the handle exists
        let handles = self.status().await?;
        let handle = handles.iter().find(|h| h.id == handle_id).ok_or_else(|| {
            ProxyError::HandleNotFound {
                handle_id: handle_id.to_string(),
            }
        })?;

        // Verify that the proxy is running
        if !handle.running {
            return Err(ProxyError::InvalidConfig {
                reason: format!("Proxy handle {} is not running", handle_id),
            });
        }

        // Reload configuration via controller
        self.controller.reload_config(handle_id).await?;

        Ok(())
    }

    /// Get status of all running proxy instances
    ///
    /// # Returns
    /// * `Ok(Vec<ProxyHandle>)` with all active proxy handles
    /// * `Err(ProxyError)` if status retrieval failed
    pub async fn status(&self) -> Result<Vec<ProxyHandle>, ProxyError> {
        // Get active handles from controller (in-memory state)
        let controller_handles = self.controller.status().await?;

        // Get active handles from repository (persisted state)
        let repository_handles =
            self.repository
                .list_active_handles()
                .await
                .map_err(|e| ProxyError::InvalidConfig {
                    reason: format!("Failed to list active proxy handles: {e}"),
                })?;

        // Merge handles: prefer controller handles (they have the most up-to-date running state)
        // but include repository handles that might not be in controller (e.g., from a different process)
        let mut all_handles: std::collections::HashMap<String, ProxyHandle> = repository_handles
            .into_iter()
            .map(|h| (h.id.clone(), h))
            .collect();

        // Update with controller handles (they have the most current state)
        for handle in controller_handles {
            all_handles.insert(handle.id.clone(), handle);
        }

        Ok(all_handles.into_values().collect())
    }

    /// Validate proxy configuration
    ///
    /// # Arguments
    /// * `config` - Proxy configuration to validate
    ///
    /// # Returns
    /// * `Ok(())` if the configuration is valid
    /// * `Err(ProxyError::InvalidConfig)` if the configuration is invalid
    fn normalize_config(mut config: ProxyConfig) -> Result<ProxyConfig, ProxyError> {
        // Validate port range (u16 is already 0-65535, but check for 0 explicitly)
        if config.port == 0 {
            return Err(ProxyError::InvalidConfig {
                reason: format!("Invalid port: {}", config.port),
            });
        }

        // Validate mode-specific requirements
        match config.mode {
            crate::domain::proxy::ProxyMode::HttpsAcme => {
                if config.acme_email.is_none() {
                    return Err(ProxyError::InvalidConfig {
                        reason: "ACME email is required for https-acme mode".to_string(),
                    });
                }
                if let Some(domain) = &config.acme_domain {
                    // Validate domain name format (supports wildcard: *.example.com)
                    if let Err(e) = validate_domain_name(domain) {
                        return Err(ProxyError::InvalidConfig {
                            reason: format!("Invalid ACME domain name: {e}"),
                        });
                    }

                    // Check if wildcard domain is specified
                    let is_wildcard = domain.starts_with("*.");
                    if is_wildcard {
                        // Wildcard certificates require DNS-01 challenge
                        if config.acme_challenge != Some(AcmeChallengeKind::Dns01) {
                            return Err(ProxyError::InvalidConfig {
                                reason: "Wildcard domain (*.example.com) requires DNS-01 challenge. Use --challenge dns-01 and --dns-profile".to_string(),
                            });
                        }
                        if !dns01_feature_enabled() {
                            return Err(ProxyError::InvalidConfig {
                                reason: "Wildcard certificates require DNS-01 feature which is currently disabled".to_string(),
                            });
                        }
                        if config.acme_dns_profile_id.is_none() {
                            return Err(ProxyError::InvalidConfig {
                                reason: "Wildcard domain requires --dns-profile to be set for DNS-01 challenge".to_string(),
                            });
                        }
                    }
                } else {
                    return Err(ProxyError::InvalidConfig {
                        reason: "ACME domain is required for https-acme mode".to_string(),
                    });
                }

                match config.acme_challenge {
                    Some(AcmeChallengeKind::Dns01) => {
                        if !dns01_feature_enabled() {
                            return Err(ProxyError::InvalidConfig {
                                reason: DNS01_DISABLED_REASON.to_string(),
                            });
                        }
                        if config.acme_dns_profile_id.is_none() {
                            return Err(ProxyError::InvalidConfig {
                                reason: "DNS-01 challenge requires --dns-profile to be set"
                                    .to_string(),
                            });
                        }
                        if config.resolved_dns_credential.is_none() {
                            return Err(ProxyError::InvalidConfig {
                                reason: "DNS-01 challenge requires runtime DNS credential secrets"
                                    .to_string(),
                            });
                        }
                    }
                    Some(AcmeChallengeKind::Http01) | None => {
                        // Clear runtime secrets when not needed
                        config.resolved_dns_credential = None;
                        if !dns01_feature_enabled() {
                            config.acme_dns_profile_id = None;
                            config.acme_dns_lego_path = None;
                            config.acme_dns_propagation_secs = None;
                        }
                    }
                }
            }
            crate::domain::proxy::ProxyMode::DevSelfSigned => {
                // No additional requirements for dev-selfsigned
            }
            crate::domain::proxy::ProxyMode::LocalHttp => {
                // No additional requirements for local-http
            }
            crate::domain::proxy::ProxyMode::PackagedCa => {
                // Phase 3: No validation needed for now
            }
        }

        if !dns01_feature_enabled() {
            // Wipe DNS-only configuration fields so they are not persisted while the feature is off.
            config.acme_dns_profile_id = None;
            config.resolved_dns_credential = None;
            config.acme_dns_lego_path = None;
            config.acme_dns_propagation_secs = None;
            if matches!(config.acme_challenge, Some(AcmeChallengeKind::Dns01)) {
                config.acme_challenge = Some(AcmeChallengeKind::Http01);
            }
        }

        config.egress = normalize_egress(config.egress)?;

        Ok(config)
    }

    fn ensure_port_available(listen_addr: &str, port: u16) -> Result<(), ProxyError> {
        use std::io::ErrorKind;
        use std::net::TcpListener;

        match TcpListener::bind((listen_addr, port)) {
            Ok(listener) => {
                drop(listener);
                Ok(())
            }
            Err(err) => {
                if err.kind() == ErrorKind::AddrInUse {
                    Err(ProxyError::PortInUse { port })
                } else {
                    Err(ProxyError::InvalidConfig {
                        reason: format!("Failed to bind {listen_addr}:{port}: {err}"),
                    })
                }
            }
        }
    }
}

fn normalize_egress(mut egress: ProxyEgressConfig) -> Result<ProxyEgressConfig, ProxyError> {
    match egress.mode {
        ProxyEgressMode::Direct => {
            egress.socks5_endpoint = None;
            egress.fail_open = false;
        }
        ProxyEgressMode::Tor => {
            if egress.socks5_endpoint.is_none() {
                egress.socks5_endpoint = Some(DEFAULT_TOR_SOCKS_ENDPOINT.to_string());
            }
            if let Some(endpoint) = &egress.socks5_endpoint {
                validate_socks_endpoint(endpoint)?;
            }
        }
        ProxyEgressMode::CustomSocks5 => {
            let endpoint =
                egress
                    .socks5_endpoint
                    .as_ref()
                    .ok_or_else(|| ProxyError::InvalidConfig {
                        reason: "socks5 endpoint is required when using custom SOCKS5 mode"
                            .to_string(),
                    })?;
            validate_socks_endpoint(endpoint)?;
        }
    }

    Ok(egress)
}

fn validate_socks_endpoint(endpoint: &str) -> Result<(), ProxyError> {
    let mut parts = endpoint.split(':');
    let host = parts.next().ok_or_else(|| ProxyError::InvalidConfig {
        reason: "Invalid socks5 endpoint (missing host)".to_string(),
    })?;
    let port = parts.next().ok_or_else(|| ProxyError::InvalidConfig {
        reason: "Invalid socks5 endpoint (missing port)".to_string(),
    })?;

    if host.trim().is_empty() {
        return Err(ProxyError::InvalidConfig {
            reason: "Invalid socks5 endpoint: host cannot be empty".to_string(),
        });
    }

    port.parse::<u16>().map_err(|_| ProxyError::InvalidConfig {
        reason: "Invalid socks5 endpoint: port must be a number between 1-65535".to_string(),
    })?;

    if parts.next().is_some() {
        return Err(ProxyError::InvalidConfig {
            reason: "Invalid socks5 endpoint: unexpected extra ':'".to_string(),
        });
    }

    Ok(())
}

/// Validate a domain name
///
/// Basic validation for domain names used in ACME configuration.
/// See `validate_domain_name` in `security.rs` for detailed validation rules.
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
    if domain.is_empty() {
        return Err("Domain name cannot be empty".to_string());
    }

    if domain.len() > 253 {
        return Err("Domain name exceeds maximum length (253 characters)".to_string());
    }

    if !domain.contains('.') {
        return Err("Domain name must contain at least one dot".to_string());
    }

    // Check for wildcard domain (*.example.com)
    let is_wildcard = domain.starts_with("*.");
    let domain_to_validate = if is_wildcard {
        &domain[2..] // Remove "*." prefix
    } else {
        domain
    };

    let labels: Vec<&str> = domain_to_validate.split('.').collect();
    if labels.len() < 2 {
        return Err("Domain name must have at least a label and TLD".to_string());
    }

    for (idx, label) in labels.iter().enumerate() {
        if label.is_empty() {
            return Err(format!("Domain label at position {idx} cannot be empty"));
        }
        if label.len() > 63 {
            return Err(format!(
                "Domain label '{label}' exceeds maximum length (63 characters)"
            ));
        }

        if !label.chars().all(|c| c.is_alphanumeric() || c == '-') {
            return Err(format!(
                "Domain label '{label}' contains invalid characters (only alphanumeric and hyphens allowed)"
            ));
        }

        if label.starts_with('-') || label.ends_with('-') {
            return Err(format!(
                "Domain label '{label}' cannot start or end with a hyphen"
            ));
        }

        if idx == labels.len() - 1 && label.len() < 2 {
            return Err("Top-level domain (TLD) must be at least 2 characters".to_string());
        }
    }

    Ok(())
}

#[inline]
fn dns01_feature_enabled() -> bool {
    cfg!(feature = "dns01-preview")
}
