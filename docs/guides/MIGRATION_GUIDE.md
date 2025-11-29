# Migration Guide
> Status: Draft | Audience: CLI / Ops engineers | Updated: 2025-11-20

Phase 0 完了前に旧 `archive/prototype/` 環境から新しい Rust 版へデータを移行する手順を定義する。

---

## 1. 対象と前提
- 旧バージョン: Node/Electron プロトタイプ (`archive/prototype/`)
- 新バージョン: Rust Core (`flm-core`) + SQLite (`config.db`, `security.db`)
- 対象データ:
  - `config.json`, `settings.sqlite`（設定・プロキシプロファイル）
  - `security.sqlite`（APIキー、認証設定）
  - プロキシ証明書 (`certs/`)
- 対応コマンド: `flm migrate legacy`
- OS サポート: Windows 11, macOS Sonoma, Ubuntu 22.04

## 2. ツール構成
```
crates/
  flm-cli/
    src/commands/migrate.rs
  flm-core/
    migrations/
      legacy/
        samples/
          config.json
          security.sqlite
```

## 3. 実行手順
現行実装では以下の 3 サブコマンドを提供しています（`README.md` 参照）。

1. **ドライラン（plan）**  
   ```
   flm migrate legacy plan --source /path/to/archive --tmp /tmp/flm-plan
   ```
   - コンソールに差分サマリを表示
   - `/tmp/flm-plan/migration-plan.json` に詳細レポートを出力
2. **変換（convert）**  
   ```
   flm migrate legacy convert --source /path/to/archive --tmp /tmp/flm-convert
   ```
   - `settings.json`, `proxy_profiles.json`, `api_keys.json` を生成
   - ログ: `logs/migrations/<ts>.log`
3. **適用（apply）**  
   ```
   flm migrate legacy apply --source /path/to/archive --confirm
   ```
   - 変換結果を本番 `config.db` / `security.db` に適用
   - `config.db.bak.<ts>`, `security.db.bak.<ts>` を自動生成してから書き込み

> **今後の拡張**: `backup`, `verify`, `rollback` サブコマンドは仕様ドラフト段階です。導入時は本ガイドと CLI SPEC を同時更新します。

## 4. マッピング仕様
| 旧データ | 新データ | 備考 |
|----------|----------|------|
| `settings.sqlite.engines` | `config.db.engines_cache` | エンジン状態を JSON で保持 |
| `security.sqlite.api_keys` (平文) | `security.db.api_keys` (`hash` を Argon2id で格納) | Argon2id (`m=19MiB, t=3, p=1`) |
| `config.json.proxy.port` | `config.db.proxy_profiles.port` | HTTPS は `port+1` を暗黙使用（`ProxyHandle.https_port` に記録） |
| `certs/*.pem` | `security.db.certificates` | ACME メタデータ + 実体ファイルパスを格納 |

詳細スキーマは `docs/specs/DB_SCHEMA.md` を参照。

## 5. 失敗シナリオ
| シナリオ | 検知方法 | CLI 挙動 |
|----------|----------|----------|
| 旧ファイルが見つからない | 入力検証 | エラー終了 (exit 1) + 詳細ログ |
| DB マイグレーション失敗 | `sqlx::migrate!()` | 自動ロールバックし、`RepoError::MigrationFailed` を CLI へ伝搬 |
| APIキー重複 | ハッシュ突合 | 新旧両方を残し、重複警告を表示 |
| ACME 証明書欠損 | ファイル参照失敗 | `ProxyProfile.acme_state = Missing` に設定し、再取得を案内 |

## 6. テスト
- 単体: `flm-core::legacy::converter::*`
- 統合: `cargo test -p flm-cli migrate::`（サンプルデータを `migrations/legacy/samples/` からロード）
- 手動: `tests/ui-scenarios.md#setup-wizard` に沿って UI から移行を実行

## 7. ドキュメント/ログ出力
- 成功時: `logs/migrations/<ts>.log`
- 失敗時: `logs/migrations/<ts>-error.log`
- サマリ: CLI が `Migration Summary` テーブルを表示（移行件数、スキップ件数、警告）

## 8. 保守
- サンプルデータは `archive/prototype/` の最新タグから 6 ヶ月ごとに更新
- 重大変更（Core API `MAJOR` 変更など）は ADR で承認し、本ガイドと `docs/specs/DB_SCHEMA.md` を同時更新

