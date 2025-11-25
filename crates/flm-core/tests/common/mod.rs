//! Common test utilities
//!
//! Shared test helpers for flm-core tests.

/// Create a test EngineState
pub fn create_test_engine_state() -> crate::domain::engine::EngineState {
    crate::domain::engine::EngineState {
        id: "test-engine".to_string(),
        kind: crate::domain::models::EngineKind::Ollama,
        name: "Test Engine".to_string(),
        version: Some("1.0.0".to_string()),
        status: crate::domain::engine::EngineStatus::InstalledOnly,
        capabilities: crate::domain::models::EngineCapabilities::default(),
    }
}

/// Create a test ProxyConfig
pub fn create_test_proxy_config() -> crate::domain::proxy::ProxyConfig {
    crate::domain::proxy::ProxyConfig {
        port: 8080,
        ..Default::default()
    }
}

