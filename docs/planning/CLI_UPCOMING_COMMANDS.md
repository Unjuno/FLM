# CLI Upcoming Commands Roadmap

> Status: Draft | Audience: CLI / UI teams | Updated: 2025-02-01

## Prioritization

1. ✅ **`flm model-profiles` (Section 3.11 of CLI spec)** - **実装完了**  
   - Needed for UI “モデル詳細設定パネル” before Phase 2 UI work.  
   - Enables CRUD over `config.db` table `model_profiles`.
   - **実装日**: 2025-01-27
   - **実装内容**: CLIコマンド、リポジトリ、UI統合、テスト完了
2. ✅ **`flm api prompts` (Section 3.12)** - **実装完了**  
   - Powers API-specific prompt overrides referenced by `UI_EXTENSIONS`.  
   - Depends on the same IPC patterns as model profiles; can reuse adapter scaffolding.
   - **実装日**: 2025-01-27
   - **実装内容**: CLIコマンド、リポジトリ、UI統合、テスト完了
3. **`flm migrate legacy` (Section 3.13)**  
   - ✅ 実装完了（`plan`, `convert`, `apply`サブコマンド実装済み）

## Implementation Notes

### `flm model-profiles`
- **CLI surface**: `list`, `save`, `delete` with filters (`--engine`, `--model`, `--label`).
- **Adapters**: extend `SqliteConfigRepository` with `ModelProfileRepository`-like helpers (table already defined in `docs/specs/DB_SCHEMA.md`).
- **Data**: store JSON parameters plus metadata (`version`, `updated_at`).
- **Tests**: add unit tests for repository helpers + CLI integration test covering list/save/delete flows.
- **UI dependency**: return data in the same structure UI expects for the builder wizard.

### `flm api prompts`
- **Commands**: `list`, `show`, `set`.
- **Storage**: `config.db` table `api_prompts`.
- **Validation**: enforce schema from `CORE_API.md` (prompt text + `version`, `updated_at`).
- **Tests**: CLI integration to verify file IO (`--file ./prompt.txt`) and JSON output.

### `flm migrate legacy`
- **Phases**: `--source <path>` → dry-run conversion; `--apply`→ backup + apply.
- **Safety**: reuse `flm security backup` before overwriting DB; confirm app is stopped.
- **Implementation**:
  - Parser module for archived prototype (JSON + SQLite).
  - Temporary directory management (`--tmp` optional).
  - Detailed logging to `logs/migrations/<timestamp>.log`.
- **Tests**: high-level integration with fixture data from `archive/prototype/`.

## Implementation Status

### ✅ `flm model-profiles` - 完了
- CLIコマンド: `list`, `save`, `delete` 実装済み
- リポジトリ: `ModelProfileStore` 実装済み
- UI統合: `ModelProfiles.tsx` ページ + IPC ブリッジ実装済み
- テスト: 5つのテストケース（正常系 + エッジケース）すべて成功

### ✅ `flm api prompts` - 完了
- CLIコマンド: `list`, `show`, `set` 実装済み
- リポジトリ: `ApiPromptStore` 実装済み
- UI統合: `ApiPrompts.tsx` ページ + IPC ブリッジ実装済み
- テスト: 5つのテストケース（正常系 + エッジケース）すべて成功

### ✅ `flm migrate legacy` - 完了
- CLIコマンド: `plan`, `convert`, `apply` 実装済み
- 実装: `crates/apps/flm-cli/src/commands/migrate.rs` に実装済み
- 詳細: `docs/guides/MIGRATION_GUIDE.md` を参照

## Next Steps

- ✅ model-profiles/api prompts の実装完了
- Schedule `migrate legacy` after lint debt + CLI feature freeze for UI Phase 2.

