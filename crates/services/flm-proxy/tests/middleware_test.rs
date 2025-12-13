//! Unit tests for middleware functions

use flm_core::domain::proxy::ProxyEgressConfig;
use flm_core::services::EngineService;
use flm_core::services::SecurityService;
use flm_proxy::adapters::SqliteSecurityRepository;
use flm_proxy::http_client::ReqwestHttpClient;
use flm_proxy::middleware::AppState;
use flm_proxy::process_controller::NoopProcessController;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[allow(dead_code)]
async fn create_test_state() -> AppState {
    let security_db = std::env::temp_dir().join(format!(
        "test-{}.db",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let security_repo = SqliteSecurityRepository::new(security_db.to_str().unwrap())
        .await
        .unwrap();
    let security_service = Arc::new(SecurityService::new(security_repo.clone()));

    // Create a mock engine repository
    struct MockEngineRepository;
    unsafe impl Send for MockEngineRepository {}
    unsafe impl Sync for MockEngineRepository {}
    #[async_trait::async_trait]
    impl flm_core::ports::EngineRepository for MockEngineRepository {
        async fn list_registered(&self) -> Vec<std::sync::Arc<dyn flm_core::ports::LlmEngine>> {
            Vec::new()
        }

        async fn register(&self, _engine: std::sync::Arc<dyn flm_core::ports::LlmEngine>) {
            // No-op for tests
        }
    }

    struct EngineRepositoryWrapper(Arc<MockEngineRepository>);
    unsafe impl Send for EngineRepositoryWrapper {}
    unsafe impl Sync for EngineRepositoryWrapper {}
    #[async_trait::async_trait]
    impl flm_core::ports::EngineRepository for EngineRepositoryWrapper {
        async fn list_registered(&self) -> Vec<std::sync::Arc<dyn flm_core::ports::LlmEngine>> {
            self.0.list_registered().await
        }
        async fn register(&self, engine: std::sync::Arc<dyn flm_core::ports::LlmEngine>) {
            self.0.register(engine).await;
        }
    }

    let engine_repo_impl = Arc::new(MockEngineRepository);
    let engine_repo: Box<dyn flm_core::ports::EngineRepository + Send + Sync> =
        Box::new(EngineRepositoryWrapper(engine_repo_impl.clone()));
    let engine_service = Arc::new(EngineService::new(
        Box::new(NoopProcessController),
        Box::new(
            ReqwestHttpClient::new()
                .map_err(|e| format!("Failed to create HTTP client: {e}"))
                .unwrap(),
        ),
        engine_repo,
    ));

    AppState {
        security_service,
        security_repo: Arc::new(security_repo),
        engine_service,
        engine_repo: engine_repo_impl,
        rate_limit_state: Arc::new(RwLock::new(HashMap::new())),
        ip_rate_limit_state: Arc::new(RwLock::new(HashMap::new())),
        trusted_proxy_ips: vec![],
        ip_blocklist: Arc::new(flm_proxy::security::IpBlocklist::new()),
        intrusion_detection: Arc::new(flm_proxy::security::IntrusionDetection::new()),
        anomaly_detection: Arc::new(flm_proxy::security::AnomalyDetection::new()),
        resource_protection: Arc::new(flm_proxy::security::ResourceProtection::new()),
        egress: ProxyEgressConfig::default(),
        https_redirect_port: None,
        public_base_host: None,
        metrics: Arc::new(flm_proxy::metrics::Metrics::new()),
    }
}

// Note: check_ip_allowed and check_ip_rate_limit_with_info are pub(crate) functions
// and cannot be tested from the tests/ directory. These functions are tested
// indirectly through integration tests that exercise the middleware.
