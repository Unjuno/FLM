//! Tests for ProxyRepository
//!
//! These tests verify that ProxyRepository works correctly with actual database operations.

use flm_cli::adapters::SqliteProxyRepository;
use flm_core::domain::proxy::{AcmeChallengeKind, ProxyConfig, ProxyMode, ProxyProfile};
use flm_core::ports::ProxyRepository;
use std::path::PathBuf;
use tempfile::TempDir;

/// Helper to create a temporary database directory
fn create_temp_db_dir() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");
    (temp_dir, config_db)
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_repository_save_and_load_profile() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    // Create repository (migrations run automatically in new())
    let repo = SqliteProxyRepository::new(&config_db).await.unwrap();

    // Create a test profile
    let profile = ProxyProfile {
        id: "test-profile-1".to_string(),
        config: ProxyConfig {
            mode: ProxyMode::LocalHttp,
            port: 8080,
            ..Default::default()
        },
        created_at: "2025-01-01T00:00:00Z".to_string(),
    };

    // Save profile
    repo.save_profile(profile.clone()).await.unwrap();

    // Load profile
    let loaded = repo.load_profile("test-profile-1").await.unwrap();
    assert!(loaded.is_some());
    let loaded_profile = loaded.unwrap();
    assert_eq!(loaded_profile.id, "test-profile-1");
    assert_eq!(loaded_profile.config.port, 8080);
    assert_eq!(loaded_profile.config.mode, ProxyMode::LocalHttp);
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_repository_load_nonexistent_profile() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    // Create repository
    let repo = SqliteProxyRepository::new(&config_db).await.unwrap();

    // Try to load a non-existent profile
    let loaded = repo.load_profile("nonexistent").await.unwrap();
    assert!(loaded.is_none());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_repository_list_profiles() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    // Create repository
    let repo = SqliteProxyRepository::new(&config_db).await.unwrap();

    // Create multiple profiles
    let profile1 = ProxyProfile {
        id: "profile-1".to_string(),
        config: ProxyConfig {
            mode: ProxyMode::LocalHttp,
            port: 8080,
            ..Default::default()
        },
        created_at: "2025-01-01T00:00:00Z".to_string(),
    };

    let profile2 = ProxyProfile {
        id: "profile-2".to_string(),
        config: ProxyConfig {
            mode: ProxyMode::DevSelfSigned,
            port: 8443,
            ..Default::default()
        },
        created_at: "2025-01-02T00:00:00Z".to_string(),
    };

    // Save profiles
    repo.save_profile(profile1).await.unwrap();
    repo.save_profile(profile2).await.unwrap();

    // List profiles
    let profiles = repo.list_profiles().await.unwrap();
    assert_eq!(profiles.len(), 2);

    // Profiles should be ordered by created_at DESC
    assert_eq!(profiles[0].id, "profile-2");
    assert_eq!(profiles[1].id, "profile-1");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_repository_save_profile_with_acme_config() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    // Create repository
    let repo = SqliteProxyRepository::new(&config_db).await.unwrap();

    // Create a profile with ACME configuration
    let profile = ProxyProfile {
        id: "acme-profile".to_string(),
        config: ProxyConfig {
            mode: ProxyMode::HttpsAcme,
            port: 8080,
            acme_email: Some("test@example.com".to_string()),
            acme_domain: Some("example.com".to_string()),
            acme_challenge: Some(AcmeChallengeKind::Http01),
            ..Default::default()
        },
        created_at: "2025-01-01T00:00:00Z".to_string(),
    };

    // Save profile
    repo.save_profile(profile.clone()).await.unwrap();

    // Load profile
    let loaded = repo.load_profile("acme-profile").await.unwrap();
    assert!(loaded.is_some());
    let loaded_profile = loaded.unwrap();
    assert_eq!(loaded_profile.config.mode, ProxyMode::HttpsAcme);
    assert_eq!(
        loaded_profile.config.acme_email,
        Some("test@example.com".to_string())
    );
    assert_eq!(
        loaded_profile.config.acme_domain,
        Some("example.com".to_string())
    );
    assert_eq!(
        loaded_profile.config.acme_challenge,
        Some(AcmeChallengeKind::Http01)
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_repository_replace_existing_profile() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    // Create repository
    let repo = SqliteProxyRepository::new(&config_db).await.unwrap();

    // Create initial profile
    let profile1 = ProxyProfile {
        id: "replace-test".to_string(),
        config: ProxyConfig {
            mode: ProxyMode::LocalHttp,
            port: 8080,
            ..Default::default()
        },
        created_at: "2025-01-01T00:00:00Z".to_string(),
    };

    // Save profile
    repo.save_profile(profile1).await.unwrap();

    // Replace with new profile (same ID, different config)
    let profile2 = ProxyProfile {
        id: "replace-test".to_string(),
        config: ProxyConfig {
            mode: ProxyMode::DevSelfSigned,
            port: 8443,
            ..Default::default()
        },
        created_at: "2025-01-02T00:00:00Z".to_string(),
    };

    // Save again (should replace)
    repo.save_profile(profile2).await.unwrap();

    // Load profile
    let loaded = repo.load_profile("replace-test").await.unwrap();
    assert!(loaded.is_some());
    let loaded_profile = loaded.unwrap();
    assert_eq!(loaded_profile.config.port, 8443);
    assert_eq!(loaded_profile.config.mode, ProxyMode::DevSelfSigned);
}

#[tokio::test(flavor = "multi_thread")]
async fn test_proxy_repository_list_active_handles() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    // Create repository
    let repo = SqliteProxyRepository::new(&config_db).await.unwrap();

    // List active handles (should return empty vector for now)
    let handles = repo.list_active_handles().await.unwrap();
    assert_eq!(handles.len(), 0);
}
