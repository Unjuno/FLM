# Versioning Policy
> Status: Canonical | Audience: Release/Platform engineers | Updated: 2025-11-20

## 1. Scope
この文書は以下に適用される:
- Rust crates (`flm-core`, `flm-cli`, `flm-proxy`, `flm-engine-*`)
- ドキュメント仕様 (`docs/CORE_API.md`, `docs/PROXY_SPEC.md`, `docs/ENGINE_DETECT.md`, `docs/DB_SCHEMA.md`)
- CLI/Proxy が外部に公開する DTO (`ProxyHandle`, `SecurityPolicy`, OpenAI 互換レスポンス)

## 2. Semantic Versioning
| 対象 | 形式 | 互換性ルール |
|------|------|--------------|
| Core API / DTO | `MAJOR.MINOR.PATCH` (例: `1.0.0`) | `MAJOR` 変更でのみ破壊的変更を許可。`MINOR` はフィールド追加・オプション化のみ。`PATCH` はバグ修正/誤記訂正。 |
| CLI/Proxy Crates | Cargo 規定の SemVer | Core API の `MINOR` 追加を取り込む際は CLI/Proxy も同じ `MINOR` を反映する。 |
| ドキュメント | Git タグ `core-api-vX.Y.Z` | タグ作成時点で `docs/*` の対応バージョンを `## Changelog` に記録。 |

> **Changelog 記録先**  
> 各 Canonical ドキュメント（`docs/CORE_API.md`, `docs/PROXY_SPEC.md`, `docs/ENGINE_DETECT.md`, `docs/DB_SCHEMA.md` 等）は末尾に `## Changelog` セクションを持つ。存在しない場合は本ポリシーに従って新設し、変更履歴を追加すること。

## 3. Release Flow
1. 変更提案を `docs/templates/ADR_TEMPLATE.md` に従って提出。
2. ADR 承認後、以下を実行:
   - `docs/CORE_API.md` など該当ファイルを更新し、冒頭の `Updated:` と `## Changelog` セクションを追記。
   - Rust crate の `Cargo.toml` で `version` を更新。
   - `docs/VERSIONING_POLICY.md` の「バージョンマッピング表」を更新。
3. `git tag -s core-api-vX.Y.Z` を作成し、署名済みタグを push。
4. CLI/Proxy/UI のリリースノートに「Core API Version」を記載。

## 4. DTO バージョンの扱い
- すべての JSON 応答は `{"version":"1.0","data":{...}}` 形式。
- フィールド追加時は `serde(default)` を設定し、古い CLI/UI が未知フィールドを無視できるようにする。
- 削除または型変更が必要な場合は `MAJOR` をインクリメントし、移行手順を `docs/MIGRATION_GUIDE.md` に追記する。

## 5. バージョンマッピング表
| Core API | CLI | Proxy | Docs タグ | 備考 |
|----------|-----|-------|-----------|------|
| `1.0.0` (Phase 0) | `0.1.0` | `0.1.0` | `core-api-v1.0.0` | 初回フリーズ。CLI/Proxy は 0.x 系のまま互換性警告を表示。 |
| `1.1.0` | `0.2.0` → `1.1.0` release window | `0.2.0` → `1.1.0` release window | `core-api-v1.1.0` | Core API の `MINOR` 追加を取り込む branch では 0.x で先行提供し、安定後に CLI/Proxy の `MAJOR` を Core API と合わせる。 |

## 6. Breaking Change Checklist
1. 新旧 DTO の差分を `git diff` で確認し、リーダブルな表を `docs/CORE_API.md` の末尾に添付。
2. `docs/MIGRATION_GUIDE.md` に CLI/DB/Proxy の移行パスを追記。
3. `tests/ui-scenarios.md` と `docs/TEST_STRATEGY.md` の該当テストを更新。
4. 変更を取り込む CLI/Proxy の PR では `cargo semver-checks` または `cargo public-api` で ABI 互換性を検証。

## 7. Changelog Template
```
## [1.0.1] - 2025-11-30
- fix: ProxyHandle.last_error を Optional<String> に修正 (#123)
- docs: MIGRATION_GUIDE.md に rollback 流れを追記 (#130)
```

## 8. Tooling
- `scripts/tag_core_api.sh` (TBD) でタグ作成と `docs/CORE_API.md` の `Updated:` を同期
- `cargo release` は `flm-core` / `flm-cli` / `flm-proxy` を同時に publish しない（社内配布のため）。タグのみで管理。
- `scripts/align_versions.rs` (TBD) で Core API 1.x 系と CLI/Proxy 1.x 系の突合せレポートを出力。

