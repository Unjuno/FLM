fn main() {
    tauri_build::build();
    
    // Generate root CA certificate for packaged-ca mode if enabled
    #[cfg(feature = "packaged-ca")]
    {
        generate_root_ca_certificate().unwrap_or_else(|e| {
            eprintln!("cargo:warning=Failed to generate root CA certificate: {}", e);
            eprintln!("cargo:warning=Note: This is expected if FLM_ROOT_CA_KEY is not set (development mode)");
        });
    }
    
    // Ensure certificate file exists for bundle resources (even without packaged-ca feature)
    #[cfg(not(feature = "packaged-ca"))]
    {
        ensure_certificate_file_exists().unwrap_or_else(|e| {
            eprintln!("cargo:warning=Failed to ensure certificate file exists: {}", e);
        });
    }
}

/// Ensure certificate file exists for bundle resources (placeholder when packaged-ca feature is disabled)
#[cfg(not(feature = "packaged-ca"))]
fn ensure_certificate_file_exists() -> Result<(), Box<dyn std::error::Error>> {
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    
    let manifest_dir = env::var("CARGO_MANIFEST_DIR")?;
    let resources_dir = PathBuf::from(&manifest_dir).join("resources").join("certs");
    
    // Create resources/certs directory if it doesn't exist
    fs::create_dir_all(&resources_dir)?;
    
    let cert_path = resources_dir.join("flm-ca.crt");
    
    // Create a placeholder file if it doesn't exist
    if !cert_path.exists() {
        // why: Tauri bundle resources require the file to exist, even if it's not used
        // alt: Remove from bundle.resources conditionally (not easily supported by Tauri)
        // evidence: tauri.conf.json always references this file in bundle.resources
        fs::write(&cert_path, "# Placeholder certificate file\n# This file is generated when packaged-ca feature is enabled\n")?;
        println!("cargo:warning=Created placeholder certificate file (packaged-ca feature not enabled)");
    }
    
    Ok(())
}

/// Generate root CA certificate for packaged-ca mode
///
/// This function generates a root CA certificate during build time and places it
/// in the resources/certs/ directory for bundling with the installer.
///
/// The private key can be provided via FLM_ROOT_CA_KEY environment variable (for CI/CD),
/// or a new certificate will be generated if not provided (for development).
#[cfg(feature = "packaged-ca")]
fn generate_root_ca_certificate() -> Result<(), Box<dyn std::error::Error>> {
    use flm_core::services::certificate;
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    
    let manifest_dir = env::var("CARGO_MANIFEST_DIR")?;
    let resources_dir = PathBuf::from(&manifest_dir).join("resources").join("certs");
    
    // Create resources/certs directory if it doesn't exist
    fs::create_dir_all(&resources_dir)?;
    
    let cert_path = resources_dir.join("flm-ca.crt");
    let key_path = resources_dir.join("flm-ca.key");
    
    // Check if certificate already exists (for development convenience)
    if cert_path.exists() && key_path.exists() {
        // Verify the certificate is valid
        if let Ok(cert_pem) = fs::read_to_string(&cert_path) {
            if certificate::is_certificate_valid(&cert_pem) {
                println!("cargo:warning=Root CA certificate already exists and is valid, skipping generation");
                println!("cargo:warning=To regenerate, delete {} and {}", cert_path.display(), key_path.display());
                return Ok(());
            }
        }
    }
    
    // Generate root CA certificate using flm-core's certificate service
    println!("cargo:warning=Generating new root CA certificate...");
    let root_ca = certificate::generate_root_ca("FLM Local Root CA", 3650)
        .map_err(|e| format!("Failed to generate root CA certificate: {e:?}"))?;
    
    // Write certificate (public key) - this will be bundled with the installer
    fs::write(&cert_path, &root_ca.certificate_pem)?;
    println!("cargo:warning=Generated root CA certificate: {}", cert_path.display());
    
    // Write private key - this should NOT be committed to the repository
    // In CI/CD, the key should be provided via FLM_ROOT_CA_KEY environment variable
    if let Ok(existing_key) = env::var("FLM_ROOT_CA_KEY") {
        // Use provided key from environment (CI/CD)
        fs::write(&key_path, existing_key)?;
        println!("cargo:warning=Using root CA key from FLM_ROOT_CA_KEY environment variable");
    } else {
        // Generate new key (development only)
        fs::write(&key_path, &root_ca.private_key_pem)?;
        println!("cargo:warning=Generated new root CA private key (development mode)");
        println!("cargo:warning=WARNING: This key should NOT be committed to the repository!");
        println!("cargo:warning=For production builds, set FLM_ROOT_CA_KEY environment variable");
    }
    
    println!("cargo:warning=Root CA certificate fingerprint: {}", root_ca.fingerprint);
    println!("cargo:warning=Certificate expires at: {}", root_ca.expires_at);
    
    Ok(())
}

