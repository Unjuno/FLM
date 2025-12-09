//! Firewall automation IPC commands for Setup Wizard
//!
//! Provides IPC commands for firewall script generation, application, and rollback.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;

/// Firewall preview request
#[derive(Debug, Deserialize)]
pub struct FirewallPreviewRequest {
    pub os: String,
    pub ports: Vec<u16>,
    pub ip_whitelist: Vec<String>,
}

/// Firewall preview response
#[derive(Debug, Serialize)]
pub struct FirewallPreviewResponse {
    pub script: String,
    pub display_name: String,
    pub shell: String,
}

/// Firewall apply request
#[derive(Debug, Deserialize)]
pub struct FirewallApplyRequest {
    pub script: String,
    pub shell: String,
}

/// Firewall apply response
#[derive(Debug, Serialize)]
pub struct FirewallApplyResponse {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Firewall status response
#[derive(Debug, Serialize)]
pub struct FirewallStatus {
    pub applied: bool,
    pub rules_count: Option<u32>,
    pub last_applied: Option<String>,
}

/// Generate firewall script preview
#[tauri::command]
pub async fn system_firewall_preview(
    request: FirewallPreviewRequest,
) -> Result<FirewallPreviewResponse, String> {
    let os = request.os.to_lowercase();
    let ports = request.ports;
    let ip_whitelist = request.ip_whitelist;

    let (script, display_name, shell) = match os.as_str() {
        "windows" => {
            let mut script_lines = Vec::new();
            script_lines.push("# Windows Firewall Rules".to_string());
            script_lines.push("# Run as Administrator".to_string());
            script_lines.push("".to_string());
            
            if ip_whitelist.is_empty() {
                // Allow all IPs for each port
                for port in &ports {
                    script_lines.push(format!(
                        "New-NetFirewallRule -DisplayName \"FLM Proxy {}\" -Direction Inbound -Action Allow -Protocol TCP -LocalPort {}",
                        port, port
                    ));
                }
            } else {
                // Restrict to specific IPs
                for port in &ports {
                    for cidr in &ip_whitelist {
                        script_lines.push(format!(
                            "New-NetFirewallRule -DisplayName \"FLM Proxy {} {}\" -Direction Inbound -Action Allow -Protocol TCP -LocalPort {} -RemoteAddress {}",
                            port, cidr, port, cidr
                        ));
                    }
                }
            }
            
            (script_lines.join("\n"), "Windows / PowerShell".to_string(), "powershell".to_string())
        }
        "macos" => {
            let mut script_lines = Vec::new();
            script_lines.push("#!/bin/bash".to_string());
            script_lines.push("# macOS Firewall Rules (pfctl)".to_string());
            script_lines.push("# Run with sudo".to_string());
            script_lines.push("".to_string());
            
            script_lines.push("sudo tee /etc/pf.anchors/flm >/dev/null <<'EOF'".to_string());
            
            if ip_whitelist.is_empty() {
                script_lines.push(format!(
                    "pass in proto tcp to any port {{ {} }} keep state",
                    ports.iter().map(|p| p.to_string()).collect::<Vec<_>>().join(" ")
                ));
            } else {
                script_lines.push(format!(
                    "table <flm_allow> persist {{ {} }}",
                    ip_whitelist.join(", ")
                ));
                script_lines.push(format!(
                    "pass in proto tcp from <flm_allow> to any port {{ {} }} keep state",
                    ports.iter().map(|p| p.to_string()).collect::<Vec<_>>().join(" ")
                ));
            }
            
            script_lines.push("EOF".to_string());
            script_lines.push("sudo pfctl -f /etc/pf.conf && sudo pfctl -e".to_string());
            
            (script_lines.join("\n"), "macOS / pfctl".to_string(), "bash".to_string())
        }
        "linux" => {
            let mut script_lines = Vec::new();
            script_lines.push("#!/bin/bash".to_string());
            script_lines.push("# Linux Firewall Rules (ufw/firewalld)".to_string());
            script_lines.push("# Run with sudo".to_string());
            script_lines.push("".to_string());
            
            script_lines.push("# Detect firewall type".to_string());
            script_lines.push("if command -v ufw > /dev/null 2>&1; then".to_string());
            script_lines.push("  # UFW (Ubuntu/Debian)".to_string());
            
            if ip_whitelist.is_empty() {
                for port in &ports {
                    script_lines.push(format!("  sudo ufw allow {}/tcp comment 'FLM Proxy'", port));
                }
            } else {
                for cidr in &ip_whitelist {
                    for port in &ports {
                        script_lines.push(format!(
                            "  sudo ufw allow proto tcp from \"{}\" to any port {} comment 'FLM Proxy'",
                            cidr, port
                        ));
                    }
                }
            }
            
            script_lines.push("  sudo ufw reload".to_string());
            script_lines.push("elif command -v firewall-cmd > /dev/null 2>&1; then".to_string());
            script_lines.push("  # firewalld (CentOS/RHEL)".to_string());
            
            for cidr in &ip_whitelist {
                let family = if cidr.contains(':') { "ipv6" } else { "ipv4" };
                for port in &ports {
                    script_lines.push(format!(
                        "  sudo firewall-cmd --permanent --add-rich-rule=\"rule family='{}' source address='{}' port protocol='tcp' port='{}' accept\"",
                        family, cidr, port
                    ));
                }
            }
            
            script_lines.push("  sudo firewall-cmd --reload".to_string());
            script_lines.push("fi".to_string());
            
            (script_lines.join("\n"), "Linux / UFW/firewalld".to_string(), "bash".to_string())
        }
        _ => return Err(format!("Unsupported OS: {}", os)),
    };

    Ok(FirewallPreviewResponse {
        script,
        display_name,
        shell,
    })
}

/// Apply firewall script
#[tauri::command]
pub async fn system_firewall_apply(
    request: FirewallApplyRequest,
) -> Result<FirewallApplyResponse, String> {
    // Get app data directory for logging
    let app_data_dir = get_app_data_dir()?;
    let log_dir = app_data_dir.join("logs").join("security");
    
    // Create log directory if it doesn't exist
    fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;

    // Create log file
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let log_file = log_dir.join(format!("firewall-{}.log", timestamp));
    let mut log_writer = fs::File::create(&log_file)
        .map_err(|e| format!("Failed to create log file: {}", e))?;

    writeln!(log_writer, "=== Firewall Apply Log ===")
        .map_err(|e| format!("Failed to write log: {}", e))?;
    writeln!(log_writer, "Timestamp: {}", chrono::Utc::now().to_rfc3339())
        .map_err(|e| format!("Failed to write log: {}", e))?;
    writeln!(log_writer, "Shell: {}", request.shell)
        .map_err(|e| format!("Failed to write log: {}", e))?;
    writeln!(log_writer, "Script:\n{}", request.script)
        .map_err(|e| format!("Failed to write log: {}", e))?;

    let output = if request.shell == "powershell" {
        Command::new("powershell.exe")
            .args(&["-ExecutionPolicy", "Bypass", "-Command", &request.script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?
    } else {
        // bash/sh
        Command::new("sh")
            .arg("-c")
            .arg(&request.script)
            .output()
            .map_err(|e| format!("Failed to execute shell: {}", e))?
    };

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    writeln!(log_writer, "Exit Code: {}", exit_code)
        .map_err(|e| format!("Failed to write log: {}", e))?;
    writeln!(log_writer, "Stdout:\n{}", stdout)
        .map_err(|e| format!("Failed to write log: {}", e))?;
    if !stderr.is_empty() {
        writeln!(log_writer, "Stderr:\n{}", stderr)
            .map_err(|e| format!("Failed to write log: {}", e))?;
    }

    Ok(FirewallApplyResponse {
        stdout,
        stderr,
        exit_code,
    })
}

/// Rollback firewall script (remove FLM firewall rules)
#[tauri::command]
pub async fn system_firewall_rollback(
    os: String,
) -> Result<FirewallApplyResponse, String> {
    let rollback_script = match os.to_lowercase().as_str() {
        "windows" => {
            "Get-NetFirewallRule -DisplayName \"FLM Proxy*\" | Remove-NetFirewallRule".to_string()
        }
        "macos" => {
            "/sbin/pfctl -a flm -F all".to_string()
        }
        "linux" => {
            let mut script = String::new();
            script.push_str("if command -v ufw > /dev/null 2>&1; then\n");
            script.push_str("  sudo ufw status numbered | grep 'FLM Proxy' | awk -F'[][]' '{print $2}' | xargs -r -I{} sudo ufw delete {}\n");
            script.push_str("  sudo ufw reload\n");
            script.push_str("elif command -v firewall-cmd > /dev/null 2>&1; then\n");
            script.push_str("  sudo firewall-cmd --permanent --remove-rich-rule=\"rule family='ipv4' source address='0.0.0.0/0' port protocol='tcp' port='8080' accept\" || true\n");
            script.push_str("  sudo firewall-cmd --permanent --remove-rich-rule=\"rule family='ipv4' source address='0.0.0.0/0' port protocol='tcp' port='8081' accept\" || true\n");
            script.push_str("  sudo firewall-cmd --reload\n");
            script.push_str("fi\n");
            script
        }
        _ => return Err(format!("Unsupported OS: {}", os)),
    };

    let shell = if os.to_lowercase() == "windows" {
        "powershell".to_string()
    } else {
        "bash".to_string()
    };

    let request = FirewallApplyRequest {
        script: rollback_script,
        shell,
    };

    system_firewall_apply(request).await
}

/// Get firewall status
#[tauri::command]
pub async fn system_firewall_status(
    _os: String,
) -> Result<FirewallStatus, String> {
    // For now, return a simple status
    // In a full implementation, we would check for existing firewall rules
    Ok(FirewallStatus {
        applied: false,
        rules_count: None,
        last_applied: None,
    })
}

/// Get app data directory
fn get_app_data_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        use std::env;
        let local_app_data = env::var("LOCALAPPDATA")
            .map_err(|_| "LOCALAPPDATA environment variable not set")?;
        Ok(PathBuf::from(local_app_data).join("flm"))
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::env;
        let home = env::var("HOME")
            .map_err(|_| "HOME environment variable not set")?;
        Ok(PathBuf::from(home).join("Library").join("Application Support").join("flm"))
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::env;
        let home = env::var("HOME")
            .map_err(|_| "HOME environment variable not set")?;
        Ok(PathBuf::from(home).join(".local").join("share").join("flm"))
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported operating system".to_string())
    }
}
