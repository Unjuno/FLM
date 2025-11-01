# FLM Authentication Proxy Server

認証プロキシサーバーの実装です。Express.jsを使用して、Ollama APIへの認証付きプロキシを提供します。

## 機能

- Bearer Token認証（APIキー検証）
- Ollama APIへのプロキシ
- OpenAI互換APIエンドポイント
- CORS対応
- エラーハンドリング

## セットアップ

```bash
cd src/backend/auth
npm install
npm start
```

## 環境変数

- `PORT`: サーバーポート（デフォルト: 8080）
- `OLLAMA_URL`: Ollama API URL（デフォルト: http://localhost:11434）
- `NODE_ENV`: 実行環境（development/production）

## エンドポイント

### ヘルスチェック（認証不要）
- `GET /health` - サーバー状態確認

### OpenAI互換API（認証必須）
- `POST /v1/chat/completions` - チャット補完
- `GET /v1/models` - モデル一覧

### Ollama API（認証必須）
- `POST /api/pull` - モデルダウンロード
- `POST /api/delete` - モデル削除
- `GET /api/tags` - モデルタグ一覧

## APIキー認証

すべてのAPIエンドポイント（`/health`を除く）は、`Authorization: Bearer <API_KEY>` ヘッダーが必要です。

## エラーレスポンス

認証エラー:
```json
{
  "error": {
    "message": "無効なAPIキーです。",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

