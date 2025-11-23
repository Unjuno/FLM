//! Tests for EngineRepository
//!
//! These tests verify that EngineRepository works correctly with actual database operations.

use flm_cli::adapters::SqliteEngineRepository;
use flm_core::domain::engine::{EngineState, EngineStatus};
use flm_core::domain::models::{EngineCapabilities, EngineKind};
use sqlx::SqlitePool;
use std::path::PathBuf;
use tempfile::TempDir;

/// Helper to create a temporary database directory
fn create_temp_db_dir() -> (TempDir, PathBuf) {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_db = temp_dir.path().join("config.db");
    (temp_dir, config_db)
}

#[tokio::test]
async fn test_engine_repository_cache_state() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    // Create repository (migrations run automatically in new())
    let repo = SqliteEngineRepository::new(&config_db).await.unwrap();

    // Create a test engine state
    let state = EngineState {
        id: "test-engine-1".to_string(),
        kind: EngineKind::Ollama,
        name: "Test Engine".to_string(),
        version: Some("1.0.0".to_string()),
        status: EngineStatus::InstalledOnly,
        capabilities: EngineCapabilities::default(),
    };

    // Cache the state
    repo.cache_engine_state(&state).await.unwrap();

    // Retrieve the cached state
    let cached = repo
        .get_cached_engine_state("test-engine-1", 30)
        .await
        .unwrap();

    assert!(cached.is_some());
    let cached_state = cached.unwrap();
    assert_eq!(cached_state.id, "test-engine-1");
    assert_eq!(cached_state.kind, EngineKind::Ollama);
    assert_eq!(cached_state.name, "Test Engine");
    assert_eq!(cached_state.version, Some("1.0.0".to_string()));
}

#[tokio::test]
async fn test_engine_repository_cache_multiple_engines() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    // Create repository
    let repo = SqliteEngineRepository::new(&config_db).await.unwrap();

    // Cache multiple engine states
    let state1 = EngineState {
        id: "engine-1".to_string(),
        kind: EngineKind::Ollama,
        name: "Ollama Engine".to_string(),
        version: None,
        status: EngineStatus::InstalledOnly,
        capabilities: EngineCapabilities::default(),
    };

    let state2 = EngineState {
        id: "engine-2".to_string(),
        kind: EngineKind::Vllm,
        name: "vLLM Engine".to_string(),
        version: Some("2.0.0".to_string()),
        status: EngineStatus::RunningHealthy { latency_ms: 100 },
        capabilities: EngineCapabilities {
            chat: true,
            chat_stream: true,
            embeddings: false,
            moderation: false,
            tools: false,
        },
    };

    repo.cache_engine_state(&state1).await.unwrap();
    repo.cache_engine_state(&state2).await.unwrap();

    // Retrieve both
    let cached1 = repo.get_cached_engine_state("engine-1", 30).await.unwrap();
    let cached2 = repo.get_cached_engine_state("engine-2", 30).await.unwrap();

    assert!(cached1.is_some());
    assert!(cached2.is_some());

    assert_eq!(cached1.unwrap().kind, EngineKind::Ollama);
    assert_eq!(cached2.unwrap().kind, EngineKind::Vllm);
}

#[tokio::test]
async fn test_engine_repository_cache_nonexistent() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    // Create repository
    let repo = SqliteEngineRepository::new(&config_db).await.unwrap();

    // Try to retrieve a non-existent engine
    let cached = repo
        .get_cached_engine_state("nonexistent-engine", 30)
        .await
        .unwrap();

    assert!(cached.is_none());
}

#[tokio::test]
async fn test_engine_repository_cache_update() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    // Create repository
    let repo = SqliteEngineRepository::new(&config_db).await.unwrap();

    // Cache initial state
    let initial_state = EngineState {
        id: "engine-1".to_string(),
        kind: EngineKind::Ollama,
        name: "Initial Name".to_string(),
        version: Some("1.0.0".to_string()),
        status: EngineStatus::InstalledOnly,
        capabilities: EngineCapabilities::default(),
    };

    repo.cache_engine_state(&initial_state).await.unwrap();

    // Update the state
    let updated_state = EngineState {
        id: "engine-1".to_string(),
        kind: EngineKind::Ollama,
        name: "Updated Name".to_string(),
        version: Some("2.0.0".to_string()),
        status: EngineStatus::RunningHealthy { latency_ms: 50 },
        capabilities: EngineCapabilities {
            chat: true,
            chat_stream: true,
            embeddings: false,
            moderation: false,
            tools: false,
        },
    };

    repo.cache_engine_state(&updated_state).await.unwrap();

    // Verify the update
    let cached = repo.get_cached_engine_state("engine-1", 30).await.unwrap();
    assert!(cached.is_some());
    let cached_state = cached.unwrap();
    assert_eq!(cached_state.name, "Updated Name");
    assert_eq!(cached_state.version, Some("2.0.0".to_string()));
    assert!(matches!(
        cached_state.status,
        EngineStatus::RunningHealthy { latency_ms: 50 }
    ));
}

#[tokio::test]
async fn test_engine_repository_cache_ttl_expiration() {
    let (_temp_dir, config_db) = create_temp_db_dir();

    let repo = SqliteEngineRepository::new(&config_db).await.unwrap();

    let state = EngineState {
        id: "engine-ttl".to_string(),
        kind: EngineKind::Ollama,
        name: "TTL Engine".to_string(),
        version: None,
        status: EngineStatus::RunningHealthy { latency_ms: 10 },
        capabilities: EngineCapabilities {
            chat: true,
            chat_stream: false,
            embeddings: false,
            moderation: false,
            tools: false,
        },
    };

    repo.cache_engine_state(&state).await.unwrap();

    let db_url = format!("sqlite://{}", config_db.to_string_lossy());
    let pool = SqlitePool::connect(&db_url).await.unwrap();
    sqlx::query(
        "UPDATE engines_cache SET cached_at = datetime('now', '-120 seconds') WHERE engine_id = ?",
    )
    .bind("engine-ttl")
    .execute(&pool)
    .await
    .unwrap();

    let cached = repo
        .get_cached_engine_state("engine-ttl", 30)
        .await
        .unwrap();

    assert!(cached.is_none(), "Cache entry should expire after TTL");
}
