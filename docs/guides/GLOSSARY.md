# FLM Glossary

> Status: Reference | Audience: All contributors | Updated: 2025-02-01

このドキュメントは、FLMプロジェクトで使用される主要な用語の定義をまとめたものです。

## A

### ACME (Automatic Certificate Management Environment)
Let's Encryptなどの証明書発行機関（CA）から自動的にTLS証明書を取得するためのプロトコル。FLMでは`https-acme`モードで使用される。

### API Key
FLM Proxyへのアクセスを認証するためのキー。Argon2idでハッシュ化されて`security.db`に保存される。

### AppState
Axumベースのプロキシサーバーで使用されるアプリケーション状態。`SecurityService`、`EngineService`、レート制限状態などを保持する。

## C

### ChatRequest
`EngineService::chat()`や`EngineService::chat_stream()`に渡されるチャットリクエスト。エンジンID、モデルID、メッセージ配列、ストリーミングフラグなどを含む。

### ChatStreamChunk
ストリーミングチャット応答のチャンク。`delta`（メッセージ差分）、`usage`（使用統計）、`is_done`（完了フラグ）を含む。

### Core API
`flm-core`クレートが提供するAPI。Domain層、Service層、Ports（Traits）の定義を含む。v1.0.0で凍結されている。

## D

### Domain Layer
ビジネスロジックとデータモデルを含む層。`flm-core/src/domain/`に定義される。

## E

### Engine
LLM API/Server（Ollama、vLLM、LM Studio、llama.cppなど）のこと。FLMは複数のエンジンを統合管理する。

### EngineCapabilities
エンジンがサポートする機能（チャット、ストリーミング、埋め込み、モデレーション、ツール、画像入力、音声入力・出力など）を表す。`vision_inputs`、`audio_inputs`、`audio_outputs`フィールドでマルチモーダル機能のサポートを表現する。詳細は`docs/specs/CORE_API.md`を参照。

### EngineId
エンジンを一意に識別するID。例: `"ollama-default"`、`"vllm-1"`。

### EngineKind
エンジンの種類を表す列挙型。`Ollama`、`Vllm`、`LmStudio`、`LlamaCpp`。

### EngineRepository
登録済みエンジンを管理するポートインターフェイス。`list_registered()`と`register()`メソッドを提供する。

### EngineService
エンジン検出、モデル一覧取得、チャット、埋め込みなどの操作を提供するサービス。`flm-core/src/services/engine.rs`に実装される。

### EngineState
エンジンの現在の状態。ID、種類、名前、バージョン、ステータス、機能を含む。

### EngineStatus
エンジンのステータス。`InstalledOnly`、`RunningHealthy`、`RunningDegraded`、`ErrorNetwork`、`ErrorApi`のいずれか。

## H

### HealthStatus
エンジンのヘルスチェック結果。`Healthy`、`Degraded`、`Unreachable`のいずれか。

### 個人利用・シングルユーザー環境
FLMの設計前提となる環境定義。同一マシン上で単一のユーザーアカウントがFLMを使用する環境を指す。マルチユーザー対応やロールベースアクセス制御（RBAC）機能は提供されていない。複数のユーザーアカウントが同一マシン上に存在する場合でも、FLMは単一ユーザー向けに設計されており、各ユーザーは独立したインストール・設定を持つ必要がある。詳細は`docs/planning/PLAN.md`の基本方針を参照。

## L

### LlmEngine
LLMエンジンが実装すべきトレイト。`health_check()`、`list_models()`、`chat()`、`chat_stream()`、`embeddings()`メソッドを定義する。

## M

### ModelId
モデルを一意に識別するID。`flm://{engine_id}/{model_name}`形式。

### MultimodalAttachment
マルチモーダル（画像・音声）データを表す構造体。`ChatMessage`の`attachments`フィールドで使用される。`kind`（`InputImage`または`InputAudio`）、`data`（バイナリデータ）、`mime_type`、`filename`、`size_bytes`、`detail`、`duration_ms`を含む。詳細は`docs/specs/CORE_API.md`を参照。

**注意**: 過去のドキュメントでは`MultimodalPayload`という用語が使用されていたが、現在は`MultimodalAttachment`に統一されている。`MultimodalPayload`への参照は`MultimodalAttachment`を指す。

## P

### Port Layer
抽象インターフェイス（Traits）を定義する層。`flm-core/src/ports/`に定義される。実装はAdapter層（`flm-cli`、`flm-proxy`）で提供される。

### ProxyConfig
プロキシサーバーの設定。モード、ポート、リスンアドレス、ACME設定、エグレス設定などを含む。

### ProxyController
プロキシサーバーの起動・停止・状態確認を提供するポートインターフェイス。

### ProxyHandle
プロキシサーバー起動時に返されるハンドル。ID、PID、ポート、モード、状態などを含む。

### ProxyMode
プロキシサーバーの動作モード。`LocalHttp`、`DevSelfSigned`、`HttpsAcme`、`PackagedCa`のいずれか。

### ProxyService
プロキシサーバーの起動・停止・状態確認を提供するサービス。`flm-core/src/services/proxy.rs`に実装される。

## R

### RepoError
リポジトリ操作で発生するエラー。`NotFound`、`ConstraintViolation`、`MigrationFailed`、`IoError`、`ValidationError`、`ReadOnlyMode`のいずれか。

## S

### SecurityPolicy
セキュリティ設定。IPホワイトリスト、CORS設定、レート制限設定などをJSON形式で保持する。

### SecurityRepository
APIキーとセキュリティポリシーを管理するポートインターフェイス。

### SecurityService
APIキー管理、セキュリティポリシー管理を提供するサービス。`flm-core/src/services/security.rs`に実装される。

### Service Layer
ビジネスロジックを実装する層。`flm-core/src/services/`に定義される。

## U

### UsageStats
トークン使用統計。`prompt_tokens`、`completion_tokens`、`total_tokens`を含む。

---

**関連ドキュメント**:
- `docs/specs/CORE_API.md` - コアAPI仕様（用語の詳細定義）
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様
- `docs/specs/CLI_SPEC.md` - CLI仕様
- `docs/specs/ENGINE_DETECT.md` - エンジン検出仕様

