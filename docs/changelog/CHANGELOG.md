# Changelog

All notable changes to FLM Core API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

See `docs/guides/VERSIONING_POLICY.md` for versioning policy details.

## [Unreleased]

### Added
- Initial Rust workspace structure with 7 crates
- Domain models (28 types) according to CORE_API.md
- Port traits (8 traits) for adapter layer
- Service layer skeletons (EngineService, ProxyService, SecurityService, ConfigService)
- Error types (EngineError, ProxyError, RepoError, HttpError)
- Database migration files for config.db and security.db
- Basic integration tests
- CI workflow files (ci-cli, ci-proxy-load, ci-acme-smoke)

## [1.0.0] - TBD

### Planned
- Core API v1.0.0 freeze and GPG-signed tag
- See `docs/planning/PLAN.md` Phase 0 completion criteria

---

**Note**: This changelog will be updated when Core API v1.0.0 is tagged.

