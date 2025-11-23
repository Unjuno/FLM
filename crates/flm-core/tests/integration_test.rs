//! Integration tests for flm-core
//!
//! See `docs/TEST_STRATEGY.md` for the complete test strategy.

#[cfg(test)]
mod tests {
    use flm_core::domain::*;

    #[test]
    fn test_engine_state_serialization() {
        // Test that EngineState can be serialized/deserialized
        let state = EngineState {
            id: "test-engine".to_string(),
            kind: EngineKind::Ollama,
            name: "Test Engine".to_string(),
            version: Some("1.0.0".to_string()),
            status: EngineStatus::InstalledOnly,
            capabilities: EngineCapabilities::default(),
        };

        let json = serde_json::to_string(&state).unwrap();
        let deserialized: EngineState = serde_json::from_str(&json).unwrap();
        assert_eq!(state.id, deserialized.id);
        assert_eq!(state.kind, deserialized.kind);
    }

    #[test]
    fn test_proxy_config_validation() {
        // Test ProxyConfig validation
        let config = ProxyConfig {
            mode: ProxyMode::LocalHttp,
            port: 8080,
            acme_email: None,
            acme_domain: None,
            acme_challenge: None,
            acme_dns_profile_id: None,
            config_db_path: None,
            security_db_path: None,
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ProxyConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.port, deserialized.port);
        assert_eq!(config.mode, deserialized.mode);
    }

    #[test]
    fn test_security_policy_serialization() {
        // Test SecurityPolicy serialization
        let policy = SecurityPolicy {
            id: "default".to_string(),
            policy_json: r#"{"ip_whitelist":[],"cors":{"allowed_origins":[]},"rate_limit":{}}"#
                .to_string(),
            updated_at: "2025-01-27T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&policy).unwrap();
        let deserialized: SecurityPolicy = serde_json::from_str(&json).unwrap();
        assert_eq!(policy.id, deserialized.id);
        assert_eq!(policy.policy_json, deserialized.policy_json);
    }
}
