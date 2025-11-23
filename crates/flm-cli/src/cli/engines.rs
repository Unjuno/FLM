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
}
