//! Domain models and data structures
//!
//! All types are defined according to `docs/CORE_API.md` section 2.
//!
//! This module contains the core domain models that are shared across
//! CLI, Proxy, and UI adapters.

pub mod chat;
pub mod engine;
pub mod models;
pub mod proxy;
pub mod security;

pub use chat::*;
pub use engine::*;
pub use models::*;
pub use proxy::*;
pub use security::*;
