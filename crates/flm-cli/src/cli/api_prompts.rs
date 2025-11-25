//! API prompts CLI definitions

use clap::Subcommand;

#[derive(Subcommand, Clone)]
pub enum ApiSubcommand {
    /// Manage API prompt templates
    #[command(name = "prompts")]
    Prompts {
        #[command(subcommand)]
        subcommand: ApiPromptsSubcommand,
    },
}

#[derive(Subcommand, Clone)]
pub enum ApiPromptsSubcommand {
    /// List all API prompts
    List,
    /// Show prompt by API ID
    Show {
        /// API identifier (e.g. chat_completions)
        #[arg(long = "api-id")]
        api_id: String,
    },
    /// Set (create/update) a prompt from file
    Set {
        /// API identifier
        #[arg(long = "api-id")]
        api_id: String,
        /// Path to prompt template file (UTF-8 text)
        #[arg(long = "file")]
        file: String,
    },
}
