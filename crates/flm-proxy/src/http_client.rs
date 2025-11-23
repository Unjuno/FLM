//! Minimal HttpClient implementation for flm-proxy

use async_trait::async_trait;
use flm_core::error::HttpError;
use flm_core::ports::{HttpClient, HttpRequest, HttpStream};
use serde_json::Value;

/// Reqwest-based HttpClient implementation
pub struct ReqwestHttpClient {
    client: reqwest::Client,
}

impl ReqwestHttpClient {
    /// Create a new ReqwestHttpClient
    pub fn new() -> Result<Self, HttpError> {
        let client = reqwest::Client::builder()
            .build()
            .map_err(|e| HttpError::NetworkError {
                reason: format!("Failed to create HTTP client: {e}"),
            })?;
        Ok(Self { client })
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
            return Err(HttpError::StatusCode {
                code: status.as_u16(),
                body: None,
            });
        }

        response
            .json::<Value>()
            .await
            .map_err(|_| HttpError::InvalidResponse {
                reason: "Failed to parse JSON".to_string(),
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
            return Err(HttpError::StatusCode {
                code: status.as_u16(),
                body: None,
            });
        }

        response
            .json::<Value>()
            .await
            .map_err(|_| HttpError::InvalidResponse {
                reason: "Failed to parse JSON".to_string(),
            })
    }

    async fn stream(&self, _req: HttpRequest) -> Result<HttpStream, HttpError> {
        // TODO: Implement streaming
        Err(HttpError::InvalidResponse {
            reason: "HTTP streaming not yet implemented".to_string(),
        })
    }
}
