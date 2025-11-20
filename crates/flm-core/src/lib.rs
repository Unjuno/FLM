//! FLM Core Library
//!
//! This crate provides the domain layer for FLM, including:
//! - Domain models and data structures
//! - Service layer (EngineService, ProxyService, SecurityService, ConfigService)
//! - Port traits (abstract interfaces for adapters)
//!
//! See `docs/CORE_API.md` for the complete API specification.

pub mod domain;
pub mod error;
pub mod ports;
pub mod services;

// Re-export commonly used types
pub use domain::*;
pub use error::*;
