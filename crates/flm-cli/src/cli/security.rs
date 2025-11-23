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

