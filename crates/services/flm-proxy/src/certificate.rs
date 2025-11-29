use flm_core::services::certificate::{
    generate_root_ca, generate_server_cert, is_certificate_valid, save_certificate_files,
};
use std::fs;
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use tracing::{info, warn};

pub fn ensure_root_ca_artifacts(
    cert_dir: &Path,
    cert_filename: &str,
    key_filename: &str,
    common_name: &str,
) -> Result<(String, String), String> {
    let cert_path = cert_dir.join(cert_filename);
    let key_path = cert_dir.join(key_filename);

    if cert_path.exists() && key_path.exists() {
        if let (Ok(cert_pem), Ok(key_pem)) = (
            std::fs::read_to_string(&cert_path),
            std::fs::read_to_string(&key_path),
        ) {
            if is_certificate_valid(&cert_pem) {
                return Ok((cert_pem, key_pem));
            }
        }
    }

    info!("Generating new root CA at {:?}", cert_dir);
    let root_ca = generate_root_ca(common_name, 3650).map_err(|e| format!("{e:?}"))?;

    save_certificate_files(
        cert_dir,
        &root_ca.certificate_pem,
        &root_ca.private_key_pem,
        cert_filename,
        key_filename,
    )
    .map_err(|e| format!("Failed to save root CA: {e}"))?;

    Ok((root_ca.certificate_pem, root_ca.private_key_pem))
}

pub fn ensure_server_cert_artifacts(
    cert_dir: &Path,
    root_ca_cert_pem: &str,
    root_ca_key_pem: &str,
    listen_addr: &str,
    cert_filename: &str,
    key_filename: &str,
) -> Result<(String, String), String> {
    let cert_path = cert_dir.join(cert_filename);
    let key_path = cert_dir.join(key_filename);

    if cert_path.exists() && key_path.exists() {
        if let (Ok(cert_pem), Ok(key_pem)) = (
            fs::read_to_string(&cert_path),
            fs::read_to_string(&key_path),
        ) {
            if is_certificate_valid(&cert_pem) {
                info!("Using existing server certificate at {:?}", cert_path);
                return Ok((cert_pem, key_pem));
            }
        }
    }

    let mut additional_sans = Vec::new();
    if let Ok(ip) = listen_addr.parse::<IpAddr>() {
        if !ip.is_unspecified() {
            additional_sans.push(ip.to_string());
        }
    } else {
        additional_sans.push(listen_addr.to_string());
    }

    let server_cert = generate_server_cert(
        root_ca_cert_pem,
        root_ca_key_pem,
        "FLM Proxy Server",
        365,
        Some(additional_sans),
    )
    .map_err(|e| format!("Failed to generate server certificate: {e}"))?;

    save_certificate_files(
        cert_dir,
        &server_cert.certificate_pem,
        &server_cert.private_key_pem,
        cert_filename,
        key_filename,
    )
    .map_err(|e| format!("Failed to persist server certificate: {e}"))?;

    Ok((server_cert.certificate_pem, server_cert.private_key_pem))
}

/// Load packaged root CA certificate from bundled resources
///
/// This function attempts to load the root CA certificate from the bundled resources
/// (e.g., `resources/certs/flm-ca.crt` in the Tauri application bundle).
/// If the certificate is not found in resources, it falls back to generating a new one.
///
/// # Arguments
/// * `cert_dir` - Directory to save certificates
/// * `cert_filename` - Certificate filename
/// * `key_filename` - Key filename
/// * `common_name` - Common name for the CA
///
/// # Returns
/// Root CA certificate and private key in PEM format
pub fn load_packaged_root_ca(
    cert_dir: &Path,
    cert_filename: &str,
    key_filename: &str,
    common_name: &str,
) -> Result<(String, String), String> {
    // Try to find packaged CA certificate in common locations
    let possible_paths = vec![
        // Tauri bundle resources (Windows)
        PathBuf::from("resources/certs/flm-ca.crt"),
        // Tauri bundle resources (macOS)
        PathBuf::from("../Resources/resources/certs/flm-ca.crt"),
        // Tauri bundle resources (Linux)
        PathBuf::from("../share/flm/resources/certs/flm-ca.crt"),
        // Development/relative path
        PathBuf::from("archive/prototype/src-tauri/resources/certs/flm-ca.crt"),
    ];

    // Also check environment variable for custom path
    if let Ok(env_path) = std::env::var("FLM_PACKAGED_CA_CERT_PATH") {
        let env_path = PathBuf::from(env_path);
        if env_path.exists() {
            if let Ok(cert_pem) = fs::read_to_string(&env_path) {
                info!(
                    "Loaded packaged root CA from environment path: {:?}",
                    env_path
                );
                // For packaged CA, we don't have the private key, so we need to generate a new one
                // or use a pre-shared key. For now, we'll generate a new root CA if key doesn't exist.
                let key_path = cert_dir.join(key_filename);
                if key_path.exists() {
                    if let Ok(key_pem) = fs::read_to_string(&key_path) {
                        if is_certificate_valid(&cert_pem) {
                            return Ok((cert_pem, key_pem));
                        }
                    }
                }
                // If key doesn't exist, we can't use the packaged cert (need key to sign server certs)
                warn!("Packaged CA certificate found but no matching key. Generating new root CA.");
            }
        }
    }

    // Try to find in possible paths
    for path in &possible_paths {
        if path.exists() {
            if let Ok(cert_pem) = fs::read_to_string(path) {
                info!("Loaded packaged root CA from: {:?}", path);
                // Check if we have a matching key
                let key_path = cert_dir.join(key_filename);
                if key_path.exists() {
                    if let Ok(key_pem) = fs::read_to_string(&key_path) {
                        if is_certificate_valid(&cert_pem) {
                            return Ok((cert_pem, key_pem));
                        }
                    }
                }
                // If key doesn't exist, we can't use the packaged cert
                warn!("Packaged CA certificate found but no matching key. Generating new root CA.");
            }
        }
    }

    // Fallback to generating a new root CA
    info!("Packaged root CA not found, generating new root CA");
    ensure_root_ca_artifacts(cert_dir, cert_filename, key_filename, common_name)
}
