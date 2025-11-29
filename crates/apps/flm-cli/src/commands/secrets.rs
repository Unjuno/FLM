//! Secrets command implementation (DNS credential profiles)

use crate::adapters::SqliteSecurityRepository;
use crate::cli::secrets::{DnsAddArgs, DnsRemoveArgs, DnsSubcommand, SecretsSubcommand};
use crate::commands::error::CliUserError;
use crate::utils::get_security_db_path;
use crate::utils::secrets::{
    delete_dns_token, keyring_disabled, store_dns_token, DNS_KEYRING_SERVICE,
};
use flm_core::services::SecurityService;
use serde_json::json;
use std::io::{self, Read};
use std::path::PathBuf;

pub async fn execute(
    subcommand: SecretsSubcommand,
    db_path_security: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        SecretsSubcommand::Dns { subcommand } => {
            execute_dns(subcommand, db_path_security, format).await
        }
    }
}

async fn execute_dns(
    subcommand: DnsSubcommand,
    db_path_security: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path_security
        .map(PathBuf::from)
        .unwrap_or_else(get_security_db_path);
    let repo = SqliteSecurityRepository::new(&db_path).await?;
    let service = SecurityService::new(repo);

    match subcommand {
        DnsSubcommand::Add(args) => execute_dns_add(args, &service, format).await,
        DnsSubcommand::List => execute_dns_list(&service, format).await,
        DnsSubcommand::Remove(args) => execute_dns_remove(args, &service, format).await,
    }
}

async fn execute_dns_add(
    args: DnsAddArgs,
    service: &SecurityService<SqliteSecurityRepository>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let token = resolve_token(&args)?;
    let profile = service
        .create_dns_credential(
            &args.provider,
            &args.label,
            &args.zone_id,
            args.zone_name.clone(),
        )
        .await?;

    store_dns_token(&profile.id, &token).map_err(|e| CliUserError::new(e.to_string()))?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "credential": {
                    "id": profile.id,
                    "provider": profile.provider,
                    "label": profile.label,
                    "zone_id": profile.zone_id,
                    "zone_name": profile.zone_name,
                    "created_at": profile.created_at,
                    "updated_at": profile.updated_at
                }
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("DNS credential stored:");
        println!("  ID       : {}", profile.id);
        println!("  Provider : {}", profile.provider);
        println!("  Label    : {}", profile.label);
        println!("  Zone ID  : {}", profile.zone_id);
        if let Some(zone_name) = &profile.zone_name {
            println!("  Zone Name: {zone_name}");
        }
        if keyring_disabled() {
            println!("Secret storage skipped (FLM_DISABLE_KEYRING set).");
        } else {
            println!("Secret saved to OS keyring ({DNS_KEYRING_SERVICE}).");
        }
    }

    Ok(())
}

async fn execute_dns_list(
    service: &SecurityService<SqliteSecurityRepository>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let credentials = service.list_dns_credentials().await?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "credentials": credentials
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else if credentials.is_empty() {
        println!("No DNS credentials stored");
    } else {
        println!("DNS credentials:");
        for cred in credentials {
            println!("  {} - {} ({})", cred.id, cred.label, cred.provider);
        }
    }

    Ok(())
}

async fn execute_dns_remove(
    args: DnsRemoveArgs,
    service: &SecurityService<SqliteSecurityRepository>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    service.delete_dns_credential(&args.id).await?;

    if !keyring_disabled() {
        if let Err(err) = delete_dns_token(&args.id) {
            eprintln!("Warning: DNS credential removed from DB but keyring cleanup failed: {err}");
        }
    }

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "id": args.id,
                "deleted": true
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("DNS credential '{}' removed", args.id);
    }

    Ok(())
}

fn resolve_token(args: &DnsAddArgs) -> Result<String, CliUserError> {
    match (args.token.as_ref().map(|s| s.to_string()), args.token_stdin) {
        (Some(token), false) => Ok(token.trim().to_string()),
        (None, true) => {
            let mut buffer = String::new();
            io::stdin()
                .read_to_string(&mut buffer)
                .map_err(|e| CliUserError::new(format!("Failed to read token from stdin: {e}")))?;
            let token = buffer.trim().to_string();
            if token.is_empty() {
                Err(CliUserError::new("Token read from stdin is empty"))
            } else {
                Ok(token)
            }
        }
        (Some(_), true) => Err(CliUserError::new(
            "Provide token via --token or --token-stdin (not both)",
        )),
        (None, false) => Err(CliUserError::new(
            "DNS credential requires --token or --token-stdin",
        )),
    }
}
