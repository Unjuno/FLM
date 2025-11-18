# APIテスト計画書（API Test Plan）

## 文書情報

- **プロジェクト名**: FLM
- **テストタイプ**: APIテスト
- **作成日**: 2024年
- **バージョン**: 1.0.0

---

## 1. 概要

### 1.1 目的

APIテストは、RESTやGraphQLなどのAPIの応答と処理を検証するテストです。APIのエンドポイントが正しく動作し、適切なレスポンスを返すことを確認します。

### 1.2 対象範囲

- 作成されたAPIのエンドポイント
- 認証プロキシ経由のAPI呼び出し
- OpenAI互換APIの動作確認
- エラーハンドリング
- レスポンスの形式確認

### 1.3 テストフレームワーク

- **フレームワーク**: Jest + fetch API
- **推奨ツール**: Postman、SoapUI、Katalon Studio
- **現状**: JestベースのAPIテスト

---

## 2. テスト対象とテスト項目

### 2.1 作成されたAPIのエンドポイント

#### 2.1.1 Chat API

**エンドポイント**: `POST /v1/chat/completions`

**テスト項目**:
- 正常なリクエストの送信
- レスポンスの形式確認
- ストリーミングレスポンスの処理
- エラーレスポンスの処理

**テスト例**:
```typescript
describe('Chat API', () => {
  it('should respond to chat completion request', async () => {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3:8b',
        messages: [
          { role: 'user', content: 'Hello, world!' }
        ],
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.choices).toBeDefined();
    expect(data.choices[0].message).toBeDefined();
  });
});
```

#### 2.1.2 Models API

**エンドポイント**: `GET /v1/models`

**テスト項目**:
- モデル一覧の取得
- レスポンスの形式確認

**テスト例**:
```typescript
describe('Models API', () => {
  it('should return list of models', async () => {
    const response = await fetch('http://localhost:8080/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });
});
```

### 2.2 認証プロキシ経由のAPI呼び出し

#### 2.2.1 APIキー認証

**テスト項目**:
- 有効なAPIキーでの認証
- 無効なAPIキーでの認証拒否
- APIキーなしでの認証拒否

**テスト例**:
```typescript
describe('API Key Authentication', () => {
  it('should accept valid API key', async () => {
    const response = await fetch('http://localhost:8080/v1/models', {
      headers: {
        'Authorization': `Bearer ${validApiKey}`,
      },
    });

    expect(response.status).toBe(200);
  });

  it('should reject invalid API key', async () => {
    const response = await fetch('http://localhost:8080/v1/models', {
      headers: {
        'Authorization': 'Bearer invalid-key',
      },
    });

    expect(response.status).toBe(401);
  });

  it('should reject request without API key when auth is enabled', async () => {
    const response = await fetch('http://localhost:8080/v1/models');

    expect(response.status).toBe(401);
  });
});
```

#### 2.2.2 認証無効時の動作

**テスト項目**:
- 認証が無効な場合のAPI呼び出し
- APIキーなしでのアクセス許可

### 2.3 OpenAI互換APIの動作確認

#### 2.3.1 互換性の確認

**テスト項目**:
- OpenAI APIと同じ形式のリクエスト
- OpenAI APIと同じ形式のレスポンス
- エラーレスポンスの互換性

**テスト例**:
```typescript
describe('OpenAI Compatibility', () => {
  it('should match OpenAI API response format', async () => {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3:8b',
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    const data = await response.json();
    // OpenAI API形式の確認
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('object');
    expect(data).toHaveProperty('created');
    expect(data).toHaveProperty('choices');
    expect(data).toHaveProperty('usage');
  });
});
```

### 2.4 エラーハンドリング

#### 2.4.1 エラーレスポンス

**テスト項目**:
- 400 Bad Requestの処理
- 401 Unauthorizedの処理
- 404 Not Foundの処理
- 500 Internal Server Errorの処理

**テスト例**:
```typescript
describe('Error Handling', () => {
  it('should return 400 for invalid request', async () => {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // 無効なリクエスト
        invalid: 'request',
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});
```

### 2.5 レスポンスの形式確認

#### 2.5.1 JSON形式の確認

**テスト項目**:
- レスポンスが有効なJSONであること
- 必須フィールドの存在確認
- データ型の確認

#### 2.5.2 ストリーミングレスポンス

**テスト項目**:
- Server-Sent Events (SSE) の処理
- ストリーミングデータの受信
- ストリーミング終了の検出

---

## 3. テスト実装方針

### 3.1 テスト環境の設定

```typescript
describe('API Tests', () => {
  let apiEndpoint: string;
  let apiKey: string;
  let createdApiId: string;

  beforeAll(async () => {
    // APIを作成
    const api = await createTestApi();
    apiEndpoint = api.endpoint;
    apiKey = api.api_key || '';
    createdApiId = api.id;

    // APIを起動
    await startApi(createdApiId);

    // APIが起動するまで待機
    await waitForApiReady(apiEndpoint);
  });

  afterAll(async () => {
    // APIを停止・削除
    await stopApi(createdApiId);
    await deleteApi(createdApiId);
  });
});
```

### 3.2 テストヘルパー関数

```typescript
// テストヘルパー関数
async function makeApiRequest(
  endpoint: string,
  method: string,
  body?: any,
  apiKey?: string
): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

### 3.3 テストデータの管理

- テスト用のAPI設定
- テスト用のモデルデータ
- テスト用のリクエストデータ

---

## 4. テスト実装優先順位

### 優先度: 高

1. **Chat APIの動作確認**
   - 最も重要なAPIエンドポイント
   - 正常系と異常系のテスト

2. **認証プロキシの動作確認**
   - セキュリティに関わる重要な機能
   - APIキー認証のテスト

### 優先度: 中

3. **Models APIの動作確認**
   - モデル一覧取得のテスト

4. **エラーハンドリング**
   - 各種エラーレスポンスのテスト

### 優先度: 低

5. **OpenAI互換性の確認**
   - 互換性の詳細な確認

---

## 5. テスト実行方法

### 5.1 APIテストを実行

```bash
# すべてのAPIテストを実行
npm test -- tests/integration/api-integration.test.ts

# 特定のAPIテストを実行
npm test -- tests/api/chat-api.test.ts
```

### 5.2 Postmanを使用する場合

1. Postmanコレクションの作成
2. 環境変数の設定
3. テストスクリプトの記述
4. コレクションの実行

### 5.3 Katalon Studioを使用する場合

1. APIテストプロジェクトの作成
2. APIリクエストの定義
3. テストケースの作成
4. テストスイートの実行

---

## 6. テスト品質基準

### 6.1 テストの品質指標

- **網羅性**: すべてのAPIエンドポイントを網羅していること
- **再現性**: 同じ条件下で常に同じ結果が得られること
- **明確性**: テストの意図が明確であること
- **保守性**: API仕様変更に伴いテストも容易に更新できること

### 6.2 テスト結果の評価基準

- **合格**: すべてのテスト項目が期待通りに動作すること
- **不合格**: 1つ以上のテスト項目が期待通りに動作しないこと

---

## 7. CI/CDへの統合

### 7.1 自動実行

- プルリクエスト作成時に自動実行
- マージ前に必須チェック

### 7.2 テスト環境

- テスト用のAPIサーバーの起動
- テスト後のクリーンアップ

---

## 8. トラブルシューティング

### 8.1 よくある問題

**問題**: APIサーバーが起動していない
- **解決策**: テスト前にAPIサーバーを起動、または自動起動を実装

**問題**: タイムアウトエラー
- **解決策**: テストのタイムアウト時間を延長

**問題**: 認証エラー
- **解決策**: APIキーの生成と設定を確認

---

## 9. 参考資料

- 既存のAPI統合テストファイル（`tests/integration/api-integration.test.ts`）
- [Postman公式ドキュメント](https://learning.postman.com/docs/)
- [SoapUI公式ドキュメント](https://www.soapui.org/docs/)
- [Katalon Studio公式ドキュメント](https://docs.katalon.com/)

