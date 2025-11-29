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

    /// Image file path (can be specified multiple times)
    #[arg(long, num_args = 0..)]
    pub image: Vec<String>,

    /// Image URL (can be specified multiple times)
    #[arg(long, num_args = 0..)]
    pub image_url: Vec<String>,

    /// Audio file path
    #[arg(long)]
    pub audio: Option<String>,
}
