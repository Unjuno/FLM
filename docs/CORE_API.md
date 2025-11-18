# FLM Core API Specification
> Status: Canonical | Audience: Rust core engineers | Updated: 2025-11-18

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
}

#[derive(Clone, Debug)]
pub struct ProxyConfig {
    pub mode: ProxyMode,
    pub port: u16,
    pub acme_email: Option<String>,
    pub acme_domain: Option<String>,
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
* ProxyService は Axum サーバ起動を統括し、HTTPS/ACME の証明書ハンドリングも内部に閉じる
* SecurityService / ConfigService は CLI / UI / Proxy の共通 API を提供する
  * Phase1/2では `SecurityPolicy` の `id` を `"default"` に固定し、`get_policy`/`set_policy` は内部的にこのIDを扱う想定
  * `rotate_api_key` は旧キーを即座に `revoked_at` 付きで無効化し、新しいキーID/平文を返す（グレース期間は設けない）
* `*_Service::new()` では、Adapter 層から渡される DB 接続に対して `sqlx::migrate!()` を呼び出すのみで、接続管理や I/O は Adapter 側の責務とする

## 6. IPC / CLI / Proxy からの利用

* CLI: EngineService / ProxyService を直接使用
* Proxy: Axum handler → EngineService / SecurityService を呼び出し OpenAI互換レスポンスを構築
* UI: Tauri コマンド → EngineService / ProxyService / SecurityService / ConfigService を呼ぶ

### DTO/IPC 互換性ポリシー
- CLI/UI/Proxy が Core へ渡す DTO は `serde` ベースの JSON でシリアライズされ、`version` フィールド（例: `{"version":"1.0","data":{...}}`）を付与する。Reverse 互換は `major` が一致する限り保証し、`minor` アップデートではフィールド追加のみ行う。
- `ProxyHandle`, `SecurityPolicy`, `ApiKeyMetadata` など外部に露出する構造体は `#[non_exhaustive]` で定義し、未知フィールドを無視できるよう CLI/UI 側で `serde(default)` を設定する。
- IPC 追加時は `docs/CLI_SPEC.md` / `docs/UI_MINIMAL.md` に JSON Schema（必須フィールド/型）を追記し、`CORE_API.md` の該当データモデルを参照させる。これにより CLI がサブコマンド増設しても UI/Proxy で schema drift が起きない。

## 7. 未確定事項

* ProxyConfig の ACME 設定（ドメイン / メールアドレス / チャレンジ種類）

これらは `CORE_API.md` の該当セクションに追記していく。

