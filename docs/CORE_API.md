# FLM Core API Specification
> Status: Canonical | Audience: Rust core engineers | Updated: 2025-11-20

**注意**: 本API仕様は**個人利用・シングルユーザー環境向け**のアプリケーション向けです。マルチユーザー対応やロールベースアクセス制御（RBAC）機能は提供されていません。

## 1. Rust Workspace Modules

```
crates/
  flm-core/             # Domain services, data models, repositories
  flm-cli/              # CLI adapter (uses Core services)
  flm-proxy/            # Axum-based HTTP/S proxy (uses Core services)
  flm-engine-ollama/    # Engine adapter implementing `LlmEngine`
  flm-engine-vllm/
  flm-engine-lmstudio/
  flm-engine-llamacpp/
```

`flm-core` は Domain 層（純粋ロジック）とポート（抽象インターフェイス）のみを保持し、HTTP/DB/FS 等の I/O 実装は `flm-cli` / `flm-proxy` / `flm-engine-*` 側（Application/Adapter 層）で提供する。Core からは trait 経由で依存し、実体は DI で注入する。

```
Domain (flm-core)
 ├─ services/ (EngineService, ProxyService, SecurityService)
 ├─ domain/   (モデル / 状態遷移ロジック)
 └─ ports/
      ├─ EngineRepository (trait)
      ├─ EngineProcessController (trait)
      ├─ HttpClient (trait)
      ├─ ConfigRepository (trait)
      ├─ SecurityRepository (trait)
      └─ ProxyController (trait)
```

## 2. 公開データモデル

```rust
pub type EngineId = String;
pub type ModelId = String;

#[derive(Clone, Debug)]
pub enum EngineKind {
    Ollama,
    Vllm,
    LmStudio,
    LlamaCpp,
}

#[derive(Clone, Debug)]
pub struct EngineCapabilities {
    pub chat: bool,
    pub chat_stream: bool,
    pub embeddings: bool,
    pub moderation: bool,
    pub tools: bool,
}

#[derive(Clone, Debug)]
pub enum HealthStatus {
    Healthy { latency_ms: u64 },
    Degraded { latency_ms: u64, reason: String },
    Unreachable { reason: String },
}

#[derive(Clone, Debug)]
pub struct EngineState {
    pub id: EngineId,
    pub kind: EngineKind,
    pub name: String,
    pub version: Option<String>,
    pub status: EngineStatus,
    pub capabilities: EngineCapabilities,
}

#[derive(Clone, Debug)]
pub enum EngineStatus {
    InstalledOnly,
    RunningHealthy { latency_ms: u64 },
    RunningDegraded { latency_ms: u64, reason: String },
    ErrorNetwork { reason: String, consecutive_failures: u32 },
    ErrorApi { reason: String },
}

#[derive(Clone, Debug)]
pub struct ModelInfo {
    pub engine_id: EngineId,
    pub model_id: ModelId,
    pub display_name: String,
    pub context_length: Option<u32>,
    pub supports_streaming: bool,
    pub supports_embeddings: bool,
}

#[derive(Clone, Debug)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
}

#[derive(Clone, Debug)]
pub enum ChatRole {
    System,
    User,
    Assistant,
    Tool,
}

#[derive(Clone, Debug)]
pub struct ChatRequest {
    pub engine_id: EngineId,
    pub model_id: ModelId,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stop: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct UsageStats {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Clone, Debug)]
pub struct ChatResponse {
    pub usage: UsageStats,
    pub messages: Vec<ChatMessage>,
}

pub struct ChatStreamChunk {
    pub delta: ChatMessage,
    pub usage: Option<UsageStats>,
    pub is_done: bool,
}

#[derive(Clone, Debug)]
pub struct EmbeddingRequest {
    pub engine_id: EngineId,
    pub model_id: ModelId,
    /// OpenAI互換に合わせテキスト配列をサポート（1件のみの場合も配列）
    pub input: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct EmbeddingVector {
    pub index: usize,
    pub values: Vec<f32>,
}

#[derive(Clone, Debug)]
pub struct EmbeddingResponse {
    pub usage: UsageStats,
    pub vectors: Vec<EmbeddingVector>,
}

#[derive(Clone, Debug)]
pub struct ApiKeyRecord {
    pub id: String,
    pub label: String,
    pub hash: String,
    pub created_at: String,
    pub revoked_at: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ApiKeyMetadata {
    pub id: String,
    pub label: String,
    pub created_at: String,
    pub revoked_at: Option<String>, // ISO8601, None if not revoked
}

#[derive(Clone, Debug)]
pub struct PlainAndHashedApiKey {
    pub plain: String,
    pub record: ApiKeyRecord,
}

#[derive(Clone, Debug)]
pub enum ProxyMode {
    LocalHttp,
    DevSelfSigned,
    HttpsAcme,
    PackagedCa, // Phase 3 で実装: パッケージ同梱のルートCA証明書を使用
}

#[derive(Clone, Debug)]
pub enum AcmeChallengeKind {
    Http01,
    Dns01,
}

#[derive(Clone, Debug)]
pub struct ProxyConfig {
    pub mode: ProxyMode,
    pub port: u16,
    pub acme_email: Option<String>,
    pub acme_domain: Option<String>,
    pub acme_challenge: Option<AcmeChallengeKind>,
    /// DNS-01 自動化で使用する資格情報プロフィールID（CLIが secrets store に保持）
    pub acme_dns_profile_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ProxyProfile {
    pub id: String,
    pub config: ProxyConfig,
    pub created_at: String, // ISO8601
}

#[derive(Clone, Debug)]
pub struct ProxyHandle {
    pub id: String,
    pub pid: u32,
    pub port: u16,
    pub mode: ProxyMode,
    pub listen_addr: String,
    /// HTTPS を有効にするモード（dev-selfsigned / https-acme / packaged-ca）では `port + 1`
    pub https_port: Option<u16>,
    pub acme_domain: Option<String>,
    pub running: bool,
    pub last_error: Option<String>,
}

#[derive(Clone, Debug)]
pub struct SecurityPolicy {
    pub id: String,
    pub policy_json: String,
    pub updated_at: String,
}

/// Phase 1で保証するSecurityPolicy JSONの最小スキーマ
///
/// ```jsonc
/// {
///   "ip_whitelist": ["127.0.0.1", "192.168.0.0/16"],
///   "cors": { "allowed_origins": ["https://example.com"] },
///   "rate_limit": { "rpm": 60, "burst": 10 }
/// }
/// ```
///
/// - `ip_whitelist`: 省略時は無効扱い
/// - `cors.allowed_origins`: 空の場合は `*`
/// - `rate_limit`: 省略時はレート制限無効
/// UI/CLIはこのキーを基準に「設定済みか」を判定し、Proxyは同じキーを参照して制御する。
///
/// Phase1/2では SecurityPolicy はグローバルに1件のみ運用し、`id = "default"` を固定とする。
/// CLI/UI/Proxyは暗黙にこのIDを扱い、将来プロファイル分割が必要になった場合にのみ
/// SecurityServiceへ複数IDサポートを拡張する。
///
/// APIキーの `label` は UI 表示用メタデータであり、DB 制約としては一意ではない。`rotate_api_key`
/// で `new_label` を指定しなかった場合、旧レコードのラベルをそのまま新レコードにコピーし、
/// 旧レコードは `revoked_at` を設定して失効させる。
```

### EngineStatus 遷移規則

- `InstalledOnly → RunningHealthy`: API Ping + health_check が成功し、レイテンシが `HEALTH_LATENCY_THRESHOLD_MS` 未満（暫定 1500ms）
- `RunningHealthy → RunningDegraded`: レイテンシが閾値以上、または 3 回以内に warning 応答（HTTP 429/503 等）が発生
- `RunningDegraded → RunningHealthy`: 連続 3 回のヘルスチェック成功かつレイテンシが閾値未満
- `RunningDegraded → ErrorNetwork`: 連続 `MAX_NETWORK_FAILURES`（デフォルト 3）で接続不可、またはタイムアウト
- `RunningHealthy/Degraded → ErrorApi`: HTTP 200 でもレスポンス形式が不正・JSON解析失敗等が連続した場合
- `Error* → InstalledOnly`: Engine プロセスが停止した場合（検出はバイナリのみ）
- `ErrorNetwork/ErrorApi → RunningHealthy`: 連続成功が閾値を満たした際に自動復帰

これらの閾値は `EngineServiceConfig` で設定し、CLI から `flm config` 経由で調整可能にする。

### 補助型定義

```rust
// EngineProcessController で使用
#[derive(Clone, Debug)]
pub struct EngineBinaryInfo {
    pub engine_id: EngineId,
    pub kind: EngineKind,
    pub binary_path: String,
    pub version: Option<String>,
}

#[derive(Clone, Debug)]
pub struct EngineRuntimeInfo {
    pub engine_id: EngineId,
    pub kind: EngineKind,
    pub base_url: String,
    pub port: Option<u16>,
}

// HttpClient で使用（serde_json::Value の型エイリアス）
pub type Value = serde_json::Value;

#[derive(Clone, Debug)]
pub struct HttpRequest {
    pub method: String, // "GET" | "POST" | etc.
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<Value>,
}

// HttpClient::stream の戻り値型（trait object を Box で包む）
// 実装時は `use std::pin::Pin; use futures::Stream;` が必要
pub type HttpStream = Pin<Box<dyn Stream<Item = Result<Vec<u8>, HttpError>> + Send>>;

// エラー型
#[derive(Debug)]
pub enum EngineError {
    NotFound { engine_id: EngineId },
    NetworkError { reason: String },
    ApiError { reason: String, status_code: Option<u16> },
    Timeout { operation: String },
    InvalidResponse { reason: String },
}

#[derive(Debug)]
pub enum ProxyError {
    AlreadyRunning { handle_id: String },
    PortInUse { port: u16 },
    CertGenerationFailed { reason: String },
    AcmeError { reason: String },
    InvalidConfig { reason: String },
    Timeout { operation: String },
}

#[derive(Debug)]
pub enum RepoError {
    NotFound { key: String },
    ConstraintViolation { reason: String },
    MigrationFailed { reason: String },
    IoError { reason: String },
}

#[derive(Debug)]
pub enum HttpError {
    NetworkError { reason: String },
    Timeout,
    InvalidResponse { reason: String },
    StatusCode { code: u16, body: Option<String> },
}
```

### ProxyConfig バリデーション要件

- `mode`: すべてのバリアントが有効。`HttpsAcme` の場合は `acme_email` と `acme_domain` が必須。
- `port`: 1-65535 の範囲。0 は無効。HTTPS を有効にするモードでは `port + 1` が TLS リスニングポートとして予約されるため、両方のポートが空いていることを CLI で検証する。
- `acme_email`: `HttpsAcme` モード時のみ必須。RFC5322 準拠のメールアドレス形式。
- `acme_domain`: `HttpsAcme` モード時のみ必須。FQDN 形式（例: `example.com`）。ワイルドカードは Phase 3 以降。
- `acme_challenge`: 省略時は `Http01`。`Dns01` を指定する場合は `acme_dns_profile_id` も必須。
- `acme_dns_profile_id`: `Dns01` のみ必須。CLI/Tauri が OS のシークレットストアに保持している DNS プロバイダ資格情報のキー。`Http01` の場合は `None`。
- `PackagedCa` モード時は `acme_email` / `acme_domain` は無視される（証明書はパッケージ同梱）。
- `ProxyHandle.https_port`: `ProxyConfig.mode` が `LocalHttp` 以外の場合は常に `Some(port + 1)` を返し、`LocalHttp` では `None`。

### SecurityPolicy エッジケース

**JSONスキーマ例**（Phase 1/2 の最小スキーマ）:

```jsonc
{
  "ip_whitelist": ["127.0.0.1", "192.168.0.0/16"],
  "cors": { "allowed_origins": ["https://example.com"] },
  "rate_limit": { "rpm": 60, "burst": 10 }
}
```

**バリデーションルール**:
- `ip_whitelist`: CIDR/IPv4/IPv6 文字列の配列。空配列 `[]` または省略時は IP 制限無効（すべて許可）。`null` は無効として扱う。
- `cors.allowed_origins`: 許可Origin配列。空配列 `[]` は `*`（すべて許可）として扱う。省略時は `*`。
- `rate_limit`: `rpm`（per API key）と任意の `burst`。省略時はレート制限無効。`rpm` が 0 の場合は無効として扱う。`burst` が省略時は `rpm` と同じ値を使用。

**参照**: Proxy/UI/CLI はこのスキーマを基準に「設定済みか」を判定し、Proxy は同じキーを参照して制御する。詳細は `docs/PROXY_SPEC.md` セクション9を参照。

## 3. `LlmEngine` Trait

```rust
pub trait LlmEngine: Send + Sync {
    fn id(&self) -> EngineId;
    fn kind(&self) -> EngineKind;
    fn capabilities(&self) -> EngineCapabilities;
    fn health_check(&self) -> Result<HealthStatus, EngineError>;
    fn list_models(&self) -> Result<Vec<ModelInfo>, EngineError>;

    fn chat(&self, req: ChatRequest) -> Result<ChatResponse, EngineError>;
    fn chat_stream(
        &self,
        req: ChatRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<ChatStreamChunk, EngineError>> + Send>>, EngineError>;

    fn embeddings(&self, req: EmbeddingRequest) -> Result<EmbeddingResponse, EngineError>;
}
```

* `chat` と `chat_stream` を分離
* 新機能は `EngineCapabilities` によって判定する
* Engineごとの差異はアダプタ crate に閉じ込める

## 4. ポート（抽象インターフェイス）

```rust
pub trait EngineRepository {
    fn list_registered(&self) -> Vec<Box<dyn LlmEngine>>;
    fn register(&self, engine: Box<dyn LlmEngine>);
}

pub trait EngineProcessController {
    fn detect_binaries(&self) -> Vec<EngineBinaryInfo>;
    fn detect_running(&self) -> Vec<EngineRuntimeInfo>;
}

pub trait HttpClient: Send + Sync {
    fn get_json(&self, url: &str) -> Result<Value, HttpError>;
    fn post_json(&self, url: &str, body: Value) -> Result<Value, HttpError>;
    fn stream(&self, req: HttpRequest) -> Result<HttpStream, HttpError>;
}

pub trait ConfigRepository {
    fn get(&self, key: &str) -> Result<Option<String>, RepoError>;
    fn set(&self, key: &str, value: &str) -> Result<(), RepoError>;
    fn list(&self) -> Result<Vec<(String, String)>, RepoError>;
}

pub trait SecurityRepository {
    fn save_api_key(&self, key: ApiKeyRecord) -> Result<(), RepoError>;
    fn fetch_api_key(&self, id: &str) -> Result<Option<ApiKeyRecord>, RepoError>;
    fn list_api_keys(&self) -> Result<Vec<ApiKeyRecord>, RepoError>;
    fn mark_api_key_revoked(&self, id: &str, revoked_at: &str) -> Result<(), RepoError>;
    fn save_policy(&self, policy: SecurityPolicy) -> Result<(), RepoError>;
    fn fetch_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError>;
    fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError>;
}

pub trait ProxyController {
    fn start(&self, config: ProxyConfig) -> Result<ProxyHandle, ProxyError>;
    fn stop(&self, handle: ProxyHandle) -> Result<(), ProxyError>;
}

pub trait ProxyRepository {
    fn save_profile(&self, profile: ProxyProfile) -> Result<(), RepoError>;
    fn load_profile(&self, id: &str) -> Result<Option<ProxyProfile>, RepoError>;
    fn list_profiles(&self) -> Result<Vec<ProxyProfile>, RepoError>;
    fn list_active_handles(&self) -> Result<Vec<ProxyHandle>, RepoError>;
}
```

`flm-core` はこれらの trait のみを参照し、実装は `flm-cli`（SQLite repo 等）や `flm-proxy`（Axumサーバ制御）側で提供する。

## 5. サービス API

CLI / Proxy / UI はこれらのサービスを通じて Core とやり取りする。

```rust
pub struct EngineService {
    engines: EngineRegistry,
    config_repo: ConfigRepository,
}

impl EngineService {
    pub fn detect_engines(&self) -> Result<Vec<EngineState>, EngineError>;
    pub fn list_models(&self, engine_id: EngineId) -> Result<Vec<ModelInfo>, EngineError>;
    pub fn chat(&self, req: ChatRequest) -> Result<ChatResponse, EngineError>;
    pub fn chat_stream(
        &self,
        req: ChatRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<ChatStreamChunk, EngineError>> + Send>>, EngineError>;
    pub fn embeddings(&self, req: EmbeddingRequest) -> Result<EmbeddingResponse, EngineError>;
}

pub struct ProxyService {
    proxy_repo: ProxyRepository,
    proxy_controller: ProxyController,
}

impl ProxyService {
    pub fn start(&self, config: ProxyConfig) -> Result<ProxyHandle, ProxyError>;
    pub fn stop(&self, handle: ProxyHandle) -> Result<(), ProxyError>;
    pub fn status(&self) -> Result<Vec<ProxyHandle>, ProxyError>;
}

pub struct SecurityService {
    security_repo: SecurityRepository,
}

impl SecurityService {
    pub fn list_policies(&self) -> Result<Vec<SecurityPolicy>, RepoError>;
    pub fn get_policy(&self, id: &str) -> Result<Option<SecurityPolicy>, RepoError>;
    pub fn set_policy(&self, policy: SecurityPolicy) -> Result<(), RepoError>;

    pub fn create_api_key(&self, label: &str) -> Result<PlainAndHashedApiKey, RepoError>;
    pub fn revoke_api_key(&self, id: &str) -> Result<(), RepoError>;
    pub fn list_api_keys(&self) -> Result<Vec<ApiKeyMetadata>, RepoError>;
    pub fn rotate_api_key(
        &self,
        id: &str,
        new_label: Option<&str>,
    ) -> Result<PlainAndHashedApiKey, RepoError>;
}

pub struct ConfigService {
    config_repo: ConfigRepository,
}

impl ConfigService {
    pub fn get(&self, key: &str) -> Result<Option<String>, RepoError>;
    pub fn set(&self, key: &str, value: &str) -> Result<(), RepoError>;
    pub fn list(&self) -> Result<Vec<(String, String)>, RepoError>;
}
```

* EngineService は `LlmEngine` 実装を登録した `EngineRegistry` を介して実装細部を隠蔽する
* ProxyService は Axum サーバ起動を統括し、HTTPS/ACME/`packaged-ca` の証明書ハンドリングも内部に閉じる。`packaged-ca` モード（Phase 3）では、パッケージ同梱のルートCA証明書を OS 信頼ストアへ自動登録し、ブラウザ警告なしで HTTPS を提供する。
* SecurityService / ConfigService は CLI / UI / Proxy の共通 API を提供する
  * Phase1/2では `SecurityPolicy` の `id` を `"default"` に固定し、`get_policy`/`set_policy` は内部的にこのIDを扱う想定
  * `rotate_api_key` は旧キーを即座に `revoked_at` 付きで無効化し、新しいキーID/平文を返す（グレース期間は設けない）
* `*_Service::new()` では、Adapter 層から渡される DB 接続に対して `sqlx::migrate!()` を呼び出すのみで、接続管理や I/O は Adapter 側の責務とする

### 並行性・リソース管理ポリシー

- **スレッド安全性**: すべての Service は `Send + Sync` を実装し、複数スレッドからの同時アクセスを許可する。Repository trait の実装も同様にスレッドセーフである必要がある。
- **リソース管理**: `ProxyService::start` で起動したプロキシは、`stop` が呼ばれるまでリソースを保持する。アプリ終了時は Adapter 層がすべてのハンドルを `stop` してから終了する。
- **DB 接続プール**: Adapter 層が SQLite 接続プールを管理し、Core は提供された接続のみを使用する。同時書き込みは SQLite の `WAL` モードで制御する。
- **エンジン検出の並行性**: `EngineService::detect_engines` は各エンジンの検出を並列実行し、タイムアウト（デフォルト 5 秒）で打ち切る。

### 非同期処理の仕様

- **タイムアウト**: HTTP リクエストはデフォルト 30 秒、エンジン検出は 5 秒、ACME 証明書取得は 90 秒。タイムアウトは `EngineServiceConfig` / `ProxyConfig` で調整可能。
- **キャンセレーション**: `chat_stream` は `tokio::sync::broadcast` または `AbortHandle` でキャンセル可能。クライアントが切断した場合は即座にストリームを終了し、エンジン側へのリクエストも可能な限り中断する。
- **リトライ**: ネットワークエラー（`EngineError::NetworkError`）は自動リトライしない。Adapter 層が必要に応じて指数バックオフでリトライを実装する。

## 6. IPC / CLI / Proxy からの利用

* CLI: EngineService / ProxyService を直接使用
* Proxy: Axum handler → EngineService / SecurityService を呼び出し OpenAI互換レスポンスを構築
* UI: Tauri コマンド → EngineService / ProxyService / SecurityService / ConfigService を呼ぶ

### DTO/IPC 互換性ポリシー
- CLI/UI/Proxy が Core へ渡す DTO は `serde` ベースの JSON でシリアライズされ、`version` フィールド（例: `{"version":"1.0","data":{...}}`）を付与する。Reverse 互換は `major` が一致する限り保証し、`minor` アップデートではフィールド追加のみ行う。
- `ProxyHandle`, `SecurityPolicy`, `ApiKeyMetadata` など外部に露出する構造体は `#[non_exhaustive]` で定義し、未知フィールドを無視できるよう CLI/UI 側で `serde(default)` を設定する。
- IPC 追加時は `docs/CLI_SPEC.md` / `docs/UI_MINIMAL.md` に JSON Schema（必須フィールド/型）を追記し、`CORE_API.md` の該当データモデルを参照させる。これにより CLI がサブコマンド増設しても UI/Proxy で schema drift が起きない。

## 7. ACME 設定詳細

### 7.1 チャレンジ種類

| フィールド | 値 | 用途 | 制約 |
|-----------|----|------|------|
| `acme_challenge = Http01` | HTTP-01 | 既定。プロキシ自身が `http://{domain}/.well-known/acme-challenge/*` をリッスンし、Let's Encrypt Staging/Production 双方に対応。 | 外部から 80/tcp に到達できること。`port` が 80 でない場合は CLI が iptables / portproxy で一時フォワードする。 |
| `acme_challenge = Dns01` | DNS-01 | DNS 更新権限がある場合に使用。長時間キャッシュされるゾーンでも対応可能。 | `acme_dns_profile_id` に指定された資格情報を CLI/Setup Wizard が OS シークレットストアから取得し、TXT レコードを自動作成する。 |

`acme_challenge` を省略した場合は `Http01` が選択される。DNS-01 を選ぶと `acme_dns_profile_id` が必須となり、CLI は `flm secrets dns add --provider cloudflare` などで登録済みのプロフィールを参照する。

### 7.2 HTTP-01 ハンドリング

1. `ProxyService::start` が `HttpsAcme + Http01` を検知すると、`port` を HTTP、`port + 1` を HTTPS に割り当て、HTTP 側で `/.well-known/acme-challenge/*` を優先マウントする。
2. ACME クライアントは 90 秒タイムアウトでチャレンジ→検証→証明書発行まで実施し、取得した証明書パスと期限を `security.db` に保存する。
3. 証明書取得後は `/.well-known` ルートを閉じ、通常の OpenAI 互換エンドポイントのみを公開する。

### 7.3 DNS-01 ハンドリング

1. CLI/Tauri Wizard が `acme_dns_profile_id` で示された資格情報（例: Cloudflare API トークン）を OS シークレットストアから読み出す。
2. `ProxyService::start` が ACME クライアントに資格情報を受け渡し、TXT レコード `_acme-challenge.{domain}` を生成。
3. 伝播確認（最大 120 秒）後に証明書取得を完了し、`security.db` に証明書・秘密鍵・有効期限を保存する。
4. DNS レコードは成功後すぐに削除するが、CLI で `--keep-dns-record` を指定した場合は次回まで残す。

### 7.4 証明書更新

- `ProxyService` は証明書の残存日数を起動時と 24 時間ごとのジョブで確認し、残り 20 日未満で自動更新タスクをキューイングする。
- 更新時もチャレンジ種別は `ProxyConfig` の指定に従う。HTTP-01 の場合は一時的に 80/tcp を占有し、DNS-01 の場合は同じ `acme_dns_profile_id` を再利用する。
- 更新失敗時は `ProxyError::AcmeError` を返し、`ProxyHandle.last_error` に詳細メッセージを格納する。CLI/UI はこのフィールドを表示して再実行を促す。

### 7.5 手動フォールバック

- CLI は `flm proxy start --mode https-acme --challenge http-01 --fallback dev-selfsigned` のようにフォールバックモードを受け付け、ACME が 2 回連続で失敗した場合に自動で `dev-selfsigned` を起動する。フォールバック発動時は `ProxyHandle.last_error` に ACME 失敗理由を保持する。
- Setup Wizard は HTTP-01 の場合にのみポートフォワード設定（Windows: `netsh interface portproxy`, Linux/macOS: `pf`/`iptables`）を案内する。

これらにより、Phase 1 完了前に ACME の要件（DNS-01/HTTP-01）が明文化され、CLI/Proxy/UI すべてが同じ設定項目を共有できる。

