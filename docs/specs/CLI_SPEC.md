# FLM CLI Specification
> Status: Canonical | Audience: CLI developers & QA | Updated: 2025-02-01
>
> **注意**: エラーハンドリングポリシーについては、セクション4「エラー仕様」と `docs/specs/UI_MINIMAL.md` セクション5「UX / エラーハンドリングポリシー」を参照してください。

> 章別リビジョン:
>
> | 節 | バージョン | 最終更新 |
> | --- | --- | --- |
> | 3.1-3.10 コマンド仕様 | v1.0.0 | 2025-11-20 |
> | 3.11-3.12 Phase 3実装済み | v1.0.0 | 2025-01-27 |
> | 3.13 Phase 3 Draft | Draft | 2025-11-25 |

## 1. 概要
- 実行形式: `flm` (Rust 製単体バイナリ)
- 対象ユーザー: 個人利用・シングルユーザー環境（マルチユーザー/RBAC非対応）。詳細な定義は`docs/guides/GLOSSARY.md`を参照。
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
- Proxy 制御系は `flm-proxy` バイナリを子プロセスとして常駐起動させる。CLI と同じディレクトリ、または `PATH` 上に `flm-proxy` が存在することが必須（`cargo install --path .` で両方導入する想定）。同梱インストーラは 2 バイナリを同一ディレクトリへ配置すること。
- JSON 出力/IPCポリシー:
  - すべての JSON 出力は `{ "version": "1.0", "data": { ... } }` 形式で返し、`version` の major が変化した場合のみ breaking change とみなす。
  - CLI が UI/Proxy へ IPC で結果を渡す際は `serde` の `deny_unknown_fields` を避け、未知フィールドを無視できるよう `#[serde(default)]` を付与。これにより Core でフィールド追加しても下位互換を維持できる。
  - DTO スキーマは `docs/specs/CORE_API.md` のデータモデルと 1:1 で対応させ、変更時は両ドキュメントを同じ変更セットで更新する。

## 3. コマンド一覧

### 3.1 `flm engines detect`
- 対応エンジンを検出して JSON を出力
- オプション: `--engine <name>` で限定検出（デフォルトは auto）、`--fresh` でキャッシュを無視
- 既定では `config.db` の `engines_cache` テーブルを最大5分間再利用。`--fresh` を指定するとキャッシュを削除して再度検出を実行し、検出結果は再び `engines_cache` に保存される。
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
- `dev-selfsigned`: 自己署名証明書で HTTPS を提供。LAN / 開発用途専用（Wizard/CLI がルート証明書の配布・削除手順を案内。手動インストールが必要）
- `packaged-ca`: パッケージに同梱されたルートCA証明書を使用。インストール時にOS信頼ストアへ自動登録されるため、ブラウザ警告なしでHTTPS利用可能。大衆向け配布に最適。**Status: Implemented（Phase 3完了）**。`--features packaged-ca`でビルドする必要があります。
- `https-acme`: ACME(Let's Encrypt等)で証明書を取得してHTTPS提供。インターネット公開時の既定モード。Phase 2 では HTTP-01 のみ提供し、DNS-01 自動化は将来の実装予定（Phase 3以降）。

その他仕様（詳細は `docs/specs/PROXY_SPEC.md`）:
- Forward 先ホストは検出済みエンジンに固定し任意URLへの転送を禁止
- 設定は `config.db` / `security.db` に保存され、再起動時に再利用
- **ポート設定**: HTTP待受ポート・デフォルト 8080、HTTPSは+1（詳細は `docs/specs/CORE_API.md` の `ProxyHandle` 定義を参照）

オプション:
- `--port <number>` (HTTP待受ポート・デフォルト 8080、HTTPSは+1。詳細は `docs/specs/CORE_API.md` の `ProxyHandle` 定義を参照)
- `--bind <address>` (バインドするIPアドレス・デフォルト "127.0.0.1"。外部アクセスが必要な場合のみ "0.0.0.0" を使用)
- `--acme-email`, `--acme-domain`（https-acmeモード必須）
- `--challenge http-01`（固定値。`dns-01` は CLI レベルで拒否される）
- `--dns-profile <id>`（**Reserved**: DNS-01 再開時まで非公開フラグの背後で無効化）
- `--lego-path <path>` / `--dns-propagation-wait <seconds>`（**Reserved**: DNS-01 再開時まで無効化）
- `--egress-mode <direct|tor|socks5>`（既定: `direct`。`tor` は `127.0.0.1:9050` を暗黙指定、`socks5` は任意エンドポイントを CLI から渡す）
- `--socks5-endpoint <host:port>`（`--egress-mode tor` の場合はオプション、`--egress-mode socks5` の場合は必須）
- `--egress-fail-open`（指定時のみ `ProxyConfig.egress.fail_open = true`。未指定は fail closed）
- `--no-daemon` (フォアグラウンド実行)
- デーモンモード（既定）: CLI が `flm-proxy --daemon` を起動し、127.0.0.1 上のランダムポートで管理 API を公開する。`%APPDATA%/flm/run/proxy-daemon.json`（macOS: `~/Library/Application Support/flm/run/`, Linux: `~/.local/share/flm/run/`）に `{ "port": <u16>, "token": "<bearer>", "pid": <u32> }` を保存し、Stop/Status 時はこのファイルを参照する。
- フォアグラウンドモード: `--no-daemon` 指定時のみ、旧来の「CLI プロセス内で Axum を起動する」手法を使用する。テスト用フラグであり、本番運用ではデーモンモードを必須とする。

ACMEエンドポイントは既定でLet's Encrypt **staging** を使用し、`FLM_ACME_USE_PROD=true` または `FLM_ACME_DIRECTORY=<url>` で切り替え可能。Phase 2 では `http-01` のみ `rustls-acme` ベースで提供し、`dns-01` を指定した場合は CLI がエラーを返す。DNS-01 自動化は将来の実装予定（Phase 3以降）。

成功時出力:
```json
{
  "version": "1.0",
  "data": {
    "status": "running",
    "mode": "local-http",
    "listen_addr": "0.0.0.0:8080",
    "endpoints": {
      "localhost": "http://localhost:8080",
      "local_network": "http://192.168.1.100:8080"
    },
    "pid": 12345,
    "egress": {
      "mode": "direct",
      "fail_open": false
    }
  }
}
```

- **Tor/上流プロキシ指定**:
  - `--egress-mode tor` は Tor Browser / tor daemon が提供する `127.0.0.1:9050` SOCKS5 を使用し、起動前に CLI が 3 回までハンドシェイクを試行する。接続失敗時は exit code 1（`PROXY_INVALID_CONFIG`）を返し、Tor を起動するようユーザーへ案内する。
  - `--egress-mode socks5` は任意の SOCKS5 プロキシ（例: 会社の出口ノード）を指定する。認証は Phase 4 で検討。現行フェーズでは匿名 SOCKS5 のみ。
  - `--egress-fail-open` を指定しない限り、Tor/上流プロキシに到達できない場合はプロキシを起動しない（`fail closed`）。`--egress-fail-open` を付けた場合は警告ログを出しつつ `Direct` にフォールバックする。
  - `flm proxy status` は `egress.mode` と実際の SOCKS5 endpoint（Tor の場合は `tor://127.0.0.1:9050` と表示）を含める。

**バイナリ配置要件**:
- CLI は `std::env::current_exe()` からの相対パス、または `PATH` 走査で `flm-proxy` を探す。どちらでも発見できない場合は直ちにエラーとし、インストール手順を案内する。
- 配布物は `flm` と `flm-proxy` を同一ディレクトリに配置すること。開発環境では `cargo install --path .` で 2 バイナリをまとめて導入する。

**エンドポイントURL表示の注意**:
- `listen_addr` は技術的なバインドアドレス（`0.0.0.0:8080`）であり、実際に使用するURLではない
- `endpoints` フィールドに、ユーザーが実際に使用可能なURLを提供:
  - `localhost`: ローカルアクセス用（`http://localhost:{port}` または `https://localhost:{https_port}`）
  - `local_network`: 同一ネットワーク内アクセス用（実際のローカルIPアドレスを使用）
  - `external`: 外部アクセス用（`acme_domain` が設定されている場合のみ、`https://{domain}:{https_port}`）
- 詳細は `docs/specs/CORE_API.md` の「ProxyHandle のユーザー向けエンドポイントURL生成」セクションを参照

### 3.4 `flm proxy stop`
指定プロファイル/ポートのプロキシを停止し、Graceful shutdown を確認。

- 実行手順:
  1. `proxy-daemon.json` を読み込み、デーモンが存在すれば `/admin/stop` へ RPC（`Authorization: Bearer <token>`）。
  2. デーモンが存在しない／応答しない場合のみ、CLI 内部で `ProxyService::status` を呼び出してフォアグラウンド起動中のハンドルを停止する。
  3. いずれのパスでも `--port` または `--handle-id` の指定が必須。

例:
```bash
flm proxy stop --port 8080
```

### 3.5 `flm proxy status`
現在稼働中のプロキシハンドル一覧を取得し、モード/ポート/ACME 情報を確認する。

- デーモン優先で `/admin/status` を呼び出し、見つからない場合のみローカルの `ProxyRepository` から状態を取得する。
- 出力: `ProxyService::status` が返すハンドル配列を JSON でそのまま表示（`id`, `mode`, `port`, `listen_addr`, `acme_domain`, `egress`, `running`, `last_error` など）
- `--format text` の場合はテーブル表示
- ハンドルが存在しない場合は空配列

例:
```bash
flm proxy status --format text
```

### 3.6 `flm config`
`set` / `get` / `list` を提供。対象は `config.db`。

**設定キー命名規則**:
- 形式: `<カテゴリ>.<設定名>`（ドット区切り）
- カテゴリ: `engine`（エンジン関連）、`proxy`（プロキシ関連）、`security`（セキュリティ関連）など
- 設定名: スネークケース（例: `health_latency_threshold_ms`、`max_network_failures`）
- 例: `engine.health_latency_threshold_ms`、`proxy.port`、`engine.max_network_failures`

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
Phase 1/2 ではグローバルポリシー ID `"default"` のみを扱い、CLI から ID を指定する必要はない。

例:
```bash
flm security policy show
flm security policy set --json ./policy.json
```

### 3.9 `flm security backup`
`security.db` のバックアップと復元を扱う。**注意**: 現在は暗号化は未実装のため、バックアップも暗号化されていない。将来的に暗号化が実装された際は、暗号化済みバックアップを提供する予定。`security.db` を直接コピーせず、将来的には暗号化キーと一貫性を保つためこのコマンドを必須とする。

サブコマンド:
- `flm security backup create --output <dir>`: `security.db.bak.<timestamp>` を指定フォルダに出力（デフォルトは OS 設定ディレクトリ配下の `.../flm/backups/`）。**注意**: 現在は暗号化は未実装のため、バックアップも暗号化されていない。将来的に暗号化が実装された際は、暗号化済みバックアップを提供する予定。3世代を超える場合は最古を削除。
- `flm security backup restore --file <path>`: アプリ停止を確認したうえで `.bak` を本番 `security.db` に復元し、マイグレーションを再実行。成功後は CLI が読み取り専用モード解除を案内。

すべての操作はジャーナルログに `request_id` を残し、ファイルパスは標準エラーに出力してユーザーが暗号化済みバックアップを管理できるようにする。

### 3.10 `flm chat`
`POST /v1/chat/completions` / `/v1/responses` を通じて CLI から応答を確認（任意）。マルチモーダル入力を CLI から直接添付できる。

要件:
- `--model` には `flm://{engine_id}/{model_name}` 形式を指定（`flm models list` の出力をそのまま利用）
- 互換性のため `--engine` + `--raw-model` を指定した場合は内部で `flm://` に変換（将来拡張）
- Vision/Audio 添付は `EngineCapabilities` を参照する。未対応モデルに `--image` / `--audio` を渡すと CLI 側で即座に `unsupported_modalities` を返す。

オプション:
- `--prompt "<text>"`: 既定本文。複数行は `--prompt-file`.
- `--prompt-file path`: ファイルから System/User メッセージを読み込む。
- `--image path` (複数指定可): 画像ファイルを Base64 化し、`content[].type = "input_image"` として添付。`--image-url` と混在可。
- `--image-url https://...`: Proxy がフェッチする HTTP(S) URL を添付。
- `--audio path`: 音声ファイルを `input_audio` として添付。WAV/MP3/FLAC/OGG/M4A, ≤25MB。
- `--json`: レスポンスを OpenAI 互換 JSON でそのまま `stdout` に出力（既定は抽出済みテキストのみ）。
- `--responses`: `/v1/responses` を強制使用。`--modalities text,audio` と併用し音声出力を要求できる。
- `--modalities text[,audio]`: Responses API の `modalities` を指定。`audio` 要求時は `--responses` が暗黙で有効化される。
- `--save-audio path`: `--modalities` に `audio` を含めた場合、Base64 で返る音声をファイルに保存。

例:
```bash
# Vision入力を1枚添付
flm chat --model flm://lmstudio/llava --image ./tests/assets/cat.png --prompt "Describe the image"

# 複数画像 + 生SSE
flm chat --model flm://ollama/gemma3-vision --image foo.png --image bar.jpg --stream

# Responses API 経由で音声出力
flm chat --model flm://vllm/gpt-4o-mini --responses --modalities text,audio --prompt "Summarize"
```

### 3.11 `flm model-profiles`
> Status: Implemented（Phase 3完了）。実装日: 2025-01-27。実装内容は `docs/planning/CLI_UPCOMING_COMMANDS.md` を参照。
モデルごとの詳細設定（`docs/specs/UI_EXTENSIONS.md` セクション1）を CLI から管理する。

- `flm model-profiles list [--engine <id>] [--model <id>]`
- `flm model-profiles save --engine <id> --model <id> --label <name> --params ./profile.json`
- `flm model-profiles delete --id <profile_id>`

`profile.json` は `{"temperature":0.7,"max_tokens":512,...}` の形式で保存し、`config.db` の `model_profiles` テーブルに書き込む。CLI は `version` フィールドを自動付与し、UI/Proxy から呼び出せるよう Core API へ連携する。

### 3.12 `flm api prompts`
> Status: Implemented（Phase 3完了）。実装日: 2025-01-27。CLI/UI連携仕様は `docs/specs/UI_EXTENSIONS.md` を参照。
エンドポイント別プロンプトテンプレートを管理するコマンド。UI Extensions の API-specific prompt 管理と同一仕様。

- `flm api prompts list`
- `flm api prompts show --api-id <id>`
- `flm api prompts set --api-id <id> --file ./prompt.txt`
- `flm api prompts delete --api-id <id>`

テンプレは `config.db` の `api_prompts` テーブルに保存し、`EngineService::chat` 呼び出し前に適用される。CLI は `version` と `updated_at` を保存し、後方互換のため JSON schema を `docs/specs/CORE_API.md` と同期させる。`delete` サブコマンドは `api_id` に一致するテンプレートを削除し、存在しない場合はユーザーエラーを返す。

### 3.13 `flm migrate legacy`
> Status: Draft（Phase 3対象）。実装の優先度と完了条件は `docs/planning/PLAN.md` の Phase 3 ロードマップに従う。
アーカイブ済みプロトタイプ（`archive/prototype/`）からデータを新スキーマへ移行するユーティリティ。`docs/planning/PLAN.md` / `docs/specs/DB_SCHEMA.md` のデータ移行戦略と同じ手順を実行する。

- `flm migrate legacy plan --source <path> [--tmp <dir>]`: 旧 SQLite / JSON を解析し、移行計画 (`migration-plan.json`) を `<tmp>`（省略時は `./tmp/flm-migrate-<timestamp>`）へ出力。
- `flm migrate legacy convert --source <path> [--tmp <dir>]`: 設定・APIキー・プロキシプロファイルを JSON 化し、`config.db` / `security.db` に取り込むための成果物を生成。
- `flm migrate legacy apply --source <path> [--tmp <dir>] --confirm`: `convert` に加えて自動バックアップ（`config.db.bak.<timestamp>` / `security.db.bak.<timestamp>`）を取得し、検証後に本番 DB を置き換える。`--confirm` が無い場合は実行を中止する。

すべての実行は `logs/migrations/<timestamp>.log` に記録する。`plan` は差分のみ出力し、`apply` は成功/失敗を CLI とログの両方に書き込む。適用時にはアプリを停止した状態で行う旨をユーザーへ案内する。

**今後の拡張**: `backup`、`verify`、`rollback` サブコマンドは仕様ドラフト段階です。導入時は本ガイド（`docs/guides/MIGRATION_GUIDE.md`）と CLI SPEC を同時更新します。

### 3.14 `flm check`
データベースの整合性を検証し、APIキー件数/ラベル、SecurityPolicy の JSON、ProxyProfile のポート値などが期待通りであることを確認する。移行後や復旧後に実行してデータの整合性を保証する。

- `flm check`: `config.db` と `security.db` の整合性をチェックし、問題があれば詳細を JSON で出力（exit code 1）。正常時は `{"version":"1.0","data":{"status":"ok","checks":[...]}}` を返す。
- `flm check --verbose`: 各チェック項目の詳細を表示（テーブル存在確認、制約違反、参照整合性など）。

**エラーレスポンス形式**: エラー時は `{"error":{...}}` 形式を返す（`version`フィールドは含めない）。エラーオブジェクトの詳細な構造（`code`、`message`、`request_id`など）については、`docs/specs/PROXY_SPEC.md` セクション7.2「エラーレスポンス形式」を参照してください。

例:
```bash
flm check
flm check --verbose
```

## 4. エラー仕様

**統一的なエラーハンドリングポリシー**: CLIとProxyは共通のエラーレスポンス形式を使用します。詳細は `docs/specs/PROXY_SPEC.md` セクション7.2を参照してください。

- 共通形式: 成功時は `{"version":"1.0","data":{...}}` 形式だが、エラー時は `{"error":{...}}` 形式を返す（意図的な設計）。エラーレスポンスには `version` フィールドは含めない（成功時とエラー時で形式を区別するため）。
- エラーオブジェクトの構造:
  - `code`: エラーコード（文字列、必須）
  - `message`: 人間が読めるエラーメッセージ（文字列、必須）
  - `request_id`: リクエストID（文字列、オプション、ログ追跡用）

```json
{"error":{"code":"ENGINE_NOT_FOUND","message":"Ollama is not installed"}}
```
- 主なコードと Core API エラー型の対応:

| CLI エラーコード | Core API エラー型 | 説明 | Exit Code |
|-----------------|------------------|------|-----------|
| `ENGINE_NOT_FOUND` | `EngineError::NotFound` | 指定エンジンが検出されない | 1 |
| `ENGINE_NETWORK_ERROR` | `EngineError::NetworkError` | エンジンへの接続失敗 | 1 |
| `ENGINE_API_ERROR` | `EngineError::ApiError` | エンジン API の応答エラー | 1 |
| `ENGINE_TIMEOUT` | `EngineError::Timeout` | エンジン操作のタイムアウト | 1 |
| `PROXY_ALREADY_RUNNING` | `ProxyError::AlreadyRunning` | プロキシが既に起動中 | 1 |
| `PROXY_PORT_IN_USE` | `ProxyError::PortInUse` | 指定ポートが使用中 | 1 |
| `PROXY_CERT_FAILED` | `ProxyError::CertGenerationFailed` | 証明書生成失敗 | 1 |
| `PROXY_ACME_ERROR` | `ProxyError::AcmeError` | ACME 証明書取得失敗 | 1 |
| `PROXY_INVALID_CONFIG` | `ProxyError::InvalidConfig` | プロキシ設定が無効 | 1 |
| `POLICY_INVALID` | `RepoError::ConstraintViolation` | セキュリティポリシーの JSON スキーマ違反 | 1 |
| `CONFIG_NOT_SET` | `RepoError::NotFound` | 設定キーが存在しない | 1 |
| `DB_ERROR` | `RepoError::*` | データベース操作エラー（マイグレーション失敗含む） | 2 |
| `MIGRATION_FAILED` | `RepoError::MigrationFailed` | DB マイグレーション失敗 | 2 |
| `IO_ERROR` | `RepoError::IoError` | ファイル I/O エラー | 2 |

- エラーコードは `docs/specs/CORE_API.md` のエラー型定義と 1:1 で対応し、CLI は Core のエラーを適切なコードに変換する。

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

**関連ドキュメント**:
- `docs/specs/CORE_API.md` - コアAPI仕様（CLIが使用するAPI）
- `docs/planning/PLAN.md` - プロジェクト計画
- `docs/specs/FEATURE_SPEC.md` - 機能仕様
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様
- `docs/specs/ENGINE_DETECT.md` - エンジン検出仕様
- `docs/specs/DB_SCHEMA.md` - データベーススキーマ

## Changelog

| バージョン | 日付 | 変更概要 |
|-----------|------|----------|
| `1.0.0` | 2025-11-20 | 初版公開。主要CLIコマンド（engines, models, proxy, api-keys, config, security）の仕様を定義。 |
