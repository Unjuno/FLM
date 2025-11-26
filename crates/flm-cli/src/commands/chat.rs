//! Chat command implementation

use crate::adapters::{DefaultEngineProcessController, ReqwestHttpClient, SqliteEngineRepository};
use crate::cli::chat::Chat;
use crate::utils::get_config_db_path;
use flm_core::domain::chat::{ChatMessage, ChatRequest, ChatRole};
use flm_core::ports::{EngineRepository, LlmEngine};
use flm_core::services::EngineService;
use futures::StreamExt;
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

/// Wrapper to convert Arc<SqliteEngineRepository> to Box<dyn EngineRepository + Send + Sync>
struct ArcEngineRepositoryWrapper(Arc<SqliteEngineRepository>);

#[async_trait::async_trait]
impl EngineRepository for ArcEngineRepositoryWrapper {
    async fn list_registered(&self) -> Vec<Arc<dyn LlmEngine>> {
        self.0.list_registered().await
    }

    async fn register(&self, engine: Arc<dyn LlmEngine>) {
        self.0.register(engine).await;
    }
}

/// Parse model ID from flm:// format
fn parse_model_id(model_id: &str) -> Result<(String, String), Box<dyn std::error::Error>> {
    if !model_id.starts_with("flm://") {
        return Err(format!("Model ID must start with 'flm://', got: {}", model_id).into());
    }

    let without_prefix = model_id.strip_prefix("flm://").unwrap();
    let parts: Vec<&str> = without_prefix.splitn(2, '/').collect();

    if parts.len() != 2 {
        return Err(format!(
            "Model ID must be in format 'flm://{{engine_id}}/{{model_name}}', got: {}",
            model_id
        )
        .into());
    }

    Ok((parts[0].to_string(), parts[1].to_string()))
}

/// Execute chat command
pub async fn execute(
    chat: Chat,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(get_config_db_path);

    // Parse model ID
    let (engine_id, model_name) = parse_model_id(&chat.model)?;
    let model_id = format!("flm://{}/{}", engine_id, model_name);

    // Initialize adapters
    let process_controller = Box::new(DefaultEngineProcessController::new());
    let http_client = Box::new(ReqwestHttpClient::new()?);
    let engine_repo_arc = SqliteEngineRepository::new(&db_path).await?;
    let engine_repo: Box<dyn EngineRepository + Send + Sync> =
        Box::new(ArcEngineRepositoryWrapper(engine_repo_arc));

    // Create service
    let service = EngineService::new(process_controller, http_client, engine_repo);

    // First, detect engines to register them
    service.detect_engines().await?;

    // Create chat request
    let request = ChatRequest {
        engine_id: engine_id.clone(),
        model_id: model_id.clone(),
        messages: vec![ChatMessage {
            role: ChatRole::User,
            content: chat.prompt.clone(),
        }],
        stream: chat.stream,
        temperature: chat.temperature,
        max_tokens: chat.max_tokens,
        stop: Vec::new(),
    };

    if chat.stream {
        execute_chat_stream(service, request, format).await
    } else {
        execute_chat(service, request, format).await
    }
}

/// Execute non-streaming chat
async fn execute_chat(
    service: EngineService,
    request: ChatRequest,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let response = service.chat(request).await?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "messages": response.messages,
                "usage": response.usage
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        // Print assistant messages
        for message in &response.messages {
            if message.role == ChatRole::Assistant {
                println!("{}", message.content);
            }
        }
        if format != "text" {
            println!(
                "\nUsage: {} prompt + {} completion = {} total tokens",
                response.usage.prompt_tokens,
                response.usage.completion_tokens,
                response.usage.total_tokens
            );
        }
    }

    Ok(())
}

/// Execute streaming chat
async fn execute_chat_stream(
    service: EngineService,
    request: ChatRequest,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut stream = service.chat_stream(request).await?;

    if format == "json" {
        // For JSON format, collect all chunks and output at the end
        let mut chunks = Vec::new();
        let mut full_content = String::new();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            chunks.push(chunk.clone());

            full_content.push_str(&chunk.delta.content);

            if chunk.is_done {
                break;
            }
        }

        let output = json!({
            "version": "1.0",
            "data": {
                "content": full_content,
                "chunks": chunks,
                "usage": chunks.last().and_then(|c| c.usage.clone())
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        // For text format, print chunks as they arrive
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;

            print!("{}", chunk.delta.content);
            use std::io::Write;
            std::io::stdout().flush()?;

            if chunk.is_done {
                if let Some(usage) = chunk.usage {
                    println!(
                        "\n\nUsage: {} prompt + {} completion = {} total tokens",
                        usage.prompt_tokens, usage.completion_tokens, usage.total_tokens
                    );
                }
                break;
            }
        }
        println!();
    }

    Ok(())
}
