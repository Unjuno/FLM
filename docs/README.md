# Documentation Index

Updated: 2025-11-18

This folder hosts the canonical specifications for the rebuilt FLM project. Use this index to find the right source of truth before implementing or updating code. Legacy drafts remain under `archive/prototype/docs/`; do not reference them for new work unless you are intentionally auditing history.

## How to Navigate

| Document | Purpose | Primary Audience | Status |
| --- | --- | --- | --- |
| `PLAN.md` | Phase roadmap, architecture principles, deliverables | All contributors | Canonical |
| `FEATURE_SPEC.md` | Minimal feature scope and acceptance criteria | Product / Eng leads | Canonical |
| `CORE_API.md` | Domain models, traits, service APIs | Rust core implementers | Canonical |
| `PROXY_SPEC.md` | HTTP proxy behavior, routing, middleware, TLS modes | Proxy engineers | Canonical |
| `ENGINE_DETECT.md` | Engine discovery flow per provider | Engine adapter devs | Canonical |
| `DB_SCHEMA.md` | SQLite schemas, migration policy | Persistence layer devs | Canonical |
| `CLI_SPEC.md` | Command definitions, options, error contract | CLI authors/testers | Canonical |
| `UI_MINIMAL.md` | Phase 2 UI screens, IPC flows, Setup Wizard | UI engineers | Canonical |
| `UI_EXTENSIONS.md` | Post-MVP UI roadmap | Product / UI leads | Reference |
| `SECURITY_FIREWALL_GUIDE.md` | Firewall automation templates for Setup Wizard | UI backend / Ops | Canonical |
| `diagram.md` | Mermaid architecture diagram | Everyone | Canonical |

## Versioning Rules

1. Each canonical file now includes a status header with last-updated date—keep it current when you change content.
2. If you need to keep superseded specs, move them into `archive/` or `DOCS.zip`; do not leave multiple competing versions in `docs/`.
3. When altering behavior that spans multiple specs, update this index (and affected documents) in the same change set.

## Contact / Ownership

- Architecture & Core: `CORE_API.md`, `PLAN.md`, `PROXY_SPEC.md`
- CLI & Tooling: `CLI_SPEC.md`, `DB_SCHEMA.md`
- UI & Wizard: `UI_MINIMAL.md`, `UI_EXTENSIONS.md`, `SECURITY_FIREWALL_GUIDE.md`

Open an issue before large structural edits so reviewers know which documents to re-read.

