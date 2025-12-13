//! Proxy command definition

use clap::Subcommand;

const DNS01_PREVIEW_ENABLED: bool = cfg!(feature = "dns01-preview");
const DNS_FLAGS_HIDDEN: bool = !DNS01_PREVIEW_ENABLED;

#[derive(Subcommand, Clone)]
#[allow(clippy::large_enum_variant)] // why: Start variant has many fields for proxy configuration, which is intentional
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
        /// ACME domain (required for https-acme mode). Supports wildcard format (*.example.com) which requires DNS-01 challenge
        #[arg(long)]
        acme_domain: Option<String>,
        /// ACME challenge type. Phase 2 では http-01 のみ有効（dns-01 はビルドフラグが必要）
        #[arg(long = "challenge", default_value = "http-01")]
        acme_challenge: String,
        /// DNS automation profile ID（dns-01 機能が有効なビルドのみ）
        #[arg(long = "dns-profile", hide = DNS_FLAGS_HIDDEN)]
        acme_dns_profile: Option<String>,
        /// lego バイナリパス上書き（dns-01 機能が有効なビルドのみ）
        #[arg(long = "lego-path", hide = DNS_FLAGS_HIDDEN)]
        acme_dns_lego_path: Option<String>,
        /// TXT設置後の待機秒数（dns-01 機能が有効なビルドのみ）
        #[arg(long = "dns-propagation-wait", hide = DNS_FLAGS_HIDDEN)]
        acme_dns_propagation_wait: Option<u64>,
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
    /// Reload configuration for a running proxy server
    Reload {
        /// Port of the proxy to reload
        #[arg(long)]
        port: Option<u16>,
        /// Proxy handle ID
        #[arg(long)]
        handle_id: Option<String>,
        /// Reload all running proxy servers
        #[arg(long, default_value_t = false)]
        all: bool,
    },
}
