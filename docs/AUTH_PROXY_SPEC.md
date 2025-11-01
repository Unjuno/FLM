# FLM - 認証プロキシ仕様書

## フェーズ2: ドキュメントエージェント (DOC) 実装

この文書は、FLMプロジェクトで使用する認証プロキシサーバーの仕様と使用方法を説明します。

---

## 概要

認証プロキシは、Express.jsベースのHTTPプロキシサーバーで、Ollama APIへのアクセスに認証を追加します。OpenAI互換APIエンドポイントを提供し、Bearer Token認証を使用してAPIキーを検証します。

---

## アーキテクチャ

```
クライアントアプリケーション
    ↓ (HTTP Request with Bearer Token)
認証プロキシ (Express.js)
    ↓ (HTTP Request)
Ollama API (http://localhost:11434)
```

---

## 実装場所

- **サーバーファイル**: `src/backend/auth/server.ts`
- **認証ロジック**: `src/backend/auth/keygen.ts`
- **データベース統合**: `src/backend/auth/database.ts`
- **プロキシ設定**: `src/backend/auth/proxy.ts`

---

## 起動と停止

### Rustバックエンドからの起動

```rust
use crate::auth;

// 認証プロキシを起動
auth::start_auth_proxy(8080, None, None).await?;
```

### Rustバックエンドからの停止

```rust
use crate::auth;

// ポート番号で停止
auth::stop_auth_proxy_by_port(8080).await?;
```

---

## APIエンドポイント

### 1. `POST /v1/chat/completions`

OpenAI互換のチャット補完エンドポイント。Ollama APIの `/api/chat` に転送されます。

#### リクエスト

```http
POST http://localhost:8080/v1/chat/completions
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "model": "llama3:8b",
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ]
}
```

#### レスポンス

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "llama3:8b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! I'm doing well, thank you for asking."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

---

### 2. `GET /v1/models`

利用可能なモデル一覧を取得します。Ollama APIの `/api/tags` に転送されます。

#### リクエスト

```http
GET http://localhost:8080/v1/models
Authorization: Bearer <API_KEY>
```

#### レスポンス

```json
{
  "object": "list",
  "data": [
    {
      "id": "llama3:8b",
      "object": "model",
      "created": 1677610602,
      "owned_by": "ollama"
    }
  ]
}
```

---

## 認証

### Bearer Token認証

すべてのリクエストには、`Authorization`ヘッダーにBearer Tokenを含める必要があります。

```http
Authorization: Bearer <API_KEY>
```

### APIキーの検証フロー

1. リクエストから`Authorization`ヘッダーを取得
2. Bearer Tokenを抽出
3. APIキーのSHA-256ハッシュを計算
4. データベースからAPIキーのハッシュを取得
5. ハッシュを比較して検証
6. 検証成功時はリクエストをOllama APIに転送
7. 検証失敗時は401エラーを返す

### エラーレスポンス

#### 401 Unauthorized（認証失敗）

```json
{
  "error": {
    "message": "認証に失敗しました。APIキーを確認してください。",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

#### 400 Bad Request（リクエスト形式エラー）

```json
{
  "error": {
    "message": "リクエストの形式が正しくありません。",
    "type": "invalid_request_error",
    "code": "malformed_request"
  }
}
```

---

## プロキシ機能

### Ollama APIへの転送

認証プロキシは、以下のエンドポイントをOllama APIに転送します：

1. **`POST /v1/chat/completions`** → `POST http://localhost:11434/api/chat`
2. **`GET /v1/models`** → `GET http://localhost:11434/api/tags`

### リクエストの変換

Ollama APIの形式に合わせてリクエストを変換します：

```typescript
// OpenAI形式
{
  "model": "llama3:8b",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}

// Ollama形式に変換
{
  "model": "llama3:8b",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

---

## CORS設定

認証プロキシは、開発環境と本番環境で適切なCORS設定を実施します。

```typescript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://yourdomain.com' 
    : '*',
  credentials: true
}));
```

---

## エラーハンドリング

### Ollama API接続エラー

Ollama APIに接続できない場合、以下のエラーを返します：

```json
{
  "error": {
    "message": "Ollama APIに接続できませんでした。Ollamaが起動しているか確認してください。",
    "type": "api_error",
    "code": "ollama_connection_error"
  }
}
```

### タイムアウト処理

リクエストがタイムアウトした場合、適切なエラーメッセージを返します。

---

## ログ機能

認証プロキシは、以下の情報をログに記録します（将来実装予定）：

- リクエストの受信時刻
- APIキー（ハッシュのみ、セキュリティのため）
- エンドポイント
- レスポンスステータス
- 処理時間

---

## セキュリティ考慮事項

### 1. APIキーの取り扱い

- APIキーはハッシュ化してデータベースに保存（AES-256-GCM暗号化）
- リクエストから取得したAPIキーは即座にハッシュ化して検証
- ログにAPIキーを記録しない（ハッシュのみ記録）

### 2. ネットワークアクセス制御

- **デフォルト動作**: 認証プロキシは `0.0.0.0` にバインドされ、外部からのアクセスも可能です
- **外部アクセス時の推奨事項**:
  - ファイアウォールで適切なポート制御を実施してください
  - 必要に応じてルーターのポート転送設定を行ってください
  - 本番環境ではHTTPSの使用を強く推奨します
- **セキュリティヘッダー**: 
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### 3. レート制限（将来実装予定 - v1.3以降）

- APIキーごとのリクエストレート制限
- IPアドレスごとのレート制限
- DDoS攻撃対策

### 4. IPホワイトリスト（将来実装予定 - v1.3以降）

- 許可されたIPアドレスのみアクセス可能にする機能
- 特定のネットワークからのみアクセスを許可

### 5. HTTPS対応（将来実装予定 - v2.0以降）

- 本番環境ではHTTPSを必須とする
- SSL/TLS証明書の自動取得・更新機能（Let's Encrypt等）

---

## トラブルシューティング

### 認証プロキシが起動しない

- Node.jsがインストールされているか確認
- ポート番号が既に使用されていないか確認
- エラーログを確認

### 認証が失敗する

- APIキーが正しいか確認
- データベースにAPIキーが保存されているか確認
- APIキーのハッシュが正しいか確認

### Ollama APIに接続できない

- Ollamaが起動しているか確認（`http://localhost:11434/api/version`で確認）
- ネットワーク接続を確認
- ファイアウォール設定を確認

---

## 開発者向け情報

### ローカル開発環境での実行

```bash
# 認証プロキシを直接起動（開発用）
cd src/backend/auth
npm install
npx tsx server.ts
```

### 環境変数

- `PORT`: プロキシサーバーのポート番号（デフォルト: 8080）
- `OLLAMA_API_URL`: Ollama APIのURL（デフォルト: http://localhost:11434）

---

## 関連ドキュメント

- `src/backend/auth/README.md`: 認証プロキシのREADME
- `DOCKS/INTERFACE_SPEC.md`: IPCインターフェース仕様
- `src-tauri/src/auth.rs`: Rust側の認証プロキシ管理
