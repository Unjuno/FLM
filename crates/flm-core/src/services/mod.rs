//! Service layer
//!
//! Services provide the main API for CLI, Proxy, and UI adapters.
//! See `docs/CORE_API.md` section 5 for the complete specification.

pub mod config;
pub mod engine;
pub mod proxy;
pub mod security;

pub use config::*;
pub use engine::*;
pub use proxy::*;
pub use security::*;
