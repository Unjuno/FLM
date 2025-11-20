# flm-core

FLM Core Library - Domain layer implementation.

This crate provides:
- Domain models and data structures (see `docs/CORE_API.md` section 2)
- Service layer (EngineService, ProxyService, SecurityService, ConfigService)
- Port traits (abstract interfaces for adapters)

## Status

Phase 0: Basic structure and type definitions completed.
- ✅ All domain models defined
- ✅ All port traits defined
- ✅ Service skeletons created
- ⏳ Implementation pending (Phase 1)

## Architecture

```
flm-core/
├── src/
│   ├── domain/      # Domain models
│   ├── ports/       # Trait definitions
│   ├── services/    # Service implementations
│   └── error.rs     # Error types
└── migrations/      # SQL migration files (TODO)
```

See `docs/CORE_API.md` for the complete API specification.

