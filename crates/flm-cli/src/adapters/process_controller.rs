//! EngineProcessController implementation
//!
//! This adapter implements the EngineProcessController trait for detecting
//! engine binaries and running processes according to ENGINE_DETECT.md.

use flm_core::domain::engine::{EngineBinaryInfo, EngineRuntimeInfo};
use flm_core::domain::models::EngineKind;
use flm_core::ports::EngineProcessController;
use reqwest::Url;
use std::net::TcpStream;
use std::path::PathBuf;
use std::time::Duration;

/// Process controller implementation for engine detection
///
/// This implementation detects engine binaries and running processes
/// according to the specifications in ENGINE_DETECT.md.
pub struct DefaultEngineProcessController;

impl DefaultEngineProcessController {
    /// Create a new DefaultEngineProcessController
    pub fn new() -> Self {
        Self
    }

    /// Detect Ollama binary
    fn detect_ollama_binary(&self) -> Option<EngineBinaryInfo> {
        // First, try to find it in PATH
        if let Ok(path) = which::which("ollama") {
            return Some(EngineBinaryInfo {
                engine_id: "ollama-default".to_string(),
                kind: EngineKind::Ollama,
                binary_path: path.to_string_lossy().to_string(),
                version: None, // TODO: Extract version from binary
            });
        }

        // Check common installation paths
        let mut candidates: Vec<PathBuf> = vec![
            PathBuf::from("C:\\Program Files\\Ollama\\ollama.exe"),
            PathBuf::from("/usr/local/bin/ollama"),
            PathBuf::from("/usr/bin/ollama"),
        ];

        // Add OLLAMA_HOME path if set
        if let Ok(home) = std::env::var("OLLAMA_HOME") {
            candidates.push(PathBuf::from(home).join("ollama"));
        }

        for candidate in candidates {
            if candidate.exists() {
                return Some(EngineBinaryInfo {
                    engine_id: "ollama-default".to_string(),
                    kind: EngineKind::Ollama,
                    binary_path: candidate.to_string_lossy().to_string(),
                    version: None,
                });
            }
        }

        None
    }

    /// Check if a port is open
    fn is_port_open(&self, host: &str, port: u16) -> bool {
        let addr = match format!("{host}:{port}").parse::<std::net::SocketAddr>() {
            Ok(addr) => addr,
            Err(_) => return false,
        };
        TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
    }

    /// Detect vLLM running process (check for HTTP server on port)
    fn detect_vllm_running(&self) -> Option<EngineRuntimeInfo> {
        // Check VLLM_PORT environment variable or default port
        let port = std::env::var("VLLM_PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(8000);

        let host = std::env::var("VLLM_HOST").unwrap_or_else(|_| "localhost".to_string());
        let base_url = format!("http://{host}:{port}");

        // Check if the port is actually open
        if !self.is_port_open(&host, port) {
            return None;
        }

        Some(EngineRuntimeInfo {
            engine_id: "vllm-default".to_string(),
            kind: EngineKind::Vllm,
            base_url,
            port: Some(port),
        })
    }

    /// Detect LM Studio running process
    fn detect_lmstudio_running(&self) -> Option<EngineRuntimeInfo> {
        // Check LMSTUDIO_API_HOST environment variable or default
        let host = std::env::var("LMSTUDIO_API_HOST").unwrap_or_else(|_| "localhost".to_string());
        let port = 1234; // Default LM Studio port
        let base_url = format!("http://{host}:{port}");

        // Check if the port is actually open
        if !self.is_port_open(&host, port) {
            return None;
        }

        Some(EngineRuntimeInfo {
            engine_id: "lmstudio-default".to_string(),
            kind: EngineKind::LmStudio,
            base_url,
            port: Some(port),
        })
    }

    /// Detect llama.cpp HTTP server
    fn detect_llamacpp_running(&self) -> Option<EngineRuntimeInfo> {
        // Check LLAMA_CPP_PORT environment variable or default
        let port = std::env::var("LLAMA_CPP_PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(8080);

        let host = "localhost";
        let base_url = format!("http://{host}:{port}");

        // Check if the port is actually open
        if !self.is_port_open(host, port) {
            return None;
        }

        Some(EngineRuntimeInfo {
            engine_id: "llamacpp-default".to_string(),
            kind: EngineKind::LlamaCpp,
            base_url,
            port: Some(port),
        })
    }

    fn detect_ollama_running(&self) -> Option<EngineRuntimeInfo> {
        let base_url = std::env::var("OLLAMA_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:11434".to_string());
        let normalized = base_url.trim_end_matches('/').to_string();
        let (host, port) = parse_host_port(&normalized, 11434)?;

        if !self.is_port_open(&host, port) {
            return None;
        }

        Some(EngineRuntimeInfo {
            engine_id: "ollama-default".to_string(),
            kind: EngineKind::Ollama,
            base_url: normalized,
            port: Some(port),
        })
    }
}

fn parse_host_port(base_url: &str, default_port: u16) -> Option<(String, u16)> {
    let url = Url::parse(base_url).ok()?;
    let host = url.host_str()?.to_string();
    let port = url.port().unwrap_or(default_port);
    Some((host, port))
}

impl Default for DefaultEngineProcessController {
    fn default() -> Self {
        Self::new()
    }
}

impl EngineProcessController for DefaultEngineProcessController {
    fn detect_binaries(&self) -> Vec<EngineBinaryInfo> {
        let mut results = Vec::new();

        // Detect Ollama binary
        if let Some(binary) = self.detect_ollama_binary() {
            results.push(binary);
        }

        // TODO: Add detection for other engine binaries
        // - vLLM: Usually runs as a service, not a binary we detect
        // - LM Studio: Windows/Mac app, binary detection may not be applicable
        // - llama.cpp: Binary detection depends on how it's installed

        results
    }

    fn detect_running(&self) -> Vec<EngineRuntimeInfo> {
        let mut results = Vec::new();

        // Detect running engines by checking for HTTP servers
        if let Some(runtime) = self.detect_ollama_running() {
            results.push(runtime);
        }

        if let Some(runtime) = self.detect_vllm_running() {
            results.push(runtime);
        }

        if let Some(runtime) = self.detect_lmstudio_running() {
            results.push(runtime);
        }

        if let Some(runtime) = self.detect_llamacpp_running() {
            results.push(runtime);
        }

        results
    }
}
