//! Tests for SecurityService

use flm_core::domain::security::{ApiKeyRecord, SecurityPolicy};
use flm_core::error::RepoError;
use flm_core::ports::SecurityRepository;
use flm_core::services::SecurityService;
use std::sync::{Arc, Mutex};

/// Mock SecurityRepository for testing
struct MockSecurityRepository {
    api_keys: Arc<Mutex<Vec<ApiKeyRecord>>>,
    policies: Arc<Mutex<Vec<SecurityPolicy>>>,
}

impl MockSecurityRepository {
    fn new() -> Self {
        Self {
            api_keys: Arc::new(Mutex::new(Vec::new())),
            policies: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[async_trait::async_trait]
impl SecurityRepository for MockSecurityRepository {
    async fn list_api_keys(&self) -> Result<Vec<ApiKeyRecord>, RepoError> {
        let keys = self.api_keys.lock().unwrap();
        Ok(keys.clone())
    }

    async fn list_active_api_keys(&self) -> Result<Vec<ApiKeyRecord>, RepoError> {
        let keys = self.api_keys.lock().unwrap();
        Ok(keys
            .iter()
            .filter(|k| k.revoked_at.is_none())
            .cloned()
            .collect())
    }

    async fn fetch_api_key(&self, id: &str) -> Result<Option<ApiKeyRecord>, RepoError> {
        let keys = self.api_keys.lock().unwrap();
        Ok(keys.iter().find(|k| k.id == id).cloned())
    }

    async fn save_api_key(&self, record: ApiKeyRecord) -> Result<(), RepoError> {
        let mut keys = self.api_keys.lock().unwrap();
        if let Some(existing) = keys.iter_mut().find(|k| k.id == record.id) {
            *existing = record;
        } else {
            keys.push(record);
        }
        Ok(())
    }

    async fn mark_api_key_revoked(&self, id: &str, revoked_at: &str) -> Result<(), RepoError> {
        let mut keys = self.api_keys.lock().unwrap();
        if let Some(key) = keys.iter_mut().find(|k| k.id == id) {
            key.revoked_at = Some(revoked_at.to_string());
        }
        Ok(())
    }

    async fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError> {
        let policies = self.policies.lock().unwrap();
        Ok(policies.clone())
    }

    async fn fetch_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError> {
        let policies = self.policies.lock().unwrap();
        Ok(policies.iter().find(|p| p.id == id).cloned())
    }

    async fn save_policy(&self, policy: SecurityPolicy) -> Result<(), RepoError> {
        let mut policies = self.policies.lock().unwrap();
        if let Some(existing) = policies.iter_mut().find(|p| p.id == policy.id) {
            *existing = policy;
        } else {
            policies.push(policy);
        }
        Ok(())
    }
}

#[tokio::test]
async fn test_verify_api_key_valid() {
    let repo = MockSecurityRepository::new();
    let service = SecurityService::new(repo);

    // Create an API key
    let result = service.create_api_key("test-key").await.unwrap();
    let plain_key = result.plain;

    // Verify the key
    let verified = service.verify_api_key(&plain_key).await.unwrap();
    assert!(verified.is_some());
    assert_eq!(verified.unwrap().id, result.record.id);
}

#[tokio::test]
async fn test_verify_api_key_invalid() {
    let repo = MockSecurityRepository::new();
    let service = SecurityService::new(repo);

    // Try to verify a non-existent key
    let verified = service.verify_api_key("invalid-key").await.unwrap();
    assert!(verified.is_none());
}

#[tokio::test]
async fn test_verify_api_key_revoked() {
    let repo = MockSecurityRepository::new();
    let service = SecurityService::new(repo);

    // Create an API key
    let result = service.create_api_key("test-key").await.unwrap();
    let plain_key = result.plain;
    let key_id = result.record.id.clone();

    // Revoke the key
    service.revoke_api_key(&key_id).await.unwrap();

    // Try to verify the revoked key
    let verified = service.verify_api_key(&plain_key).await.unwrap();
    assert!(verified.is_none());
}

#[tokio::test]
async fn test_validate_domain() {
    // Valid domains
    assert!(SecurityService::<MockSecurityRepository>::validate_domain("example.com").unwrap());
    assert!(SecurityService::<MockSecurityRepository>::validate_domain("api.example.com").unwrap());
    assert!(
        SecurityService::<MockSecurityRepository>::validate_domain("sub.domain.example.com")
            .unwrap()
    );

    // Invalid domains
    assert!(!SecurityService::<MockSecurityRepository>::validate_domain("").unwrap());
    assert!(!SecurityService::<MockSecurityRepository>::validate_domain("example").unwrap()); // No TLD
    assert!(!SecurityService::<MockSecurityRepository>::validate_domain("-example.com").unwrap()); // Starts with hyphen
    assert!(!SecurityService::<MockSecurityRepository>::validate_domain("example-.com").unwrap()); // Ends with hyphen
    assert!(!SecurityService::<MockSecurityRepository>::validate_domain(".example.com").unwrap()); // Starts with dot
    assert!(!SecurityService::<MockSecurityRepository>::validate_domain("example.com.").unwrap());
    // Ends with dot
}
