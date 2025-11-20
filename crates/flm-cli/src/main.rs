//! FLM CLI - Command-line interface

use clap::{Parser, Subcommand};
use flm_core::VERSION;

#[derive(Parser)]
#[command(name = "flm")]
#[command(version = VERSION)]
#[command(about = "Flexible LLM Manager - Manage local LLM engines", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Detect and list available engines
    #[command(subcommand)]
    Engines(EngineCommands),

    /// List and manage models
    #[command(subcommand)]
    Models(ModelCommands),

    /// Manage proxy server
    #[command(subcommand)]
    Proxy(ProxyCommands),

    /// Configuration management
    #[command(subcommand)]
    Config(ConfigCommands),

    /// API key management
    #[command(subcommand)]
    ApiKeys(ApiKeyCommands),
}

#[derive(Subcommand)]
enum EngineCommands {
    /// Detect available engines
    Detect,
}

#[derive(Subcommand)]
enum ModelCommands {
    /// List available models
    List {
        /// Filter by engine ID
        #[arg(short, long)]
        engine: Option<String>,
    },
}

#[derive(Subcommand)]
enum ProxyCommands {
    /// Start proxy server
    Start {
        /// Port to listen on
        #[arg(short, long, default_value = "8080")]
        port: u16,

        /// Proxy mode
        #[arg(short, long, default_value = "local-http")]
        mode: String,
    },

    /// Stop proxy server
    Stop,

    /// Show proxy status
    Status,
}

#[derive(Subcommand)]
enum ConfigCommands {
    /// Get configuration value
    Get { key: String },

    /// Set configuration value
    Set { key: String, value: String },
}

#[derive(Subcommand)]
enum ApiKeyCommands {
    /// Generate new API key
    Generate {
        /// Label for the key
        #[arg(short, long)]
        label: Option<String>,
    },

    /// List API keys
    List,

    /// Revoke an API key
    Revoke { key_id: String },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Engines(cmd) => match cmd {
            EngineCommands::Detect => {
                println!("Detecting engines...");
                // TODO: Implement engine detection
                println!("Engine detection not yet implemented");
            }
        },
        Commands::Models(cmd) => match cmd {
            ModelCommands::List { engine } => {
                if let Some(engine_id) = engine {
                    println!("Listing models for engine: {}", engine_id);
                } else {
                    println!("Listing all models...");
                }
                // TODO: Implement model listing
                println!("Model listing not yet implemented");
            }
        },
        Commands::Proxy(cmd) => match cmd {
            ProxyCommands::Start { port, mode } => {
                println!("Starting proxy on port {} in {} mode...", port, mode);
                // TODO: Implement proxy start
                println!("Proxy start not yet implemented");
            }
            ProxyCommands::Stop => {
                println!("Stopping proxy...");
                // TODO: Implement proxy stop
                println!("Proxy stop not yet implemented");
            }
            ProxyCommands::Status => {
                println!("Checking proxy status...");
                // TODO: Implement proxy status
                println!("Proxy status not yet implemented");
            }
        },
        Commands::Config(cmd) => match cmd {
            ConfigCommands::Get { key } => {
                println!("Getting config: {}", key);
                // TODO: Implement config get
                println!("Config get not yet implemented");
            }
            ConfigCommands::Set { key, value } => {
                println!("Setting config: {} = {}", key, value);
                // TODO: Implement config set
                println!("Config set not yet implemented");
            }
        },
        Commands::ApiKeys(cmd) => match cmd {
            ApiKeyCommands::Generate { label } => {
                if let Some(label) = label {
                    println!("Generating API key with label: {}", label);
                } else {
                    println!("Generating API key...");
                }
                // TODO: Implement API key generation
                println!("API key generation not yet implemented");
            }
            ApiKeyCommands::List => {
                println!("Listing API keys...");
                // TODO: Implement API key listing
                println!("API key listing not yet implemented");
            }
            ApiKeyCommands::Revoke { key_id } => {
                println!("Revoking API key: {}", key_id);
                // TODO: Implement API key revocation
                println!("API key revocation not yet implemented");
            }
        },
    }

    Ok(())
}
