//! HttpClient implementation using reqwest
//!
//! This adapter implements the HttpClient trait for making HTTP requests
//! to engine APIs.

use async_trait::async_trait;
use flm_core::error::HttpError;
use flm_core::ports::{HttpClient, HttpRequest, HttpStream};
use serde_json::Value;

/// HTTP client implementation using reqwest
pub struct ReqwestHttpClient {
    client: reqwest::Client,
}

impl ReqwestHttpClient {
    /// Create a new ReqwestHttpClient
    pub fn new() -> Result<Self, HttpError> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| HttpError::NetworkError {
                reason: format!("Failed to create HTTP client: {e}"),
            })?;

        Ok(Self { client })
    }
}

impl Default for ReqwestHttpClient {
    fn default() -> Self {
        // Default implementation should not panic, so we create a client with minimal configuration
        // If this fails, we use a fallback client creation
        Self::new().unwrap_or_else(|e| {
            eprintln!("Warning: Failed to create default HTTP client: {}, using fallback", e);
            // Fallback: create client without timeout (less ideal but won't panic)
            Self {
                client: reqwest::Client::builder()
                    .build()
                    .unwrap_or_else(|_| {
                        // Last resort: use a basic client
                        reqwest::Client::new()
                    }),
            }
        })
    }
}

#[async_trait]
impl HttpClient for ReqwestHttpClient {
    async fn get_json(&self, url: &str) -> Result<Value, HttpError> {
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| HttpError::NetworkError {
                reason: format!("Request failed: {e}"),
            })?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.ok();
            return Err(HttpError::StatusCode {
                code: status.as_u16(),
                body,
            });
        }

        response
            .json::<Value>()
            .await
            .map_err(|e| HttpError::InvalidResponse {
                reason: format!("Failed to parse JSON: {e}"),
            })
    }

    async fn post_json(&self, url: &str, body: Value) -> Result<Value, HttpError> {
        let response = self
            .client
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(|e| HttpError::NetworkError {
                reason: format!("Request failed: {e}"),
            })?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.ok();
            return Err(HttpError::StatusCode {
                code: status.as_u16(),
                body,
            });
        }

        response
            .json::<Value>()
            .await
            .map_err(|e| HttpError::InvalidResponse {
                reason: format!("Failed to parse JSON: {e}"),
            })
    }

    async fn stream(&self, req: HttpRequest) -> Result<HttpStream, HttpError> {
        // Build request
        let method = match req.method.as_str() {
            "GET" => reqwest::Method::GET,
            "POST" => reqwest::Method::POST,
            "PUT" => reqwest::Method::PUT,
            "DELETE" => reqwest::Method::DELETE,
            _ => {
                return Err(HttpError::InvalidResponse {
                    reason: format!("Unsupported HTTP method: {}", req.method),
                });
            }
        };

        let mut request_builder = self.client.request(method, &req.url);

        // Add headers
        for (key, value) in req.headers {
            request_builder = request_builder.header(&key, &value);
        }

        // Add body if present
        if let Some(body) = req.body {
            request_builder = request_builder.json(&body);
        }

        // Create the request
        let request = request_builder
            .build()
            .map_err(|e| HttpError::NetworkError {
                reason: format!("Failed to build request: {e}"),
            })?;

        // Send request and get response stream
        let response = self
            .client
            .execute(request)
            .await
            .map_err(|e| HttpError::NetworkError {
                reason: format!("Request failed: {e}"),
            })?;

        if !response.status().is_success() {
            return Err(HttpError::StatusCode {
                code: response.status().as_u16(),
                body: response.text().await.ok(),
            });
        }

        // Convert response bytes stream to HttpStream
        use futures::StreamExt;
        let stream = response.bytes_stream().map(|result| {
            result
                .map(|bytes| bytes.to_vec())
                .map_err(|e| HttpError::NetworkError {
                    reason: format!("Stream error: {e}"),
                })
        });

        Ok(Box::pin(stream))
    }
}
