//! Proxy command definition

use clap::Subcommand;

#[derive(Subcommand, Clone)]
pub enum ProxySubcommand {
    /// Start a proxy server
    Start {
        /// HTTP port (default: 8080)
        #[arg(long, default_value = "8080")]
        port: u16,
        /// Proxy mode (local-http, dev-selfsigned, https-acme, packaged-ca)
        #[arg(long, default_value = "local-http")]
        mode: String,
        /// Egress mode (direct, tor, socks5)
        #[arg(long, default_value = "direct")]
        egress_mode: String,
        /// SOCKS5 endpoint for tor/custom modes (host:port, default 127.0.0.1:9050 for tor)
        #[arg(long)]
        socks5_endpoint: Option<String>,
        /// Allow fallback to direct egress if SOCKS endpoint is unreachable
        #[arg(long, default_value_t = false)]
        egress_fail_open: bool,
        /// Listen address (IP address to bind to, default: 127.0.0.1)
        /// Use 0.0.0.0 only when external access is explicitly needed
        #[arg(long, default_value = "127.0.0.1")]
        bind: String,
        /// ACME email (required for https-acme mode)
        #[arg(long)]
        acme_email: Option<String>,
        /// ACME domain (required for https-acme mode)
        #[arg(long)]
        acme_domain: Option<String>,
        /// Run in foreground (don't daemonize)
        #[arg(long)]
        no_daemon: bool,
    },
    /// Stop a proxy server
    Stop {
        /// Port of the proxy to stop
        #[arg(long)]
        port: Option<u16>,
        /// Proxy handle ID
        #[arg(long)]
        handle_id: Option<String>,
    },
    /// Get status of running proxy servers
    Status,
}
