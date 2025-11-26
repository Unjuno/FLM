// SPDX-License-Identifier: MIT OR Apache-2.0
//! Version alignment checker for FLM Core API and CLI/Proxy crates
//!
//! This script reads version information from:
//! - `docs/specs/CORE_API.md` (Core API version from Changelog)
//! - `Cargo.toml` files (CLI/Proxy crate versions)
//! - Git tags (core-api-v* tags)
//!
//! It outputs a report showing version alignment status according to
//! `docs/guides/VERSIONING_POLICY.md`.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process;

fn main() {
    let root_dir = find_root_dir().unwrap_or_else(|e| {
        eprintln!("error: failed to find project root: {e}");
        process::exit(1);
    });

    let core_api_version = extract_core_api_version(&root_dir)
        .unwrap_or_else(|e| {
            eprintln!("warning: failed to extract Core API version: {e}");
            "unknown".to_string()
        });

    let crate_versions = extract_crate_versions(&root_dir)
        .unwrap_or_else(|e| {
            eprintln!("warning: failed to extract crate versions: {e}");
            HashMap::new()
        });

    let git_tags = extract_git_tags(&root_dir)
        .unwrap_or_else(|e| {
            eprintln!("warning: failed to extract git tags: {e}");
            Vec::new()
        });

    print_report(&core_api_version, &crate_versions, &git_tags);
}

fn find_root_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let mut current = std::env::current_dir()?;
    loop {
        if current.join("Cargo.toml").exists() && current.join("docs").exists() {
            return Ok(current);
        }
        if !current.pop() {
            return Err("project root not found".into());
        }
    }
}

fn extract_core_api_version(root: &Path) -> Result<String, Box<dyn std::error::Error>> {
    let spec_path = root.join("docs/specs/CORE_API.md");
    let content = fs::read_to_string(&spec_path)?;

    // Look for "## Changelog" section and extract the latest version
    let mut in_changelog = false;
    let mut latest_version = None;

    for line in content.lines() {
        if line.trim() == "## Changelog" {
            in_changelog = true;
            continue;
        }

        if in_changelog {
            // Look for version entries like "### [1.0.0] - 2025-01-27" or "| `1.0.0` | 2025-01-27 |"
            // Try to find version in format like "### [1.0.0]" or "| `1.0.0` |"
            if line.contains('[') && line.contains(']') {
                if let Some(start) = line.find('[') {
                    if let Some(end) = line[start + 1..].find(']') {
                        let version_str = &line[start + 1..start + 1 + end];
                        if is_valid_version(version_str) {
                            latest_version = Some(version_str.to_string());
                            break;
                        }
                    }
                }
            } else if line.contains('`') {
                // Look for | `1.0.0` | format
                let parts: Vec<&str> = line.split('`').collect();
                if parts.len() >= 2 {
                    let version_str = parts[1].trim();
                    if is_valid_version(version_str) {
                        if latest_version.is_none() {
                            latest_version = Some(version_str.to_string());
                        }
                    }
                }
            }
        }
    }

    latest_version.ok_or_else(|| "Core API version not found in Changelog".into())
}

fn extract_crate_versions(
    root: &Path,
) -> Result<HashMap<String, String>, Box<dyn std::error::Error>> {
    let mut versions = HashMap::new();

    // Read workspace Cargo.toml
    let workspace_toml = root.join("Cargo.toml");
    let workspace_content = fs::read_to_string(&workspace_toml)?;
    let workspace_version = extract_version_from_toml(&workspace_content)?;

    // Check each crate
    for crate_name in &["flm-core", "flm-cli", "flm-proxy"] {
        let crate_toml = root.join(format!("crates/{crate_name}/Cargo.toml"));
        if crate_toml.exists() {
            let content = fs::read_to_string(&crate_toml)?;
            let version = if content.contains("version.workspace = true") {
                workspace_version.clone()
            } else {
                extract_version_from_toml(&content)?
            };
            versions.insert(crate_name.to_string(), version);
        }
    }

    Ok(versions)
}

fn extract_version_from_toml(content: &str) -> Result<String, Box<dyn std::error::Error>> {
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("version") && line.contains('"') {
            if let Some(start) = line.find('"') {
                if let Some(end) = line[start + 1..].find('"') {
                    let version = &line[start + 1..start + 1 + end];
                    if is_valid_version(version) {
                        return Ok(version.to_string());
                    }
                }
            }
        }
    }
    Err("version not found in Cargo.toml".into())
}

fn is_valid_version(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 3 {
        return false;
    }
    parts.iter().all(|p| p.parse::<u32>().is_ok())
}

fn extract_git_tags(root: &Path) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let output = process::Command::new("git")
        .args(&["tag", "--list", "core-api-v*"])
        .current_dir(root)
        .output()?;

    if !output.status.success() {
        return Err("git tag command failed".into());
    }

    let tags = String::from_utf8(output.stdout)?;
    Ok(tags
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect())
}

fn print_report(
    core_api_version: &str,
    crate_versions: &HashMap<String, String>,
    git_tags: &[String],
) {
    println!("FLM Version Alignment Report");
    println!("============================\n");

    println!("Core API Version (from docs/specs/CORE_API.md):");
    println!("  {core_api_version}\n");

    println!("Crate Versions:");
    for (name, version) in crate_versions.iter() {
        println!("  {name}: {version}");
    }
    println!();

    println!("Git Tags (core-api-v*):");
    if git_tags.is_empty() {
        println!("  (none)");
    } else {
        for tag in git_tags {
            println!("  {tag}");
        }
    }
    println!();

    // Check alignment
    println!("Alignment Status:");
    let mut all_aligned = true;

    if let Some(cli_version) = crate_versions.get("flm-cli") {
        if !is_version_aligned(core_api_version, cli_version) {
            println!("  ⚠️  flm-cli version ({cli_version}) is not aligned with Core API ({core_api_version})");
            all_aligned = false;
        } else {
            println!("  ✅ flm-cli version ({cli_version}) is aligned with Core API ({core_api_version})");
        }
    }

    if let Some(proxy_version) = crate_versions.get("flm-proxy") {
        if !is_version_aligned(core_api_version, proxy_version) {
            println!("  ⚠️  flm-proxy version ({proxy_version}) is not aligned with Core API ({core_api_version})");
            all_aligned = false;
        } else {
            println!("  ✅ flm-proxy version ({proxy_version}) is aligned with Core API ({core_api_version})");
        }
    }

    let expected_tag = format!("core-api-v{core_api_version}");
    if !git_tags.contains(&expected_tag) {
        println!("  ⚠️  Git tag {expected_tag} not found");
        all_aligned = false;
    } else {
        println!("  ✅ Git tag {expected_tag} exists");
    }

    println!();

    if all_aligned {
        println!("✅ All versions are aligned.");
        process::exit(0);
    } else {
        println!("⚠️  Version misalignment detected. See VERSIONING_POLICY.md for alignment rules.");
        process::exit(1);
    }
}

fn is_version_aligned(core_api: &str, crate_version: &str) -> bool {
    // According to VERSIONING_POLICY.md:
    // - Core API 1.0.0 → CLI/Proxy 0.1.0 (0.x during Phase 0)
    // - Core API 1.1.0 → CLI/Proxy 0.2.0 → 1.1.0 (transition period)
    // - Core API 1.x → CLI/Proxy 1.x (after stabilization)

    let core_parts: Vec<&str> = core_api.split('.').collect();
    let crate_parts: Vec<&str> = crate_version.split('.').collect();

    if core_parts.len() != 3 || crate_parts.len() != 3 {
        return false;
    }

    let core_major: u32 = core_parts[0].parse().unwrap_or(0);
    let core_minor: u32 = core_parts[1].parse().unwrap_or(0);
    let crate_major: u32 = crate_parts[0].parse().unwrap_or(0);
    let crate_minor: u32 = crate_parts[1].parse().unwrap_or(0);

    // Core API 1.0.0 → CLI/Proxy 0.1.0 is acceptable (Phase 0)
    if core_major == 1 && core_minor == 0 && crate_major == 0 {
        return true;
    }

    // Core API 1.1.0+ → CLI/Proxy 0.2.0+ or 1.x is acceptable (transition)
    if core_major == 1 && core_minor >= 1 {
        if crate_major == 0 && crate_minor >= 2 {
            return true;
        }
        if crate_major == 1 {
            return true;
        }
    }

    // Core API 1.x → CLI/Proxy 1.x (after stabilization)
    if core_major == 1 && crate_major == 1 {
        return true;
    }

    false
}
