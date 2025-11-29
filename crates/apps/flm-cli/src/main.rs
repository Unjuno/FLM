//! FLM CLI
//!
//! Command-line interface for FLM.
//! See `docs/CLI_SPEC.md` for the complete command specification.

use clap::Parser;
use flm_cli::cli::{Cli, Commands};
use flm_cli::commands::{self, CliUserError};

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
        Commands::ModelProfiles { subcommand } => {
            commands::model_profiles::execute(
                subcommand.clone(),
                cli.db_path_config,
                cli.format.clone(),
            )
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
        Commands::Secrets { subcommand } => {
            commands::secrets::execute(subcommand.clone(), cli.db_path_security, cli.format.clone())
                .await
        }
        Commands::Api { subcommand } => match subcommand {
            flm_cli::cli::api_prompts::ApiSubcommand::Prompts { subcommand } => {
                commands::api_prompts::execute(
                    subcommand.clone(),
                    cli.db_path_config,
                    cli.format.clone(),
                )
                .await
            }
        },
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
        Commands::Migrate { subcommand } => {
            commands::migrate::execute(
                subcommand.clone(),
                cli.db_path_config,
                cli.db_path_security,
                cli.format.clone(),
            )
            .await
        }
    };

    if let Err(err) = result {
        if let Some(user_err) = err.downcast_ref::<CliUserError>() {
            if let Some(message) = user_err.message() {
                eprintln!("{message}");
            }
            std::process::exit(1);
        } else {
            eprintln!("Error: {err}");
            std::process::exit(2); // Internal error
        }
    }
}
