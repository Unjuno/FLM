//! Chat command definition

use clap::Parser;

/// Chat command
#[derive(Parser, Clone)]
pub struct Chat {
    /// Model ID in format flm://{engine_id}/{model_name}
    #[arg(long)]
    pub model: String,

    /// Prompt text
    #[arg(long)]
    pub prompt: String,

    /// Stream the response
    #[arg(long)]
    pub stream: bool,

    /// Temperature (0.0-2.0)
    #[arg(long)]
    pub temperature: Option<f32>,

    /// Maximum tokens
    #[arg(long)]
    pub max_tokens: Option<u32>,
}

