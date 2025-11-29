use async_trait::async_trait;
use flm_core::domain::proxy::ResolvedDnsCredential;
use flm_core::error::ProxyError;
use reqwest::{Client, Url};
use rustls_acme::dns::{DnsChallengeHook, DnsChallengeRecord, DynDnsHookError};
use serde::Deserialize;
use std::io;
use std::sync::Arc;

const CLOUDFLARE_API_BASE: &str = "https://api.cloudflare.com/client/v4";

/// Build a DNS challenge hook for the configured provider.
pub fn dns_hook_from_credential(
    credential: &ResolvedDnsCredential,
) -> Result<Arc<dyn DnsChallengeHook>, ProxyError> {
    match credential.provider.as_str() {
        "cloudflare" => Ok(Arc::new(CloudflareDnsHook::new(credential)?)),
        other => Err(ProxyError::InvalidConfig {
            reason: format!("Unsupported DNS provider '{other}'. Supported providers: cloudflare"),
        }),
    }
}

struct CloudflareDnsHook {
    client: Client,
    zone_id: String,
    token: String,
}

impl CloudflareDnsHook {
    fn new(credential: &ResolvedDnsCredential) -> Result<Self, ProxyError> {
        let client = Client::builder()
            .user_agent("flm-proxy/https-acme")
            .build()
            .map_err(|e| ProxyError::InvalidConfig {
                reason: format!("Failed to build Cloudflare HTTP client: {e}"),
            })?;
        Ok(Self {
            client,
            zone_id: credential.zone_id.clone(),
            token: credential.token.clone(),
        })
    }

    async fn list_records(
        &self,
        fqdn: &str,
        value_filter: Option<&str>,
    ) -> Result<Vec<CloudflareDnsRecord>, DynDnsHookError> {
        let mut url = Url::parse(&format!(
            "{CLOUDFLARE_API_BASE}/zones/{}/dns_records",
            self.zone_id
        ))
        .map_err(to_hook_error)?;
        {
            let mut pairs = url.query_pairs_mut();
            pairs.append_pair("type", "TXT");
            pairs.append_pair("name", fqdn);
            if let Some(value) = value_filter {
                pairs.append_pair("content", value);
            }
        }
        let response = self
            .client
            .get(url)
            .bearer_auth(&self.token)
            .send()
            .await
            .map_err(to_hook_error)?;
        let payload = response
            .json::<CloudflareResponse<Vec<CloudflareDnsRecord>>>()
            .await
            .map_err(to_hook_error)?;
        if payload.success {
            Ok(payload.result.unwrap_or_default())
        } else {
            Err(Self::api_error("list DNS records", payload.errors))
        }
    }

    async fn delete_record(&self, record_id: &str) -> Result<(), DynDnsHookError> {
        let url = format!(
            "{CLOUDFLARE_API_BASE}/zones/{}/dns_records/{record_id}",
            self.zone_id
        );
        let response = self
            .client
            .delete(url)
            .bearer_auth(&self.token)
            .send()
            .await
            .map_err(to_hook_error)?;
        let payload = response
            .json::<CloudflareResponse<serde_json::Value>>()
            .await
            .map_err(to_hook_error)?;
        if payload.success {
            Ok(())
        } else {
            Err(Self::api_error("delete DNS record", payload.errors))
        }
    }

    async fn delete_records(
        &self,
        fqdn: &str,
        value_filter: Option<&str>,
    ) -> Result<(), DynDnsHookError> {
        let records = self.list_records(fqdn, value_filter).await?;
        for record in records {
            let _ = &record.content;
            self.delete_record(&record.id).await?;
        }
        Ok(())
    }

    fn api_error(action: &str, errors: Vec<CloudflareApiError>) -> DynDnsHookError {
        let detail = if errors.is_empty() {
            "unknown error".to_string()
        } else {
            errors
                .into_iter()
                .map(|e| match e.message.is_empty() {
                    true => format!("code {}", e.code),
                    false => format!("{} ({})", e.message, e.code),
                })
                .collect::<Vec<_>>()
                .join("; ")
        };
        Box::new(io::Error::other(format!(
            "Cloudflare API {action} failed: {detail}"
        )))
    }
}

#[async_trait]
impl DnsChallengeHook for CloudflareDnsHook {
    async fn present(&self, record: &DnsChallengeRecord) -> Result<(), DynDnsHookError> {
        // Clean up any stale records first to avoid duplicates.
        self.delete_records(&record.fqdn, Some(&record.value))
            .await?;

        let url = format!("{CLOUDFLARE_API_BASE}/zones/{}/dns_records", self.zone_id);
        let response = self
            .client
            .post(url)
            .bearer_auth(&self.token)
            .json(&serde_json::json!({
                "type": "TXT",
                "name": record.fqdn,
                "content": record.value,
                "ttl": 120
            }))
            .send()
            .await
            .map_err(to_hook_error)?;
        let payload = response
            .json::<CloudflareResponse<CloudflareDnsRecord>>()
            .await
            .map_err(to_hook_error)?;
        if payload.success {
            Ok(())
        } else {
            Err(Self::api_error("create DNS record", payload.errors))
        }
    }

    async fn cleanup(&self, record: &DnsChallengeRecord) -> Result<(), DynDnsHookError> {
        self.delete_records(&record.fqdn, None).await
    }
}

#[derive(Deserialize)]
struct CloudflareResponse<T> {
    success: bool,
    errors: Vec<CloudflareApiError>,
    result: Option<T>,
}

#[derive(Deserialize)]
struct CloudflareApiError {
    code: i64,
    #[serde(default)]
    message: String,
}

#[derive(Deserialize)]
struct CloudflareDnsRecord {
    id: String,
    #[allow(dead_code)]
    #[serde(default)]
    content: String,
}

fn to_hook_error<E>(err: E) -> DynDnsHookError
where
    E: std::error::Error + Send + Sync + 'static,
{
    Box::new(err)
}
