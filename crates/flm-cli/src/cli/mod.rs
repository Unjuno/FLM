//! CLI command definitions
//!
//! This module contains all CLI command definitions using clap.

pub mod api_keys;
pub mod config;

use clap::{Parser, Subcommand};

/// FLM CLI - Command-line interface for FLM
#[derive(Parser)]
#[command(name = "flm")]
#[command(about = "FLM CLI - Manage LLM engines, proxies, and security")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Output format (json or text)
    #[arg(global = true, long, default_value = "json")]
    pub format: String,

    /// Path to config.db
    #[arg(global = true, long)]
    pub db_path_config: Option<String>,

    /// Path to security.db
    #[arg(global = true, long)]
    pub db_path_security: Option<String>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Configuration management
    Config {
        #[command(subcommand)]
        subcommand: config::ConfigSubcommand,
    },
    /// API key management
    #[command(name = "api-keys")]
    ApiKeys {
        #[command(subcommand)]
        subcommand: api_keys::ApiKeysSubcommand,
    },
}
