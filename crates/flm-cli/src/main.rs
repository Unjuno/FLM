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
            commands::config::execute(subcommand.clone(), cli.db_path_config, cli.format.clone())
                .await
        }
        Commands::ApiKeys { subcommand } => {
            commands::api_keys::execute(
                subcommand.clone(),
                cli.db_path_security,
                cli.format.clone(),
            )
            .await
        }
        Commands::Engines { subcommand } => {
            commands::engines::execute(subcommand.clone(), cli.db_path_config, cli.format.clone())
                .await
        }
        Commands::Models { subcommand } => {
            commands::models::execute(subcommand.clone(), cli.db_path_config, cli.format.clone())
                .await
        }
        Commands::Proxy { subcommand } => {
            commands::proxy::execute(
                subcommand.clone(),
                cli.db_path_config,
                cli.db_path_security,
                cli.format.clone(),
            )
            .await
        }
        Commands::Security { subcommand } => {
            commands::security::execute(
                subcommand.clone(),
                cli.db_path_security,
                cli.format.clone(),
            )
            .await
        }
        Commands::Check { verbose } => {
            commands::check::execute(
                *verbose,
                cli.db_path_config,
                cli.db_path_security,
                cli.format.clone(),
            )
            .await
        }
        Commands::Chat(chat) => {
            commands::chat::execute(chat.clone(), cli.db_path_config, cli.format.clone()).await
        }
    };

    if let Err(e) = result {
        eprintln!("Error: {e}");
        std::process::exit(2); // Internal error
    }
}
