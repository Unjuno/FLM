use keyring::Entry;

pub const DNS_KEYRING_SERVICE: &str = "flm.dns.credentials";

pub fn keyring_disabled() -> bool {
    matches!(
        std::env::var("FLM_DISABLE_KEYRING")
            .ok()
            .map(|v| v.to_ascii_lowercase()),
        Some(ref value) if value == "1" || value == "true" || value == "yes"
    )
}

pub fn store_dns_token(profile_id: &str, token: &str) -> Result<(), keyring::Error> {
    if keyring_disabled() {
        return Ok(());
    }
    keyring_entry(profile_id)?.set_password(token)
}

pub fn load_dns_token(profile_id: &str) -> Result<String, keyring::Error> {
    if keyring_disabled() {
        return Err(keyring::Error::NoEntry);
    }
    keyring_entry(profile_id)?.get_password()
}

pub fn delete_dns_token(profile_id: &str) -> Result<(), keyring::Error> {
    if keyring_disabled() {
        return Ok(());
    }
    keyring_entry(profile_id)?.delete_password()
}

fn keyring_entry(profile_id: &str) -> Result<Entry, keyring::Error> {
    Entry::new(DNS_KEYRING_SERVICE, profile_id)
}
