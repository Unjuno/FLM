# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Rust workspace structure with 8 crates (flm-core, flm-cli, flm-proxy, 4 engine adapters)
- flm-core domain layer implementation
  - Domain models: Engine, Model, ProxyProfile, SecurityPolicy
  - Abstract ports: Repository traits for Engine, Model, Proxy, Security
  - Use cases: Engine detection, Model listing
- flm-cli skeleton with all planned commands
  - `flm engines detect`
  - `flm models list`
  - `flm proxy start/stop/status`
  - `flm config get/set`
  - `flm api-keys generate/list/revoke`
- Comprehensive documentation
  - docs/PLAN.md (180 lines)
  - docs/CORE_API.md (571 lines)
  - docs/PROXY_SPEC.md (212 lines)
  - docs/EVALUATION_REPORT.md (300 lines)
  - docs/MIGRATION_GUIDE.md (92 lines)
  - docs/TEST_STRATEGY.md (76 lines)
  - docs/VERSIONING_POLICY.md (57 lines)
  - docs/templates/ADR_TEMPLATE.md
  - tests/ui-scenarios.md

### Fixed
- js-yaml prototype pollution vulnerability (CVE-2025-XXXX) in archive/prototype

### Changed
- Updated README.md with Phase 0 progress indicators
- Updated PLAN.md with implementation status notes

### Technical Notes
- HTTP dependencies (reqwest, axum) temporarily disabled due to Rust 1.82 compatibility
- Will re-enable after Rust 1.83 upgrade or finding compatible versions
- archive/prototype is now officially frozen (no new features or bug fixes)

## [0.0.0] - 2025-11-20

### Added
- Initial project structure
- Archive of legacy Node/Electron prototype
