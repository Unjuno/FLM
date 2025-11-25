//! Engines command implementation

use crate::adapters::{DefaultEngineProcessController, ReqwestHttpClient, SqliteEngineRepository};
use crate::cli::engines::EnginesSubcommand;
use crate::commands::CliUserError;
use flm_core::domain::engine::EngineState;
use flm_core::domain::models::EngineKind;
use flm_core::ports::{EngineRepository, LlmEngine};
use flm_core::services::EngineService;
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

const ENGINE_CACHE_TTL_SECONDS: u64 = 300;

/// Wrapper to convert Arc<SqliteEngineRepository> to Box<dyn EngineRepository>
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

/// Get the default config.db path
fn default_config_db_path() -> PathBuf {
    crate::utils::get_config_db_path()
}

/// Execute engines detect command
pub async fn execute_detect(
    engine: Option<String>,
    fresh: bool,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_config_db_path);

    // Initialize repository up front for caching behavior
    let engine_repo_arc = SqliteEngineRepository::new(&db_path).await?;

    if fresh {
        engine_repo_arc.clear_engine_cache().await?;
    } else {
        let cached_states = engine_repo_arc
            .list_cached_engine_states(ENGINE_CACHE_TTL_SECONDS)
            .await?;
        if !cached_states.is_empty() {
            return render_states(&cached_states, &format);
        }
    }

    // Initialize adapters
    let process_controller = Box::new(DefaultEngineProcessController::new());
    let http_client = Box::new(ReqwestHttpClient::new()?);
    // Convert Arc to Box by cloning the Arc and wrapping it
    // Note: This is a workaround - ideally EngineService should accept Arc
    let engine_repo: Box<dyn flm_core::ports::EngineRepository> =
        Box::new(ArcEngineRepositoryWrapper(engine_repo_arc.clone()));

    // Create service
    let service = EngineService::new(process_controller, http_client, engine_repo);

    // Detect engines
    let states = if let Some(engine_name) = engine {
        // Filter by specific engine
        let kind = match engine_name.to_lowercase().as_str() {
            "ollama" => EngineKind::Ollama,
            "vllm" => EngineKind::Vllm,
            "lmstudio" | "lm-studio" => EngineKind::LmStudio,
            "llamacpp" | "llama-cpp" => EngineKind::LlamaCpp,
            _ => {
                let message = format!(
                    "Unknown engine: {engine_name}\nSupported engines: ollama, vllm, lmstudio, llamacpp"
                );
                return Err(Box::new(CliUserError::new(message)));
            }
        };

        let all_states = service.detect_engines().await?;
        all_states.into_iter().filter(|s| s.kind == kind).collect()
    } else {
        service.detect_engines().await?
    };

    // Cache latest states for subsequent runs
    for state in &states {
        let _ = engine_repo_arc.cache_engine_state(state).await;
    }

    render_states(&states, &format)
}

/// Execute engines command
pub async fn execute(
    subcommand: EnginesSubcommand,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    match subcommand {
        EnginesSubcommand::Detect { engine, fresh } => {
            execute_detect(engine, fresh, db_path, format).await
        }
    }
}

fn render_states(states: &[EngineState], format: &str) -> Result<(), Box<dyn std::error::Error>> {
    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "engines": states
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else if states.is_empty() {
        println!("No engines detected.");
    } else {
        println!("Detected {} engine(s):", states.len());
        for state in states {
            println!("\nEngine: {}", state.id);
            println!("  Kind: {:?}", state.kind);
            println!("  Name: {}", state.name);
            if let Some(version) = &state.version {
                println!("  Version: {version}");
            }
            println!("  Status: {:?}", state.status);
        }
    }

    Ok(())
}
