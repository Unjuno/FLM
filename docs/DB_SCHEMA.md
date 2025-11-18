# SQLite Schema & Migration Strategy
> Status: Canonical | Audience: Persistence / CLI engineers | Updated: 2025-11-18

## 1. ツール

- `sqlx` を採用し、`flm-core` の `migrations/` ディレクトリに SQL ファイルを格納（Domain 層は `sqlx::migrate!()` を呼ぶだけで、実際の DB 接続は Adapter 層が実装する）
- `sqlx::migrate!()` を `EngineService::new()` / `SecurityService::new()` / `ProxyService::new()` で呼び出し、アプリ起動時に常に適用
- `--no-migrate` フラグは将来のために予約（現状は常に migration を実行）

## 2. スキーマ

### `config.db`

| テーブル            | 説明                                              |
|---------------------|---------------------------------------------------|
| `schema_migrations` | SQLx 管理テーブル                                 |
| `settings`          | `key TEXT PRIMARY KEY, value TEXT, updated_at`    |
| `engines_cache`     | 検出結果キャッシュ。`engine_id`, `state_json`, `cached_at` |
| `proxy_profiles`    | 過去のプロキシ設定 (`id`, `config_json`, `created_at`) |

### `security.db`

| テーブル            | 説明                                                           |
|---------------------|----------------------------------------------------------------|
| `schema_migrations` | SQLx 管理テーブル                                              |
| `api_keys`          | `id TEXT PRIMARY KEY, label TEXT, hash TEXT UNIQUE, created_at, revoked_at DATETIME` |
| `security_policies` | `id TEXT PRIMARY KEY CHECK(id = 'default'), policy_json TEXT, updated_at`            |
| `audit_logs`        | `id INTEGER PK, request_id TEXT, api_key_id TEXT, endpoint TEXT, status INTEGER, latency_ms INTEGER, created_at DATETIME` |
| `rate_limit_states` | レート制限の状態を保持（リセット可能）                         |
| `certificates`      | ACME/自己署名証明書のメタデータ（パス、更新日時）              |

## 3. マイグレーションの実行タイミング

- CLI 起動 (`flm-cli`)：`EngineService::new()` で `config.db`、`SecurityService::new()` で `security.db` の migration を実行
- Proxy 起動 (`flm-proxy`)：サーバ起動前に両 DB の migration を実行。失敗した場合は起動を中止
- UI 起動（Tauri）：バックエンドの Rust コマンドで同様に migration を実行

## 4. バージョン管理

- migration ファイル命名例: `migrations/20250101_create_settings.sql`
- `docs/DB_SCHEMA.md` には最新版の schema を常に記載し、差分が生じたら migration ファイルを追加
- Phase1/2では `security_policies` に `id = "default"` の1行のみを保持し、初期化時に空ポリシーを挿入する

## 5. データ保護

- `security.db` は OS のユーザーディレクトリに保存し、権限を 600 相当に設定（Windows ACL / Unix chmod）。暗号化キーは OS キーチェーン (DPAPI / Keychain / libsecret) に格納し、アプリ起動時に取得→プロセスメモリ上でのみ展開。キーをファイルに書き出さない。
- API キーはハッシュ（Argon2）で保存し、平文キーは表示後即破棄。`security.db` の暗号化キーをローテーションする際は (1) 新DBを新キーで初期化 → (2) 旧DBを復号しながら migrate → (3) 成功後に旧ファイルを secure delete → (4) バックアップを更新。
- 監査ログは tamper-resistant（DELETE 禁止、アーカイブコマンドで別ファイルに移動）。Elevated firewall 操作など長文ログはファイル (`logs/security/firewall-*.log`) に出力し、`audit_logs` には request_id / endpoint 等のメタデータのみ保存。
- 自動バックアップ: `security.db` 暗号化済みバックアップを OS ごとの設定ディレクトリ配下（例: `~/.config/flm/backups/security.db.bak.<timestamp>`、Windows は `%APPDATA%\\flm\\backups\\...`）に 3 世代保持する。バックアップの取得/削除ポリシーは CLI `flm security backup/restore` コマンドと共通で、ファイル名は `security.db.bak.<UTC timestamp>` に統一する。復旧時はアプリを停止してから `.bak` を復元し、その後 migrate を再実行。
- マイグレーション失敗時は読み取り専用モードで起動し、CLI/UI は APIキー・ポリシー変更をブロックして復旧手順を提示。読み取り専用モードでのログは警告として収集する。

## 6. レガシーデータ移行 / 復旧
- `flm migrate legacy --source <path>` が旧 `archive/prototype` から JSON/SQLite を取り込み、以下の順に変換する:
  1. `config.json` → `settings` / `proxy_profiles`。未知フィールドは `notes` 列に JSON として保存し、後から手動確認できるようにする。
  2. 旧 API キーを Argon2 で再ハッシュし、`revoked` フラグを日時に変換。
  3. SecurityPolicy を Phase1/2 の JSON スキーマにマッピング（IP/CORS/RateLimit を正規化）。
- 変換結果は一時ディレクトリに `.sql` / `.json` で吐き出し、ユーザー確認後に `--apply` で本番 DB に反映。適用前には必ず自動バックアップを取得する。
- 復旧手順: CLI `flm security backup restore --file <bak>` で暗号化バックアップを戻し → `sqlx::migrate!()` を再実行 → `flm check` で整合性を確認。バックアップと実 DB のバージョンが不一致の場合は復元を中断し、ユーザーへ警告する。

## 7. Post-MVP スキーマ（UI拡張向け）
Phase3 以降に実装する UI Extensions に備えて、以下のテーブルを追加予定。実装時は `docs/UI_EXTENSIONS.md` に記載された機能と同期し、マイグレーションを追加する。

| テーブル | 用途 | 主要カラム |
|----------|------|------------|
| `model_profiles` | モデル別プロファイル保存（UI「モデル詳細設定パネル」向け） | `id TEXT PRIMARY KEY`, `engine_id TEXT`, `model_id TEXT`, `label TEXT`, `parameters_json TEXT`, `updated_at DATETIME` |
| `api_prompts` | APIごとのテンプレート管理（UI「API個別プロンプトテンプレート」向け） | `api_id TEXT PRIMARY KEY`, `template_text TEXT`, `updated_at DATETIME`, `version INTEGER DEFAULT 1` |

- どちらのテーブルも `config.db` に配置し、`EngineService` / `ConfigService` からアクセスする。
- バージョニング: `model_profiles.version`, `api_prompts.version` を設け、今後の schema 変更時に後方互換を確保。
- CLI コマンド (`flm model-profiles`, `flm api prompts …`) と同時に導入し、Phase3 ブランチでマイグレーションファイルを追加する。追加前に `docs/CLI_SPEC.md` を更新して利用方法を定義すること。

