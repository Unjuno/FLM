//! Tests for ProxyService

use flm_core::domain::proxy::{
    AcmeChallengeKind, ProxyConfig, ProxyEgressConfig, ProxyHandle, ProxyMode, ProxyProfile,
};
use flm_core::error::{ProxyError, RepoError};
use flm_core::ports::{ProxyController, ProxyRepository};
use flm_core::services::ProxyService;
use std::sync::{Arc, Mutex};

/// Mock ProxyController for testing
struct MockProxyController {
    handles: Arc<Mutex<Vec<ProxyHandle>>>,
}

impl MockProxyController {
    fn new() -> Self {
        Self {
            handles: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[async_trait::async_trait]
impl ProxyController for MockProxyController {
    async fn start(&self, config: ProxyConfig) -> Result<ProxyHandle, ProxyError> {
        let handle = ProxyHandle {
            id: format!("handle-{}", config.port),
            pid: 12345,
            port: config.port,
            mode: config.mode.clone(),
            listen_addr: format!("0.0.0.0:{}", config.port),
            https_port: match config.mode {
                ProxyMode::LocalHttp => None,
                _ => Some(config.port + 1),
            },
            acme_domain: config.acme_domain.clone(),
            egress: ProxyEgressConfig::direct(),
            running: true,
            last_error: None,
        };

        let mut handles = self.handles.lock().unwrap();
        handles.push(handle.clone());
        Ok(handle)
    }

    async fn stop(&self, handle: ProxyHandle) -> Result<(), ProxyError> {
        let mut handles = self.handles.lock().unwrap();
        handles.retain(|h| h.id != handle.id);
        Ok(())
    }

    async fn status(&self) -> Result<Vec<ProxyHandle>, ProxyError> {
        let handles = self.handles.lock().unwrap();
        Ok(handles.clone())
    }
}

/// Mock ProxyRepository for testing
struct MockProxyRepository {
    profiles: Arc<Mutex<Vec<ProxyProfile>>>,
    handles: Arc<Mutex<Vec<ProxyHandle>>>,
}

impl MockProxyRepository {
    fn new() -> Self {
        Self {
            profiles: Arc::new(Mutex::new(Vec::new())),
            handles: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[async_trait::async_trait]
impl ProxyRepository for MockProxyRepository {
    async fn save_profile(&self, profile: ProxyProfile) -> Result<(), RepoError> {
        let mut profiles = self.profiles.lock().unwrap();
        // Remove existing profile with same ID
        profiles.retain(|p| p.id != profile.id);
        profiles.push(profile);
        Ok(())
    }

    async fn load_profile(&self, id: &str) -> Result<Option<ProxyProfile>, RepoError> {
        let profiles = self.profiles.lock().unwrap();
        Ok(profiles.iter().find(|p| p.id == id).cloned())
    }

    async fn list_profiles(&self) -> Result<Vec<ProxyProfile>, RepoError> {
        let profiles = self.profiles.lock().unwrap();
        Ok(profiles.clone())
    }

    async fn list_active_handles(&self) -> Result<Vec<ProxyHandle>, RepoError> {
        let handles = self.handles.lock().unwrap();
        Ok(handles.clone())
    }

    async fn save_active_handle(&self, handle: ProxyHandle) -> Result<(), RepoError> {
        let mut handles = self.handles.lock().unwrap();
        handles.retain(|h| h.id != handle.id);
        handles.push(handle);
        Ok(())
    }

    async fn remove_active_handle(&self, handle_id: &str) -> Result<(), RepoError> {
        let mut handles = self.handles.lock().unwrap();
        handles.retain(|h| h.id != handle_id);
        Ok(())
    }
}

#[tokio::test]
async fn test_proxy_service_start_local_http() {
    let controller = Arc::new(MockProxyController::new());
    let repository = Arc::new(MockProxyRepository::new());
    let service = ProxyService::new(controller.clone(), repository.clone());

    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 28080, // Use a high port to avoid conflicts
        ..Default::default()
    };

    let handle = service.start(config).await.unwrap();
    assert_eq!(handle.port, 28080);
    assert_eq!(handle.mode, ProxyMode::LocalHttp);
    assert!(handle.running);

    // Verify profile was saved
    let profiles = repository.list_profiles().await.unwrap();
    assert_eq!(profiles.len(), 1);
    assert_eq!(profiles[0].config.port, 28080);
}

#[tokio::test]
async fn test_proxy_service_start_invalid_port() {
    let controller = Arc::new(MockProxyController::new());
    let repository = Arc::new(MockProxyRepository::new());
    let service = ProxyService::new(controller, repository);

    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 0, // Invalid port
        ..Default::default()
    };

    let result = service.start(config).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        ProxyError::InvalidConfig { reason } => {
            assert!(reason.contains("Invalid port"));
        }
        _ => panic!("Expected InvalidConfig error"),
    }
}

#[tokio::test]
async fn test_proxy_service_start_https_acme_missing_email() {
    let controller = Arc::new(MockProxyController::new());
    let repository = Arc::new(MockProxyRepository::new());
    let service = ProxyService::new(controller, repository);

    let config = ProxyConfig {
        mode: ProxyMode::HttpsAcme,
        port: 28082,      // Use a high port to avoid conflicts
        acme_email: None, // Missing email
        acme_domain: Some("example.com".to_string()),
        acme_challenge: Some(AcmeChallengeKind::Http01),
        ..Default::default()
    };

    let result = service.start(config).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        ProxyError::InvalidConfig { reason } => {
            assert!(reason.contains("ACME email is required"));
        }
        _ => panic!("Expected InvalidConfig error"),
    }
}

#[tokio::test]
async fn test_proxy_service_start_https_acme_missing_domain() {
    let controller = Arc::new(MockProxyController::new());
    let repository = Arc::new(MockProxyRepository::new());
    let service = ProxyService::new(controller, repository);

    let config = ProxyConfig {
        mode: ProxyMode::HttpsAcme,
        port: 28083, // Use a high port to avoid conflicts
        acme_email: Some("test@example.com".to_string()),
        acme_domain: None, // Missing domain
        acme_challenge: Some(AcmeChallengeKind::Http01),
        ..Default::default()
    };

    let result = service.start(config).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        ProxyError::InvalidConfig { reason } => {
            assert!(reason.contains("ACME domain is required"));
        }
        _ => panic!("Expected InvalidConfig error"),
    }
}

#[tokio::test]
async fn test_proxy_service_start_https_acme_valid() {
    let controller = Arc::new(MockProxyController::new());
    let repository = Arc::new(MockProxyRepository::new());
    let service = ProxyService::new(controller.clone(), repository.clone());

    let config = ProxyConfig {
        mode: ProxyMode::HttpsAcme,
        port: 28084, // Use a high port to avoid conflicts
        acme_email: Some("test@example.com".to_string()),
        acme_domain: Some("example.com".to_string()),
        acme_challenge: Some(AcmeChallengeKind::Http01),
        ..Default::default()
    };

    let handle = service.start(config).await.unwrap();
    assert_eq!(handle.port, 28084);
    assert_eq!(handle.mode, ProxyMode::HttpsAcme);
    assert_eq!(handle.https_port, Some(28085));
    assert!(handle.running);
}

#[tokio::test]
async fn test_proxy_service_start_rejects_https_port_overflow() {
    let controller = Arc::new(MockProxyController::new());
    let repository = Arc::new(MockProxyRepository::new());
    let service = ProxyService::new(controller, repository);

    let config = ProxyConfig {
        mode: ProxyMode::DevSelfSigned,
        port: u16::MAX,
        ..Default::default()
    };

    let result = service.start(config).await;
    match result {
        Err(ProxyError::InvalidConfig { reason }) => {
            assert!(
                reason.contains("HTTPS port"),
                "expected overflow message, got {reason}"
            );
        }
        other => panic!("Expected InvalidConfig error, got {other:?}"),
    }
}

#[tokio::test]
async fn test_proxy_service_stop() {
    let controller = Arc::new(MockProxyController::new());
    let repository = Arc::new(MockProxyRepository::new());
    let service = ProxyService::new(controller.clone(), repository);

    // Start a proxy
    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: 28081, // Use a high port to avoid conflicts
        ..Default::default()
    };

    let handle = service.start(config).await.unwrap();

    // Stop the proxy
    service.stop(handle.clone()).await.unwrap();

    // Verify handle was removed from controller
    let handles = controller.handles.lock().unwrap();
    assert!(!handles.iter().any(|h| h.id == handle.id));
}

#[tokio::test]
async fn test_proxy_service_status() {
    let controller = Arc::new(MockProxyController::new());
    let repository = Arc::new(MockProxyRepository::new());
    let service = ProxyService::new(controller, repository);

    // Status should return empty vector (repository returns empty)
    let handles = service.status().await.unwrap();
    assert_eq!(handles.len(), 0);
}

#[tokio::test]
async fn test_proxy_service_start_port_in_use() {
    use std::net::TcpListener;

    let controller = Arc::new(MockProxyController::new());
    let repository = Arc::new(MockProxyRepository::new());
    let service = ProxyService::new(controller, repository);

    // Find an available port and bind to it to simulate it being in use
    let test_port = (28082..29000)
        .find(|&port| TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok())
        .expect("Failed to find available port for test");
    let _listener =
        TcpListener::bind(format!("127.0.0.1:{}", test_port)).expect("Failed to bind test port");

    let config = ProxyConfig {
        mode: ProxyMode::LocalHttp,
        port: test_port,
        listen_addr: "127.0.0.1".to_string(),
        ..Default::default()
    };

    let result = service.start(config).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        ProxyError::PortInUse { port } => {
            assert_eq!(port, test_port);
        }
        _ => panic!("Expected PortInUse error"),
    }
}

#[tokio::test]
async fn test_proxy_service_start_https_port_in_use() {
    use std::net::TcpListener;

    let controller = Arc::new(MockProxyController::new());
    let repository = Arc::new(MockProxyRepository::new());
    let service = ProxyService::new(controller, repository);

    // Find an available port pair (HTTP and HTTPS ports)
    let test_port = (29001..30000)
        .step_by(2)
        .find(|&port| {
            TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
                && TcpListener::bind(format!("127.0.0.1:{}", port + 1)).is_ok()
        })
        .expect("Failed to find available port pair for test");
    let https_port = test_port + 1;
    let _listener = TcpListener::bind(format!("127.0.0.1:{}", https_port))
        .expect("Failed to bind test HTTPS port");

    let config = ProxyConfig {
        mode: ProxyMode::DevSelfSigned,
        port: test_port,
        listen_addr: "127.0.0.1".to_string(),
        ..Default::default()
    };

    let result = service.start(config).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        ProxyError::PortInUse { port } => {
            assert_eq!(port, https_port);
        }
        _ => panic!("Expected PortInUse error for HTTPS port"),
    }
}
