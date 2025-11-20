//! FLM Proxy - HTTP(S) authentication proxy
//!
//! Provides secure proxy functionality with authentication, rate limiting,
//! and TLS support.

pub mod server;
pub mod middleware;

pub use server::ProxyServer;
