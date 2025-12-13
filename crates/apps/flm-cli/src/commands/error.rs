//! Common command error helpers.

use std::error::Error;
use std::fmt::{Display, Formatter};

/// Error type used to signal user-caused failures that should map to exit code 1.
#[derive(Debug)]
pub struct CliUserError {
    message: Option<String>,
    error_code: Option<String>,
}

impl CliUserError {
    /// Create a user error with a message that should be shown to stderr.
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: Some(message.into()),
            error_code: None,
        }
    }

    /// Create a user error with an error code for programmatic error handling.
    pub fn with_code(message: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            message: Some(message.into()),
            error_code: Some(code.into()),
        }
    }

    /// Create a user error that does not emit any additional stderr output.
    pub fn silent() -> Self {
        Self {
            message: None,
            error_code: None,
        }
    }

    /// Optional message content. Used by the CLI entrypoint to decide what to print.
    pub fn message(&self) -> Option<&str> {
        self.message.as_deref()
    }

    /// Optional error code for programmatic error handling.
    pub fn error_code(&self) -> Option<&str> {
        self.error_code.as_deref()
    }
}

impl Display for CliUserError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        if let Some(msg) = &self.message {
            if let Some(code) = &self.error_code {
                write!(f, "[{code}] {msg}")
            } else {
                write!(f, "{msg}")
            }
        } else {
            Ok(())
        }
    }
}

impl Error for CliUserError {}
