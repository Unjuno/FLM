//! Engines command implementation

use crate::adapters::{
    DefaultEngineProcessController, ReqwestHttpClient, SqliteEngineHealthLogRepository,
    SqliteEngineRepository,
};
use crate::cli::engines::EnginesSubcommand;
use crate::commands::CliUserError;
use chrono::Utc;
use flm_core::domain::engine::EngineState;
use flm_core::domain::models::EngineKind;
use flm_core::ports::{EngineHealthLogRepository, EngineRepository, LlmEngine};
use flm_core::services::EngineService;
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

const ENGINE_CACHE_TTL_SECONDS: u64 = 300;

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
    let engine_repo: Box<dyn flm_core::ports::EngineRepository + Send + Sync> =
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
        if let Err(e) = engine_repo_arc.cache_engine_state(state).await {
            eprintln!("Warning: Failed to cache engine state: {}", e);
        }
    }

    render_states(&states, &format)
}

/// Execute engines health-history command
pub async fn execute_health_history(
    engine: Option<String>,
    model: Option<String>,
    hours: u32,
    limit: u32,
    db_path: Option<String>,
    format: String,
) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = db_path
        .map(PathBuf::from)
        .unwrap_or_else(default_config_db_path);

    let health_log_repo = SqliteEngineHealthLogRepository::new(&db_path).await?;

    let end_time = Utc::now();
    let start_time = end_time - chrono::Duration::hours(hours as i64);

    let logs = health_log_repo
        .get_logs_in_range(
            engine.as_deref(),
            model.as_deref(),
            start_time,
            end_time,
            Some(limit),
        )
        .await?;

    if format == "json" {
        let output = json!({
            "version": "1.0",
            "data": {
                "logs": logs.iter().map(|log| json!({
                    "id": log.id,
                    "engine_id": log.engine_id,
                    "model_id": log.model_id,
                    "status": log.status,
                    "latency_ms": log.latency_ms,
                    "error_rate": log.error_rate,
                    "created_at": log.created_at.to_rfc3339(),
                })).collect::<Vec<_>>()
            }
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        if logs.is_empty() {
            println!("No health logs found for the specified criteria.");
        } else {
            println!("Found {} health log(s):", logs.len());
            for log in &logs {
                println!("\nLog ID: {}", log.id);
                println!("  Engine: {}", log.engine_id);
                if let Some(model_id) = &log.model_id {
                    println!("  Model: {}", model_id);
                }
                println!("  Status: {}", log.status);
                if let Some(latency) = log.latency_ms {
                    println!("  Latency: {}ms", latency);
                }
                println!("  Error Rate: {:.2}%", log.error_rate * 100.0);
                println!("  Created At: {}", log.created_at.to_rfc3339());
            }
        }
    }

    Ok(())
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
        EnginesSubcommand::HealthHistory {
            engine,
            model,
            hours,
            limit,
        } => execute_health_history(engine, model, hours, limit, db_path, format).await,
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
