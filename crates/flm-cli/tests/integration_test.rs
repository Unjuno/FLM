//! Integration tests for flm-cli
//!
//! These tests verify that CLI commands work correctly with actual database operations.

use flm_cli::adapters::{SqliteConfigRepository, SqliteSecurityRepository};
use flm_core::services::{ConfigService, SecurityService};
use std::path::PathBuf;
use tempfile::TempDir;

/// Helper to create a temporary database directory
fn create_temp_db_dir() -> (TempDir, PathBuf, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");
    let security_db = temp_dir.path().join("security.db");
    (temp_dir, config_db, security_db)
}

#[tokio::test(flavor = "multi_thread")]
async fn test_config_service_integration() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();

    // Create repository and service (migrations run automatically in new())
    let repo = SqliteConfigRepository::new(&config_db).await.unwrap();
    let service = ConfigService::new(repo);

    // Test set
    service.set("test_key", "test_value").await.unwrap();

    // Test get
    let value = service.get("test_key").await.unwrap();
    assert_eq!(value, Some("test_value".to_string()));

    // Test list
    let items = service.list().await.unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].0, "test_key");
    assert_eq!(items[0].1, "test_value");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_service_integration() {
    let (_temp_dir, _config_db, security_db) = create_temp_db_dir();

    // Create repository and service (migrations run automatically in new())
    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);

    // Test create API key
    let result = service.create_api_key("test_key").await.unwrap();
    assert!(!result.plain.is_empty());
    assert!(!result.record.hash.is_empty());
    assert_eq!(result.record.label, "test_key");

    // Test list API keys
    let keys = service.list_api_keys().await.unwrap();
    assert_eq!(keys.len(), 1);
    assert_eq!(keys[0].id, result.record.id);
    assert_eq!(keys[0].label, "test_key");

    // Test revoke API key
    service.revoke_api_key(&result.record.id).await.unwrap();

    // Verify it's revoked
    let keys_after_revoke = service.list_api_keys().await.unwrap();
    assert_eq!(keys_after_revoke.len(), 1);
    let revoked_key = keys_after_revoke
        .iter()
        .find(|k| k.id == result.record.id)
        .expect("Revoked key should be in the list");
    assert!(revoked_key.revoked_at.is_some(), "Key should be revoked");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_security_service_rotate() {
    let (_temp_dir, _config_db, security_db) = create_temp_db_dir();

    // Create repository and service (migrations run automatically in new())
    let repo = SqliteSecurityRepository::new(&security_db).await.unwrap();
    let service = SecurityService::new(repo);

    // Create initial key
    let initial = service.create_api_key("original").await.unwrap();
    let initial_id = initial.record.id.clone();

    // Rotate the key
    let rotated = service.rotate_api_key(&initial_id, None).await.unwrap();

    // Verify new key is different
    assert_ne!(rotated.record.id, initial_id);
    assert_eq!(rotated.record.label, "original");

    // Verify old key is revoked and new key exists
    let all_keys = service.list_api_keys().await.unwrap();
    assert_eq!(
        all_keys.len(),
        2,
        "Should have both old (revoked) and new keys"
    );

    // Find old and new keys
    let old_key_meta = all_keys.iter().find(|k| k.id == initial_id).unwrap();
    let new_key_meta = all_keys.iter().find(|k| k.id == rotated.record.id).unwrap();

    // Verify old key is revoked
    assert!(
        old_key_meta.revoked_at.is_some(),
        "Old key should be revoked"
    );

    // Verify new key is not revoked
    assert!(
        new_key_meta.revoked_at.is_none(),
        "New key should not be revoked"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_engine_service_detect_engines() {
    let (_temp_dir, config_db, _security_db) = create_temp_db_dir();

    // Create adapters
    use flm_cli::adapters::{
        DefaultEngineProcessController, ReqwestHttpClient, SqliteEngineRepository,
    };
    use flm_core::ports::{EngineRepository, LlmEngine};
    use flm_core::services::EngineService;
    use std::sync::Arc;

    let process_controller = Box::new(DefaultEngineProcessController::new());
    let http_client = Box::new(ReqwestHttpClient::new().unwrap());
    let engine_repo_arc = SqliteEngineRepository::new(&config_db).await.unwrap();

    // Wrapper to convert Arc to Box
    struct ArcEngineRepositoryWrapper(Arc<SqliteEngineRepository>);
    #[async_trait::async_trait]
    impl EngineRepository for ArcEngineRepositoryWrapper {
        async fn list_registered(&self) -> Vec<Arc<dyn LlmEngine>> {
            self.0.list_registered().await
        }
        async fn register(&self, engine: Arc<dyn LlmEngine>) {
            self.0.register(engine).await;
        }
    }

    let engine_repo: Box<dyn EngineRepository> =
        Box::new(ArcEngineRepositoryWrapper(engine_repo_arc));

    // Create service
    let service = EngineService::new(process_controller, http_client, engine_repo);

    // Detect engines
    let states = service.detect_engines().await.unwrap();

    // We can't guarantee engines are installed, so we just verify the structure
    for state in states {
        assert!(!state.id.is_empty());
        assert!(!state.name.is_empty());
        // Status should be one of the valid states
        match state.status {
            flm_core::domain::engine::EngineStatus::InstalledOnly => {}
            flm_core::domain::engine::EngineStatus::RunningHealthy { latency_ms: _ } => {}
            flm_core::domain::engine::EngineStatus::RunningDegraded {
                latency_ms: _,
                reason: _,
            } => {}
            flm_core::domain::engine::EngineStatus::ErrorNetwork {
                reason: _,
                consecutive_failures: _,
            } => {}
            flm_core::domain::engine::EngineStatus::ErrorApi { reason: _ } => {}
        }
    }
}
