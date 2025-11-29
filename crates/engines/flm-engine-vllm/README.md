# flm-engine-vllm

vLLM engine adapter for FLM.

This crate implements the `LlmEngine` trait for vLLM, providing integration with vLLM's OpenAI-compatible API.

## Status

✅ Implemented and tested.

## Features

- Engine detection via HTTP API (port 8000)
- Model listing (`/v1/models`)
- Chat completions (`/v1/chat/completions`)
- Streaming chat completions
- Embeddings (`/v1/embeddings`)
- Health checks with latency measurement

## Usage

```rust
use flm_engine_vllm::VllmEngine;

let engine = VllmEngine::new(
    "vllm-default".to_string(),
    "http://localhost:8000".to_string()
)?;

// List models
let models = engine.list_models().await?;

// Chat
let response = engine.chat(request).await?;
```

## Configuration

- Default base URL: `http://localhost:8000`
- vLLM must be running as a service (not a binary)

## API Compatibility

vLLM provides an OpenAI-compatible API, so the implementation directly maps:
- FLM `ChatRequest` ↔ OpenAI `/v1/chat/completions` format
- FLM `ModelInfo` ↔ OpenAI `/v1/models` format

See `docs/specs/ENGINE_DETECT.md` for detection specification.

