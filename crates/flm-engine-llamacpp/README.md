# flm-engine-llamacpp

llama.cpp engine adapter for FLM.

This crate implements the `LlmEngine` trait for llama.cpp, providing integration with llama.cpp's OpenAI-compatible API when running in server mode.

## Status

✅ Implemented and tested.

## Features

- Engine detection via binary and HTTP API (port 8080)
- Model listing (`/v1/models`)
- Chat completions (`/v1/chat/completions`)
- Streaming chat completions
- Embeddings (`/v1/embeddings`)
- Health checks with latency measurement

## Usage

```rust
use flm_engine_llamacpp::LlamaCppEngine;

let engine = LlamaCppEngine::new(
    "llamacpp-default".to_string(),
    "http://localhost:8080".to_string()
)?;

// List models
let models = engine.list_models().await?;

// Chat
let response = engine.chat(request).await?;
```

## Configuration

- Default base URL: `http://localhost:8080`
- llama.cpp must be running in server mode
- Binary detection supports common installation paths and `LLAMA_CPP_PATH` environment variable

## API Compatibility

llama.cpp provides an OpenAI-compatible API when running in server mode, so the implementation directly maps:
- FLM `ChatRequest` ↔ OpenAI `/v1/chat/completions` format
- FLM `ModelInfo` ↔ OpenAI `/v1/models` format

See `docs/specs/ENGINE_DETECT.md` for detection specification.

