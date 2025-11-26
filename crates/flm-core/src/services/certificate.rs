//! Certificate management service for packaged-ca mode (Phase 3)
//!
//! This module provides functionality for generating and managing root CA certificates
//! and server certificates for the packaged-ca mode.

use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use rcgen::{
    Certificate, CertificateParams, DistinguishedName, DnType, KeyPair, SanType,
    PKCS_ECDSA_P256_SHA256,
};
use ring::digest;
use std::collections::BTreeSet;
use std::fs;
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Root CA certificate information
#[derive(Debug, Clone)]
pub struct RootCaInfo {
    /// Certificate in PEM format
    pub certificate_pem: String,
    /// Private key in PEM format (should be kept secret)
    pub private_key_pem: String,
    /// Certificate fingerprint (SHA256)
    pub fingerprint: String,
    /// Expiration date
    pub expires_at: DateTime<Utc>,
}

/// Generate a root CA certificate
///
/// This function generates a self-signed root CA certificate that can be used
/// to sign server certificates for the packaged-ca mode.
///
/// # Arguments
/// * `common_name` - Common name for the CA (e.g., "FLM Local CA")
/// * `validity_days` - Certificate validity period in days (default: 3650 = 10 years)
///
/// # Returns
/// Root CA certificate information including certificate and private key
pub fn generate_root_ca(common_name: &str, validity_days: u32) -> Result<RootCaInfo> {
    let key_pair = KeyPair::generate(&PKCS_ECDSA_P256_SHA256)
        .context("Failed to generate key pair for root CA")?;

    let mut params = CertificateParams::new(Vec::<String>::new());
    params.distinguished_name = DistinguishedName::new();
    params
        .distinguished_name
        .push(DnType::CommonName, common_name);
    params
        .distinguished_name
        .push(DnType::OrganizationName, "FLM");
    params.distinguished_name.push(DnType::CountryName, "US");

    // Set certificate as CA
    params.is_ca = rcgen::IsCa::Ca(rcgen::BasicConstraints::Unconstrained);

    // Set validity period
    let not_before = Utc::now();
    let not_after = not_before + chrono::Duration::days(validity_days as i64);
    // Convert chrono::DateTime to time::OffsetDateTime
    let not_before_time = time::OffsetDateTime::from_unix_timestamp(not_before.timestamp())
        .context("Failed to convert not_before to OffsetDateTime")?;
    let not_after_time = time::OffsetDateTime::from_unix_timestamp(not_after.timestamp())
        .context("Failed to convert not_after to OffsetDateTime")?;
    params.not_before = not_before_time;
    params.not_after = not_after_time;

    // Set key pair for the certificate
    params.key_pair = Some(key_pair);

    // Generate certificate from parameters
    // Note: rcgen 0.12 API - Certificate::from_params() takes ownership of params
    let cert = Certificate::from_params(params).context("Failed to create root CA certificate")?;

    let certificate_pem = cert
        .serialize_pem()
        .context("Failed to serialize root CA certificate")?;

    let private_key_pem = cert.serialize_private_key_pem();

    // Calculate fingerprint (SHA256 of DER)
    let der = cert
        .serialize_der()
        .context("Failed to serialize root CA certificate to DER")?;
    let fingerprint = digest::digest(&digest::SHA256, &der);
    let fingerprint_hex = fingerprint
        .as_ref()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join(":");

    Ok(RootCaInfo {
        certificate_pem,
        private_key_pem,
        fingerprint: fingerprint_hex,
        expires_at: not_after,
    })
}

/// Server certificate information
#[derive(Debug, Clone)]
pub struct ServerCertInfo {
    /// Certificate in PEM format
    pub certificate_pem: String,
    /// Private key in PEM format
    pub private_key_pem: String,
    /// Certificate fingerprint (SHA256)
    pub fingerprint: String,
    /// Expiration date
    pub expires_at: DateTime<Utc>,
}

/// Generate a server certificate signed by root CA
///
/// This function generates a server certificate signed by the provided root CA.
/// The certificate includes Subject Alternative Names (SAN) for localhost and
/// RFC1918 private IP ranges.
///
/// # Arguments
/// * `root_ca_cert_pem` - Root CA certificate in PEM format
/// * `root_ca_key_pem` - Root CA private key in PEM format
/// * `common_name` - Common name for the server certificate (e.g., "FLM Proxy Server")
/// * `validity_days` - Certificate validity period in days (default: 365 = 1 year)
/// * `san_ips` - Additional IP addresses to include in SAN (optional)
///
/// # Returns
/// Server certificate information including certificate and private key
pub fn generate_server_cert(
    root_ca_cert_pem: &str,
    root_ca_key_pem: &str,
    common_name: &str,
    validity_days: u32,
    san_ips: Option<Vec<String>>,
) -> Result<ServerCertInfo> {
    let root_ca_key =
        KeyPair::from_pem(root_ca_key_pem).context("Failed to parse packaged root CA key")?;
    let root_ca_params = CertificateParams::from_ca_cert_pem(root_ca_cert_pem, root_ca_key)
        .context("Failed to parse packaged root CA certificate")?;
    let root_ca_cert =
        Certificate::from_params(root_ca_params).context("Failed to load packaged root CA")?;

    // Generate server key pair
    let server_key_pair =
        KeyPair::generate(&PKCS_ECDSA_P256_SHA256).context("Failed to generate server key pair")?;

    // Create server certificate parameters
    // Note: rcgen 0.12 API - CertificateParams::new() takes a Vec<String> for subject_alt_names
    let mut params = CertificateParams::new(Vec::new());
    params.distinguished_name = DistinguishedName::new();
    params
        .distinguished_name
        .push(DnType::CommonName, common_name);
    params
        .distinguished_name
        .push(DnType::OrganizationName, "FLM");
    params.distinguished_name.push(DnType::CountryName, "US");

    params.key_pair = Some(server_key_pair);

    // Add Subject Alternative Names
    params.subject_alt_names = build_subject_alt_names(san_ips);

    // Set validity period
    let not_before = Utc::now();
    let not_after = not_before + chrono::Duration::days(validity_days as i64);
    // Convert chrono::DateTime to time::OffsetDateTime
    let not_before_time = time::OffsetDateTime::from_unix_timestamp(not_before.timestamp())
        .context("Failed to convert not_before to OffsetDateTime")?;
    let not_after_time = time::OffsetDateTime::from_unix_timestamp(not_after.timestamp())
        .context("Failed to convert not_after to OffsetDateTime")?;
    params.not_before = not_before_time;
    params.not_after = not_after_time;

    let server_cert =
        Certificate::from_params(params).context("Failed to create server certificate")?;

    let certificate_pem = server_cert
        .serialize_pem_with_signer(&root_ca_cert)
        .context("Failed to serialize signed server certificate")?;

    let private_key_pem = server_cert.serialize_private_key_pem();

    let der = server_cert
        .serialize_der_with_signer(&root_ca_cert)
        .context("Failed to serialize signed server certificate to DER")?;
    let fingerprint = digest::digest(&digest::SHA256, &der);
    let fingerprint_hex = fingerprint
        .as_ref()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join(":");

    Ok(ServerCertInfo {
        certificate_pem,
        private_key_pem,
        fingerprint: fingerprint_hex,
        expires_at: not_after,
    })
}

/// Save certificate and key to files
///
/// # Arguments
/// * `cert_dir` - Directory to save certificates
/// * `cert_pem` - Certificate in PEM format
/// * `key_pem` - Private key in PEM format
/// * `cert_filename` - Certificate filename (default: "server.pem")
/// * `key_filename` - Key filename (default: "server.key")
pub fn save_certificate_files(
    cert_dir: &Path,
    cert_pem: &str,
    key_pem: &str,
    cert_filename: &str,
    key_filename: &str,
) -> Result<PathBuf> {
    // Create directory if it doesn't exist
    fs::create_dir_all(cert_dir)
        .with_context(|| format!("Failed to create certificate directory: {cert_dir:?}"))?;

    let cert_path = cert_dir.join(cert_filename);
    let key_path = cert_dir.join(key_filename);

    // Save certificate
    fs::write(&cert_path, cert_pem)
        .with_context(|| format!("Failed to write certificate to {cert_path:?}"))?;

    // Save private key with restricted permissions (600)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&cert_dir)?.permissions();
        perms.set_mode(0o600);
        fs::set_permissions(&key_path, perms)
            .with_context(|| format!("Failed to set permissions on {key_path:?}"))?;
    }

    fs::write(&key_path, key_pem)
        .with_context(|| format!("Failed to write private key to {key_path:?}"))?;

    Ok(cert_path)
}

/// Check if certificate is valid and not expired
///
/// # Arguments
/// * `cert_pem` - Certificate in PEM format
///
/// # Returns
/// `true` if certificate is valid and not expired, `false` otherwise
pub fn is_certificate_valid(cert_pem: &str) -> bool {
    match x509_parser::pem::parse_x509_pem(cert_pem.as_bytes()) {
        Ok((_, pem)) => {
            match x509_parser::parse_x509_certificate(&pem.contents) {
                Ok((_, cert)) => {
                    let now = Utc::now();
                    let validity = cert.validity();
                    let not_before = validity.not_before.to_datetime();
                    let not_after = validity.not_after.to_datetime();

                    // Convert x509-parser's OffsetDateTime to chrono's DateTime<Utc>
                    let not_before_utc =
                        DateTime::<Utc>::from_timestamp(not_before.unix_timestamp(), 0)
                            .unwrap_or_else(Utc::now);
                    let not_after_utc =
                        DateTime::<Utc>::from_timestamp(not_after.unix_timestamp(), 0)
                            .unwrap_or_else(Utc::now);

                    now >= not_before_utc && now <= not_after_utc
                }
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

fn build_subject_alt_names(additional: Option<Vec<String>>) -> Vec<SanType> {
    let mut entries: BTreeSet<String> = BTreeSet::new();
    entries.insert("localhost".to_string());
    entries.insert("127.0.0.1".to_string());
    entries.insert("::1".to_string());
    entries.insert("10.0.0.1".to_string());
    entries.insert("172.16.0.1".to_string());
    entries.insert("192.168.0.1".to_string());

    if let Some(values) = additional {
        for value in values {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                continue;
            }
            entries.insert(trimmed.to_string());
        }
    }

    entries
        .into_iter()
        .map(|entry| match entry.parse::<IpAddr>() {
            Ok(ip) => SanType::IpAddress(ip),
            Err(_) => SanType::DnsName(entry),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use x509_parser::extensions::GeneralName;

    #[test]
    fn generate_server_cert_uses_packaged_root() {
        let root = generate_root_ca("Test Root CA", 365).unwrap();

        let server = generate_server_cert(
            &root.certificate_pem,
            &root.private_key_pem,
            "FLM Proxy Server",
            90,
            Some(vec!["custom.local".into(), "192.168.1.50".into()]),
        )
        .unwrap();

        let (_, root_pem) =
            x509_parser::pem::parse_x509_pem(root.certificate_pem.as_bytes()).unwrap();
        let (_, root_cert) = x509_parser::parse_x509_certificate(&root_pem.contents).unwrap();

        let (_, server_pem) =
            x509_parser::pem::parse_x509_pem(server.certificate_pem.as_bytes()).unwrap();
        let (_, server_cert) = x509_parser::parse_x509_certificate(&server_pem.contents).unwrap();

        assert_eq!(
            server_cert.tbs_certificate.issuer,
            root_cert.tbs_certificate.subject
        );

        let san = server_cert
            .subject_alternative_name()
            .expect("Failed to parse SAN extension")
            .expect("SAN extension missing")
            .value;

        let mut has_localhost = false;
        let mut has_custom = false;
        let mut has_private_ip = false;

        for name in san.general_names.iter() {
            match name {
                GeneralName::DNSName(dns) => {
                    if *dns == "localhost" {
                        has_localhost = true;
                    }
                    if *dns == "custom.local" {
                        has_custom = true;
                    }
                }
                GeneralName::IPAddress(ip) => {
                    if ip == &[192, 168, 1, 50] {
                        has_private_ip = true;
                    }
                }
                _ => {}
            }
        }

        assert!(has_localhost, "SAN should include localhost");
        assert!(has_custom, "SAN should include caller provided DNS entries");
        assert!(
            has_private_ip,
            "SAN should include caller provided private IP addresses"
        );
    }
}

/// Register the provided certificate PEM with the OS trust store
pub fn register_root_ca_with_os_trust_store(
    cert_pem: &str,
    preferred_filename: &str,
) -> Result<()> {
    if cert_pem.trim().is_empty() {
        return Err(anyhow!("certificate PEM is empty"));
    }

    let filename = Path::new(preferred_filename)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("flm-ca.crt");

    let temp_path = std::env::temp_dir().join(filename);
    fs::write(&temp_path, cert_pem).context("failed to write temporary certificate file")?;

    #[cfg(target_os = "windows")]
    let install_result = install_certificate_windows(&temp_path);

    #[cfg(target_os = "macos")]
    let install_result = install_certificate_macos(&temp_path);

    #[cfg(target_os = "linux")]
    let install_result = install_certificate_linux(&temp_path, filename);

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let install_result = Err(anyhow!(
        "unsupported OS '{}' for trust store registration",
        std::env::consts::OS
    ));

    let _ = fs::remove_file(&temp_path);
    install_result
}

#[cfg(target_os = "windows")]
fn install_certificate_windows(cert_path: &Path) -> Result<()> {
    let cert_str = cert_path
        .to_str()
        .ok_or_else(|| anyhow!("invalid certificate path"))?;

    let current_user_script = format!(
        r#"Import-Certificate -FilePath "{cert_str}" -CertStoreLocation Cert:\CurrentUser\Root"#
    );
    let current_user_output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &current_user_script,
        ])
        .output()
        .context("failed to execute PowerShell for certificate import")?;
    if current_user_output.status.success() {
        return Ok(());
    }

    let local_machine_script = format!(
        r#"Import-Certificate -FilePath "{cert_str}" -CertStoreLocation Cert:\LocalMachine\Root"#
    );
    let local_machine_output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &local_machine_script,
        ])
        .output()
        .context("failed to execute PowerShell for LocalMachine certificate import")?;
    if local_machine_output.status.success() {
        return Ok(());
    }

    let current_err = String::from_utf8_lossy(&current_user_output.stderr);
    let machine_err = String::from_utf8_lossy(&local_machine_output.stderr);
    Err(anyhow!(
        "failed to import certificate into Windows trust store. CurrentUser error: {}. LocalMachine error: {}. Run the application as Administrator and retry.",
        current_err.trim(),
        machine_err.trim()
    ))
}

#[cfg(target_os = "macos")]
fn install_certificate_macos(cert_path: &Path) -> Result<()> {
    let cert_str = cert_path
        .to_str()
        .ok_or_else(|| anyhow!("invalid certificate path"))?;
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/Shared".to_string());
    let keychain = format!("{home}/Library/Keychains/login.keychain-db");

    let output = Command::new("security")
        .args([
            "add-trusted-cert",
            "-d",
            "-r",
            "trustRoot",
            "-k",
            &keychain,
            cert_str,
        ])
        .output()
        .context("failed to execute security command")?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(anyhow!(
        "failed to register certificate on macOS keychain '{}': {}. Try running the app with elevated privileges.",
        keychain,
        stderr.trim()
    ))
}

#[cfg(target_os = "linux")]
fn install_certificate_linux(cert_path: &Path, filename: &str) -> Result<()> {
    use std::io;

    let target_dir = Path::new("/usr/local/share/ca-certificates");
    let dest_path = target_dir.join(filename);

    if let Err(err) = fs::create_dir_all(target_dir) {
        if err.kind() != io::ErrorKind::PermissionDenied {
            return Err(err).context("failed to prepare /usr/local/share/ca-certificates");
        }
        return Err(anyhow!(
            "permission denied creating '{}'. Run `sudo mkdir -p {}` and retry.",
            target_dir.display(),
            target_dir.display()
        ));
    }

    if let Err(err) = fs::copy(cert_path, &dest_path) {
        if err.kind() == io::ErrorKind::PermissionDenied {
            return Err(anyhow!(
                "permission denied copying certificate to '{}'. Run `sudo cp {} {}` and retry.",
                dest_path.display(),
                cert_path.display(),
                dest_path.display()
            ));
        }
        return Err(err).context("failed to copy certificate into trust store directory");
    }

    let update_status = Command::new("update-ca-certificates").output();
    match update_status {
        Ok(output) if output.status.success() => Ok(()),
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if let Ok(fallback_output) = Command::new("update-ca-trust").arg("extract").output() {
                if fallback_output.status.success() {
                    return Ok(());
                }
                let fallback_err = String::from_utf8_lossy(&fallback_output.stderr);
                Err(anyhow!(
                    "failed to refresh CA certificates. update-ca-certificates: {}; update-ca-trust: {}. Run the commands manually with sudo.",
                    stderr.trim(),
                    fallback_err.trim()
                ))
            } else {
                Err(anyhow!(
                    "failed to refresh CA certificates via update-ca-certificates: {}. Install ca-certificates utilities and retry.",
                    stderr.trim()
                ))
            }
        }
        Err(_) => {
            if let Ok(fallback_output) = Command::new("update-ca-trust").arg("extract").output() {
                if fallback_output.status.success() {
                    return Ok(());
                }
                let fallback_err = String::from_utf8_lossy(&fallback_output.stderr);
                return Err(anyhow!(
                    "update-ca-trust extract failed: {}. Run the command manually with sudo.",
                    fallback_err.trim()
                ));
            }
            Err(anyhow!(
                "neither update-ca-certificates nor update-ca-trust commands are available. Install ca-certificates utilities and rerun."
            ))
        }
    }
}
