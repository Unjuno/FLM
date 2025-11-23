//! CLI command definitions
//!
//! This module contains all CLI command definitions using clap.

pub mod api_keys;
pub mod chat;
pub mod config;
pub mod engines;
pub mod models;
pub mod proxy;
pub mod security;

use clap::{Parser, Subcommand};

/// FLM CLI - Command-line interface for FLM
#[derive(Parser)]
#[command(name = "flm")]
#[command(about = "FLM CLI - Manage LLM engines, proxies, and security")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Output format (json or text)
    #[arg(global = true, long, default_value = "text")]
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
    /// Engine management
    Engines {
        #[command(subcommand)]
        subcommand: engines::EnginesSubcommand,
    },
    /// Model management
    Models {
        #[command(subcommand)]
        subcommand: models::ModelsSubcommand,
    },
    /// Proxy management
    Proxy {
        #[command(subcommand)]
        subcommand: proxy::ProxySubcommand,
    },
    /// Security management
    Security {
        #[command(subcommand)]
        subcommand: security::SecuritySubcommand,
    },
    /// Check database integrity
    Check {
        /// Show detailed information about each check
        #[arg(long)]
        verbose: bool,
    },
    /// Chat with LLM models
    Chat(chat::Chat),
}
