use flm_core::services::certificate::{
    generate_root_ca, generate_server_cert, is_certificate_valid, save_certificate_files,
};
use std::fs;
use std::net::IpAddr;
use std::path::Path;
use tracing::info;

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
