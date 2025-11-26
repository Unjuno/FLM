//! FLM Proxy
//!
//! HTTP(S) proxy server for FLM.
//! See `docs/PROXY_SPEC.md` for the complete specification.

mod adapters;
mod controller;
mod daemon;
mod engine_repo;
mod http_client;
mod middleware;
mod process_controller;
mod security;
mod utils;

pub use controller::AxumProxyController;
pub use middleware::AppState;

use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(author, version, about)]
struct ProxyArgs {
    /// Run the proxy controller daemon
    #[arg(long)]
    daemon: bool,
    /// Path to config.db (required in daemon mode)
    #[arg(long)]
    config_db: Option<PathBuf>,
    /// Path to security.db (required in daemon mode)
    #[arg(long)]
    security_db: Option<PathBuf>,
    /// Path to daemon state file (required in daemon mode)
    #[arg(long)]
    state_file: Option<PathBuf>,
    /// Admin API port (required in daemon mode)
    #[arg(long)]
    admin_port: Option<u16>,
    /// Admin bearer token (required in daemon mode)
    #[arg(long)]
    admin_token: Option<String>,
}

impl ProxyArgs {
    fn into_daemon_config(self) -> anyhow::Result<daemon::DaemonConfig> {
        let config_db = self
            .config_db
            .ok_or_else(|| anyhow::anyhow!("--config-db is required in daemon mode"))?;
        let security_db = self
            .security_db
            .ok_or_else(|| anyhow::anyhow!("--security-db is required in daemon mode"))?;
        let state_file = self
            .state_file
            .ok_or_else(|| anyhow::anyhow!("--state-file is required in daemon mode"))?;
        let admin_port = self
            .admin_port
            .ok_or_else(|| anyhow::anyhow!("--admin-port is required in daemon mode"))?;
        let admin_token = self
            .admin_token
            .ok_or_else(|| anyhow::anyhow!("--admin-token is required in daemon mode"))?;

        Ok(daemon::DaemonConfig {
            config_db,
            security_db,
            state_file,
            admin_port,
            admin_token,
        })
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let args = ProxyArgs::parse();

    if args.daemon {
        let config = args.into_daemon_config()?;
        daemon::run_daemon(config).await?;
    } else {
        println!("FLM Proxy - Under construction");
    }

    Ok(())
}
