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
| `api_keys`          | `id TEXT PRIMARY KEY, label TEXT UNIQUE, hash TEXT UNIQUE, created_at, revoked_at DATETIME` |
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

- `security.db` は OS のユーザーディレクトリに保存し、権限を 600 相当に設定（Windows ACL / Unix chmod）
- API キーはハッシュ（Argon2）で保存し、平文キーは表示後即破棄
- 監査ログは tamper-resistant（DELETE 禁止、アーカイブコマンドで別ファイルに移動）

