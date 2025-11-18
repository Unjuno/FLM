# FLM Proxy Specification
> Status: Canonical | Audience: Proxy/Network engineers | Updated: 2025-11-18

## 1. 役割

Axum/Hyper ベースの HTTP(S) プロキシ。以下の責務を担う:

1. リクエスト受付 (`/v1/*`, `/engine/*`)
2. 認証 (Bearer API Key)
3. ポリシー適用 (IPホワイトリスト / CORS / レート制限)
4. ルーティングおよびリクエスト変換
5. EngineService 呼び出し
6. OpenAI 互換レスポンス / SSE の生成

## 2. リクエストフロー

```mermaid
flowchart LR
    A["Incoming HTTP(S) Request"]
    B["Auth Middleware<br/>Bearer Token → APIキー検証"]
    C["Policy Middleware<br/>IP / CORS / Rate Limit"]
    D["Router<br/>/v1/* or /engine/*"]
    E["Handler<br/>EngineService / SecurityService 呼び出し"]
    F["Response Formatter<br/>OpenAI JSON / SSE"]
    G["HTTP Response"]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
```

## 3. ルーティングルール

| Path                     | ハンドラ概要                                                     |
|-------------------------|------------------------------------------------------------------|
| `POST /v1/chat/completions` | OpenAI 互換チャット。リクエストを `ChatRequest` にマッピングして `EngineService::chat/chat_stream` を呼ぶ。未対応パラメータ（例: `logit_bias`）は warning ログのみ。Phase1/2 は `model` に `flm://engine/model` 形式を必須とし、異なる形式や欠落時は 400 `invalid_model` |
| `GET /v1/models`        | `EngineService::list_models` → モデルIDを `flm://{engine_id}/{model}` 形式に正規化し OpenAI 互換 JSON へ整形 |
| `POST /v1/embeddings`   | `EngineService::embeddings` を呼び、OpenAI 互換で返却           |
| `POST /engine/:id/*`    | エンジン固有エンドポイントへのパススルー（ヘッダ制限付き）      |

### `/v1/chat/completions`

* リクエスト変換: OpenAI JSON → `ChatRequest`
* Phase1/2 は `model` に `flm://{engine_id}/{model}` 形式を必須とする。欠落または異なる形式の場合は 400 `invalid_model`
* モデル名が `flm://` 形式の場合のみ internal `ChatRequest.model_id` / `engine_id` に分解
* ストリーミング: `stream: true` の場合は `EngineService::chat_stream` を呼び、SSEとして返却
* fallback ルール:
  - 温度指定 (`temperature`) が対象エンジンで未サポート → 設定を無視し warning を `stderr` ログ
  - `n > 1` は vLLM のみサポート。その他では `n=1` に強制
  - `response_format` 等が未知の場合は 400 (unsupported_parameter)

```rust
async fn chat_stream_handler(...) -> impl IntoResponse {
    let core_req = map_openai_to_core(openai_req)?;
    let stream = engine_service.chat_stream(core_req)?;

    let sse = stream.map(|chunk_res| match chunk_res {
        Ok(chunk) => Ok(Event::default().data(map_core_chunk_to_openai(chunk))),
        Err(e) => Err(e),
    });

    Sse::new(sse)
}
```

### `/engine/:engine_id/*`

* 可能な限り単純プロキシ（FLM の責務外の操作をユーザーが行うことを許容）
* ただし Forward 先ホストは EngineService が検出済みのホストのみ

## 4. Streaming の扱い

| エンジン | Proxy での処理                                         |
|----------|-------------------------------------------------------|
| vLLM / LM Studio / llama.cpp (OpenAI互換) | chunked response を透過（SSEヘッダと `data:` プレフィックスのみ追加） |
| Ollama   | Engineアダプタで `ChatStreamChunk` に変換 → Proxy が OpenAI SSE 形式に整形（`delta.content` にマッピング、`done` 時に `[DONE]`） |

## 5. 順序と責務境界

1. 認証 (APIキー → security.db)
2. ポリシー (IP / CORS / RateLimit)
3. ルーティング (/v1/* or /engine/*)
4. Handler 内で EngineService / SecurityService を呼び、結果を OpenAI形式に整形
5. レスポンス変換（モデルID / SSE chunk / usage）

この順序を崩すと不正アクセスやリソース浪費が発生するため厳守。

## 6. TLS / HTTPS モード

| モード          | 説明                                                      |
|-----------------|---------------------------------------------------------|
| `local-http`    | HTTPのみ。ローカルネットワーク限定（ファイアウォール必須） |
| `dev-selfsigned`| 自己署名証明書で HTTPS 提供。LAN / 開発用途専用。Wizard はルート証明書の生成・配布・削除手順を提示する（手動インストールが必要） |
| `packaged-ca`   | パッケージに同梱されたルートCA証明書を使用。インストール時にOS信頼ストアへ自動登録されるため、ブラウザ警告なしでHTTPS利用可能。大衆向け配布に最適。Phase 3 で実装予定 |
| `https-acme`    | ACME (Let's Encrypt など) で証明書を取得し HTTPS 提供（インターネット公開の既定モード） |

CLI のデフォルトは `local-http`（ローカル検証向け）とし、インターネット公開を行う場合の既定モードは `https-acme` とする。`dev-selfsigned` を選ぶ場合は、Wizard/CLI が生成したルート証明書をクライアント OS／ブラウザに手動でインポートし、ローテーション期限・撤去手順も `docs/SECURITY_FIREWALL_GUIDE.md` に従う必要がある。`packaged-ca` モードは Phase 3 のパッケージング時に実装し、インストーラが自動的に証明書を登録する。`--port` で指定した値は HTTP 用ポートとして扱い、HTTPS は `port + 1` をデフォルトとする（例: 8080/8081）。

* 設定は `ProxyConfig` に集約 (`core` 側で管理)
* ACME 証明書は `security.db` にパスと更新日時を保存
* `packaged-ca` モードのルートCA証明書はビルド時に生成し、インストーラに同梱。サーバー証明書は起動時に自動生成（ルートCAで署名）

## 7. エラー・ログポリシー

* すべてのリクエストに `request_id` を付与
* ログ項目: timestamp, request_id, client_ip, api_key_id, endpoint, engine_id, latency_ms, status, error_type
* SSE ストリーム中のエラーは `data: {"error": ...}` として送出し、最後に `done` イベントで終了

## 8. Fallback ルール（暫定）

| パラメータ | サポートエンジン | 非対応時の挙動 |
|------------|------------------|----------------|
| `temperature` | 全エンジン | 受け入れるが範囲外の場合 clamp。未実装エンジンはログ警告＋デフォルト値 |
| `n` | vLLM のみ | その他は `n=1` 強制、warning |
| `logit_bias`, `presence_penalty`, `frequency_penalty` | 未サポートエンジン多数 | warning を出しつつ無視 |
| `stop` | Ollama/vLLM | llama.cpp 等未対応は無視 |

## 9. セキュリティポリシー JSON の前提

Proxy / UI / CLI は `SecurityPolicy.policy_json` に以下のキーが存在する前提で動作する（省略時は無効扱い）:

```jsonc
{
  "ip_whitelist": ["127.0.0.1"],
  "cors": { "allowed_origins": ["https://example.com"] },
  "rate_limit": { "rpm": 60, "burst": 10 }
}
```

- `ip_whitelist`: CIDR/IPv4/IPv6 文字列の配列。空または省略で無効。
- `cors.allowed_origins`: 許可Origin配列。空で `*`。
- `rate_limit`: `rpm`（per API key）と任意の `burst`。省略でレート制限無効。
- Phase1/2ではグローバルポリシーID `"default"` のみを参照し、Proxy は常にこのポリシーをロードして適用する。

## 10. 証明書管理（packaged-ca モード）

### 10.1 ルートCA証明書の生成と同梱

* ビルド時に一度だけ自己署名ルートCA証明書を生成（例: `FLM Local CA`）
* 公開鍵 (`flm-ca.crt`) をインストーラに同梱
* 秘密鍵 (`flm-ca.key`) はビルド環境のシークレットとして管理（漏洩時は再生成）
* 証明書の有効期限は10年を推奨（ローテーション戦略は `docs/SECURITY_FIREWALL_GUIDE.md` 参照）

### 10.2 サーバー証明書の自動生成

* `packaged-ca` モードで起動時、サーバー証明書を自動生成
* Subject Alternative Name (SAN) に以下を含める:
  - `localhost`, `127.0.0.1`, `::1`
  - RFC1918 プライベートIP範囲（`192.168.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`）
* ルートCAで署名し、`AppData/flm/certs/server.pem` に保存
* 証明書が既に存在し有効期限内なら再利用（IP変動時も再生成不要）

### 10.3 インストール時の自動登録

* Windows: NSIS/PowerShell で `Cert:\LocalMachine\Root` に `flm-ca.crt` を登録（UAC確認）
* macOS: `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain` を実行
* Linux: `/usr/local/share/ca-certificates/flm-ca.crt` にコピー後、`update-ca-certificates` を実行
* インストール中に「FLM Local CA 証明書を信頼しますか？」という確認ダイアログを表示

### 10.4 アンインストール時の削除

* アンインストーラで証明書を削除するオプションを提供
* 手動削除手順も `docs/SECURITY_FIREWALL_GUIDE.md` に記載

### 10.5 ローテーション戦略

* ルートCA証明書の期限切れ前に警告を表示（アプリ起動時）
* 新バージョンのインストールで新しいルートCAを配布
* 緊急時は `flm-ca.key` を使って新CAを生成し、アップデートで配布

## 11. 未決事項

- `/v1/audio/*` 等の将来 API は `EngineCapabilities` を確認して動的にサポート
- ProxyService でのホットリロード（設定変更を再起動無しで反映するか）

