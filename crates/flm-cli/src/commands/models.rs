//! Models command implementation

use crate::adapters::{DefaultEngineProcessController, ReqwestHttpClient, SqliteEngineRepository};
use crate::cli::models::ModelsSubcommand;
use async_trait::async_trait;
use flm_core::domain::models::EngineKind;
use flm_core::ports::{EngineProcessController, EngineRepository, LlmEngine};
use flm_core::services::EngineService;
use flm_engine_ollama::OllamaEngine;
use serde_json::json;
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;
use std::sync::Arc;

/// Wrapper to convert Arc<SqliteEngineRepository> to Box<dyn EngineRepository>
struct ArcEngineRepositoryWrapper(Arc<SqliteEngineRepository>);

#[async_trait]
impl EngineRepository for ArcEngineRepositoryWrapper {
    async fn list_registered(&self) -> Vec<Arc<dyn LlmEngine>> {
        self.0.list_registered().await
    }

    async fn register(&self, engine: Arc<dyn LlmEngine>) {
        self.0.register(engine).await;
    }
}

/// Get the default config.db path
fn default_config_db_path() -> PathBuf {
    crate::utils::get_config_db_path()
}

/// Register engines based on detected states
async fn register_detected_engines(
    service: &EngineService,
    engine_repo: &ArcEngineRepositoryWrapper,
    runtime_urls: &HashMap<String, String>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Detect engines first
    let states = service.detect_engines().await?;

    // Register engines based on detected states
    for state in states {
        if state.kind == EngineKind::Ollama {
            let base_url = runtime_urls
                .get(&state.id)
                .cloned()
                .or_else(|| env::var("OLLAMA_BASE_URL").ok())
                .unwrap_or_else(|| "http://localhost:11434".to_string());

            let engine = Arc::new(OllamaEngine::new(state.id.clone(), base_url)?);
            engine_repo.register(engine).await;
        }
        // TODO: Add other engine types as adapters are implemented
    }

    if engine_repo.list_registered().await.is_empty() {
        if let Ok(base_url) = env::var("OLLAMA_BASE_URL") {
            let engine = Arc::new(OllamaEngine::new("ollama-default".to_string(), base_url)?);
            engine_repo.register(engine).await;
        }
    }

    Ok(())
}

/// Execute models list command
pub async fn execute_list(
    engine_id: String,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_config_db_path);

    // Initialize adapters
    let process_controller_impl = DefaultEngineProcessController::new();
    let runtime_urls: HashMap<String, String> = process_controller_impl
        .detect_running()
        .into_iter()
        .map(|runtime| (runtime.engine_id, runtime.base_url))
        .collect();
    let process_controller = Box::new(process_controller_impl);
    let http_client = Box::new(ReqwestHttpClient::new()?);
    let engine_repo_arc = SqliteEngineRepository::new(&db_path).await?;
    let engine_repo: Box<dyn flm_core::ports::EngineRepository> =
        Box::new(ArcEngineRepositoryWrapper(engine_repo_arc.clone()));

    // Create service
    let service = EngineService::new(process_controller, http_client, engine_repo);

    // Register detected engines
    let engine_repo_wrapper = ArcEngineRepositoryWrapper(engine_repo_arc);
    register_detected_engines(&service, &engine_repo_wrapper, &runtime_urls).await?;

    // List models
    let models = service.list_models(engine_id.clone()).await?;

    // Output results
    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "engine_id": engine_id,
                "models": models
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        // Text format
        if models.is_empty() {
            println!("No models found for engine: {engine_id}");
        } else {
            println!("Models for engine '{engine_id}':");
            for model in models {
                println!("  - {} ({})", model.display_name, model.model_id);
                if let Some(context_length) = model.context_length {
                    println!("    Context length: {context_length}");
                }
                println!("    Streaming: {}", model.supports_streaming);
                println!("    Embeddings: {}", model.supports_embeddings);
            }
        }
    }

    Ok(())
}

/// Execute models command
pub async fn execute(
    subcommand: ModelsSubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        ModelsSubcommand::List { engine } => execute_list(engine, db_path, format).await,
    }
}
