//! FLM CLI Library
//!
//! This crate provides the CLI implementation for FLM.

pub mod adapters;
pub mod cli;
pub mod commands;
pub mod db;
pub mod utils;

// Re-export for convenience
pub use adapters::{SqliteConfigRepository, SqliteSecurityRepository};
