use async_trait::async_trait;
use std::error::Error;

/// Shared error type for DNS challenge hooks.
pub type DynDnsHookError = Box<dyn Error + Send + Sync>;

/// Metadata for a DNS-01 TXT record.
#[derive(Clone, Debug)]
pub struct DnsChallengeRecord {
    /// Base domain that is being validated.
    pub domain: String,
    /// Fully-qualified record name (e.g., `_acme-challenge.example.com`).
    pub fqdn: String,
    /// TXT record value that must be published.
    pub value: String,
}

/// Hook invoked when DNS-01 challenges need to publish or clean up TXT records.
#[async_trait]
pub trait DnsChallengeHook: Send + Sync {
    /// Present the TXT record value required by the CA.
    async fn present(&self, record: &DnsChallengeRecord) -> Result<(), DynDnsHookError>;

    /// Remove the TXT record after validation completes.
    async fn cleanup(&self, record: &DnsChallengeRecord) -> Result<(), DynDnsHookError>;
}
