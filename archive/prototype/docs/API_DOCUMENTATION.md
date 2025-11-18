# APIドキュメント

このドキュメントは、FLMアプリケーションで提供されるAPIエンドポイントの仕様を説明します。

---

## 概要

FLMは、以下の2種類のAPIを提供します：

1. **Tauri IPCコマンド**: フロントエンドとバックエンド間の通信
2. **OpenAI互換API**: 認証プロキシ経由で提供されるHTTP API

---

## Tauri IPCコマンド

### 基本情報

- **通信方式**: Tauri IPC（Inter-Process Communication）
- **フロントエンドからの呼び出し**: `invoke('command_name', { params })`
- **型安全性**: TypeScript型定義あり

### コマンド一覧

#### Ollama管理

##### `detect_ollama`

Ollamaの状態を検出します。

**パラメータ**: なし

**戻り値**:
```typescript
{
  is_installed: boolean;
  is_running: boolean;
  version?: string;
  system_path?: string;
}
```

**使用例**:
```typescript
const result = await invoke('detect_ollama');
console.log(result.is_installed); // true or false
```

---

##### `download_ollama`

Ollamaを自動ダウンロードします。

**パラメータ**: なし

**戻り値**: `void`

**イベント**: `ollama_download_progress`
- `progress`: 0-100の進捗率
- `downloaded_bytes`: ダウンロード済みバイト数
- `total_bytes`: 総バイト数

**使用例**:
```typescript
await listen('ollama_download_progress', (event) => {
  console.log('進捗:', event.payload.progress);
});
await invoke('download_ollama');
```

---

##### `start_ollama`

Ollamaを起動します。

**パラメータ**: なし

**戻り値**: `void`

**使用例**:
```typescript
await invoke('start_ollama');
```

---

##### `stop_ollama`

Ollamaを停止します。

**パラメータ**: なし

**戻り値**: `void`

---

#### API管理

##### `create_api`

新しいAPIを作成します。

**パラメータ**:
```typescript
{
  name: string;
  model_name: string;
  port: number;
  enable_auth: boolean;
}
```

**戻り値**:
```typescript
{
  id: string;
  name: string;
  model_name: string;
  port: number;
  endpoint: string;
  api_key: string | null;
  status: 'running' | 'stopped';
}
```

**使用例**:
```typescript
const result = await invoke('create_api', {
  name: 'My API',
  model_name: 'llama3:8b',
  port: 8080,
  enable_auth: true,
});
console.log('APIエンドポイント:', result.endpoint);
console.log('APIキー:', result.api_key);
```

---

##### `list_apis`

API一覧を取得します。

**パラメータ**: なし

**戻り値**:
```typescript
Array<{
  id: string;
  name: string;
  model_name: string;
  port: number;
  status: 'running' | 'stopped';
  enable_auth: boolean;
}>
```

---

##### `get_api_details`

APIの詳細情報を取得します。

**パラメータ**:
```typescript
{
  api_id: string;
}
```

**戻り値**:
```typescript
{
  id: string;
  name: string;
  model_name: string;
  port: number;
  endpoint: string;
  api_key: string | null;
  status: 'running' | 'stopped';
  enable_auth: boolean;
  created_at: string;
  updated_at: string;
}
```

---

##### `start_api`

APIを起動します。

**パラメータ**:
```typescript
{
  api_id: string;
}
```

**戻り値**: `void`

---

##### `stop_api`

APIを停止します。

**パラメータ**:
```typescript
{
  api_id: string;
}
```

**戻り値**: `void`

---

##### `update_api`

API設定を更新します。

**パラメータ**:
```typescript
{
  api_id: string;
  config: {
    name?: string;
    port?: number;
    enable_auth?: boolean;
  };
}
```

**戻り値**: `void`

**注意**: ポート番号や認証設定を変更した場合、実行中のAPIは自動的に再起動されます。

---

##### `delete_api`

APIを削除します。

**パラメータ**:
```typescript
{
  api_id: string;
}
```

**戻り値**: `void`

**注意**: 実行中のAPIは停止してから削除されます。

---

##### `get_api_key`

APIキーを取得します。

**パラメータ**:
```typescript
{
  api_id: string;
}
```

**戻り値**: `string | null`

---

##### `regenerate_api_key`

APIキーを再生成します。

**パラメータ**:
```typescript
{
  api_id: string;
}
```

**戻り値**: `string`

**注意**: 古いAPIキーは無効になります。

---

#### モデル管理

##### `get_models_list`

利用可能なモデル一覧を取得します。

**パラメータ**: なし

**戻り値**:
```typescript
Array<{
  name: string;
  size: number;
  parameters?: number;
  description?: string;
}>
```

---

##### `download_model`

モデルをダウンロードします。

**パラメータ**:
```typescript
{
  model_name: string;
}
```

**戻り値**: `void`

**イベント**: `model_download_progress`
- `status`: 'downloading' | 'completed' | 'error'
- `downloaded_bytes`: ダウンロード済みバイト数
- `total_bytes`: 総バイト数
- `speed_bytes_per_sec`: ダウンロード速度
- `message`: メッセージ

---

##### `delete_model`

モデルを削除します。

**パラメータ**:
```typescript
{
  model_name: string;
}
```

**戻り値**: `void`

---

##### `get_installed_models`

インストール済みモデル一覧を取得します。

**パラメータ**: なし

**戻り値**:
```typescript
Array<{
  name: string;
  size: number;
  parameters?: number;
  installed_at: string;
  last_used_at?: string;
  usage_count: number;
}>
```

---

#### リクエストログ

##### `save_request_log`

リクエストログを保存します（認証プロキシから呼び出される）。

**パラメータ**:
```typescript
{
  api_id: string;
  method: string;
  path: string;
  status_code: number;
  response_time_ms: number;
  request_size_bytes: number;
  response_size_bytes: number;
}
```

**戻り値**: `void`

---

##### `get_request_logs`

リクエストログ一覧を取得します。

**パラメータ**:
```typescript
{
  api_id?: string;
  limit?: number;
  offset?: number;
}
```

**戻り値**:
```typescript
Array<{
  id: string;
  api_id: string;
  method: string;
  path: string;
  status_code: number;
  response_time_ms: number;
  request_size_bytes: number;
  response_size_bytes: number;
  created_at: string;
}>
```

---

## OpenAI互換API

### 基本情報

- **ベースURL**: `http://localhost:{port}` または `http://{your-ip}:{port}`（外部アクセス時）
- **ネットワークアクセス**: 
  - デフォルトでローカルネットワーク（同一LAN内）からのアクセスも可能です
  - インターネット経由でアクセスする場合は、ファイアウォールとルーターのポート転送設定が必要です
  - 外部アクセス時はセキュリティ対策（HTTPS、IPホワイトリスト等）を推奨します（v1.3以降で実装予定）
- **認証**: Bearer Token（認証が有効な場合）
- **形式**: JSON

### エンドポイント

#### POST /v1/chat/completions

チャット補完エンドポイント。OpenAI互換形式でリクエストを受け付けます。

**認証**: Bearer Token（認証が有効な場合）

**リクエスト例**:
```http
POST http://localhost:8080/v1/chat/completions
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "model": "llama3:8b",
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "temperature": 0.7,
  "max_tokens": 100
}
```

**レスポンス例**:
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

#### GET /v1/models

利用可能なモデル一覧を取得します。

**認証**: Bearer Token（認証が有効な場合）

**リクエスト例**:
```http
GET http://localhost:8080/v1/models
Authorization: Bearer <API_KEY>
```

**レスポンス例**:
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

### エラーレスポンス

#### 401 Unauthorized

認証に失敗した場合。

```json
{
  "error": {
    "message": "認証に失敗しました。APIキーを確認してください。",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

#### 400 Bad Request

リクエストの形式が正しくない場合。

```json
{
  "error": {
    "message": "リクエストの形式が正しくありません。",
    "type": "invalid_request_error",
    "code": "malformed_request"
  }
}
```

#### 500 Internal Server Error

サーバーエラーが発生した場合。

```json
{
  "error": {
    "message": "Ollama APIに接続できませんでした。Ollamaが起動しているか確認してください。",
    "type": "api_error",
    "code": "ollama_connection_error"
  }
}
```

---

## SDK使用例

### Python

```python
import requests

# APIエンドポイントとAPIキー
api_endpoint = "http://localhost:8080/v1/chat/completions"
api_key = "your-api-key"

# リクエストヘッダー
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# リクエストボディ
data = {
    "model": "llama3:8b",
    "messages": [
        {"role": "user", "content": "Hello!"}
    ]
}

# リクエスト送信
response = requests.post(api_endpoint, headers=headers, json=data)
result = response.json()
print(result["choices"][0]["message"]["content"])
```

### JavaScript/TypeScript

```typescript
const apiEndpoint = "http://localhost:8080/v1/chat/completions";
const apiKey = "your-api-key";

const response = await fetch(apiEndpoint, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "llama3:8b",
    messages: [
      { role: "user", content: "Hello!" }
    ]
  })
});

const result = await response.json();
console.log(result.choices[0].message.content);
```

### curl

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3:8b",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

---

## 関連ドキュメント

- [認証プロキシ仕様](./AUTH_PROXY_SPEC.md): 認証プロキシの詳細な仕様
- [IPCインターフェース仕様](../INTERFACE_SPEC.md): IPCコマンドの詳細仕様
- [開発者ガイド](./DEVELOPER_GUIDE.md): 開発者向け情報

---

**このドキュメントは、FLMアプリケーションのAPIを使用するためのリファレンスです。**

