//! Tests for ConfigService

use flm_core::error::RepoError;
use flm_core::ports::ConfigRepository;
use flm_core::services::ConfigService;
use std::sync::Mutex;

/// Mock ConfigRepository for testing
struct MockConfigRepository {
    data: Mutex<std::collections::HashMap<String, String>>,
}

impl MockConfigRepository {
    fn new() -> Self {
        Self {
            data: Mutex::new(std::collections::HashMap::new()),
        }
    }
}

#[async_trait::async_trait]
impl ConfigRepository for MockConfigRepository {
    async fn get(&self, key: &str) -> Result<Option<String>, RepoError> {
        let data = self.data.lock().unwrap();
        Ok(data.get(key).cloned())
    }

    async fn set(&self, key: &str, value: &str) -> Result<(), RepoError> {
        let mut data = self.data.lock().unwrap();
        data.insert(key.to_string(), value.to_string());
        Ok(())
    }

    async fn list(&self) -> Result<Vec<(String, String)>, RepoError> {
        let data = self.data.lock().unwrap();
        Ok(data.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
    }
}

#[tokio::test]
async fn test_config_service_get_nonexistent() {
    let repo = MockConfigRepository::new();
    let service = ConfigService::new(repo);

    // Test getting a non-existent key
    let result = service.get("nonexistent").await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_none());
}

#[tokio::test]
async fn test_config_service_set_and_get() {
    let repo = MockConfigRepository::new();
    let service = ConfigService::new(repo);

    // Test setting a value
    let result = service.set("test_key", "test_value").await;
    assert!(result.is_ok());

    // Test getting the value
    let result = service.get("test_key").await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), Some("test_value".to_string()));
}

#[tokio::test]
async fn test_config_service_list() {
    let repo = MockConfigRepository::new();
    let service = ConfigService::new(repo);

    // Test listing (should be empty initially)
    let result = service.list().await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_empty());

    // Add some values
    service.set("key1", "value1").await.unwrap();
    service.set("key2", "value2").await.unwrap();

    // Test listing with values
    let result = service.list().await;
    assert!(result.is_ok());
    let list = result.unwrap();
    assert_eq!(list.len(), 2);
}

#[tokio::test]
async fn test_config_service_set_empty_key() {
    let repo = MockConfigRepository::new();
    let service = ConfigService::new(repo);

    // Test setting a value with empty key (should still work)
    let result = service.set("", "value").await;
    assert!(result.is_ok());

    // Test getting the value
    let result = service.get("").await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), Some("value".to_string()));
}

#[tokio::test]
async fn test_config_service_set_empty_value() {
    let repo = MockConfigRepository::new();
    let service = ConfigService::new(repo);

    // Test setting a value with empty value (should still work)
    let result = service.set("key", "").await;
    assert!(result.is_ok());

    // Test getting the value
    let result = service.get("key").await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), Some("".to_string()));
}

#[tokio::test]
async fn test_config_service_list_empty() {
    let repo = MockConfigRepository::new();
    let service = ConfigService::new(repo);

    // Test listing when empty
    let result = service.list().await;
    assert!(result.is_ok());
    assert!(result.unwrap().is_empty());
}
