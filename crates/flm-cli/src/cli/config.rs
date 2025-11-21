//! Config command implementation

use clap::Subcommand;

#[derive(Subcommand, Clone)]
pub enum ConfigSubcommand {
    /// Get a configuration value
    Get {
        /// Configuration key
        key: String,
    },
    /// Set a configuration value
    Set {
        /// Configuration key
        key: String,
        /// Configuration value
        value: String,
    },
    /// List all configuration values
    List,
}
