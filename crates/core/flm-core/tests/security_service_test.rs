//! Tests for SecurityService

use flm_core::domain::security::{ApiKeyRecord, DnsCredentialProfile, SecurityPolicy};
use flm_core::error::RepoError;
use flm_core::ports::SecurityRepository;
use flm_core::services::SecurityService;
use std::sync::{Arc, Mutex};

/// Mock SecurityRepository for testing
struct MockSecurityRepository {
    api_keys: Arc<Mutex<Vec<ApiKeyRecord>>>,
    policies: Arc<Mutex<Vec<SecurityPolicy>>>,
    dns_credentials: Arc<Mutex<Vec<DnsCredentialProfile>>>,
}

impl MockSecurityRepository {
    fn new() -> Self {
        Self {
            api_keys: Arc::new(Mutex::new(Vec::new())),
            policies: Arc::new(Mutex::new(Vec::new())),
            dns_credentials: Arc::new(Mutex::new(Vec::new())),
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

    async fn upsert_dns_credential(&self, profile: DnsCredentialProfile) -> Result<(), RepoError> {
        let mut store = self.dns_credentials.lock().unwrap();
        if let Some(existing) = store.iter_mut().find(|p| p.id == profile.id) {
            *existing = profile;
        } else {
            store.push(profile);
        }
        Ok(())
    }

    async fn fetch_dns_credential(
        &self,
        id: &str,
    ) -> Result<Option<DnsCredentialProfile>, RepoError> {
        let store = self.dns_credentials.lock().unwrap();
        Ok(store.iter().find(|p| p.id == id).cloned())
    }

    async fn list_dns_credentials(&self) -> Result<Vec<DnsCredentialProfile>, RepoError> {
        let store = self.dns_credentials.lock().unwrap();
        Ok(store.clone())
    }

    async fn delete_dns_credential(&self, id: &str) -> Result<(), RepoError> {
        let mut store = self.dns_credentials.lock().unwrap();
        store.retain(|p| p.id != id);
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

#[tokio::test]
async fn test_set_policy_invalid_ip() {
    let repo = MockSecurityRepository::new();
    let service = SecurityService::new(repo);

    // Try to set a policy with invalid IP address
    let policy_json = serde_json::json!({
        "ip_whitelist": ["invalid-ip"]
    });

    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let result = service.set_policy(policy).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        RepoError::ValidationError { .. } => {}
        _ => panic!("Expected ValidationError"),
    }
}

#[tokio::test]
async fn test_set_policy_invalid_cidr() {
    let repo = MockSecurityRepository::new();
    let service = SecurityService::new(repo);

    // Try to set a policy with invalid CIDR notation
    let policy_json = serde_json::json!({
        "ip_whitelist": ["192.168.1.0/999"]
    });

    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json: serde_json::to_string(&policy_json).unwrap(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let result = service.set_policy(policy).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        RepoError::ValidationError { .. } => {}
        _ => panic!("Expected ValidationError"),
    }
}

#[tokio::test]
async fn test_create_api_key_empty_name() {
    let repo = MockSecurityRepository::new();
    let service = SecurityService::new(repo);

    // Create API key with empty name (should still work, but test error handling)
    let result = service.create_api_key("").await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_revoke_nonexistent_api_key() {
    let repo = MockSecurityRepository::new();
    let service = SecurityService::new(repo);

    // Try to revoke a non-existent API key
    let result = service.revoke_api_key("nonexistent-id").await;
    // Should succeed (idempotent operation)
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_rotate_nonexistent_api_key() {
    let repo = MockSecurityRepository::new();
    let service = SecurityService::new(repo);

    // Try to rotate a non-existent API key
    let result = service.rotate_api_key("nonexistent-id", None).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_verify_api_key_timing_attack_prevention() {
    let repo = MockSecurityRepository::new();
    let service = SecurityService::new(repo);

    // Create multiple API keys to test timing attack prevention
    let key1 = service.create_api_key("key1").await.unwrap();
    let key2 = service.create_api_key("key2").await.unwrap();
    let key3 = service.create_api_key("key3").await.unwrap();
    let key4 = service.create_api_key("key4").await.unwrap();
    let key5 = service.create_api_key("key5").await.unwrap();

    // Test that verification time is consistent regardless of which key matches
    // We verify all keys before returning, so the time should be similar
    // regardless of whether the key is at the beginning or end of the list

    // Verify the first key (should match early in the list)
    let start = std::time::Instant::now();
    let verified1 = service.verify_api_key(&key1.plain).await.unwrap();
    let time1 = start.elapsed();
    assert!(verified1.is_some());
    assert_eq!(verified1.unwrap().id, key1.record.id);

    // Verify the last key (should match late in the list)
    let start = std::time::Instant::now();
    let verified5 = service.verify_api_key(&key5.plain).await.unwrap();
    let time5 = start.elapsed();
    assert!(verified5.is_some());
    assert_eq!(verified5.unwrap().id, key5.record.id);

    // Verify an invalid key (should check all keys)
    let start = std::time::Instant::now();
    let verified_invalid = service
        .verify_api_key("invalid-key-that-does-not-exist")
        .await
        .unwrap();
    let time_invalid = start.elapsed();
    assert!(verified_invalid.is_none());

    // The verification times should be similar (within reasonable variance)
    // This ensures that all keys are checked regardless of match position
    // Note: We allow some variance due to system timing, but they should be close
    let max_time = time1.max(time5).max(time_invalid);
    let min_time = time1.min(time5).min(time_invalid);

    // Times should be within 2x of each other (allowing for system variance)
    // This is a basic check; a more sophisticated test would use statistical analysis
    assert!(
        max_time.as_nanos() <= min_time.as_nanos() * 2 || min_time.as_nanos() == 0,
        "Verification times should be similar regardless of key position. time1: {:?}, time5: {:?}, time_invalid: {:?}",
        time1, time5, time_invalid
    );
}
