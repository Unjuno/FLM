//! Models command definitions

use clap::Subcommand;

#[derive(Subcommand, Clone)]
pub enum ModelsSubcommand {
    /// List available models for an engine
    List {
        /// Engine ID to list models for (e.g., "ollama-default")
        #[arg(long)]
        engine: String,
    },
}
