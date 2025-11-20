//! Proxy controller trait

use crate::domain::proxy::{ProxyConfig, ProxyHandle};
use crate::error::ProxyError;

/// Proxy controller trait
pub trait ProxyController {
    fn start(&self, config: ProxyConfig) -> Result<ProxyHandle, ProxyError>;
    fn stop(&self, handle: ProxyHandle) -> Result<(), ProxyError>;
}

/// Proxy repository trait
pub trait ProxyRepository {
    fn save_profile(
        &self,
        profile: crate::domain::proxy::ProxyProfile,
    ) -> Result<(), crate::error::RepoError>;
    fn load_profile(
        &self,
        id: &str,
    ) -> Result<Option<crate::domain::proxy::ProxyProfile>, crate::error::RepoError>;
    fn list_profiles(
        &self,
    ) -> Result<Vec<crate::domain::proxy::ProxyProfile>, crate::error::RepoError>;
    fn list_active_handles(&self) -> Result<Vec<ProxyHandle>, crate::error::RepoError>;
}
