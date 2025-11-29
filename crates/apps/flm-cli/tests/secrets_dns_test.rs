use flm_cli::adapters::SqliteSecurityRepository;
use flm_cli::cli::secrets::{DnsAddArgs, DnsRemoveArgs, DnsSubcommand, SecretsSubcommand};
use flm_cli::commands::secrets;
use flm_core::services::SecurityService;
use tempfile::tempdir;

fn temp_db_path() -> String {
    let dir = tempdir().expect("tempdir");
    dir.into_path()
        .join("security.db")
        .to_string_lossy()
        .to_string()
}

#[tokio::test]
async fn dns_credentials_add_list_remove() {
    std::env::set_var("FLM_DISABLE_KEYRING", "1");
    let db_path = temp_db_path();

    let add_args = DnsAddArgs {
        provider: "cloudflare".into(),
        label: "prod-zone".into(),
        zone_id: "cf_zone_123".into(),
        zone_name: Some("example.com".into()),
        token: Some("token123".into()),
        token_stdin: false,
    };

    secrets::execute(
        SecretsSubcommand::Dns {
            subcommand: DnsSubcommand::Add(add_args),
        },
        Some(db_path.clone()),
        "json".into(),
    )
    .await
    .expect("add command");

    secrets::execute(
        SecretsSubcommand::Dns {
            subcommand: DnsSubcommand::List,
        },
        Some(db_path.clone()),
        "json".into(),
    )
    .await
    .expect("list command");

    let repo = SqliteSecurityRepository::new(&db_path).await.unwrap();
    let service = SecurityService::new(repo);
    let creds = service.list_dns_credentials().await.unwrap();
    assert_eq!(creds.len(), 1);
    let profile = &creds[0];
    assert_eq!(profile.provider, "cloudflare");
    assert_eq!(profile.label, "prod-zone");

    secrets::execute(
        SecretsSubcommand::Dns {
            subcommand: DnsSubcommand::Remove(DnsRemoveArgs {
                id: profile.id.clone(),
            }),
        },
        Some(db_path.clone()),
        "json".into(),
    )
    .await
    .expect("remove command");

    let repo = SqliteSecurityRepository::new(&db_path).await.unwrap();
    let service = SecurityService::new(repo);
    assert!(service.list_dns_credentials().await.unwrap().is_empty());
}

#[tokio::test]
async fn dns_credentials_requires_token() {
    std::env::set_var("FLM_DISABLE_KEYRING", "1");
    let db_path = temp_db_path();

    let add_args = DnsAddArgs {
        provider: "cloudflare".into(),
        label: "missing-token".into(),
        zone_id: "cf_zone_x".into(),
        zone_name: None,
        token: None,
        token_stdin: false,
    };

    let result = secrets::execute(
        SecretsSubcommand::Dns {
            subcommand: DnsSubcommand::Add(add_args),
        },
        Some(db_path),
        "json".into(),
    )
    .await;

    assert!(result.is_err(), "expected error when token missing");
}
