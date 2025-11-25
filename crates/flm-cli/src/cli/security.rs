//! Security command definition

use clap::Subcommand;

#[derive(Subcommand, Clone)]
pub enum SecuritySubcommand {
    /// Security policy management
    Policy {
        #[command(subcommand)]
        subcommand: PolicySubcommand,
    },
    /// Security database backup management
    Backup {
        #[command(subcommand)]
        subcommand: BackupSubcommand,
    },
    /// IP blocklist management
    #[command(name = "ip-blocklist")]
    IpBlocklist {
        #[command(subcommand)]
        subcommand: IpBlocklistSubcommand,
    },
    /// Audit logs viewing
    #[command(name = "audit-logs")]
    AuditLogs {
        /// Filter by event type
        #[arg(long)]
        event_type: Option<String>,
        /// Filter by severity
        #[arg(long)]
        severity: Option<String>,
        /// Filter by IP address
        #[arg(long)]
        ip: Option<String>,
        /// Maximum number of logs to return
        #[arg(long, default_value = "100")]
        limit: u32,
        /// Number of logs to skip
        #[arg(long, default_value = "0")]
        offset: u32,
    },
    /// Intrusion detection events viewing
    Intrusion {
        /// Filter by IP address
        #[arg(long)]
        ip: Option<String>,
        /// Minimum score filter
        #[arg(long)]
        min_score: Option<u32>,
        /// Maximum number of events to return
        #[arg(long, default_value = "100")]
        limit: u32,
        /// Number of events to skip
        #[arg(long, default_value = "0")]
        offset: u32,
    },
    /// Anomaly detection events viewing
    Anomaly {
        /// Filter by IP address
        #[arg(long)]
        ip: Option<String>,
        /// Filter by anomaly type
        #[arg(long)]
        anomaly_type: Option<String>,
        /// Maximum number of events to return
        #[arg(long, default_value = "100")]
        limit: u32,
        /// Number of events to skip
        #[arg(long, default_value = "0")]
        offset: u32,
    },
}

#[derive(Subcommand, Clone)]
pub enum IpBlocklistSubcommand {
    /// List all blocked IPs
    List,
    /// Unblock a specific IP address
    Unblock {
        /// IP address to unblock
        ip: String,
    },
    /// Clear all temporary blocks (keep permanent blocks)
    Clear,
}

#[derive(Subcommand, Clone)]
pub enum PolicySubcommand {
    /// Show the current security policy
    Show,
    /// Set/update the security policy
    Set {
        /// Policy JSON as string
        #[arg(long)]
        json: Option<String>,
        /// Path to policy JSON file
        #[arg(long)]
        file: Option<String>,
    },
}

#[derive(Subcommand, Clone)]
pub enum BackupSubcommand {
    /// Create an encrypted backup of security.db
    Create {
        /// Output directory (default: OS config directory/flm/backups/)
        #[arg(long)]
        output: Option<String>,
    },
    /// Restore security.db from a backup
    Restore {
        /// Path to backup file
        #[arg(long)]
        file: String,
    },
}
