//! Minimal EngineRepository implementation for flm-proxy
//!
//! This is a simple in-memory implementation for the proxy server.
//! Engines should be registered by the CLI before starting the proxy.

use async_trait::async_trait;
use flm_core::ports::{EngineRepository, LlmEngine};
use std::sync::{Arc, RwLock};

/// Simple in-memory EngineRepository for proxy server
pub struct InMemoryEngineRepository {
    engines: Arc<RwLock<Vec<Arc<dyn LlmEngine>>>>,
}

impl InMemoryEngineRepository {
    /// Create a new InMemoryEngineRepository
    pub fn new() -> Self {
        Self {
            engines: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

impl Default for InMemoryEngineRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl EngineRepository for InMemoryEngineRepository {
    async fn list_registered(&self) -> Vec<Arc<dyn LlmEngine>> {
        match self.engines.read() {
            Ok(engines) => engines.clone(),
            Err(e) => {
                eprintln!("ERROR: Failed to acquire read lock on engines: {}. Returning empty list.", e);
                Vec::new()
            }
        }
    }

    async fn register(&self, engine: Arc<dyn LlmEngine>) {
        match self.engines.write() {
            Ok(mut engines) => {
                // Remove existing engine with same ID if any
                engines.retain(|e| e.id() != engine.id());
                engines.push(engine);
            }
            Err(e) => {
                eprintln!("ERROR: Failed to acquire write lock on engines: {}. Engine registration skipped.", e);
            }
        }
    }
}
