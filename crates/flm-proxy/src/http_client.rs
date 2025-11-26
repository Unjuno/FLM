//! Minimal HttpClient implementation for flm-proxy

use async_trait::async_trait;
use flm_core::error::HttpError;
use flm_core::ports::{HttpClient, HttpRequest, HttpStream};
use futures::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde_json::Value;

/// Reqwest-based HttpClient implementation
pub struct ReqwestHttpClient {
    client: reqwest::Client,
}

impl ReqwestHttpClient {
    /// Create a new ReqwestHttpClient
    #[allow(dead_code)]
    pub fn new() -> Result<Self, HttpError> {
        Self::from_builder(reqwest::Client::builder())
    }

    /// Create a Reqwest client from a custom builder
    pub fn from_builder(builder: reqwest::ClientBuilder) -> Result<Self, HttpError> {
        let client = builder.build().map_err(|e| HttpError::NetworkError {
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

    async fn stream(&self, req: HttpRequest) -> Result<HttpStream, HttpError> {
        let method = reqwest::Method::from_bytes(req.method.as_bytes()).map_err(|e| {
            HttpError::InvalidResponse {
                reason: format!("Invalid HTTP method: {e}"),
            }
        })?;

        let mut request = self.client.request(method, &req.url);

        if !req.headers.is_empty() {
            let mut header_map = HeaderMap::new();
            for (name, value) in &req.headers {
                let header_name = HeaderName::from_bytes(name.as_bytes()).map_err(|e| {
                    HttpError::InvalidResponse {
                        reason: format!("Invalid header name '{name}': {e}"),
                    }
                })?;
                let header_value =
                    HeaderValue::from_str(value).map_err(|e| HttpError::InvalidResponse {
                        reason: format!("Invalid header value for '{name}': {e}"),
                    })?;
                header_map.append(header_name, header_value);
            }
            request = request.headers(header_map);
        }

        if let Some(body) = &req.body {
            request = request.json(body);
        }

        let response = request.send().await.map_err(|e| HttpError::NetworkError {
            reason: format!("Request failed: {e}"),
        })?;

        let status = response.status();
        if !status.is_success() {
            return Err(HttpError::StatusCode {
                code: status.as_u16(),
                body: None,
            });
        }

        let stream = response.bytes_stream().map(|chunk| match chunk {
            Ok(bytes) => Ok(bytes.to_vec()),
            Err(e) => Err(HttpError::NetworkError {
                reason: format!("Stream error: {e}"),
            }),
        });

        Ok(Box::pin(stream))
    }
}
