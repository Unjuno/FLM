//! Minimal EngineProcessController implementation for flm-proxy

use flm_core::domain::engine::{EngineBinaryInfo, EngineRuntimeInfo};
use flm_core::ports::EngineProcessController;

/// Simple EngineProcessController that returns empty lists
///
/// The proxy server doesn't need to detect engines itself;
/// engines should be registered by the CLI before starting the proxy.
#[derive(Clone)]
pub struct NoopProcessController;

impl EngineProcessController for NoopProcessController {
    fn detect_binaries(&self) -> Vec<EngineBinaryInfo> {
        Vec::new()
    }

    fn detect_running(&self) -> Vec<EngineRuntimeInfo> {
        Vec::new()
    }
}

// NoopProcessController is thread-safe (no internal state)
unsafe impl Sync for NoopProcessController {}
unsafe impl Send for NoopProcessController {}
