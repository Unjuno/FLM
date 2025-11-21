//! FLM CLI
//!
//! Command-line interface for FLM.
//! See `docs/CLI_SPEC.md` for the complete command specification.

use clap::Parser;
use flm_cli::cli::{Cli, Commands};
use flm_cli::commands;

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    let result = match &cli.command {
        Commands::Config { subcommand } => {
            commands::config::execute(subcommand.clone(), cli.db_path_config).await
        }
        Commands::ApiKeys { subcommand } => {
            commands::api_keys::execute(subcommand.clone(), cli.db_path_security).await
        }
    };

    if let Err(e) = result {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}
