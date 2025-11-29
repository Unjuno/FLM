use clap::{Args, Subcommand};

#[derive(Subcommand, Clone)]
pub enum SecretsSubcommand {
    /// DNS credential profile management
    Dns {
        #[command(subcommand)]
        subcommand: DnsSubcommand,
    },
}

#[derive(Subcommand, Clone)]
pub enum DnsSubcommand {
    /// Register a DNS provider credential (metadata stored in security.db, secret in OS keyring)
    Add(DnsAddArgs),
    /// List stored DNS credential profiles
    List,
    /// Remove a DNS credential profile (also clears keyring entry)
    Remove(DnsRemoveArgs),
}

#[derive(Args, Clone)]
pub struct DnsAddArgs {
    /// DNS provider identifier (e.g., cloudflare)
    #[arg(long, value_parser = ["cloudflare"], default_value = "cloudflare")]
    pub provider: String,
    /// Friendly label for this credential profile
    #[arg(long)]
    pub label: String,
    /// Provider-specific zone identifier
    #[arg(long = "zone-id")]
    pub zone_id: String,
    /// Optional DNS zone name (for display)
    #[arg(long = "zone-name")]
    pub zone_name: Option<String>,
    /// Raw API token value (avoid shell history; consider --token-stdin)
    #[arg(long = "token")]
    pub token: Option<String>,
    /// Read API token from stdin (pipe)
    #[arg(long = "token-stdin", default_value_t = false)]
    pub token_stdin: bool,
}

#[derive(Args, Clone)]
pub struct DnsRemoveArgs {
    /// Credential profile ID to delete
    #[arg(long)]
    pub id: String,
}
