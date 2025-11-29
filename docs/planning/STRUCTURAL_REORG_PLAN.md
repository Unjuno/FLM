<!-- SPDX-License-Identifier: MIT OR Apache-2.0 -->
# Structural Reorganization Plan

> Status: Planning | Audience: All contributors | Updated: 2025-11-26

## Objective
- Improve discoverability of workspace crates (`flm-core`, `flm-proxy`, `flm-cli`, engine adapters) by grouping them by responsibility.
- Keep build hygiene intact (no changes to package names, keep existing tooling commands working).
- Maintain documentation accuracy by updating all path references alongside physical moves.

## Current Pain Points
1. Flat `crates/` directory mixes domain core, services, CLI, and engine adapters, making navigation and ownership boundaries unclear.
2. Documentation and reports cite the flat paths, so contributors must mentally map responsibilities before editing.
3. CI scripts and lint/test instructions rely on whole-workspace commands; without logical grouping it is hard to reason about incremental builds.

## Target Layout
```
crates/
  core/flm-core
  services/flm-proxy
  apps/flm-cli
  engines/
    flm-engine-ollama
    flm-engine-vllm
    flm-engine-lmstudio
    flm-engine-llamacpp
docs/
  planning/STRUCTURAL_REORG_PLAN.md (this file)
docs/status/completed/tasks/DONE.md / PERSONA_REGISTRY.md (governance)
```

## Acceptance Criteria
1. `cargo fmt --all -- --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo check --workspace`, and `cargo test --workspace --no-fail-fast` all succeed after moves.
2. All documentation and reports referencing crate paths are updated to the new grouped layout (no `crates/flm-*` paths remain outside `archive/`).
3. Workspace manifests (`Cargo.toml` root and per-crate `Cargo.toml` files) reference the new paths, and dependencies still resolve.
4. Governance files (`docs/status/completed/tasks/DONE.md`, `PERSONA_REGISTRY.md`) reflect assignment and completion of this refactor.
5. README and guides describe the grouped layout so newcomers can find crates without scanning flat directories.

## Compatibility / Tooling Requirements
- FORMAT_CMD: `cargo fmt --all -- --check`
- LINT_CMD: `cargo clippy --all-targets --all-features -- -D warnings`
- TYPECHECK_CMD: `cargo check --workspace`
- TEST_CMD: `cargo test --workspace --no-fail-fast`
- CI scripts (`scripts/ci-*.sh`, `.ps1`) must continue to run without modification; they invoke workspace-level cargo commands so path grouping must retain crate names.

## Dependency Map
| Crate | Depends On | Notes |
| --- | --- | --- |
| `flm-core` | n/a | Provides domain models/services used everywhere. |
| `flm-proxy` | `flm-core` | Proxy server uses core services and ports. |
| `flm-cli` | `flm-core`, `flm-proxy`, all engine adapters | CLI shells domain services and orchestrates proxy. |
| Engine adapters (`flm-engine-*`) | `flm-core` | Each adapter plugs into core engine traits. |

## Plan
1. **Governance setup** – add `PERSONA_REGISTRY.md`, `docs/status/completed/tasks/DONE.md` entries so contributors can claim/close work.
2. **Directory creation & moves** – introduce `core/`, `services/`, `apps/`, `engines/` subdirectories under `crates/`, then move each crate.
3. **Manifest updates** – adjust root/workspace `Cargo.toml` members and path dependencies inside crates.
4. **Documentation sweep** – update README, reports, and status docs referencing the old paths.
5. **Validation** – run FORMAT_CMD → LINT_CMD → TYPECHECK_CMD → TEST_CMD in that order, capture logs in `reports/` if failures occur.
6. **Governance close-out** – append entry to `docs/status/completed/tasks/DONE.md`.

## [ASSUMPTIONS]
- No external tooling hard-codes absolute paths; workspace uses relative cargo members only.
- Contributors access crates via Git (no symlinks), so moving directories is safe across OSes.
- Documentation references are only Markdown/plan files (no generated assets embedding the old paths).


