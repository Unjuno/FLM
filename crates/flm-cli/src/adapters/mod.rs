//! Adapter implementations for flm-cli
//!
//! This module contains concrete implementations of port traits
//! defined in flm-core.

pub mod config;
pub mod security;

// Re-export for convenience
pub use config::SqliteConfigRepository;
pub use security::SqliteSecurityRepository;
