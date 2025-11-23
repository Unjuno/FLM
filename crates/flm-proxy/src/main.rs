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

pub use controller::AxumProxyController;
pub use middleware::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("FLM Proxy - Under construction");
    // TODO: Implement proxy server
    Ok(())
}
