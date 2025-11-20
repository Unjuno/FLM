//! HTTP client trait

use crate::error::HttpError;
use futures::Stream;
use serde_json::Value;
use std::pin::Pin;

/// HTTP request structure
#[derive(Clone, Debug)]
pub struct HttpRequest {
    pub method: String, // "GET" | "POST" | etc.
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<Value>,
}

/// HTTP stream type
pub type HttpStream = Pin<Box<dyn Stream<Item = Result<Vec<u8>, HttpError>> + Send>>;

/// HTTP client trait
pub trait HttpClient: Send + Sync {
    fn get_json(&self, url: &str) -> Result<Value, HttpError>;
    fn post_json(&self, url: &str, body: Value) -> Result<Value, HttpError>;
    fn stream(&self, req: HttpRequest) -> Result<HttpStream, HttpError>;
}
