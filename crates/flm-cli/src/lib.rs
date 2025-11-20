//! FLM CLI Library
//!
//! This crate provides the CLI implementation for FLM.

pub mod adapters;
pub mod db;

// Re-export for convenience
pub use adapters::{SqliteConfigRepository, SqliteSecurityRepository};

