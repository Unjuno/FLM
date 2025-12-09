//! Engines command definitions

use clap::Subcommand;

#[derive(Subcommand, Clone)]
pub enum EnginesSubcommand {
    /// Detect available engines
    Detect {
        /// Specific engine to detect (optional, detects all if not specified)
        #[arg(long)]
        engine: Option<String>,
        /// Ignore cache and force fresh detection
        #[arg(long)]
        fresh: bool,
    },
    /// Get engine health history
    HealthHistory {
        /// Engine ID to filter by (optional)
        #[arg(long)]
        engine: Option<String>,
        /// Model ID to filter by (optional)
        #[arg(long)]
        model: Option<String>,
        /// Number of hours to look back (default: 24)
        #[arg(long, default_value = "24")]
        hours: u32,
        /// Maximum number of records to return (default: 100)
        #[arg(long, default_value = "100")]
        limit: u32,
    },
}
