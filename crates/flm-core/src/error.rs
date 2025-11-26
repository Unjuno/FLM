//! Error types for FLM Core
//!
//! All error types are defined according to `docs/CORE_API.md` section 2.

use thiserror::Error;

/// Engine-related errors
#[derive(Debug, Error)]
pub enum EngineError {
    #[error("Engine not found: {engine_id}")]
    NotFound { engine_id: String },

    #[error("Network error: {reason}")]
    NetworkError { reason: String },

    #[error("API error: {reason} (status: {status_code:?})")]
    ApiError {
        reason: String,
        status_code: Option<u16>,
    },

    #[error("Timeout: {operation}")]
    Timeout { operation: String },

    #[error("Invalid response: {reason}")]
    InvalidResponse { reason: String },
}

/// Proxy-related errors
#[derive(Debug, Error)]
pub enum ProxyError {
    #[error("Proxy already running: {handle_id}")]
    AlreadyRunning { handle_id: String },

    #[error("Port in use: {port}")]
    PortInUse { port: u16 },

    #[error("Certificate generation failed: {reason}")]
    CertGenerationFailed { reason: String },

    #[error("ACME error: {reason}")]
    AcmeError { reason: String },

    #[error("Invalid config: {reason}")]
    InvalidConfig { reason: String },

    #[error("Timeout: {operation}")]
    Timeout { operation: String },
}

/// Repository-related errors
#[derive(Debug, Error)]
pub enum RepoError {
    #[error("Not found: {key}")]
    NotFound { key: String },

    #[error("Constraint violation: {reason}")]
    ConstraintViolation { reason: String },

    #[error("Migration failed: {reason}")]
    MigrationFailed { reason: String },

    #[error("IO error: {reason}")]
    IoError { reason: String },

    #[error("Validation error: {reason}")]
    ValidationError { reason: String },

    #[error("Database is in read-only mode: {reason}")]
    ReadOnlyMode { reason: String },
}

/// HTTP-related errors
#[derive(Debug, Error)]
pub enum HttpError {
    #[error("Network error: {reason}")]
    NetworkError { reason: String },

    #[error("Timeout")]
    Timeout,

    #[error("Invalid response: {reason}")]
    InvalidResponse { reason: String },

    #[error("HTTP {code}: {body:?}")]
    StatusCode { code: u16, body: Option<String> },
}
