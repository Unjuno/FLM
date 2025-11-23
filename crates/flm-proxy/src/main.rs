//! FLM Proxy
//!
//! HTTP(S) proxy server for FLM.
//! See `docs/PROXY_SPEC.md` for the complete specification.

mod adapters;
mod controller;
mod engine_repo;
mod http_client;
mod middleware;
mod process_controller;
mod security;
mod utils;

pub use controller::AxumProxyController;
pub use middleware::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing subscriber
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    println!("FLM Proxy - Under construction");
    // TODO: Implement proxy server
    Ok(())
}
