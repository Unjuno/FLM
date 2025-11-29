//! Migration CLI definitions

use clap::{Args, Subcommand};

#[derive(Subcommand, Clone)]
pub enum MigrateSubcommand {
    /// Migrate data from legacy prototype
    Legacy {
        #[command(subcommand)]
        action: LegacyAction,
    },
}

#[derive(Subcommand, Clone)]
pub enum LegacyAction {
    /// Analyze legacy data and emit a plan report
    Plan(LegacyPlanArgs),
    /// Convert legacy data into migration artifacts
    Convert(LegacyConvertArgs),
    /// Convert and apply changes to live databases
    Apply(LegacyApplyArgs),
}

#[derive(Args, Clone)]
pub struct LegacyPlanArgs {
    /// Source directory containing legacy data
    #[arg(long)]
    pub source: String,
    /// Temporary directory for conversion output
    #[arg(long)]
    pub tmp: Option<String>,
}

#[derive(Args, Clone)]
pub struct LegacyConvertArgs {
    /// Source directory containing legacy data
    #[arg(long)]
    pub source: String,
    /// Temporary directory for conversion output
    #[arg(long)]
    pub tmp: Option<String>,
}

#[derive(Args, Clone)]
pub struct LegacyApplyArgs {
    /// Source directory containing legacy data
    #[arg(long)]
    pub source: String,
    /// Temporary directory for conversion output
    #[arg(long)]
    pub tmp: Option<String>,
    /// Confirm applying migration changes
    #[arg(long)]
    pub confirm: bool,
}
