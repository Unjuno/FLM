# OAuth2認証サーバー実装ガイド

## 概要

OAuth2を使用する場合の認証プロキシサーバーの実装について説明します。現在の実装では、APIキー認証とOAuth2トークン認証の両方に対応しています。

## アーキテクチャ

### 認証フロー

```
クライアント
  ↓
認証プロキシサーバー (Express.js)
  ├─ APIキー検証
  └─ OAuth2トークン検証
      ├─ データベース検証
      ├─ イントロスペクションエンドポイント検証
      └─ JWT検証
  ↓
LLMエンジン (Ollama、LM Studio等)
```

## 実装ファイル

### 1. 認証ミドルウェア (`src/backend/auth/server.ts`)

**ファイル**: `src/backend/auth/server.ts`

```typescript
// 認証ミドルウェア（APIキーまたはOAuth2トークン対応）
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: {
                message: '認証が必要です。APIキーまたはOAuth2トークンを指定してください。',
                type: 'authentication_error',
                code: 'missing_credentials'
            }
        });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const apiId = process.env.API_ID || '';
    
    // 1. まずAPIキーとして検証
    const isApiKeyValid = await validateApiKey(token);
    
    if (isApiKeyValid) {
        // APIキー認証成功
        return next();
    }
    
    // 2. OAuth2トークンとして検証
    try {
        // OAuth2設定を取得
        const oauthConfig = await getOAuthConfig(apiId);
        
        // OAuth2トークンを検証
        const oauthResult = await validateOAuthToken(token, apiId, oauthConfig || undefined);
        
        if (oauthResult.valid) {
            // OAuth2認証成功
            return next();
        }
        
        // 両方の認証方法が失敗した場合
        return res.status(401).json({
            error: {
                message: '無効なAPIキーまたはOAuth2トークンです。',
                type: 'authentication_error',
                code: 'invalid_credentials'
            }
        });
    } catch (err) {
        // OAuth2検証エラー
        return res.status(401).json({
            error: {
                message: '認証に失敗しました。',
                type: 'authentication_error',
                code: 'authentication_failed'
            }
        });
    }
};
```

**動作**:
1. `Authorization: Bearer <token>` ヘッダーからトークンを取得
2. まずAPIキーとして検証
3. 失敗した場合、OAuth2トークンとして検証
4. どちらかが成功すればリクエストを通過

### 2. OAuth2トークン検証モジュール (`src/backend/auth/oauth-validator.ts`)

**ファイル**: `src/backend/auth/oauth-validator.ts`

**機能**:
- **データベース検証**: 保存済みトークンを検証
- **イントロスペクション検証**: OAuth2イントロスペクションエンドポイントで検証
- **JWT検証**: JWT形式のトークンを検証（簡易実装）

**検証順序**:
1. データベースに保存されたトークンを検証（最速）
2. イントロスペクションエンドポイントで検証（設定されている場合）
3. JWTとして検証（設定されている場合）

### 3. データベーススキーマ (`src-tauri/src/database/schema.rs`)

**テーブル**: `oauth_tokens`

```sql
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    expires_at TEXT,
    scope TEXT,  -- JSON配列形式: ["read", "write"]
    client_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
);
```

**インデックス**:
- `idx_oauth_tokens_api_id`: API IDでの検索
- `idx_oauth_tokens_access_token`: アクセストークンでの検索
- `idx_oauth_tokens_expires_at`: 有効期限での検索

### 4. データベースアクセス関数 (`src/backend/auth/database.ts`)

**関数**:
- `saveOAuthTokenInfo(apiId, tokenInfo)`: OAuth2トークン情報を保存
- `getOAuthTokenInfo(apiId, accessToken)`: OAuth2トークン情報を取得
- `getOAuthConfig(apiId)`: API設定からOAuth2設定を取得

## 使用方法

### 1. OAuth2設定の保存

API作成時に、`engine_config`にOAuth2設定を含める：

```json
{
  "oauth_introspection_endpoint": "https://oauth.example.com/introspect",
  "oauth_client_id": "your-client-id",
  "oauth_client_secret": "your-client-secret",
  "oauth_jwks_uri": "https://oauth.example.com/.well-known/jwks.json"
}
```

### 2. リクエストでの使用

クライアントは、OAuth2トークンを`Authorization`ヘッダーに含めてリクエスト：

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer <oauth_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 3. トークン検証の流れ

1. **データベース検証**: まず、データベースに保存されたトークンを検証
   - 有効期限チェック
   - トークンが存在するかチェック

2. **イントロスペクション検証**: データベースにない場合、イントロスペクションエンドポイントで検証
   - OAuth2サーバーにトークンの有効性を確認
   - 検証成功したトークンはデータベースに保存（キャッシュ）

3. **JWT検証**: イントロスペクションが使えない場合、JWTとして検証
   - JWTの署名を検証（JWKS URIから公開鍵を取得）
   - 有効期限をチェック
   - 検証成功したトークンはデータベースに保存

## セキュリティ考慮事項

### 1. トークンの保存

- アクセストークンは平文で保存（OAuth2標準）
- リフレッシュトークンも平文で保存
- データベースは暗号化されていないため、OSレベルでの保護が必要

### 2. トークンの有効期限

- 有効期限が切れたトークンは自動的に拒否
- データベースから期限切れトークンを定期的に削除（将来実装）

### 3. イントロスペクションエンドポイント

- HTTPS必須
- Basic認証で保護
- レート制限を考慮

### 4. JWT検証

- JWKS URIから公開鍵を取得
- 署名検証を実装（現在は簡易実装）
- 完全なJWT検証には`jose`ライブラリの使用を推奨

## 設定例

### GitHub OAuth2

```json
{
  "oauth_introspection_endpoint": "https://api.github.com/applications/CLIENT_ID/token",
  "oauth_client_id": "your-github-client-id",
  "oauth_client_secret": "your-github-client-secret"
}
```

### Google OAuth2

```json
{
  "oauth_introspection_endpoint": "https://oauth2.googleapis.com/tokeninfo",
  "oauth_client_id": "your-google-client-id",
  "oauth_client_secret": "your-google-client-secret",
  "oauth_jwks_uri": "https://www.googleapis.com/oauth2/v3/certs"
}
```

### カスタムOAuth2サーバー

```json
{
  "oauth_introspection_endpoint": "https://your-oauth-server.com/introspect",
  "oauth_client_id": "your-client-id",
  "oauth_client_secret": "your-client-secret",
  "oauth_jwks_uri": "https://your-oauth-server.com/.well-known/jwks.json"
}
```

## トラブルシューティング

### トークンが無効と判定される

1. **有効期限チェック**: トークンの有効期限を確認
2. **設定確認**: OAuth2設定（イントロスペクションエンドポイント等）が正しいか確認
3. **ネットワーク**: イントロスペクションエンドポイントにアクセスできるか確認
4. **ログ確認**: 開発モードでエラーログを確認

### イントロスペクションエラー

1. **エンドポイントURL**: 正しいURLが設定されているか確認
2. **認証情報**: Client IDとClient Secretが正しいか確認
3. **ネットワーク**: ファイアウォールやプロキシ設定を確認

## 今後の拡張

- [ ] JWT署名検証の完全実装（`jose`ライブラリ使用）
- [ ] トークンリフレッシュの自動化
- [ ] 期限切れトークンの自動削除
- [ ] トークン使用状況のログ記録
- [ ] スコープベースのアクセス制御

