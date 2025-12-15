use async_trait::async_trait;
use once_cell::sync::Lazy;
use regex::Regex;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::Mutex;
use tokio::time::sleep;
use tracing::{debug, trace};

static RECORD_LINE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(_acme-challenge[\.\w-]+)").expect("valid dns record regex for lego-runner")
});

/// Default propagation wait applied between presenting a TXT record and
/// resuming the lego manual workflow. This gives DNS providers time to
/// converge before the CA starts querying.
pub const DEFAULT_PROPAGATION_WAIT: Duration = Duration::from_secs(15);

/// Known error variants for lego-runner orchestration.
#[derive(Debug, Error)]
pub enum LegoRunnerError {
    #[error("lego binary missing at {0}")]
    MissingBinary(PathBuf),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("lego output parsing failed: {0}")]
    OutputParse(String),
    #[error("DNS hook error: {0}")]
    DnsHook(String),
    #[error("lego command failed (exit code {code:?}): {stderr}")]
    CommandFailed { code: Option<i32>, stderr: String },
    #[error("join error: {0}")]
    Join(#[from] tokio::task::JoinError),
}

/// TXT record metadata forwarded to the DNS hook adapter.
#[derive(Clone, Debug)]
pub struct DnsRecord {
    pub domain: String,
    pub fqdn: String,
    pub value: String,
}

/// Shared error type for DNS hooks.
pub type DnsHookError = Box<dyn std::error::Error + Send + Sync>;

#[async_trait]
pub trait DnsRecordHandler: Send + Sync {
    async fn present(&self, record: &DnsRecord) -> Result<(), DnsHookError>;
    async fn cleanup(&self, record: &DnsRecord) -> Result<(), DnsHookError>;
}

pub type DynDnsRecordHandler = Arc<dyn DnsRecordHandler>;

/// Configuration for invoking lego to satisfy DNS-01 challenges.
pub struct LegoRequest<'a> {
    pub email: &'a str,
    pub directory_url: &'a str,
    pub domains: &'a [String],
    pub data_dir: &'a Path,
    pub dns_hook: DynDnsRecordHandler,
    pub propagation_wait: Duration,
}

impl<'a> LegoRequest<'a> {
    pub fn primary_domain(&self) -> &str {
        &self.domains[0]
    }
}

/// PEM materials emitted by lego (certificate chain + private key).
#[derive(Debug, Clone)]
pub struct LegoCertificate {
    pub certificate_pem: String,
    pub private_key_pem: String,
}

impl LegoCertificate {
    pub fn into_bundle(self) -> String {
        let mut bundle = String::new();
        bundle.push_str(self.certificate_pem.trim());
        bundle.push('\n');
        bundle.push_str(self.private_key_pem.trim());
        bundle.push('\n');
        bundle
    }
}

/// Thin wrapper around the lego binary, allowing call-sites to pin to
/// the build-script managed download path or an explicit override.
#[derive(Clone, Debug)]
pub struct LegoRunner {
    binary_path: PathBuf,
}

impl Default for LegoRunner {
    fn default() -> Self {
        let env_path = option_env!("FLM_LEGO_BIN_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("lego"));
        Self {
            binary_path: env_path,
        }
    }
}

impl LegoRunner {
    pub fn with_binary<P: Into<PathBuf>>(path: P) -> Self {
        Self {
            binary_path: path.into(),
        }
    }

    fn ensure_binary(&self) -> Result<(), LegoRunnerError> {
        if self.binary_path.exists() {
            return Ok(());
        }
        Err(LegoRunnerError::MissingBinary(self.binary_path.clone()))
    }

    pub async fn obtain_certificate(
        &self,
        request: &LegoRequest<'_>,
    ) -> Result<LegoCertificate, LegoRunnerError> {
        if request.domains.is_empty() {
            return Err(LegoRunnerError::OutputParse(
                "certificate request must include at least one domain".to_string(),
            ));
        }
        self.ensure_binary()?;

        tokio::fs::create_dir_all(request.data_dir).await?;

        let mut command = Command::new(&self.binary_path);
        command
            .arg("--accept-tos")
            .arg("--email")
            .arg(request.email)
            .arg("--server")
            .arg(request.directory_url)
            .arg("--dns")
            .arg("manual")
            .arg("--path")
            .arg(request.data_dir)
            .arg("--pem");
        for domain in request.domains {
            command.arg("--domains").arg(domain);
        }
        command.arg("run");
        command.stdin(std::process::Stdio::piped());
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let mut child = command.spawn()?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| LegoRunnerError::OutputParse("missing stdout pipe".into()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| LegoRunnerError::OutputParse("missing stderr pipe".into()))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| LegoRunnerError::OutputParse("missing stdin pipe".into()))?;

        let stdin = Arc::new(Mutex::new(stdin));
        let stdout_task = tokio::spawn(process_stdout(
            stdout,
            stdin.clone(),
            request.dns_hook.clone(),
            request.propagation_wait,
        ));
        let stderr_task = tokio::spawn(collect_stream(stderr));

        let status = child.wait().await?;
        let stdout_result = stdout_task.await??;
        let stderr_lines = stderr_task.await??;

        cleanup_records(request.dns_hook.clone(), &stdout_result.records).await;

        if !status.success() {
            return Err(LegoRunnerError::CommandFailed {
                code: status.code(),
                stderr: stderr_lines.join("\n"),
            });
        }
        if let Some(err) = stdout_result.pending_error {
            return Err(err);
        }

        let certs_dir = request.data_dir.join("certificates");
        let primary = request.primary_domain();
        let cert_pem = tokio::fs::read_to_string(certs_dir.join(format!("{primary}.crt"))).await?;
        let key_pem = tokio::fs::read_to_string(certs_dir.join(format!("{primary}.key"))).await?;

        Ok(LegoCertificate {
            certificate_pem: cert_pem,
            private_key_pem: key_pem,
        })
    }
}

struct StdoutResult {
    records: Vec<DnsRecord>,
    pending_error: Option<LegoRunnerError>,
}

async fn cleanup_records(handler: DynDnsRecordHandler, records: &[DnsRecord]) {
    for record in records.iter().rev() {
        if let Err(err) = handler.cleanup(record).await {
            debug!(
                fqdn = %record.fqdn,
                error = %err,
                "failed to cleanup DNS TXT record via lego-runner",
            );
        }
    }
}

async fn collect_stream<R>(stream: R) -> Result<Vec<String>, std::io::Error>
where
    R: tokio::io::AsyncRead + Unpin,
{
    let mut reader = BufReader::new(stream);
    let mut buf = String::new();
    let mut lines = Vec::new();
    loop {
        buf.clear();
        let bytes = reader.read_line(&mut buf).await?;
        if bytes == 0 {
            break;
        }
        lines.push(buf.trim_end_matches('\n').to_string());
    }
    Ok(lines)
}

async fn process_stdout<R>(
    stream: R,
    stdin: Arc<Mutex<ChildStdin>>,
    handler: DynDnsRecordHandler,
    propagation_wait: Duration,
) -> Result<StdoutResult, LegoRunnerError>
where
    R: tokio::io::AsyncRead + Unpin,
{
    let mut reader = BufReader::new(stream);
    let mut buf = String::new();
    let mut pending_fqdn: Option<String> = None;
    let mut records = Vec::new();
    let mut pending_error: Option<LegoRunnerError> = None;

    loop {
        buf.clear();
        let bytes = reader.read_line(&mut buf).await?;
        if bytes == 0 {
            break;
        }
        let line = buf.trim().to_string();
        trace!(line = %line, "lego stdout");
        if let Some(record) = maybe_challenge(&line, &mut pending_fqdn) {
            if pending_error.is_none() {
                match handler.present(&record).await {
                    Ok(_) => {
                        trace!(fqdn = %record.fqdn, "presented TXT record");
                        records.push(record.clone());
                    }
                    Err(err) => {
                        pending_error = Some(LegoRunnerError::DnsHook(err.to_string()));
                    }
                }
            }
            let wait = if pending_error.is_some() {
                Duration::from_secs(0)
            } else {
                propagation_wait
            };
            if wait > Duration::from_secs(0) {
                sleep(wait).await;
            }
            let mut guard = stdin.lock().await;
            guard.write_all(b"\n").await?;
            guard.flush().await?;
        }
    }

    Ok(StdoutResult {
        records,
        pending_error,
    })
}

fn maybe_challenge(line: &str, pending_fqdn: &mut Option<String>) -> Option<DnsRecord> {
    if let Some(fqdn) = pending_fqdn.take() {
        if line.is_empty() {
            *pending_fqdn = Some(fqdn);
            return None;
        }
        return Some(DnsRecord {
            domain: derive_domain(&fqdn),
            fqdn,
            value: line.trim().to_string(),
        });
    }

    if line.to_ascii_lowercase().contains("dns txt record") {
        if let Some(caps) = RECORD_LINE_RE.captures(line) {
            if let Some(fqdn_match) = caps.get(1) {
                let fqdn = fqdn_match.as_str().trim_end_matches('.');
                *pending_fqdn = Some(fqdn.to_string());
            } else {
                debug!("DNS TXT record line matched but capture group 1 is missing: {}", line);
            }
        }
    }
    None
}

fn derive_domain(fqdn: &str) -> String {
    fqdn.trim_start_matches("_acme-challenge.")
        .trim_end_matches('.')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_domain_without_prefix() {
        assert_eq!(derive_domain("_acme-challenge.example.com"), "example.com");
        assert_eq!(
            derive_domain("_acme-challenge.sub.example.com."),
            "sub.example.com"
        );
    }

    #[test]
    fn parses_challenge_prompt_sequence() {
        let mut pending = None;
        assert!(
            maybe_challenge(
                "Please deploy a DNS TXT record under the name _acme-challenge.demo.example.com with the following value:",
                &mut pending
            )
            .is_none()
        );
        assert_eq!(pending.as_deref(), Some("_acme-challenge.demo.example.com"));
        let record = maybe_challenge("token-value-123", &mut pending).expect("record");
        assert_eq!(record.fqdn, "_acme-challenge.demo.example.com");
        assert_eq!(record.value, "token-value-123");
        assert_eq!(record.domain, "demo.example.com");
        assert!(pending.is_none());
    }
}
