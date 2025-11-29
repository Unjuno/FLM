# flm-core

FLM Core Library - Domain layer implementation.

This crate provides:
- Domain models and data structures (see `docs/specs/CORE_API.md` section 2)
- Service layer (EngineService, ProxyService, SecurityService, ConfigService)
- Port traits (abstract interfaces for adapters)

## Status

Phase 1: Core services implementation completed.
- ✅ All domain models defined
- ✅ All port traits defined
- ✅ EngineService: Engine detection, model listing, chat, embeddings
- ✅ ProxyService: Proxy start/stop/status, port availability checking
- ✅ SecurityService: API key management, security policy management
- ✅ ConfigService: Configuration management
- ✅ Certificate service: Certificate management utilities
- ✅ Database migrations: All migration files implemented

## Architecture

```
flm-core/
├── src/
│   ├── domain/      # Domain models
│   ├── ports/       # Trait definitions
│   ├── services/    # Service implementations
│   └── error.rs     # Error types
├── migrations/      # SQL migration files
│   ├── 20250101000001_create_config_db.sql
│   ├── 20250101000002_create_security_db.sql
│   ├── 20250101000003_init_security_policy.sql
│   ├── 20250127000001_add_botnet_protection.sql
│   ├── 20250127000002_extend_audit_logs.sql
│   ├── 20250127000003_add_active_proxy_handles.sql
│   └── 20251125000001_add_model_profiles_api_prompts.sql
└── tests/           # Test files
```

See `docs/specs/CORE_API.md` for the complete API specification.

