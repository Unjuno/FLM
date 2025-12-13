//! Prometheus metrics collection for flm-proxy
//!
//! This module provides Prometheus-compatible metrics for monitoring the proxy server.

use axum::response::Response;
use axum::routing::get;
use axum::Router;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Metrics collector for flm-proxy
pub struct Metrics {
    /// Total number of requests
    pub requests_total: AtomicU64,
    /// Total number of successful requests (2xx)
    pub requests_success: AtomicU64,
    /// Total number of failed requests (4xx, 5xx)
    pub requests_failed: AtomicU64,
    /// Total number of rate-limited requests
    pub requests_rate_limited: AtomicU64,
    /// Total number of blocked requests (IP blocklist, etc.)
    pub requests_blocked: AtomicU64,
    /// Current number of active connections
    pub connections_active: AtomicU64,
    /// Total number of API key authentications
    pub auth_success: AtomicU64,
    /// Total number of authentication failures
    pub auth_failure: AtomicU64,
    /// Total number of intrusion detections
    pub intrusions_detected: AtomicU64,
    /// Total number of anomalies detected
    pub anomalies_detected: AtomicU64,
}

impl Metrics {
    /// Create a new metrics collector
    pub fn new() -> Self {
        Self {
            requests_total: AtomicU64::new(0),
            requests_success: AtomicU64::new(0),
            requests_failed: AtomicU64::new(0),
            requests_rate_limited: AtomicU64::new(0),
            requests_blocked: AtomicU64::new(0),
            connections_active: AtomicU64::new(0),
            auth_success: AtomicU64::new(0),
            auth_failure: AtomicU64::new(0),
            intrusions_detected: AtomicU64::new(0),
            anomalies_detected: AtomicU64::new(0),
        }
    }

    /// Increment total requests counter
    pub fn increment_requests_total(&self) {
        self.requests_total.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment successful requests counter
    pub fn increment_requests_success(&self) {
        self.requests_success.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment failed requests counter
    pub fn increment_requests_failed(&self) {
        self.requests_failed.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment rate-limited requests counter
    pub fn increment_requests_rate_limited(&self) {
        self.requests_rate_limited.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment blocked requests counter
    pub fn increment_requests_blocked(&self) {
        self.requests_blocked.fetch_add(1, Ordering::Relaxed);
    }

    /// Set active connections count
    pub fn set_connections_active(&self, count: u64) {
        self.connections_active.store(count, Ordering::Relaxed);
    }

    /// Increment authentication success counter
    pub fn increment_auth_success(&self) {
        self.auth_success.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment authentication failure counter
    pub fn increment_auth_failure(&self) {
        self.auth_failure.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment intrusion detection counter
    pub fn increment_intrusions_detected(&self) {
        self.intrusions_detected.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment anomaly detection counter
    pub fn increment_anomalies_detected(&self) {
        self.anomalies_detected.fetch_add(1, Ordering::Relaxed);
    }

    /// Export metrics in Prometheus format
    pub fn export_prometheus(&self) -> String {
        let mut output = String::new();

        output.push_str("# HELP flm_proxy_requests_total Total number of requests\n");
        output.push_str("# TYPE flm_proxy_requests_total counter\n");
        output.push_str(&format!(
            "flm_proxy_requests_total {}\n",
            self.requests_total.load(Ordering::Relaxed)
        ));

        output.push_str(
            "# HELP flm_proxy_requests_success Total number of successful requests (2xx)\n",
        );
        output.push_str("# TYPE flm_proxy_requests_success counter\n");
        output.push_str(&format!(
            "flm_proxy_requests_success {}\n",
            self.requests_success.load(Ordering::Relaxed)
        ));

        output.push_str(
            "# HELP flm_proxy_requests_failed Total number of failed requests (4xx, 5xx)\n",
        );
        output.push_str("# TYPE flm_proxy_requests_failed counter\n");
        output.push_str(&format!(
            "flm_proxy_requests_failed {}\n",
            self.requests_failed.load(Ordering::Relaxed)
        ));

        output.push_str(
            "# HELP flm_proxy_requests_rate_limited Total number of rate-limited requests\n",
        );
        output.push_str("# TYPE flm_proxy_requests_rate_limited counter\n");
        output.push_str(&format!(
            "flm_proxy_requests_rate_limited {}\n",
            self.requests_rate_limited.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP flm_proxy_requests_blocked Total number of blocked requests\n");
        output.push_str("# TYPE flm_proxy_requests_blocked counter\n");
        output.push_str(&format!(
            "flm_proxy_requests_blocked {}\n",
            self.requests_blocked.load(Ordering::Relaxed)
        ));

        output
            .push_str("# HELP flm_proxy_connections_active Current number of active connections\n");
        output.push_str("# TYPE flm_proxy_connections_active gauge\n");
        output.push_str(&format!(
            "flm_proxy_connections_active {}\n",
            self.connections_active.load(Ordering::Relaxed)
        ));

        output
            .push_str("# HELP flm_proxy_auth_success Total number of successful authentications\n");
        output.push_str("# TYPE flm_proxy_auth_success counter\n");
        output.push_str(&format!(
            "flm_proxy_auth_success {}\n",
            self.auth_success.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP flm_proxy_auth_failure Total number of authentication failures\n");
        output.push_str("# TYPE flm_proxy_auth_failure counter\n");
        output.push_str(&format!(
            "flm_proxy_auth_failure {}\n",
            self.auth_failure.load(Ordering::Relaxed)
        ));

        output.push_str(
            "# HELP flm_proxy_intrusions_detected Total number of intrusion detections\n",
        );
        output.push_str("# TYPE flm_proxy_intrusions_detected counter\n");
        output.push_str(&format!(
            "flm_proxy_intrusions_detected {}\n",
            self.intrusions_detected.load(Ordering::Relaxed)
        ));

        output.push_str("# HELP flm_proxy_anomalies_detected Total number of anomalies detected\n");
        output.push_str("# TYPE flm_proxy_anomalies_detected counter\n");
        output.push_str(&format!(
            "flm_proxy_anomalies_detected {}\n",
            self.anomalies_detected.load(Ordering::Relaxed)
        ));

        output
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_new() {
        let metrics = Metrics::new();
        assert_eq!(metrics.requests_total.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.requests_success.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.requests_failed.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.requests_rate_limited.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.requests_blocked.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.connections_active.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.auth_success.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.auth_failure.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.intrusions_detected.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.anomalies_detected.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn test_metrics_increment_requests_total() {
        let metrics = Metrics::new();
        metrics.increment_requests_total();
        assert_eq!(metrics.requests_total.load(Ordering::Relaxed), 1);
        metrics.increment_requests_total();
        assert_eq!(metrics.requests_total.load(Ordering::Relaxed), 2);
    }

    #[test]
    fn test_metrics_increment_requests_success() {
        let metrics = Metrics::new();
        metrics.increment_requests_success();
        assert_eq!(metrics.requests_success.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn test_metrics_increment_requests_failed() {
        let metrics = Metrics::new();
        metrics.increment_requests_failed();
        assert_eq!(metrics.requests_failed.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn test_metrics_increment_requests_rate_limited() {
        let metrics = Metrics::new();
        metrics.increment_requests_rate_limited();
        assert_eq!(metrics.requests_rate_limited.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn test_metrics_increment_requests_blocked() {
        let metrics = Metrics::new();
        metrics.increment_requests_blocked();
        assert_eq!(metrics.requests_blocked.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn test_metrics_set_connections_active() {
        let metrics = Metrics::new();
        metrics.set_connections_active(5);
        assert_eq!(metrics.connections_active.load(Ordering::Relaxed), 5);
        metrics.set_connections_active(10);
        assert_eq!(metrics.connections_active.load(Ordering::Relaxed), 10);
    }

    #[test]
    fn test_metrics_increment_auth_success() {
        let metrics = Metrics::new();
        metrics.increment_auth_success();
        assert_eq!(metrics.auth_success.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn test_metrics_increment_auth_failure() {
        let metrics = Metrics::new();
        metrics.increment_auth_failure();
        assert_eq!(metrics.auth_failure.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn test_metrics_increment_intrusions_detected() {
        let metrics = Metrics::new();
        metrics.increment_intrusions_detected();
        assert_eq!(metrics.intrusions_detected.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn test_metrics_increment_anomalies_detected() {
        let metrics = Metrics::new();
        metrics.increment_anomalies_detected();
        assert_eq!(metrics.anomalies_detected.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn test_metrics_export_prometheus() {
        let metrics = Metrics::new();
        metrics.increment_requests_total();
        metrics.increment_requests_success();
        metrics.set_connections_active(3);

        let output = metrics.export_prometheus();
        assert!(output.contains("flm_proxy_requests_total 1"));
        assert!(output.contains("flm_proxy_requests_success 1"));
        assert!(output.contains("flm_proxy_connections_active 3"));
        assert!(output.contains("# HELP flm_proxy_requests_total"));
        assert!(output.contains("# TYPE flm_proxy_requests_total counter"));
        assert!(output.contains("# TYPE flm_proxy_connections_active gauge"));
    }

    #[test]
    fn test_metrics_default() {
        let metrics = Metrics::default();
        assert_eq!(metrics.requests_total.load(Ordering::Relaxed), 0);
    }
}

/// Create metrics endpoint router
#[allow(dead_code)]
pub fn create_metrics_router(metrics: Arc<Metrics>) -> Router {
    Router::new()
        .route("/metrics", get(metrics_handler))
        .with_state(metrics)
}

/// Metrics endpoint handler
pub async fn metrics_handler(
    axum::extract::State(metrics): axum::extract::State<Arc<Metrics>>,
) -> Response {
    let body = metrics.export_prometheus();
    Response::builder()
        .status(200)
        .header("Content-Type", "text/plain; version=0.0.4")
        .body(body.into())
        .unwrap_or_else(|e| {
            tracing::error!("Failed to build metrics response: {}", e);
            // Fallback to a simple error response
            Response::builder()
                .status(500)
                .body(axum::body::Body::from("Internal server error"))
                .unwrap_or_else(|_| {
                    // Last resort: return an empty 500 response
                    Response::new(axum::body::Body::empty())
                })
        })
}
