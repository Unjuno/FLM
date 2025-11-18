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
- JSON 出力/IPCポリシー:
  - すべての JSON 出力は `{ "version": "1.0", "data": { ... } }` 形式で返し、`version` の major が変化した場合のみ breaking change とみなす。
  - CLI が UI/Proxy へ IPC で結果を渡す際は `serde` の `deny_unknown_fields` を避け、未知フィールドを無視できるよう `#[serde(default)]` を付与。これにより Core でフィールド追加しても下位互換を維持できる。
  - DTO スキーマは `docs/CORE_API.md` のデータモデルと 1:1 で対応させ、変更時は両ドキュメントを同じ変更セットで更新する。

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
{
  "version": "1.0",
  "data": {
    "status": "running",
    "mode": "local-http",
    "endpoint": "http://0.0.0.0:8080",
    "pid": 12345
  }
}
```

### 3.4 `flm proxy stop`
指定プロファイル/ポートのプロキシを停止し、Graceful shutdown を確認。

例:
```bash
flm proxy stop --port 8080
```

### 3.5 `flm proxy status`
現在稼働中のプロキシハンドル一覧を取得し、モード/ポート/ACME 情報を確認する。

- 出力: `ProxyService::status` が返すハンドル配列を JSON でそのまま表示（`id`, `mode`, `port`, `listen_addr`, `acme_domain`, `running`, `last_error` など）
- `--format text` の場合はテーブル表示
- ハンドルが存在しない場合は空配列

例:
```bash
flm proxy status --format text
```

### 3.6 `flm config`
`set` / `get` / `list` を提供。対象は `config.db`。

例:
```bash
flm config set proxy.port 8080
flm config get proxy.port
flm config list
```

### 3.7 `flm api-keys`
API キー生成・一覧・無効化・ローテーションを担当（`security.db`）。

例:
```bash
flm api-keys create --label default
flm api-keys list
flm api-keys revoke ak_xxxxx
flm api-keys rotate ak_xxxxx
```

### 3.8 `flm security policy`
IPホワイトリスト、CORS、レート制限設定の取得・更新。
Phase1/2 ではグローバルポリシー ID `"default"` のみを扱い、CLI から ID を指定する必要はない。

例:
```bash
flm security policy show
flm security policy set --json ./policy.json
```

### 3.9 `flm security backup`
`security.db` の暗号化済みバックアップと復元を扱う。`security.db` を直接コピーせず、暗号化キーと一貫性を保つためこのコマンドを必須とする。

サブコマンド:
- `flm security backup create --output <dir>`: 暗号化済み `security.db.bak.<timestamp>` を指定フォルダに出力（デフォルトは OS 設定ディレクトリ配下の `.../flm/backups/`）。3世代を超える場合は最古を削除。
- `flm security backup restore --file <path>`: アプリ停止を確認したうえで `.bak` を本番 `security.db` に復元し、マイグレーションを再実行。成功後は CLI が読み取り専用モード解除を案内。

すべての操作はジャーナルログに `request_id` を残し、ファイルパスは標準エラーに出力してユーザーが暗号化済みバックアップを管理できるようにする。

### 3.10 `flm chat`
`POST /v1/chat/completions` を通じて CLI から応答を確認（任意）。

要件:
- `--model` には `flm://{engine_id}/{model_name}` 形式を指定（`flm models list` の出力をそのまま利用）
- 互換性のため `--engine` + `--raw-model` を指定した場合は内部で `flm://` に変換（将来拡張）

例:
```bash
flm chat --model flm://ollama/llama3:8b --prompt "Hello"
flm chat --model flm://ollama/llama3:8b --prompt "Hello" --stream
```

### 3.11 `flm model-profiles` （Phase3予定）
モデルごとの詳細設定（`docs/UI_EXTENSIONS.md` セクション1）を CLI から管理する。

- `flm model-profiles list [--engine <id>] [--model <id>]`
- `flm model-profiles save --engine <id> --model <id> --label <name> --params ./profile.json`
- `flm model-profiles delete --id <profile_id>`

`profile.json` は `{"temperature":0.7,"max_tokens":512,...}` の形式で保存し、`config.db` の `model_profiles` テーブルに書き込む。CLI は `version` フィールドを自動付与し、UI/Proxy から呼び出せるよう Core API へ連携する。

### 3.12 `flm api prompts` （Phase3予定）
エンドポイント別プロンプトテンプレートを管理するコマンド。UI Extensions の API-specific prompt 管理と同一仕様。

- `flm api prompts list`
- `flm api prompts show --api-id <id>`
- `flm api prompts set --api-id <id> --file ./prompt.txt`

テンプレは `config.db` の `api_prompts` テーブルに保存し、`EngineService::chat` 呼び出し前に適用される。CLI は `version` と `updated_at` を保存し、後方互換のため JSON schema を `docs/CORE_API.md` と同期させる。

### 3.13 `flm migrate legacy`
アーカイブ済みプロトタイプ（`archive/prototype/`）からデータを新スキーマへ移行するユーティリティ。`docs/PLAN.md` / `docs/DB_SCHEMA.md` のデータ移行戦略と同じ手順を実行する。

- `flm migrate legacy --source <path> --tmp <dir>`: 旧 SQLite / JSON をパースし、`config.db` / `security.db` へ取り込むための `.sql` + `.json` を `<tmp>` に生成。デフォルトは `./tmp/flm-migrate-<timestamp>`。
- `flm migrate legacy --source <path> --apply`: 変換に加えて自動バックアップ（`flm security backup create` と同じロケーション）を取得し、検証後に本番 DB を置き換える。整合性チェックに失敗した場合は自動ロールバックして終了コード 1 を返す。

すべての実行は `logs/migrations/<timestamp>.log` に記録し、`--dry-run` オプションで差分のみ出力する。適用時にはユーザーに「アプリが停止しているか」を確認し、失敗時の復旧コマンドを案内する。

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
- `proxy status` で `ProxyService::status` のレスポンスを検証（起動前は空、起動後は mode/port/pid が一致、停止後に再び空になること）
- `security policy` コマンドでポリシーJSONの取得・全体更新を確認
- モック: Ollama API / OpenAI互換API を HTTP server mock で再現
- CI: Windows + Linux + macOS で CLI コマンド一式と Proxy 統合テストを実行

---

この仕様は `docs/PLAN.md` / `docs/FEATURE_SPEC.md` と連動し、コマンド実装前に更新する。

