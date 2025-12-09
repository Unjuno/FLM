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
- Tauri UI application with React frontend
- Common UI components (LoadingSpinner, ErrorMessage, SuccessMessage, ConfirmDialog, ErrorBoundary)
- Utility functions (formatters, timeout management, logging, input validation, error handling)
- Error handling utilities with CLI error extraction
- Input validation utilities (email, URL, port, IP address, temperature, tokens)
- Logging utilities with configurable log levels
- URL validation and security improvements in chatTester service
- Type guard functions for runtime type checking
- React.memo optimization for common UI components
- Comprehensive test coverage for utility functions and services
- Accessibility improvements (WCAG compliance, ARIA attributes, screen reader support)
- Unified logging system (replaced console.warn/error with logger)
- Phase 3 packaging support: Tauri bundle configuration for certificates and installer scripts
- Build-time root CA certificate generation for packaged-ca mode
- Integration tests for routing, App component, security UI components, and ErrorBoundary
- I18N (Internationalization) support: translation files (ja.json, en.json), I18nContext, language switching UI, OS language auto-detection, full I18N support for all pages (Home, ChatTester, SecurityEvents, IpBlocklistManagement, Settings)
- IPC commands integration tests: comprehensive test suite for Tauri IPC bridge commands (ipc_detect_engines, ipc_list_models, ipc_proxy_start/stop/status, ipc_api_keys, ipc_config, ipc_security, get_platform) with error handling tests
- Proxy stop functionality fix: `handleStopProxy` now correctly uses `port` from current proxy status
- Expanded test coverage for proxy stop functionality: added test cases for error handling, success scenarios, and edge cases

### Changed
- Improved error handling across all pages and components
- Unified error message display with detailed CLI error information
- Enhanced type safety (reduced `any` usage)
- Improved timer management with common utility functions
- Refactored error handling patterns to use common utilities
- Function decomposition to reduce cognitive complexity
- Enhanced security with URL validation and protocol checks
- Unified logging system across frontend and backend
- Improved loading state management with LoadingSpinner component
- Updated Tauri configuration to bundle certificates and installer scripts as resources
- Enhanced build script to generate root CA certificate during build time (packaged-ca feature)
- Fixed proxy stop functionality to use port from current proxy status instead of empty payload
- Improved error handling for proxy stop when proxy is not running
- Expanded test coverage with integration tests for routing, security UI, and error handling
- Added I18N support: Settings page for language switching, automatic language detection from OS settings, translation integration in all pages (Home, ChatTester, SecurityEvents, IpBlocklistManagement, Settings) and Sidebar

### Fixed
- Duplicate command definition errors (E0255)
- Lifetime errors (E0716, E0597) in CLI bridge
- Type inference errors (E0283)
- Memory leaks in timer management
- Inconsistent error handling patterns
- Missing type guards for CLI responses
- Memory leaks from URL.createObjectURL (fixed with URL.revokeObjectURL)
- Missing NaN validation for parseInt results

## [1.0.0] - TBD

### Planned
- Core API v1.0.0 freeze and GPG-signed tag
- See `docs/planning/PLAN.md` Phase 0 completion criteria

---

**Note**: This changelog will be updated when Core API v1.0.0 is tagged.

