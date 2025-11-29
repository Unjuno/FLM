# flm-engine-lmstudio

LM Studio engine adapter for FLM.

This crate implements the `LlmEngine` trait for LM Studio, providing integration with LM Studio's OpenAI-compatible API.

## Status

✅ Implemented and tested.

## Features

- Engine detection via HTTP API (port 1234)
- Model listing (`/v1/models`)
- Chat completions (`/v1/chat/completions`)
- Streaming chat completions
- Embeddings (`/v1/embeddings`)
- Health checks with latency measurement

## Usage

```rust
use flm_engine_lmstudio::LmStudioEngine;

let engine = LmStudioEngine::new(
    "lmstudio-default".to_string(),
    "http://localhost:1234".to_string()
)?;

// List models
let models = engine.list_models().await?;

// Chat
let response = engine.chat(request).await?;
```

## Configuration

- Default base URL: `http://localhost:1234`
- LM Studio must be running as a service (not a binary)

## API Compatibility

LM Studio provides an OpenAI-compatible API, so the implementation directly maps:
- FLM `ChatRequest` ↔ OpenAI `/v1/chat/completions` format
- FLM `ModelInfo` ↔ OpenAI `/v1/models` format

See `docs/specs/ENGINE_DETECT.md` for detection specification.

