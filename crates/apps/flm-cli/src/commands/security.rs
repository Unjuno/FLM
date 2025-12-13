//! Security command implementation

use crate::adapters::SqliteSecurityRepository;
use crate::cli::security::{
    BackupSubcommand, CertificatesSubcommand, IpBlocklistSubcommand, PolicySubcommand,
    SecuritySubcommand,
};
use crate::utils::get_security_db_path;
use flm_core::domain::security::SecurityPolicy;
use flm_core::services::SecurityService;
use serde_json::json;
use std::fs;
use std::net::IpAddr;
use std::path::PathBuf;

/// Execute security command
pub async fn execute(
    subcommand: SecuritySubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        SecuritySubcommand::Policy { subcommand } => {
            execute_policy(subcommand, db_path, format).await
        }
        SecuritySubcommand::Backup { subcommand } => {
            execute_backup(subcommand, db_path, format).await
        }
        SecuritySubcommand::IpBlocklist { subcommand } => {
            execute_ip_blocklist(subcommand, db_path, format).await
        }
        SecuritySubcommand::AuditLogs {
            event_type,
            severity,
            ip,
            limit,
            offset,
        } => execute_audit_logs(event_type, severity, ip, limit, offset, db_path, format).await,
        SecuritySubcommand::Intrusion {
            ip,
            min_score,
            limit,
            offset,
        } => execute_intrusion(ip, min_score, limit, offset, db_path, format).await,
        SecuritySubcommand::Anomaly {
            ip,
            anomaly_type,
            limit,
            offset,
        } => execute_anomaly(ip, anomaly_type, limit, offset, db_path, format).await,
        SecuritySubcommand::InstallCa { cert_path } => execute_install_ca(cert_path, format).await,
        SecuritySubcommand::Certificates { subcommand } => {
            execute_certificates(subcommand, db_path, format).await
        }
        SecuritySubcommand::RateLimits { api_key_id } => {
            execute_rate_limits(api_key_id, db_path, format).await
        }
    }
}

/// Execute policy command
async fn execute_policy(
    subcommand: PolicySubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        PolicySubcommand::Show => execute_policy_show(db_path, format).await,
        PolicySubcommand::Set { json, file } => {
            execute_policy_set(json, file, db_path, format).await
        }
    }
}

/// Execute policy show command
async fn execute_policy_show(
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    let policy = service.get_policy("default").await?;

    if format == "json" {
        if let Some(policy) = policy {
            let output = json!({
                "version": "1.0",
                "data": {
                    "id": policy.id,
                    "policy_json": serde_json::from_str::<serde_json::Value>(&policy.policy_json)?,
                    "updated_at": policy.updated_at
                }
            });
            println!("{}", serde_json::to_string_pretty(&output)?);
        } else {
            let output = json!({
                "version": "1.0",
                "data": null
            });
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
    } else if let Some(policy) = policy {
        println!("Security Policy (default):");
        println!("  Updated: {}", policy.updated_at);
        println!("  Policy JSON:");
        let policy_value: serde_json::Value = serde_json::from_str(&policy.policy_json)?;
        println!("{}", serde_json::to_string_pretty(&policy_value)?);
    } else {
        println!("No security policy found (default)");
    }

    Ok(())
}

/// Execute policy set command
async fn execute_policy_set(
    json: Option<String>,
    file: Option<String>,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let policy_json = match (json, file) {
        (Some(json_str), None) => json_str,
        (None, Some(file_path)) => fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read policy file '{file_path}': {e}"))?,
        (Some(_), Some(_)) => {
            return Err("Cannot specify both --json and --file".into());
        }
        (None, None) => {
            return Err("Must specify either --json or --file".into());
        }
    };

    // Validate JSON
    serde_json::from_str::<serde_json::Value>(&policy_json)
        .map_err(|e| format!("Invalid JSON: {e}"))?;

    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    let policy = SecurityPolicy {
        id: "default".to_string(),
        policy_json,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    service.set_policy(policy.clone()).await?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "id": policy.id,
                "updated_at": policy.updated_at
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("Security policy updated successfully");
        println!("  ID: {}", policy.id);
        println!("  Updated: {}", policy.updated_at);
    }

    Ok(())
}

/// Execute backup command
async fn execute_backup(
    subcommand: BackupSubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        BackupSubcommand::Create { output } => execute_backup_create(output, db_path, format).await,
        BackupSubcommand::Restore { file } => execute_backup_restore(file, db_path, format).await,
    }
}

/// Execute backup create command
pub async fn execute_backup_create(
    output: Option<String>,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let security_db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    if !security_db_path.exists() {
        return Err("security.db does not exist".into());
    }

    // Determine backup directory
    let backup_dir = if let Some(output_path) = output {
        PathBuf::from(output_path)
    } else {
        // Use OS config directory/flm/backups/
        let app_data_dir =
            crate::utils::paths::get_app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
        app_data_dir.join("backups")
    };

    // Create backup directory if it doesn't exist
    fs::create_dir_all(&backup_dir)?;

    // Generate backup filename with timestamp
    let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
    let backup_filename = format!("security.db.bak.{timestamp}");
    let backup_path = backup_dir.join(&backup_filename);

    // Copy security.db to backup location
    fs::copy(&security_db_path, &backup_path)?;

    // Manage backup generations (keep only 3 most recent)
    let mut backup_files: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
    for entry in fs::read_dir(&backup_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file()
            && path
                .file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("security.db.bak."))
        {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    backup_files.push((path, modified));
                }
            }
        }
    }

    // Sort by modification time (newest first)
    backup_files.sort_by(|a, b| b.1.cmp(&a.1));

    // Remove oldest backups if more than 3
    if backup_files.len() > 3 {
        for (path, _) in backup_files.iter().skip(3) {
            if let Err(e) = fs::remove_file(path) {
                eprintln!("Warning: Failed to remove old backup {path:?}: {e}");
            }
        }
    }

    if format == "json" {
        let output_json = json!({
            "version": "1.0",
            "data": {
                "backup_path": backup_path.to_str().ok_or_else(|| {
                    format!(
                        "Error: Invalid UTF-8 encoding in backup path.\n\
                        Path: {}\n\
                        This usually indicates a system configuration issue.\n\
                        Please ensure your system locale supports UTF-8 or use a different backup location.",
                        backup_path.display()
                    )
                })?,
                "timestamp": timestamp.to_string(),
                "total_backups": backup_files.len().min(3)
            }
        });
        println!("{}", serde_json::to_string_pretty(&output_json)?);
    } else {
        println!("Backup created successfully");
        println!("  Path: {}", backup_path.display());
        println!("  Timestamp: {timestamp}");
        eprintln!("Backup saved to: {}", backup_path.display());
    }

    Ok(())
}

/// Execute backup restore command
pub async fn execute_backup_restore(
    file: String,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let backup_path = PathBuf::from(&file);
    if !backup_path.exists() {
        return Err(format!("Backup file does not exist: {file}").into());
    }

    let security_db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    // Check if security.db exists and warn user
    if security_db_path.exists() && format != "json" {
        eprintln!(
            "Warning: security.db already exists at: {}",
            security_db_path.display()
        );
        eprintln!("This operation will overwrite the existing database.");
        eprintln!("Make sure the application is stopped before proceeding.");
    }

    // Create parent directory if needed
    if let Some(parent) = security_db_path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Copy backup to security.db location
    fs::copy(&backup_path, &security_db_path)?;

    // Run migrations on the restored database
    let repo = SqliteSecurityRepository::new(&security_db_path).await?;
    // Repository initialization already runs migrations, so we just need to verify
    let service = SecurityService::new(repo);

    // Verify the restored database is accessible
    match service.list_api_keys().await {
        Ok(_) => {
            if format == "json" {
                let output_json = json!({
                    "version": "1.0",
                    "data": {
                        "restored_path": security_db_path.to_str().ok_or_else(|| {
                            format!(
                                "Error: Invalid UTF-8 encoding in restored database path.\n\
                                Path: {}\n\
                                This usually indicates a system configuration issue.\n\
                                Please ensure your system locale supports UTF-8 or use a different database path.",
                                security_db_path.display()
                            )
                        })?,
                        "backup_path": file,
                        "migrations_applied": true
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output_json)?);
            } else {
                println!("Backup restored successfully");
                println!("  Restored to: {}", security_db_path.display());
                println!("  Migrations applied");
                println!(
                    "\nNote: The application should be restarted to use the restored database."
                );
            }
        }
        Err(e) => {
            return Err(format!("Failed to verify restored database: {e}").into());
        }
    }

    Ok(())
}

/// Execute IP blocklist command
async fn execute_ip_blocklist(
    subcommand: IpBlocklistSubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let repo = SqliteSecurityRepository::new(&db_path).await?;

    match subcommand {
        IpBlocklistSubcommand::List => {
            let blocked_ips = repo.get_blocked_ips().await?;

            if format == "json" {
                let ip_list: Vec<serde_json::Value> = blocked_ips
                    .iter()
                    .map(
                        |(
                            ip,
                            failure_count,
                            first_failure_at,
                            blocked_until,
                            permanent_block,
                            last_attempt,
                        )| {
                            json!({
                                "ip": ip.to_string(),
                                "failure_count": failure_count,
                                "first_failure_at": first_failure_at,
                                "blocked_until": blocked_until,
                                "permanent_block": permanent_block,
                                "last_attempt": last_attempt
                            })
                        },
                    )
                    .collect();

                let output = json!({
                    "version": "1.0",
                    "data": {
                        "blocked_ips": ip_list
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else if blocked_ips.is_empty() {
                println!("No blocked IPs found");
            } else {
                println!("Blocked IPs:");
                for (
                    ip,
                    failure_count,
                    first_failure_at,
                    blocked_until,
                    permanent_block,
                    last_attempt,
                ) in blocked_ips
                {
                    println!("  IP: {ip}");
                    println!("    Failures: {failure_count}");
                    println!("    First failure: {first_failure_at}");
                    if let Some(until) = blocked_until {
                        println!("    Blocked until: {until}");
                    }
                    println!("    Permanent: {permanent_block}");
                    println!("    Last attempt: {last_attempt}");
                    println!();
                }
            }
        }
        IpBlocklistSubcommand::Unblock { ip } => {
            let ip_addr: IpAddr = ip.parse().map_err(|e| format!("Invalid IP address: {e}"))?;

            repo.unblock_ip(&ip_addr).await?;

            if format == "json" {
                let output = json!({
                    "version": "1.0",
                    "data": {
                        "ip": ip,
                        "unblocked": true
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else {
                println!("IP {ip} unblocked successfully");
            }
        }
        IpBlocklistSubcommand::Clear => {
            repo.clear_temporary_blocks().await?;

            if format == "json" {
                let output = json!({
                    "version": "1.0",
                    "data": {
                        "cleared": true
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else {
                println!("All temporary blocks cleared (permanent blocks remain)");
            }
        }
    }

    Ok(())
}

/// Execute audit logs command
async fn execute_audit_logs(
    event_type: Option<String>,
    severity: Option<String>,
    ip: Option<String>,
    limit: u32,
    offset: u32,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let repo = SqliteSecurityRepository::new(&db_path).await?;

    let logs = repo
        .list_audit_logs(
            Some(limit),
            Some(offset),
            event_type.as_deref(),
            severity.as_deref(),
            ip.as_deref(),
        )
        .await?;

    if format == "json" {
        let log_list: Vec<serde_json::Value> = logs
            .iter()
            .map(
                |(
                    id,
                    request_id,
                    api_key_id,
                    endpoint,
                    status,
                    latency_ms,
                    event_type,
                    severity,
                    ip,
                    details,
                    created_at,
                )| {
                    json!({
                        "id": id,
                        "request_id": request_id,
                        "api_key_id": api_key_id,
                        "endpoint": endpoint,
                        "status": status,
                        "latency_ms": latency_ms,
                        "event_type": event_type,
                        "severity": severity,
                        "ip": ip,
                        "details": details,
                        "created_at": created_at
                    })
                },
            )
            .collect();

        let output = json!({
            "version": "1.0",
            "data": {
                "logs": log_list,
                "limit": limit,
                "offset": offset
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else if logs.is_empty() {
        println!("No audit logs found");
    } else {
        println!(
            "Audit Logs (showing {} entries, offset {}):",
            logs.len(),
            offset
        );
        for (
            _id,
            request_id,
            _api_key_id,
            endpoint,
            status,
            latency_ms,
            event_type,
            severity,
            ip,
            _details,
            created_at,
        ) in logs
        {
            println!("  [{created_at}] {endpoint} - {request_id} - Status: {status}");
            if let Some(et) = event_type {
                let severity_label = severity.as_deref().unwrap_or("unknown");
                println!("    Event: {et} (Severity: {severity_label})");
            }
            if let Some(ip_addr) = ip {
                println!("    IP: {ip_addr}");
            }
            if let Some(latency) = latency_ms {
                println!("    Latency: {latency}ms");
            }
            println!();
        }
    }

    Ok(())
}

/// Execute intrusion command
async fn execute_intrusion(
    ip: Option<String>,
    min_score: Option<u32>,
    limit: u32,
    offset: u32,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let repo = SqliteSecurityRepository::new(&db_path).await?;

    let attempts = repo
        .list_intrusion_attempts(Some(limit), Some(offset), ip.as_deref(), min_score)
        .await?;

    if format == "json" {
        let attempt_list: Vec<serde_json::Value> = attempts
            .iter()
            .map(
                |(id, ip, pattern, score, request_path, user_agent, method, created_at)| {
                    json!({
                        "id": id,
                        "ip": ip,
                        "pattern": pattern,
                        "score": score,
                        "request_path": request_path,
                        "user_agent": user_agent,
                        "method": method,
                        "created_at": created_at
                    })
                },
            )
            .collect();

        let output = json!({
            "version": "1.0",
            "data": {
                "attempts": attempt_list,
                "limit": limit,
                "offset": offset
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else if attempts.is_empty() {
        println!("No intrusion attempts found");
    } else {
        println!(
            "Intrusion Attempts (showing {} entries, offset {}):",
            attempts.len(),
            offset
        );
        for (_id, ip, pattern, score, request_path, user_agent, method, created_at) in attempts {
            println!("  [{created_at}] IP: {ip} - Pattern: {pattern} - Score: {score}");
            if let Some(path) = request_path {
                let method_name = method.as_deref().unwrap_or("unknown");
                println!("    Path: {path} ({method_name})");
            }
            if let Some(ua) = user_agent {
                println!("    User-Agent: {ua}");
            }
            println!();
        }
    }

    Ok(())
}

/// Execute anomaly command
async fn execute_anomaly(
    ip: Option<String>,
    anomaly_type: Option<String>,
    limit: u32,
    offset: u32,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let repo = SqliteSecurityRepository::new(&db_path).await?;

    let detections = repo
        .list_anomaly_detections(
            Some(limit),
            Some(offset),
            ip.as_deref(),
            anomaly_type.as_deref(),
        )
        .await?;

    if format == "json" {
        let detection_list: Vec<serde_json::Value> = detections
            .iter()
            .map(|(id, ip, anomaly_type, score, details, created_at)| {
                json!({
                    "id": id,
                    "ip": ip,
                    "anomaly_type": anomaly_type,
                    "score": score,
                    "details": details,
                    "created_at": created_at
                })
            })
            .collect();

        let output = json!({
            "version": "1.0",
            "data": {
                "detections": detection_list,
                "limit": limit,
                "offset": offset
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else if detections.is_empty() {
        println!("No anomaly detections found");
    } else {
        println!(
            "Anomaly Detections (showing {} entries, offset {}):",
            detections.len(),
            offset
        );
        for (_id, ip, anomaly_type, score, details, created_at) in detections {
            println!("  [{created_at}] IP: {ip} - Type: {anomaly_type} - Score: {score}");
            if let Some(d) = details {
                println!("    Details: {d}");
            }
            println!();
        }
    }

    Ok(())
}

/// Execute install-ca command
async fn execute_install_ca(
    cert_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    use anyhow::Context;
    use flm_core::services::certificate;
    use std::path::Path;

    let cert_pem = if let Some(ref path) = cert_path {
        fs::read_to_string(path)
            .with_context(|| format!("Failed to read certificate file: {path}"))?
    } else {
        // Try to find flm-ca.crt in default cert directory
        let default_cert_dir = if cfg!(target_os = "windows") {
            let mut base =
                PathBuf::from(std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string()));
            base.push("flm");
            base.push("certs");
            base
        } else {
            let mut base = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".to_string()));
            base.push(".flm");
            base.push("certs");
            base
        };
        let default_cert_path = default_cert_dir.join("flm-ca.crt");
        if default_cert_path.exists() {
            fs::read_to_string(&default_cert_path).with_context(|| {
                format!(
                    "Failed to read certificate file: {}",
                    default_cert_path.display()
                )
            })?
        } else {
            return Err(format!(
                "Certificate file not found. Please specify --cert-path or place flm-ca.crt at {}",
                default_cert_path.display()
            )
            .into());
        }
    };

    let filename = cert_path
        .as_ref()
        .and_then(|p| Path::new(p).file_name())
        .and_then(|s| s.to_str())
        .unwrap_or("flm-ca.crt");

    if format == "json" {
        println!("{{");
        println!("  \"version\": \"1.0\",");
        println!("  \"status\": \"installing\"");
        println!("}}");
    } else {
        println!("Installing CA certificate to OS trust store...");
    }

    certificate::register_root_ca_with_os_trust_store(&cert_pem, filename)
        .with_context(|| "Failed to register certificate with OS trust store")?;

    if format == "json" {
        println!("{{");
        println!("  \"version\": \"1.0\",");
        println!("  \"status\": \"success\",");
        println!("  \"message\": \"Certificate installed successfully\"");
        println!("}}");
    } else {
        println!("✓ Certificate installed successfully to OS trust store");
    }

    Ok(())
}

/// Execute certificates command
async fn execute_certificates(
    subcommand: CertificatesSubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        CertificatesSubcommand::List => {
            let db_path = db_path
                .map(PathBuf::from)
                .unwrap_or_else(get_security_db_path);

            let repo = SqliteSecurityRepository::new(&db_path).await?;

            let certificates = repo.list_certificates().await?;

            if format == "json" {
                let cert_list: Vec<serde_json::Value> = certificates
                    .iter()
                    .map(
                        |(id, cert_path, key_path, mode, domain, expires_at, updated_at)| {
                            json!({
                                "id": id,
                                "cert_path": cert_path,
                                "key_path": key_path,
                                "mode": mode,
                                "domain": domain,
                                "expires_at": expires_at,
                                "updated_at": updated_at
                            })
                        },
                    )
                    .collect();

                let output = json!({
                    "version": "1.0",
                    "data": {
                        "certificates": cert_list
                    }
                });
                println!("{}", serde_json::to_string_pretty(&output)?);
            } else if certificates.is_empty() {
                println!("No certificates found");
            } else {
                println!("Certificates:");
                for (id, cert_path, key_path, mode, domain, expires_at, updated_at) in certificates
                {
                    println!("  ID: {id}");
                    if let Some(d) = domain {
                        println!("    Domain: {d}");
                    }
                    println!("    Mode: {mode}");
                    if let Some(exp) = expires_at {
                        println!("    Expires: {exp}");
                    }
                    println!("    Certificate: {cert_path}");
                    println!("    Key: {key_path}");
                    println!("    Updated: {updated_at}");
                    println!();
                }
            }
        }
    }

    Ok(())
}

/// Execute rate-limits command
async fn execute_rate_limits(
    api_key_id: Option<String>,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);

    let repo = SqliteSecurityRepository::new(&db_path).await?;

    let rate_limits = repo.list_rate_limit_states(api_key_id.as_deref()).await?;

    let now = chrono::Utc::now();

    if format == "json" {
        let rate_limit_list: Vec<serde_json::Value> = rate_limits
            .iter()
            .map(|(key_id, requests_count, reset_at)| {
                let reset_chrono = chrono::DateTime::parse_from_rfc3339(reset_at)
                    .ok()
                    .map(|dt| dt.with_timezone(&chrono::Utc));
                let is_expired = reset_chrono.map(|dt| dt < now).unwrap_or(false);

                json!({
                    "api_key_id": key_id,
                    "requests_count": requests_count,
                    "reset_at": reset_at,
                    "is_expired": is_expired
                })
            })
            .collect();

        let output = json!({
            "version": "1.0",
            "data": {
                "rate_limits": rate_limit_list
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else if rate_limits.is_empty() {
        println!("No rate limit states found");
    } else {
        println!("Rate Limit States:");
        for (key_id, requests_count, reset_at) in rate_limits {
            let reset_chrono = chrono::DateTime::parse_from_rfc3339(&reset_at)
                .ok()
                .map(|dt| dt.with_timezone(&chrono::Utc));
            let is_expired = reset_chrono.map(|dt| dt < now).unwrap_or(false);

            println!("  API Key ID: {key_id}");
            println!("    Requests: {requests_count}");
            println!("    Reset at: {reset_at}");
            if is_expired {
                println!("    Status: expired");
            } else {
                println!("    Status: active");
            }
            println!();
        }
    }

    Ok(())
}
