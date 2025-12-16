# SQLite Schema & Migration Strategy
> Status: Canonical | Audience: Persistence / CLI engineers | Updated: 2025-02-01

## 1. ツール

- `sqlx` を採用し、`flm-core` の `migrations/` ディレクトリに SQL ファイルを格納（Domain 層は `sqlx::migrate!()` を呼ぶだけで、実際の DB 接続は Adapter 層が実装する）
- `sqlx::migrate!()` を `EngineService::new()` / `SecurityService::new()` / `ProxyService::new()` で呼び出し、アプリ起動時に常に適用
- `--no-migrate` フラグは将来のために予約（現状は常に migration を実行）

## 2. スキーマ

### `config.db`

| テーブル            | 説明                                              |
|---------------------|---------------------------------------------------|
| `schema_migrations` | SQLx 管理テーブル                                 |
| `settings`          | `key TEXT PRIMARY KEY, value TEXT, updated_at, notes TEXT` （`notes` は移行時の未知フィールド保存用）。使用例: `preferred_language`（I18N設定、`docs/specs/I18N_SPEC.md`参照） |
| `engines_cache`     | 検出結果キャッシュ。`engine_id`, `state_json`, `cached_at` |
| `proxy_profiles`    | 過去のプロキシ設定 (`id`, `config_json`, `created_at`) |

### `security.db`

| テーブル            | 説明                                                           |
|---------------------|----------------------------------------------------------------|
| `schema_migrations` | SQLx 管理テーブル                                              |
| `api_keys`          | `id TEXT PRIMARY KEY, label TEXT, hash TEXT UNIQUE, created_at, revoked_at DATETIME` |
| `security_policies` | `id TEXT PRIMARY KEY CHECK(id = 'default'), policy_json TEXT, updated_at`            |
| `audit_logs`        | `id INTEGER PK, request_id TEXT, api_key_id TEXT, endpoint TEXT, engine_id TEXT, client_ip TEXT, status INTEGER, latency_ms INTEGER, error_type TEXT, created_at DATETIME` |
| `rate_limit_states` | レート制限の状態を保持（リセット可能）                         |
| `certificates`      | ACME/自己署名証明書のメタデータ（パス、更新日時）。`packaged-ca` モードのサーバー証明書メタデータも保存 |

## 3. マイグレーションの実行タイミング

- CLI 起動 (`flm-cli`)：`EngineService::new()` で `config.db`、`SecurityService::new()` で `security.db` の migration を実行
- Proxy 起動 (`flm-proxy`)：サーバ起動前に両 DB の migration を実行。失敗した場合は起動を中止
- UI 起動（Tauri）：バックエンドの Rust コマンドで同様に migration を実行

## 4. バージョン管理

- migration ファイル命名例: `migrations/20250101_create_settings.sql`
- `docs/specs/DB_SCHEMA.md` には最新版の schema を常に記載し、差分が生じたら migration ファイルを追加
- Phase 1/2では `security_policies` に `id = "default"` の1行のみを保持し、初期化時に空ポリシーを挿入する

## 5. データ保護

- `security.db` は OS のユーザーディレクトリに保存し、権限を 600 相当に設定（Windows ACL / Unix chmod）。**注意**: 現在は暗号化は未実装（将来実装予定）。将来的には暗号化キーを OS キーチェーン (DPAPI / Keychain / libsecret) に格納し、アプリ起動時に取得→プロセスメモリ上でのみ展開する予定。詳細な要件（鍵ローテーション、バックアップ、マイグレーション失敗時の動作等）は `docs/planning/PLAN.md` の「security.db ガバナンス」セクションを参照。
- API キーはハッシュ（Argon2id）で保存し、平文キーは表示後即破棄。**注意**: `security.db` の暗号化は未実装のため、現在は暗号化キーのローテーションは不要。将来的に暗号化が実装された際は、ローテーション手順は (1) 新DBを新キーで初期化 → (2) 旧DBを復号しながら migrate → (3) 成功後に旧ファイルを secure delete → (4) バックアップを更新。
- 監査ログは tamper-resistant（DELETE 禁止、アーカイブコマンドで別ファイルに移動）。Elevated firewall 操作など長文ログはファイル (`logs/security/firewall-*.log`) に出力し、`audit_logs` には request_id / endpoint 等のメタデータのみ保存。
- 自動バックアップ: `security.db` バックアップを OS ごとの設定ディレクトリ配下（例: `~/.config/flm/backups/security.db.bak.<timestamp>`、Windows は `%APPDATA%\\flm\\backups\\...`）に 3 世代保持する。**注意**: 現在は暗号化は未実装のため、バックアップも暗号化されていない。将来的に暗号化が実装された際は、暗号化済みバックアップを提供する予定。バックアップの取得/削除ポリシーは CLI `flm security backup/restore` コマンドと共通で、ファイル名は `security.db.bak.<UTC timestamp>` に統一する。復旧時はアプリを停止してから `.bak` を復元し、その後 migrate を再実行。
- マイグレーション失敗時は読み取り専用モードで起動し、CLI/UI は APIキー・ポリシー変更をブロックして復旧手順を提示。読み取り専用モードでのログは警告として収集する。

## 6. レガシーデータ移行 / 復旧

> **注意**: データ移行戦略の詳細は `docs/planning/PLAN.md` セクション「データ移行戦略」を参照してください。`flm migrate legacy` コマンドの詳細は `docs/specs/CLI_SPEC.md` セクション3.13を参照してください。
- `flm migrate legacy --source <path>` が旧 `archive/prototype` から JSON/SQLite を取り込み、以下の順に変換する:
  1. `config.json` → `settings` / `proxy_profiles`。未知フィールドは `notes` 列に JSON として保存し、後から手動確認できるようにする。
  2. 旧 API キーを Argon2id で再ハッシュし、`revoked` フラグを日時に変換。
  3. SecurityPolicy を Phase 1/2 の JSON スキーマにマッピング（IP/CORS/RateLimit を正規化）。
- 変換結果は一時ディレクトリに `.sql` / `.json` で吐き出し、ユーザー確認後に `--apply` で本番 DB に反映。適用前には必ず自動バックアップを取得する。
- 復旧手順: CLI `flm security backup restore --file <bak>` で暗号化バックアップを戻し → `sqlx::migrate!()` を再実行 → `flm check` で整合性を確認。バックアップと実 DB のバージョンが不一致の場合は復元を中断し、ユーザーへ警告する。

## 7. Post-MVP スキーマ（UI拡張向け）

以下のテーブルは実装済み（2025-01-27実装完了）。詳細は `docs/planning/CLI_UPCOMING_COMMANDS.md` を参照。

| テーブル | 用途 | 主要カラム |
|----------|------|------------|
| `model_profiles` | モデル別プロファイル保存（UI「モデル詳細設定パネル」向け） | `id TEXT PRIMARY KEY`, `engine_id TEXT`, `model_id TEXT`, `label TEXT`, `parameters_json TEXT`, `version INTEGER DEFAULT 1`, `modalities TEXT`, `vision_prompt TEXT`, `audio_prompt TEXT`, `updated_at DATETIME` |
| `api_prompts` | APIごとのテンプレート管理（UI「API個別プロンプトテンプレート」向け） | `api_id TEXT PRIMARY KEY`, `template_text TEXT`, `version INTEGER DEFAULT 1`, `modalities TEXT`, `vision_prompt TEXT`, `audio_prompt TEXT`, `updated_at DATETIME` |
| `multimodal_settings` | マルチモーダル機能設定（UI/CLI共通） | `id TEXT PRIMARY KEY DEFAULT 'default'`, `enable_vision BOOLEAN`, `enable_audio BOOLEAN`, `max_image_size_mb INTEGER`, `max_audio_size_mb INTEGER`, `default_modalities TEXT` |

- どちらのテーブルも `config.db` に配置し、`EngineService` / `ConfigService` からアクセスする。
- バージョニング: `model_profiles.version`, `api_prompts.version` を設け、今後の schema 変更時に後方互換を確保。
- CLI コマンド (`flm model-profiles`, `flm api prompts …`) は実装済み。詳細は `docs/specs/CLI_SPEC.md` セクション3.11-3.12を参照。

---

**関連ドキュメント**:
- `docs/specs/CORE_API.md` - コアAPI仕様
- `docs/specs/CLI_SPEC.md` - CLI仕様
- `docs/guides/MIGRATION_GUIDE.md` - 移行ガイド

## Changelog

| バージョン | 日付 | 変更概要 |
|-----------|------|----------|
| `v1.0.0` | 2025-11-20 | 初版公開。`config.db` と `security.db` のスキーマ定義、マイグレーション戦略、データ保護方針を定義。 |

