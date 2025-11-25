//! Adapter implementations for flm-cli
//!
//! This module contains concrete implementations of port traits
//! defined in flm-core.

pub mod api_prompts;
pub mod config;
pub mod engine;
pub mod http;
pub mod model_profiles;
pub mod process_controller;
pub mod proxy;
pub mod security;

// Re-export for convenience
pub use api_prompts::{ApiPromptRecord, ApiPromptStore};
pub use config::SqliteConfigRepository;
pub use engine::SqliteEngineRepository;
pub use http::ReqwestHttpClient;
pub use model_profiles::{ModelProfileRecord, ModelProfileStore};
pub use process_controller::DefaultEngineProcessController;
pub use proxy::SqliteProxyRepository;
pub use security::SqliteSecurityRepository;
