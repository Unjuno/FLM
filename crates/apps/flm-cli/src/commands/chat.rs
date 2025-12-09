//! Chat command implementation

use crate::adapters::{DefaultEngineProcessController, ReqwestHttpClient, SqliteEngineRepository};
use crate::cli::chat::Chat;
use crate::utils::get_config_db_path;
use flm_core::domain::chat::{
    ChatMessage, ChatRequest, ChatRole, MultimodalAttachment, MultimodalAttachmentKind,
};
use flm_core::ports::{EngineRepository, LlmEngine};
use flm_core::services::EngineService;
use futures::StreamExt;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
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
        return Err(format!("Model ID must start with 'flm://', got: {model_id}").into());
    }

    // why: starts_withでチェック済みなので、strip_prefixは常にSomeを返す
    // alt: unwrap()を使用（理論上は安全だが、expect()の方が明確）
    // evidence: starts_with("flm://")がtrueの場合、strip_prefix("flm://")は常にSomeを返す
    let without_prefix = model_id.strip_prefix("flm://").expect("prefix check failed");
    let parts: Vec<&str> = without_prefix.splitn(2, '/').collect();

    if parts.len() != 2 {
        return Err(format!(
            "Model ID must be in format 'flm://{{engine_id}}/{{model_name}}', got: {model_id}"
        )
        .into());
    }

    Ok((parts[0].to_string(), parts[1].to_string()))
}

/// Load image file and create MultimodalAttachment
fn load_image_file(path: &str) -> Result<MultimodalAttachment, Box<dyn std::error::Error>> {
    let path = Path::new(path);
    if !path.exists() {
        return Err(format!("Image file not found: {}", path.display()).into());
    }

    let data = fs::read(path)?;
    let size_bytes = data.len() as u64;
    let mime_type = detect_image_mime_type(path)?;

    Ok(MultimodalAttachment {
        kind: MultimodalAttachmentKind::InputImage,
        data,
        mime_type,
        filename: path
            .file_name()
            .and_then(|n| n.to_str().map(|s| s.to_string())),
        size_bytes: Some(size_bytes),
        detail: None,
        duration_ms: None,
    })
}

/// Load audio file and create MultimodalAttachment
fn load_audio_file(path: &str) -> Result<MultimodalAttachment, Box<dyn std::error::Error>> {
    let path = Path::new(path);
    if !path.exists() {
        return Err(format!("Audio file not found: {}", path.display()).into());
    }

    let data = fs::read(path)?;
    let size_bytes = data.len() as u64;
    let mime_type = detect_audio_mime_type(path)?;

    Ok(MultimodalAttachment {
        kind: MultimodalAttachmentKind::InputAudio,
        data,
        mime_type,
        filename: path
            .file_name()
            .and_then(|n| n.to_str().map(|s| s.to_string())),
        size_bytes: Some(size_bytes),
        detail: None,
        duration_ms: None,
    })
}

/// Detect MIME type from file extension
fn detect_image_mime_type(path: &Path) -> Result<String, Box<dyn std::error::Error>> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "png" => Ok("image/png".to_string()),
        "jpg" | "jpeg" => Ok("image/jpeg".to_string()),
        "webp" => Ok("image/webp".to_string()),
        _ => Err(format!("Unsupported image format: .{ext}. Supported: PNG, JPEG, WebP").into()),
    }
}

/// Detect audio MIME type from file extension
fn detect_audio_mime_type(path: &Path) -> Result<String, Box<dyn std::error::Error>> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "wav" => Ok("audio/wav".to_string()),
        "mp3" => Ok("audio/mpeg".to_string()),
        "flac" => Ok("audio/flac".to_string()),
        "ogg" => Ok("audio/ogg".to_string()),
        "m4a" => Ok("audio/m4a".to_string()),
        "webm" => Ok("audio/webm".to_string()),
        _ => Err(format!(
            "Unsupported audio format: .{ext}. Supported: WAV, MP3, FLAC, OGG, M4A, WEBM"
        )
        .into()),
    }
}

/// Load image from URL and create MultimodalAttachment
async fn load_image_url(
    client: &reqwest::Client,
    url: &str,
) -> Result<MultimodalAttachment, Box<dyn std::error::Error>> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(
            format!("Invalid image URL: {url}. Must start with http:// or https://").into(),
        );
    }

    const MAX_IMAGE_SIZE: usize = 10 * 1024 * 1024; // 10MB

    let response = client.get(url).send().await?;

    if !response.status().is_success() {
        return Err(format!("Failed to fetch image: HTTP {}", response.status()).into());
    }

    let content_length = response.content_length().unwrap_or(0);
    if content_length > MAX_IMAGE_SIZE as u64 {
        return Err(format!(
            "Image too large: {content_length} bytes (max: {MAX_IMAGE_SIZE} bytes)"
        )
        .into());
    }

    let mime_type = response
        .headers()
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("image/png")
        .to_string();

    if !is_supported_image_mime(&mime_type) {
        return Err(format!("Unsupported image MIME type: {mime_type}. Supported: image/png, image/jpeg, image/webp").into());
    }

    let data = response.bytes().await?.to_vec();
    let size_bytes = data.len() as u64;

    if data.len() > MAX_IMAGE_SIZE {
        return Err(format!(
            "Image too large: {} bytes (max: {} bytes)",
            data.len(),
            MAX_IMAGE_SIZE
        )
        .into());
    }

    Ok(MultimodalAttachment {
        kind: MultimodalAttachmentKind::InputImage,
        data,
        mime_type,
        filename: Some(url.to_string()),
        size_bytes: Some(size_bytes),
        detail: None,
        duration_ms: None,
    })
}

/// Check if MIME type is a supported image format
fn is_supported_image_mime(mime: &str) -> bool {
    matches!(
        mime.trim().to_ascii_lowercase().as_str(),
        "image/png" | "image/jpeg" | "image/jpg" | "image/webp"
    )
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
    let model_id = format!("flm://{engine_id}/{model_name}");

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

    // Get engine capabilities to validate multimodal support
    let engine_repo_arc = SqliteEngineRepository::new(&db_path).await?;
    let engines = engine_repo_arc.list_registered().await;
    let engine = engines
        .iter()
        .find(|e| e.id() == engine_id)
        .ok_or_else(|| format!("Engine '{engine_id}' not found"))?;
    let capabilities = engine.capabilities();

    // Load multimodal attachments
    let mut attachments = Vec::new();

    // Load image files
    for image_path in &chat.image {
        let attachment = load_image_file(image_path)?;
        attachments.push(attachment);
    }

    // Load image URLs (fetch them now)
    let reqwest_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    for image_url in &chat.image_url {
        let attachment = load_image_url(&reqwest_client, image_url).await?;
        attachments.push(attachment);
    }

    // Load audio file
    if let Some(audio_path) = &chat.audio {
        let attachment = load_audio_file(audio_path)?;
        attachments.push(attachment);
    }

    // Validate capabilities
    if !attachments.is_empty() {
        let has_images = attachments
            .iter()
            .any(|a| matches!(a.kind, MultimodalAttachmentKind::InputImage));
        let has_audio = attachments
            .iter()
            .any(|a| matches!(a.kind, MultimodalAttachmentKind::InputAudio));

        if has_images && !capabilities.vision_inputs {
            return Err(format!(
                "Engine '{engine_id}' does not support vision inputs. Selected model: {model_id}"
            )
            .into());
        }

        if has_audio && !capabilities.audio_inputs {
            return Err(format!(
                "Engine '{engine_id}' does not support audio inputs. Selected model: {model_id}"
            )
            .into());
        }
    }

    // Create chat request
    let request = ChatRequest {
        engine_id: engine_id.clone(),
        model_id: model_id.clone(),
        messages: vec![ChatMessage {
            role: ChatRole::User,
            content: chat.prompt.clone(),
            attachments,
        }],
        stream: chat.stream,
        temperature: chat.temperature,
        max_tokens: chat.max_tokens,
        stop: Vec::new(),
        requested_modalities: Vec::new(),
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
