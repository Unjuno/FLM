//! Model profiles CLI definitions

use clap::{Args, Subcommand};

#[derive(Subcommand, Clone)]
pub enum ModelProfilesSubcommand {
    /// List model profiles (optionally filter by engine/model)
    List {
        /// Filter by engine ID (e.g. ollama)
        #[arg(long)]
        engine: Option<String>,
        /// Filter by model ID (e.g. flm://ollama/llama3)
        #[arg(long)]
        model: Option<String>,
    },
    /// Save (create/update) a profile
    Save(ModelProfileSaveArgs),
    /// Delete a profile by ID
    Delete {
        /// Profile ID
        #[arg(long)]
        id: String,
    },
}

#[derive(Args, Clone)]
pub struct ModelProfileSaveArgs {
    /// Engine ID (ollama, vllm, etc.)
    #[arg(long)]
    pub engine: String,
    /// Model ID (flm://engine/model or raw engine-specific ID)
    #[arg(long)]
    pub model: String,
    /// Label used to identify the profile in UI
    #[arg(long)]
    pub label: String,
    /// Path to JSON file describing parameters
    #[arg(long)]
    pub params: String,
}
