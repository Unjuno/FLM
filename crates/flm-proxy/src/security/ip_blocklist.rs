//! IP blocklist management
//!
//! This module provides IP blocking functionality to prevent brute-force attacks.
//! See `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md` section 2.1

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::warn;

/// Blocklist entry for an IP address
#[derive(Clone, Debug)]
pub struct BlocklistEntry {
    failure_count: u32,
    first_failure_time: Instant,
    blocked_until: Option<Instant>,
    permanent_block: bool,
    last_attempt: Instant,
}

/// IP blocklist manager
///
/// Manages IP addresses that should be blocked due to authentication failures.
/// Uses in-memory cache for fast lookups, with periodic database synchronization.
pub struct IpBlocklist {
    /// In-memory cache: IP -> BlocklistEntry
    blocked_ips: Arc<RwLock<HashMap<IpAddr, BlocklistEntry>>>,
    /// Last database sync time
    last_sync: Arc<RwLock<Instant>>,
    /// Sync interval (5 minutes)
    sync_interval: Duration,
}

impl IpBlocklist {
    /// Create a new IP blocklist
    pub fn new() -> Self {
        Self {
            blocked_ips: Arc::new(RwLock::new(HashMap::new())),
            last_sync: Arc::new(RwLock::new(Instant::now())),
            sync_interval: Duration::from_secs(300), // 5 minutes
        }
    }

    /// Check if an IP address is currently blocked
    ///
    /// Returns `true` if the IP is blocked, `false` otherwise.
    /// Automatically removes expired temporary blocks.
    pub async fn is_blocked(&self, ip: &IpAddr) -> bool {
        let mut blocked_ips = self.blocked_ips.write().await;
        
        if let Some(entry) = blocked_ips.get(ip) {
            // Check if temporary block has expired
            if let Some(blocked_until) = entry.blocked_until {
                if Instant::now() > blocked_until {
                    // Temporary block expired, remove it (unless permanent)
                    if !entry.permanent_block {
                        blocked_ips.remove(ip);
                        return false;
                    }
                } else {
                    // Still blocked
                    return true;
                }
            }
            
            // Permanent block
            if entry.permanent_block {
                return true;
            }
        }
        
        false
    }

    /// Record an authentication failure for an IP address
    ///
    /// Updates the failure count and applies blocking rules:
    /// - 1-4 failures: Warning only
    /// - 5 failures: 30-minute block
    /// - 10 failures: 24-hour block
    /// - 20 failures: Permanent block
    pub async fn record_failure(&self, ip: IpAddr) -> bool {
        let mut blocked_ips = self.blocked_ips.write().await;
        let now = Instant::now();
        
        let entry = blocked_ips.entry(ip).or_insert_with(|| BlocklistEntry {
            failure_count: 0,
            first_failure_time: now,
            blocked_until: None,
            permanent_block: false,
            last_attempt: now,
        });
        
        entry.failure_count += 1;
        entry.last_attempt = now;
        
        // Apply blocking rules
        let should_block = if entry.failure_count >= 20 {
            // Permanent block
            entry.permanent_block = true;
            entry.blocked_until = None;
            warn!(
                ip = %ip,
                failure_count = entry.failure_count,
                "IP address permanently blocked due to excessive authentication failures"
            );
            true
        } else if entry.failure_count >= 10 {
            // 24-hour block
            entry.blocked_until = Some(now + Duration::from_secs(86400)); // 24 hours
            warn!(
                ip = %ip,
                failure_count = entry.failure_count,
                "IP address blocked for 24 hours due to authentication failures"
            );
            true
        } else if entry.failure_count >= 5 {
            // 30-minute block
            entry.blocked_until = Some(now + Duration::from_secs(1800)); // 30 minutes
            warn!(
                ip = %ip,
                failure_count = entry.failure_count,
                "IP address blocked for 30 minutes due to authentication failures"
            );
            true
        } else {
            // Warning only (1-4 failures)
            warn!(
                ip = %ip,
                failure_count = entry.failure_count,
                "Authentication failure recorded (warning only)"
            );
            false
        };
        
        should_block
    }

    /// Unblock an IP address
    ///
    /// Removes the IP from the blocklist. For permanent blocks, this requires
    /// explicit unblocking.
    pub async fn unblock(&self, ip: &IpAddr) {
        let mut blocked_ips = self.blocked_ips.write().await;
        blocked_ips.remove(ip);
    }

    /// Clear all temporary blocks (keeps permanent blocks)
    pub async fn clear_temporary_blocks(&self) {
        let mut blocked_ips = self.blocked_ips.write().await;
        blocked_ips.retain(|_, entry| entry.permanent_block);
    }

    /// Get all blocked IPs
    pub async fn get_blocked_ips(&self) -> Vec<(IpAddr, BlocklistEntry)> {
        let blocked_ips = self.blocked_ips.read().await;
        blocked_ips
            .iter()
            .map(|(ip, entry)| (*ip, entry.clone()))
            .collect()
    }

    /// Check if database sync is needed
    pub async fn needs_sync(&self) -> bool {
        let last_sync = self.last_sync.read().await;
        Instant::now().duration_since(*last_sync) >= self.sync_interval
    }

    /// Mark database sync as completed
    pub async fn mark_synced(&self) {
        let mut last_sync = self.last_sync.write().await;
        *last_sync = Instant::now();
    }

    /// Load blocked IPs from database
    ///
    /// This should be called on startup to load existing blocks.
    /// Converts database timestamps to Instant.
    pub async fn load_from_db(
        &self,
        entries: Vec<(IpAddr, u32, String, Option<String>, bool, String)>,
    ) {
        use chrono::DateTime;
        
        let mut blocked_ips = self.blocked_ips.write().await;
        let now = Instant::now();
        
        for (ip, failure_count, first_failure_at_str, blocked_until_str, permanent_block, last_attempt_str) in entries {
            // Parse timestamps
            let first_failure_time = DateTime::parse_from_rfc3339(&first_failure_at_str)
                .ok()
                .and_then(|dt| {
                    dt.signed_duration_since(chrono::Utc::now())
                        .to_std()
                        .ok()
                        .map(|d| now - d)
                })
                .unwrap_or(now);
            
            let blocked_until = blocked_until_str
                .and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .and_then(|dt| {
                            dt.signed_duration_since(chrono::Utc::now())
                                .to_std()
                                .ok()
                                .map(|d| now + d)
                        })
                });
            
            let last_attempt = DateTime::parse_from_rfc3339(&last_attempt_str)
                .ok()
                .and_then(|dt| {
                    dt.signed_duration_since(chrono::Utc::now())
                        .to_std()
                        .ok()
                        .map(|d| now - d)
                })
                .unwrap_or(now);
            
            blocked_ips.insert(ip, BlocklistEntry {
                failure_count,
                first_failure_time,
                blocked_until,
                permanent_block,
                last_attempt,
            });
        }
    }

    /// Sync to database
    ///
    /// Saves all current blocklist entries to the database.
    pub async fn sync_to_db(&self, repo: &crate::adapters::SqliteSecurityRepository) -> Result<(), flm_core::error::RepoError> {
        let blocked_ips = self.blocked_ips.read().await;
        let now = Instant::now();
        
        for (ip, entry) in blocked_ips.iter() {
            // Convert Instant to RFC3339 timestamps
            let first_failure_at = chrono::Utc::now()
                .checked_sub_signed(chrono::Duration::from_std(now.duration_since(entry.first_failure_time)).unwrap_or_default())
                .unwrap_or_else(chrono::Utc::now)
                .to_rfc3339();
            
            let blocked_until = entry.blocked_until.map(|until| {
                chrono::Utc::now()
                    .checked_add_signed(chrono::Duration::from_std(until.duration_since(now)).unwrap_or_default())
                    .unwrap_or_else(chrono::Utc::now)
                    .to_rfc3339()
            });
            
            let last_attempt = chrono::Utc::now()
                .checked_sub_signed(chrono::Duration::from_std(now.duration_since(entry.last_attempt)).unwrap_or_default())
                .unwrap_or_else(chrono::Utc::now)
                .to_rfc3339();
            
            repo.add_ip_failure(
                ip,
                entry.failure_count,
                &first_failure_at,
                blocked_until.as_deref(),
                entry.permanent_block,
                &last_attempt,
            ).await?;
        }
        
        Ok(())
    }
}

impl Default for IpBlocklist {
    fn default() -> Self {
        Self::new()
    }
}

