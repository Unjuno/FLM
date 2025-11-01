# FLM - モジュール間インターフェース仕様書

## 文書情報

- **プロジェクト名**: FLM
- **バージョン**: 1.0.0
- **作成日**: 2024年
- **作成者**: アーキテクトエージェント (ARCH)
- **最終更新日**: 2024年（フェーズ4完了時点）

---

## 目次

1. [IPC (Inter-Process Communication) 仕様](#ipc-inter-process-communication-仕様)
2. [認証プロキシAPI仕様](#認証プロキシapi仕様)
3. [データベースインターフェース仕様](#データベースインターフェース仕様)
4. [エラーハンドリング仕様](#エラーハンドリング仕様)

---

## IPC (Inter-Process Communication) 仕様

### 概要

フロントエンド (React/TypeScript) とバックエンド (Rust/Tauri) 間の通信は、Tauriの `invoke` APIを使用します。

### コマンド命名規則

- 形式: `{action}_{module}` または `{action}`
- 実装済みコマンド例: `create_api`, `detect_ollama`, `get_models_list`
- コマンド名は実装されている関数名（スネークケース）に対応します

### 主要コマンド一覧

#### 1. Ollama関連コマンド

##### `detect_ollama`
Ollamaの検出

**リクエスト**:
```typescript
await invoke('detect_ollama')
```

**レスポンス**:
```typescript
{
  installed: boolean;        // インストール済みか
  running: boolean;          // 実行中か
  version?: string;          // バージョン（存在する場合）
  path?: string;            // パス（存在する場合）
}
```

**エラー**: `string`（エラーメッセージ）

---

##### `download_ollama`
Ollamaの自動ダウンロード

**リクエスト**:
```typescript
await invoke('download_ollama', {
  platform?: 'windows' | 'macos' | 'linux';  // プラットフォーム（オプション、自動検出可能）
})
```

**レスポンス**: イベント経由で進捗を送信
```typescript
// イベント: 'ollama-download-progress'
{
  progress: number;         // 0-100
  downloaded: number;       // ダウンロード済みバイト数
  total: number;           // 総バイト数
  speed: number;           // ダウンロード速度 (bytes/sec)
}

// 完了時、コマンド自体は成功時に void を返します
```

**エラー**: `string`（エラーメッセージ）

---

##### `start_ollama`
Ollamaプロセスの起動

**リクエスト**:
```typescript
await invoke('start_ollama', {
  ollama_path?: string;    // Ollama実行ファイルのパス（オプション、省略時は自動検出）
})
```

**レスポンス**:
```typescript
number  // プロセスID（PID）
```

**エラー**: `string`（エラーメッセージ）

---

##### `stop_ollama`
Ollamaプロセスの停止

**リクエスト**:
```typescript
await invoke('stop_ollama')
```

**レスポンス**:
```typescript
// 成功時、void（空のレスポンス）
```

**エラー**: `string`（エラーメッセージ）

**注意**: インストール済みモデル一覧は `get_installed_models` コマンドを使用してください（モデル管理コマンドセクションを参照）。

---

#### 2. API関連コマンド

##### `create_api`
API作成

**リクエスト**:
```typescript
await invoke('create_api', {
  name: string;                    // API名
  model_name: string;              // モデル名（例: "llama3", "mistral"）
  port?: number;                   // ポート番号（オプション、デフォルト: 8080）
  enable_auth?: boolean;           // 認証有効化（オプション、デフォルト: true）
})
```

**レスポンス**:
```typescript
{
  id: string;                      // API ID (UUID)
  name: string;
  endpoint: string;                // http://localhost:{port}
  api_key: string | null;          // APIキー（認証が有効な場合、表示用）
  model_name: string;
  port: number;
  status: string;                  // "running" | "stopped"
}
```

**エラー**: `string`（エラーメッセージ）

**注意**: 
- Ollamaが起動していない場合、自動的に起動を試みます
- 指定されたモデルがインストールされていない場合、エラーが返されます
- 認証が有効な場合、APIキーが自動生成され、暗号化してデータベースに保存されます

---

##### `list_apis`
API一覧取得

**リクエスト**:
```typescript
await invoke('list_apis')
```

**レスポンス**:
```typescript
Array<{
  id: string;
  name: string;
  endpoint: string;          // http://localhost:{port}
  model_name: string;
  port: number;
  enable_auth: boolean;
  status: string;           // "running" | "stopped"
  created_at: string;        // ISO 8601形式
  updated_at: string;        // ISO 8601形式
}>
```

**エラー**: `string`（エラーメッセージ）

---

##### `start_api`
API起動

**リクエスト**:
```typescript
await invoke('start_api', {
  api_id: string;          // API ID
})
```

**レスポンス**:
```typescript
// 成功時、void（空のレスポンス）
```

**エラー**: `string`（エラーメッセージ）

**注意**: 
- Ollamaが起動していない場合、自動的に起動を試みます
- 認証が有効な場合、認証プロキシサーバーが自動的に起動されます
- ポートが既に使用されている場合、エラーが返されます

---

##### `stop_api`
API停止

**リクエスト**:
```typescript
await invoke('stop_api', {
  api_id: string;          // API ID
})
```

**レスポンス**:
```typescript
// 成功時、void（空のレスポンス）
```

**エラー**: `string`（エラーメッセージ）

**注意**: 認証プロキシサーバーが実行中の場合は自動的に停止されます。

---

##### `delete_api`
API削除

**リクエスト**:
```typescript
await invoke('delete_api', {
  api_id: string;          // API ID
})
```

**レスポンス**:
```typescript
// 成功時、void（空のレスポンス）
```

**エラー**: `string`（エラーメッセージ）

**注意**: 
- APIが実行中の場合は自動的に停止されます
- 関連するAPIキーも自動的に削除されます（データベースのCASCADE制約により）

---

##### `get_api_details`
API詳細情報取得

**リクエスト**:
```typescript
await invoke('get_api_details', {
  api_id: string;
})
```

**レスポンス**:
```typescript
{
  id: string;
  name: string;
  endpoint: string;        // http://localhost:{port}
  model_name: string;
  port: number;
  enable_auth: boolean;
  status: 'running' | 'stopped';
  api_key: string | null;  // 復号化済み（認証が有効な場合）
  created_at: string;      // ISO 8601形式
  updated_at: string;      // ISO 8601形式
}
```

**エラー**: `string`（エラーメッセージ）

---

##### `update_api`
API設定更新

**リクエスト**:
```typescript
await invoke('update_api', {
  api_id: string;
  config: {
    name?: string;         // API名（オプション）
    port?: number;         // ポート番号（オプション）
    enable_auth?: boolean; // 認証設定（オプション）
  };
})
```

**レスポンス**:
```typescript
// 成功時、void（空のレスポンス）
```

**エラー**: `string`（エラーメッセージ）

**注意**: ポート番号や認証設定を変更した場合、APIが実行中であれば自動的に再起動されます。

---

##### `get_api_key`
APIキー取得

**リクエスト**:
```typescript
await invoke('get_api_key', {
  api_id: string;
})
```

**レスポンス**:
```typescript
string | null  // 復号化済みAPIキー（認証が有効な場合）、認証が無効な場合はnull
```

**エラー**: `string`（エラーメッセージ）

---

##### `regenerate_api_key`
APIキー再生成

**リクエスト**:
```typescript
await invoke('regenerate_api_key', {
  api_id: string;
})
```

**レスポンス**:
```typescript
string  // 新しく生成されたAPIキー（復号化済み）
```

**エラー**: `string`（エラーメッセージ）

**注意**: 既存のAPIキーは無効になり、新しいAPIキーが生成されます。

---

##### `delete_api_key`
APIキー削除

**リクエスト**:
```typescript
await invoke('delete_api_key', {
  api_id: string;
})
```

**レスポンス**:
```typescript
// 成功時、void（空のレスポンス）
```

**エラー**: `string`（エラーメッセージ）

**注意**: APIキーを削除すると、認証が無効になります。

---

#### 3. モデル管理コマンド

**注意**: モデル管理コマンドはOllama APIと直接通信します。モデルカタログ情報はデータベースにキャッシュされません。

##### `get_models_list`
モデルカタログ一覧取得

**リクエスト**:
```typescript
await invoke('get_models_list')
```

**レスポンス**:
```typescript
Array<{
  name: string;
  size: number | null;           // バイト数（不明な場合はnull）
  modified_at: string;           // ISO 8601形式
  parameter_size: string | null;  // パラメータサイズ（例: "7B", "8B"）（推定値、不明な場合はnull）
}>
```

**エラー**: `string`（エラーメッセージ）

**注意**: このコマンドはOllama APIから直接モデル情報を取得します。データベースにキャッシュされているモデルカタログ情報は使用されません。

---

##### `download_model`
モデルダウンロード

**リクエスト**:
```typescript
await invoke('download_model', {
  model_name: string;      // モデル名（例: "llama3", "mistral"）
})
```

**レスポンス**: イベント経由で進捗を送信
```typescript
// イベント: 'model-download-progress'
{
  status: string;              // "pulling" | "completed" | "error"
  progress: number;            // 0.0 - 100.0
  downloaded_bytes: number;    // ダウンロード済みバイト数
  total_bytes: number;         // 総バイト数
  speed_bytes_per_sec: number; // ダウンロード速度（バイト/秒）
  message: string | null;      // ステータスメッセージ（オプション）
}
```

**完了時**: コマンド自体は成功時に `void` を返します。進捗はイベントで通知されます。

**エラー**: `string`（エラーメッセージ）

---

##### `delete_model`
モデル削除

**リクエスト**:
```typescript
await invoke('delete_model', {
  model_name: string;      // モデル名
})
```

**レスポンス**:
```typescript
// 成功時、void（空のレスポンス）
```

**エラー**: `string`（エラーメッセージ）

---

##### `get_installed_models`
インストール済みモデル一覧取得

**リクエスト**:
```typescript
await invoke('get_installed_models')
```

**レスポンス**:
```typescript
Array<{
  name: string;
  size: number;               // バイト数
  parameters: number | null;   // パラメータ数（推定値、不明な場合はnull）
  installed_at: string;        // ISO 8601形式
  last_used_at: string | null; // ISO 8601形式（使用履歴がない場合はnull）
  usage_count: number;        // 使用回数
}>
```

**エラー**: `string`（エラーメッセージ）

**注意**: このコマンドはデータベースに保存されているインストール済みモデル情報と、Ollama APIから取得した最新情報を統合して返します。

---

---

### イベント仕様

Tauriのイベントシステムを使用して、進捗や状態変更を通知します。

**リスニング例**:
```typescript
import { listen } from '@tauri-apps/api/event';

listen('ollama_download_progress', (event) => {
  console.log(event.payload); // { progress: 50, ... }
});
```

**イベント一覧**:
- `ollama-download-progress`: Ollamaダウンロード進捗
- `model-download-progress`: モデルダウンロード進捗（`download_model`コマンドで発行）
- `api-status-changed`: APIステータス変更（将来実装予定）

---

## 認証プロキシAPI仕様

### エンドポイント

#### `POST /v1/chat/completions`
OpenAI互換チャットAPI

**リクエスト**:
```http
POST /v1/chat/completions HTTP/1.1
Host: localhost:8080
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "model": "llama3",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "stream": false
}
```

**レスポンス**:
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "llama3",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 5,
    "completion_tokens": 10,
    "total_tokens": 15
  }
}
```

**エラー**:
```json
{
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

---

#### `GET /v1/models`
利用可能なモデル一覧

**リクエスト**:
```http
GET /v1/models HTTP/1.1
Host: localhost:8080
Authorization: Bearer <API_KEY>
```

**レスポンス**:
```json
{
  "object": "list",
  "data": [
    {
      "id": "llama3",
      "object": "model",
      "created": 1234567890,
      "owned_by": "ollama"
    }
  ]
}
```

---

#### 4. リクエストログコマンド（F006基盤機能）

##### `save_request_log`
リクエストログ保存

**リクエスト**:
```typescript
await invoke('save_request_log', {
  request: {
    api_id: string;
    method: string;              // HTTPメソッド（例: "GET", "POST"）
    path: string;                // リクエストパス（例: "/v1/chat/completions"）
    request_body: string | null;  // リクエストボディ（JSON文字列、10KB以下、大きい場合はnull）
    response_status: number | null; // HTTPステータスコード
    response_time_ms: number | null; // レスポンス時間（ミリ秒）
    error_message: string | null;    // エラーメッセージ（エラー発生時）
  };
})
```

**レスポンス**:
```typescript
// 成功時、void（空のレスポンス）
```

**エラー**: `string`（エラーメッセージ）

**注意**: このコマンドは認証プロキシサーバーから呼び出されます（現在は実装準備中）。フロントエンドから直接呼び出すことは通常ありません。

---

##### `get_request_logs`
リクエストログ一覧取得

**リクエスト**:
```typescript
await invoke('get_request_logs', {
  request: {
    api_id?: string;      // API ID（指定するとそのAPIのログのみ取得、省略すると全APIのログを取得）
    limit?: number;       // 取得件数の上限（オプション、デフォルト: 100）
    offset?: number;      // オフセット（ページネーション用、オプション、デフォルト: 0）
  };
})
```

**レスポンス**:
```typescript
Array<{
  id: string;                    // ログID（UUID）
  api_id: string;                 // API ID
  method: string;                 // HTTPメソッド
  path: string;                  // リクエストパス
  request_body: string | null;   // リクエストボディ（JSON文字列）
  response_status: number | null; // HTTPステータスコード
  response_time_ms: number | null; // レスポンス時間（ミリ秒）
  error_message: string | null;    // エラーメッセージ
  created_at: string;            // ISO 8601形式
}>
```

**エラー**: `string`（エラーメッセージ）

**注意**: ログは最新順にソートされて返されます。

---

#### 5. データベース管理コマンド

##### `check_database_integrity`
データベース整合性チェック

**リクエスト**:
```typescript
await invoke('check_database_integrity')
```

**レスポンス**:
```typescript
{
  is_valid: boolean;
  errors: Array<{
    type: string;         // エラータイプ
    message: string;      // エラーメッセージ
  }>;
  summary: {
    total_apis: number;
    total_api_keys: number;
    total_models: number;
    orphaned_records: number;  // 孤立レコード数
  };
}
```

**エラー**: `string`（エラーメッセージ）

---

##### `fix_database_integrity`
データベース整合性修復

**リクエスト**:
```typescript
await invoke('fix_database_integrity')
```

**レスポンス**:
```typescript
{
  is_valid: boolean;
  errors: Array<{
    type: string;
    message: string;
  }>;
  summary: {
    total_apis: number;
    total_api_keys: number;
    total_models: number;
    orphaned_records: number;
    fixed_records: number;  // 修復されたレコード数
  };
}
```

**エラー**: `string`（エラーメッセージ）

**注意**: このコマンドは孤立レコード（外部キー制約違反）を自動的に削除します。実行前にバックアップを推奨します。

---

## データベースインターフェース仕様

詳細は `DATABASE_SCHEMA.sql` を参照。

主要な操作:
- `database::repository::ApiRepository`: API設定のCRUD操作
- `database::repository::ApiKeyRepository`: APIキーの管理（暗号化・復号化）
- `database::repository::InstalledModelRepository`: インストール済みモデル情報の管理
- `database::repository::RequestLogRepository`: リクエストログの保存・取得

---

## エラーハンドリング仕様

### エラー型定義

#### Rust側 (バックエンド)
```rust
#[derive(Debug, serde::Serialize)]
pub enum AppError {
    OllamaError { message: String },
    ApiError { message: String, code: String },
    ModelError { message: String },
    DatabaseError { message: String },
    ValidationError { message: String },
}
```

#### TypeScript側 (フロントエンド)
```typescript
interface AppError {
  message: string;
  code?: string;
  type?: 'ollama' | 'api' | 'model' | 'database' | 'validation';
}
```

### エラーメッセージ原則

1. **非開発者向け**: 専門用語を避け、わかりやすい表現を使用
2. **具体的**: 何が問題で、どうすれば解決できるかを明示
3. **多言語対応準備**: 将来の多言語化を考慮した構造

**例**:
- ❌ "Ollama process failed to start: EACCES"
- ✅ "Ollamaの起動に失敗しました。管理者権限で実行してください。"

---

## バージョニング

インターフェースの変更時は、バージョンを更新し、後方互換性を維持します。

- **v1.0**: 初期リリース
- **v1.1**: ログ機能追加（後方互換）
- **v2.0**: 破壊的変更（将来）

---

**この仕様書は、実装中に必要に応じて更新されます。**




