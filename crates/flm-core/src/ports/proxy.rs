//! Proxy controller trait
//!
//! See `docs/CORE_API.md` section 2 for the complete specification.

use crate::domain::proxy::{ProxyConfig, ProxyHandle};
use crate::error::ProxyError;
use async_trait::async_trait;

/// Proxy controller trait
///
/// This trait is async to allow for asynchronous server startup and shutdown.
#[async_trait]
pub trait ProxyController: Send + Sync {
    async fn start(&self, config: ProxyConfig) -> Result<ProxyHandle, ProxyError>;
    async fn stop(&self, handle: ProxyHandle) -> Result<(), ProxyError>;
    async fn status(&self) -> Result<Vec<ProxyHandle>, ProxyError>;
}

/// Proxy repository trait
#[async_trait]
pub trait ProxyRepository: Send + Sync {
    async fn save_profile(
        &self,
        profile: crate::domain::proxy::ProxyProfile,
    ) -> Result<(), crate::error::RepoError>;
    async fn load_profile(
        &self,
        id: &str,
    ) -> Result<Option<crate::domain::proxy::ProxyProfile>, crate::error::RepoError>;
    async fn list_profiles(
        &self,
    ) -> Result<Vec<crate::domain::proxy::ProxyProfile>, crate::error::RepoError>;
    async fn list_active_handles(&self) -> Result<Vec<ProxyHandle>, crate::error::RepoError>;
    async fn save_active_handle(&self, handle: ProxyHandle) -> Result<(), crate::error::RepoError>;
    async fn remove_active_handle(&self, handle_id: &str) -> Result<(), crate::error::RepoError>;
}
