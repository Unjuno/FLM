//! Port traits (abstract interfaces)
//!
//! These traits define the boundaries between Domain and Application/Adapter layers.
//! Implementations are provided by adapters (flm-cli, flm-proxy, etc.).
//!
//! See `docs/CORE_API.md` section 4 for the complete specification.

pub mod config;
pub mod engine;
pub mod engine_health_log;
pub mod http;
pub mod proxy;
pub mod security;

pub use config::*;
pub use engine::*;
pub use engine_health_log::*;
pub use http::*;
pub use proxy::*;
pub use security::*;
