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

    #[error("Unsupported operation: {operation} ({reason})")]
    UnsupportedOperation { operation: String, reason: String },
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

    #[error("Proxy handle not found: {handle_id}")]
    HandleNotFound { handle_id: String },

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_error_display() {
        let error = EngineError::NotFound {
            engine_id: "test-engine".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("test-engine"));
        assert!(msg.contains("not found"));

        let error = EngineError::NetworkError {
            reason: "connection failed".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("connection failed"));

        let error = EngineError::ApiError {
            reason: "invalid response".to_string(),
            status_code: Some(500),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("invalid response"));
        assert!(msg.contains("500"));

        let error = EngineError::Timeout {
            operation: "health check".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("health check"));
    }

    #[test]
    fn test_proxy_error_display() {
        let error = ProxyError::AlreadyRunning {
            handle_id: "handle-1".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("handle-1"));
        assert!(msg.contains("already running"));

        let error = ProxyError::PortInUse { port: 8080 };
        let msg = format!("{}", error);
        assert!(msg.contains("8080"));
        assert!(msg.contains("in use"));

        let error = ProxyError::CertGenerationFailed {
            reason: "invalid domain".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("invalid domain"));

        let error = ProxyError::AcmeError {
            reason: "challenge failed".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("challenge failed"));

        let error = ProxyError::InvalidConfig {
            reason: "missing domain".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("missing domain"));

        let error = ProxyError::HandleNotFound {
            handle_id: "handle-1".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("handle-1"));
        assert!(msg.contains("not found"));

        let error = ProxyError::Timeout {
            operation: "start".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("start"));
    }

    #[test]
    fn test_repo_error_display() {
        let error = RepoError::NotFound {
            key: "test-key".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("test-key"));
        assert!(msg.contains("not found"));

        let error = RepoError::ConstraintViolation {
            reason: "duplicate key".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("duplicate key"));

        let error = RepoError::MigrationFailed {
            reason: "schema mismatch".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("schema mismatch"));

        let error = RepoError::IoError {
            reason: "file not found".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("file not found"));

        let error = RepoError::ValidationError {
            reason: "invalid format".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("invalid format"));

        let error = RepoError::ReadOnlyMode {
            reason: "database locked".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("database locked"));
    }

    #[test]
    fn test_http_error_display() {
        let error = HttpError::NetworkError {
            reason: "connection timeout".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("connection timeout"));

        let error = HttpError::Timeout;
        let msg = format!("{}", error);
        assert!(msg.contains("Timeout"));

        let error = HttpError::InvalidResponse {
            reason: "malformed JSON".to_string(),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("malformed JSON"));

        let error = HttpError::StatusCode {
            code: 404,
            body: Some("Not Found".to_string()),
        };
        let msg = format!("{}", error);
        assert!(msg.contains("404"));
        assert!(msg.contains("Not Found"));

        let error = HttpError::StatusCode {
            code: 500,
            body: None,
        };
        let msg = format!("{}", error);
        assert!(msg.contains("500"));
    }
}
