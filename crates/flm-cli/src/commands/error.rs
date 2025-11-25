//! Common command error helpers.

use std::error::Error;
use std::fmt::{Display, Formatter};

/// Error type used to signal user-caused failures that should map to exit code 1.
#[derive(Debug)]
pub struct CliUserError {
    message: Option<String>,
}

impl CliUserError {
    /// Create a user error with a message that should be shown to stderr.
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: Some(message.into()),
        }
    }

    /// Create a user error that does not emit any additional stderr output.
    pub fn silent() -> Self {
        Self { message: None }
    }

    /// Optional message content. Used by the CLI entrypoint to decide what to print.
    pub fn message(&self) -> Option<&str> {
        self.message.as_deref()
    }
}

impl Display for CliUserError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        if let Some(msg) = &self.message {
            write!(f, "{msg}")
        } else {
            Ok(())
        }
    }
}

impl Error for CliUserError {}
