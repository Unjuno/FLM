# flm-engine-ollama

Ollama engine adapter for FLM.

This crate implements the `LlmEngine` trait for Ollama, providing integration with the Ollama API.

## Status

✅ Implemented and tested.

## Features

- Engine detection via binary and HTTP API
- Model listing (`/api/tags`)
- Chat completions (`/api/chat`)
- Streaming chat completions
- Embeddings (`/api/embeddings`)
- Health checks with latency measurement

## Usage

```rust
use flm_engine_ollama::OllamaEngine;

let engine = OllamaEngine::new(
    "ollama-default".to_string(),
    "http://localhost:11434".to_string()
)?;

// List models
let models = engine.list_models().await?;

// Chat
let response = engine.chat(request).await?;
```

## Configuration

- Default base URL: `http://localhost:11434`
- Can be overridden via `OLLAMA_BASE_URL` environment variable

## API Compatibility

Ollama uses a custom API format, so this adapter converts between:
- FLM `ChatRequest` ↔ Ollama `/api/chat` format
- FLM `ModelInfo` ↔ Ollama `/api/tags` format

See `docs/specs/ENGINE_DETECT.md` for detection specification.

