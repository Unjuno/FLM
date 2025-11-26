# FLM Minimal Feature Specification
> Status: Canonical | Audience: Product & Engineering leads | Updated: 2025-11-20

## 1. 概要
- 対象: FLM 再構築版（Rust コア + 薄いアダプタ構成）
- 対象ユーザー: 個人利用・シングルユーザー環境（マルチユーザー/RBAC非対応）
- 目的: 既存インストール済み LLM エンジンを安全に外部公開できる最小構成を定義
- スコープ外: モデルダウンロード/削除、大規模監視、複雑な RBAC、Node/Express 依存機能

---

## 2. アーキテクチャ要件
- Rust コアライブラリがドメインロジック（エンジン抽象・セキュリティ・設定）を一元管理
- CLI / UI / Proxy は同じコアAPIを呼び出す薄いアダプタ。CLI を子プロセスとして UI が呼び出す構造は禁止
- Proxy も Rust (Axum/Hyper 等) で実装し、旧 Express 実装はアーカイブ
- エンジン抽象 `LlmEngine` が Ollama / LM Studio / vLLM / llama.cpp をプラガブルに扱う
- ネットワークモード: `local-http`（CLIデフォルト） / `https-acme`（インターネット公開時の既定） / `dev-selfsigned`（LAN/検証用途の例外的モード、手動インストール必要） / `packaged-ca`（Phase 3 で実装、パッケージ版の既定、証明書自動インストール）を提供
- 仕様詳細は `docs/specs/CORE_API.md`, `docs/specs/PROXY_SPEC.md`, `docs/specs/ENGINE_DETECT.md`, `docs/specs/DB_SCHEMA.md` に分割して管理

---

## 3. CLI 機能

| コマンド | 概要 | 備考 |
| --- | --- | --- |
| `flm engines detect` | エンジン状態（インストール/稼働/パス/バージョン）を JSON で返す | `--engine` で絞り込み、状態は `InstalledOnly`/`RunningHealthy` 等で返却 |
| `flm models list` | 利用可能モデル一覧を取得（読取専用） | Ollama: `/api/tags`, 他: `/v1/models` |
| `flm proxy start` | Rust製セキュアプロキシ起動 | `--mode local-http` / `--mode https-acme` / `--mode dev-selfsigned` / `--mode packaged-ca` (Phase 3) |
| `flm proxy stop` | プロキシ停止 | PID/ポート、Graceful shutdown |
| `flm proxy status` | 稼働中ハンドルの一覧取得 | `ProxyService::status` の結果を JSONで表示（mode/port/cert/uptime） |
| `flm config set/get/list` | 設定DB (`config.db`) 操作 | キー/値 or JSON ブロック |
| `flm api-keys create/list/revoke/rotate` | APIキー管理 | セキュリティDB (`security.db`) を使用 |
| `flm security policy` | IPホワイトリスト/CORS/レート制限設定の取得・更新 | Policy JSON を丸ごと取得・更新（差分は将来拡張） |
| `flm chat` (任意) | `/v1/chat/completions` を利用した疎通確認 | Rust Proxy経由のHTTPリクエストとして実行 |

テスト要件:
- すべてのコマンドにユニット＋統合テストを用意
- `proxy start`（local-http/https-acme）→ 応答確認 → `proxy stop` を CI ワークフローに組み込む

---

## 4. 認証プロキシ & セキュリティ
- Rust (Axum/Hyper) 実装。OpenAI互換 `/v1/*` とエンジン固有 `/engine/*` を明確に分離
- Forward 先ホストは検出済みエンジンに限定し、任意URLへの転送を禁止
- 認証: APIキー (Bearer) + IPホワイトリスト + CORS 制限 + レート制限（APIキー単位 & グローバル）を標準有効化
- APIキーはハッシュ＋ソルトで保存し、ローテーションと失効操作を提供
- ログ仕様: request_id, timestamp, client_id, engine, endpoint, latency(ms), status_code, error_type を JSON Lines で記録
- HTTPS/TLS: CLI デフォルトは `local-http`（ローカル利用向け）。インターネット公開時は `https-acme` を既定モードとし、`dev-selfsigned` は LAN / テスト / ドメイン非所持ユーザーに限定した暫定モードとして扱う（Wizard/CLI がルート証明書配布と撤去手順を案内）。Phase 3 のパッケージ版では `packaged-ca` を既定とし、インストール時に証明書が自動登録されるためブラウザ警告なしでHTTPS利用可能（大衆向け配布に最適）。
- SecurityPolicy は Phase1/2 ではグローバルに1件（ID=`"default"`）のみを扱う
- ルーティング、ストリーミング、ミドルウェア順序は `docs/specs/PROXY_SPEC.md` を参照

---

## 5. 設定・データ保存
- SQLite を用途別に分離し、同一ファイルへの競合を回避
  - `config.db`: 設定 (`settings`), エンジン検出キャッシュ (`engines_cache`), プロキシ設定 (`proxy_profiles`)
  - `security.db`: APIキー (`api_keys`), ポリシー (`security_policies`), 監査ログ (`audit_logs`)
- すべてのアクセスは Rust コアのリポジトリ層を経由（CLI/UIが直接 DB を触らない）
- 監査ログは tamper-resistant（直接削除不可、アーカイブコマンドのみ許可）

---

## 6. 最小 UI
- Tauri (React + Rust) がコアAPIを IPC 経由で呼び出し、CLI サブプロセスを使わない
- 画面構成:
  1. **Dashboard**: エンジン状態 / プロキシ状態 / セキュリティ警告
  2. **API Setup**: モデル選択、APIキー管理、ポリシー設定
  3. **Chat Tester**: `/v1/chat/completions` を用いた疎通確認
- **Setup Wizard (External Publish)**: Dashboard から起動できるステッパーで Proxy モード選択（パッケージ版は `packaged-ca` を既定、CLI版は `https-acme` を推奨、`dev-selfsigned` は開発用途）、SecurityPolicy 設定、Firewall コマンド自動生成を案内。Firewall スクリプトは `docs/guides/SECURITY_FIREWALL_GUIDE.md` に沿って自動/手動適用をサポート
- UI テスト: コンポーネント単位 + IPCモック、主要ユーザーフローを手動テスト記録

---

## 7. パッケージング
- CLI 単体: Windows/macOS/Linux 向けに `flm` バイナリを配布
- Desktop: Tauri アプリで CLI と同じ Rust コアをリンクし、単一インストーラを提供
- `packaged-ca` モードの実装:
  - ビルド時にルートCA証明書を生成し、インストーラに同梱
  - インストール時にOS信頼ストアへ自動登録（Windows: PowerShell, macOS/Linux: shell script）
  - サーバー証明書は起動時に自動生成（SANにRFC1918範囲を含める）
  - アンインストール時に証明書削除オプションを提供
- **セキュリティ対策**: パッケージングのセキュリティ対策（コード署名、ハッシュ値の公開、ビルド環境の保護、インストール時の検証、配布チャネルの保護）の詳細は `docs/specs/PROXY_SPEC.md` セクション10.6を参照。検証手順は `docs/guides/SECURITY_FIREWALL_GUIDE.md` セクション9を参照。
- README / SECURITY_POLICY / PLAN / CLI_SPEC / UI_MINIMAL を更新し、アーカイブ版との差分を明示

---

## 8. 非機能要件
- Rust コアの自動テストカバレッジ 80%以上
- CLI 起動: 2回目以降 < 1秒、初回は進捗表示を必須（DB初期化/証明書取得を区別）
- プロキシ起動: `local-http` モード < 2秒、`https-acme` は ACME 処理時間をログ出力し監視（90秒以内）、`packaged-ca` モード（Phase 3）は証明書が既にインストール済みのため < 3秒
- 依存ライブラリは Rust 標準 + 必須クレート（tokio / axum / hyper / openssl 等）に限定
- ログ出力はローカル JSON Lines のみにし、外部送信機能は Phase3 以降
- CI は Windows / Linux / macOS で CLI と Proxy の統合テストを実行
- Phase完了条件は `docs/planning/PLAN.md` のメトリクスを参照

---

## 9. 今後の拡張 (参考)
- リアルタイム監視ダッシュボード
- サードパーティ認証（OIDC 等）
- 追加エンジン (SGLang, LocalAI など)
- 分散構成・オートスケール

---

この機能書は `docs/planning/PLAN.md` と連動して定期的に更新する。

**関連ドキュメント**:
- `docs/planning/PLAN.md` - プロジェクト計画
- `docs/specs/CORE_API.md` - コアAPI仕様
- `docs/specs/CLI_SPEC.md` - CLI仕様
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様
- `docs/specs/UI_MINIMAL.md` - UI最小仕様

## Changelog

| バージョン | 日付 | 変更概要 |
|-----------|------|----------|
| `1.0.0` | 2025-11-20 | 初版公開。FLM再構築版の最小機能仕様を定義。CLI機能、認証プロキシ、セキュリティ、UI機能、Phase 3パッケージング計画を記載。 |

