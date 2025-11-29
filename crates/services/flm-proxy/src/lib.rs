//! FLM Proxy Library
//!
//! This crate provides the Axum-based HTTP proxy server implementation.

pub mod adapters;
pub mod certificate;
pub mod controller;
pub mod dns;
pub mod engine_repo;
pub mod http_client;
pub mod metrics;
pub mod middleware;
pub mod process_controller;
pub mod security;
pub mod utils;

pub use controller::AxumProxyController;
