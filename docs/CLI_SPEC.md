# FLM CLI Specification
> Status: Canonical | Audience: CLI developers & QA | Updated: 2025-11-18

## 1. 概要
- 実行形式: `flm` (Rust 製単体バイナリ)
- 目的: 既存エンジン検出、モデル参照、Rust製セキュアプロキシ制御、設定/セキュリティ管理を CLI で提供
- 対応エンジン: Ollama / LM Studio / vLLM / llama.cpp
- 依存: SQLite (`config.db`, `security.db`)、Rust コアライブラリ、対象エンジン本体

```
flm <command> [subcommand] [options]
```

## 2. 共通仕様
- Exit code: `0` 正常、`1` ユーザーエラー、`2` 内部エラー
- 出力: デフォルト JSON（`--format text` で人間向け表示）
- `--db-path-config`, `--db-path-security` で DB パス上書き可能（省略時は既定）
- ログ: `stderr` に INFO/ERROR をJSON Linesで出力、`stdout` は純粋な結果

## 3. コマンド一覧

### 3.1 `flm engines detect`
- 対応エンジンを検出して JSON を出力
- オプション: `--engine <name>` で限定検出（デフォルトは auto）、`--fresh` でキャッシュを無視
- 出力には `status` フィールド（`InstalledOnly` / `RunningHealthy` / `RunningDegraded` / `ErrorNetwork` / `ErrorApi`）と `latency_ms` が含まれる
- 例:
```bash
flm engines detect --format json
```

### 3.2 `flm models list`
- 接続先エンジンからモデル一覧を取得（Ollama: `/api/tags`, その他: `/v1/models`）
- モデルIDは `flm://{engine_id}/{model_name}` に正規化され、Proxy/CLI/UIで共通利用
- 例:
```bash
flm models list --engine ollama --format text
```

### 3.3 `flm proxy start`
Rust製セキュアプロキシを起動し、Forward先を検出済みエンジンに固定。

モード:
- `local-http` (デフォルト): ローカルネットワーク限定。TLS 無し
- `dev-selfsigned`: 自己署名証明書で HTTPS を提供。ドメインを持たないユーザー向けの標準公開モード
- `https-acme`: ACME(Let's Encrypt等)で証明書を取得してHTTPS提供（カスタムドメイン所有者向け）

その他仕様（詳細は `docs/PROXY_SPEC.md`）:
- Forward 先ホストは検出済みエンジンに固定し任意URLへの転送を禁止
- 設定は `config.db` / `security.db` に保存され、再起動時に再利用

オプション:
- `--port <number>` (HTTP待受ポート・デフォルト 8080、HTTPSは+1)
- `--engine-base-url <url>` (デフォルトは検出結果)
- `--acme-email`, `--acme-domain`（https-acmeモード必須）
- `--no-daemon` (フォアグラウンド実行)

成功時出力:
```json
{"status":"running","mode":"local-http","endpoint":"http://0.0.0.0:8080","pid":12345}
```

### 3.4 `flm proxy stop`
指定プロファイル/ポートのプロキシを停止し、Graceful shutdown を確認。

例:
```bash
flm proxy stop --port 8080
```

### 3.5 `flm config`
`set` / `get` / `list` を提供。対象は `config.db`。

例:
```bash
flm config set proxy.port 8080
flm config get proxy.port
flm config list
```

### 3.6 `flm api-keys`
API キー生成・一覧・無効化・ローテーションを担当（`security.db`）。

例:
```bash
flm api-keys create --label default
flm api-keys list
flm api-keys revoke ak_xxxxx
flm api-keys rotate ak_xxxxx
```

### 3.7 `flm security policy`
IPホワイトリスト、CORS、レート制限設定の取得・更新。
Phase1/2 ではグローバルポリシー ID `"default"` のみを扱い、CLI から ID を指定する必要はない。

例:
```bash
flm security policy show
flm security policy set --json ./policy.json
```

### 3.8 `flm chat`
`POST /v1/chat/completions` を通じて CLI から応答を確認（任意）。

要件:
- `--model` には `flm://{engine_id}/{model_name}` 形式を指定（`flm models list` の出力をそのまま利用）
- 互換性のため `--engine` + `--raw-model` を指定した場合は内部で `flm://` に変換（将来拡張）

例:
```bash
flm chat --model flm://ollama/llama3:8b --prompt "Hello"
flm chat --model flm://ollama/llama3:8b --prompt "Hello" --stream
```

## 4. エラー仕様
- 共通形式:
```json
{"error":{"code":"ENGINE_NOT_FOUND","message":"Ollama is not installed"}}
```
- 主なコード:
  - `ENGINE_NOT_FOUND`
  - `PROXY_ALREADY_RUNNING`
  - `POLICY_INVALID`
  - `CERT_GENERATION_FAILED`
  - `CONFIG_NOT_SET`
  - `DB_ERROR`

## 5. SQLite 設定
- 既定パス:
  - Windows: `%APPDATA%\\flm\\config.db`, `%APPDATA%\\flm\\security.db`
  - macOS: `~/Library/Application Support/flm/config.db`, `.../security.db`
  - Linux: `~/.config/flm/config.db`, `~/.config/flm/security.db`
- CLI 起動時に存在チェックとマイグレーションを実行

## 6. テスト要件
- ユニット: 設定/セキュリティリポジトリ、エンジン検出、APIキー生成、ポリシー更新
- 統合:
  - `proxy start --mode local-http` → 応答確認 → `proxy stop`
  - `proxy start --mode dev-selfsigned` で TLS ハンドシェイク確認
- `security policy` コマンドでポリシーJSONの取得・全体更新を確認
- モック: Ollama API / OpenAI互換API を HTTP server mock で再現
- CI: Windows + Linux + macOS で CLI コマンド一式と Proxy 統合テストを実行

---

この仕様は `docs/PLAN.md` / `docs/FEATURE_SPEC.md` と連動し、コマンド実装前に更新する。

