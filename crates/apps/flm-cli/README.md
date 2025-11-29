# flm-cli

FLM Command Line Interface - CLI tool for managing FLM services.

This crate provides:
- Command-line interface for FLM services
- Engine detection and management
- Proxy control (start, stop, status)
- Security management (API keys, policies)
- Configuration management
- Model and API prompt management

## Status

Phase 1: Core CLI commands completed.
- ✅ Engine detection (`flm engines detect`)
- ✅ Model listing (`flm models list`)
- ✅ Proxy control (`flm proxy start/stop/status`)
- ✅ Security management (`flm security`)
- ✅ Configuration management (`flm config`)
- ✅ Chat interface (`flm chat`)
- ✅ Health checks (`flm check`)
- ✅ Phase 3 commands: `flm model-profiles` (実装完了 2025-01-27), `flm api prompts` (実装完了 2025-01-27), `flm migrate legacy` (基本構造実装済み、完全な移行ロジックは開発中)

## Architecture

```
flm-cli/
├── src/
│   ├── main.rs            # CLI entry point
│   ├── cli/               # CLI command definitions
│   │   ├── engines.rs
│   │   ├── models.rs
│   │   ├── proxy.rs
│   │   ├── security.rs
│   │   ├── config.rs
│   │   ├── chat.rs
│   │   └── ...
│   ├── commands/          # Command implementations
│   │   ├── engines.rs
│   │   ├── models.rs
│   │   ├── proxy.rs
│   │   ├── security.rs
│   │   ├── config.rs
│   │   ├── chat.rs
│   │   └── ...
│   ├── adapters/          # Adapter implementations
│   │   ├── engine.rs
│   │   ├── proxy.rs
│   │   ├── security.rs
│   │   ├── config.rs
│   │   └── ...
│   └── db/                # Database management
│       └── migration.rs
└── tests/                 # Integration tests
    ├── engines_test.rs
    ├── models_test.rs
    ├── proxy_cli_test.rs
    ├── security_test.rs
    └── ...
```

## Commands

### Engine Management
- `flm engines detect` - Detect available LLM engines
- `flm engines list` - List detected engines

### Model Management
- `flm models list` - List available models from an engine

### Proxy Control
- `flm proxy start` - Start the proxy server
- `flm proxy stop` - Stop the proxy server
- `flm proxy status` - Check proxy status

### Security
- `flm security api-keys` - Manage API keys
- `flm security policy` - Manage security policies
- `flm security backup` - Backup security database

### Configuration
- `flm config get` - Get configuration value
- `flm config set` - Set configuration value
- `flm config list` - List all configuration

### Chat
- `flm chat` - Interactive chat interface

### Health Checks
- `flm check` - Check system health and database integrity

## Usage

```bash
# Detect engines
flm engines detect --format json

# List models
flm models list --engine ollama

# Start proxy
flm proxy start --mode local-http --port 8080

# Check status
flm proxy status

# Manage API keys
flm security api-keys create --name "My Key"

# Interactive chat
flm chat --engine ollama --model llama2
```

See `docs/specs/CLI_SPEC.md` for complete specification.

