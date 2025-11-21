//! API keys command implementation

use clap::Subcommand;

#[derive(Subcommand, Clone)]
pub enum ApiKeysSubcommand {
    /// Create a new API key
    Create {
        /// Human-readable label for the API key
        #[arg(long)]
        label: String,
    },
    /// List all API keys (metadata only)
    List,
    /// Revoke an API key
    Revoke {
        /// API key ID to revoke
        id: String,
    },
    /// Rotate an API key (revoke old and create new)
    Rotate {
        /// API key ID to rotate
        id: String,
        /// Optional new label (if not provided, uses old label)
        #[arg(long)]
        label: Option<String>,
    },
}
