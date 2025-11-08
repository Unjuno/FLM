# Redis統合レート制限のセットアップガイド（上級者向け）

## 概要

**注意**: この機能は上級者向けです。一般向けアプリでは通常不要です。

本番環境で複数のインスタンスを運用する場合、メモリ内ストアではレート制限が各インスタンスで独立して管理されるため、正確な制限ができません。Redisを使用することで、すべてのインスタンス間でレート制限を共有できます。

**単一インスタンスで運用する場合は、デフォルトのメモリ内ストアで十分です。**

## セットアップ手順

### 1. Redisパッケージのインストール

```bash
npm install redis
npm install --save-dev @types/redis
```

### 2. Redisサーバーの起動

#### Dockerを使用する場合（推奨）

```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

#### ローカルインストール

- **macOS**: `brew install redis && brew services start redis`
- **Linux**: `sudo apt-get install redis-server && sudo systemctl start redis`
- **Windows**: [Redis for Windows](https://github.com/microsoftarchive/redis/releases) をダウンロード

### 3. 環境変数の設定

```bash
# Redis接続URLを設定
export REDIS_URL="redis://localhost:6379"

# パスワードが設定されている場合
export REDIS_URL="redis://:password@localhost:6379"

# SSL/TLSを使用する場合
export REDIS_URL="rediss://localhost:6380"
```

### 4. サーバーコードの更新

`src/backend/auth/server.ts` でRedis統合を有効化：

```typescript
import {
  initializeRedisRateLimit,
  cleanupRedisRateLimit,
  rateLimitMiddlewareRedis,
} from './rate-limit-redis.js';

// サーバー起動時にRedisを初期化
initializeRedisRateLimit()
  .then(redisEnabled => {
    if (redisEnabled) {
      console.log('Redis統合レート制限が有効になりました。');
    }
  })
  .catch(err => {
    console.warn('Redis初期化に失敗しました。メモリ内ストアを使用します。', err);
  });

// グレースフルシャットダウン時にRedisをクリーンアップ
const gracefulShutdown = (signal: string) => {
  // ... 既存のコード ...
  cleanupRedisRateLimit();
  // ... 既存のコード ...
};
```

### 5. ミドルウェアの切り替え（オプション）

Redisを使用する場合は、`rateLimitMiddleware` の代わりに `rateLimitMiddlewareRedis` を使用：

```typescript
// Redisが利用可能な場合はRedisを使用、そうでない場合はメモリ内ストアを使用
app.post(
  '/v1/chat/completions',
  requestLogMiddleware,
  process.env.REDIS_URL ? rateLimitMiddlewareRedis : rateLimitMiddleware,
  authMiddleware,
  createProxyMiddleware(`${ENGINE_BASE_URL}/api/chat`)
);
```

## 動作確認

### Redis接続の確認

```bash
# Redis CLIで接続確認
redis-cli ping
# 応答: PONG
```

### ログの確認

サーバー起動時に以下のログが表示されれば、Redis接続が成功しています：

```
[RATE_LIMIT] Redis接続が確立されました。
```

## フォールバック動作

- Redisが利用できない場合、自動的にメモリ内ストアにフォールバックします
- エラー時も可用性を優先し、リクエストを許可します
- 開発環境では警告ログが出力されます

## パフォーマンス

- **メモリ内ストア**: 非常に高速（マイクロ秒単位）
- **Redis**: 高速（ミリ秒単位、ネットワークレイテンシを含む）
- **キャッシュ**: 設定は5秒間キャッシュされ、環境変数の変更を検出可能

## 注意事項

1. **Redisの可用性**: Redisがダウンした場合、自動的にメモリ内ストアにフォールバックしますが、複数インスタンス間でのレート制限は正確ではなくなります

2. **メモリ使用量**: Redisを使用する場合、メモリ使用量はRedisサーバー側で管理されます

3. **スケーラビリティ**: 大量のリクエストがある場合、Redisクラスターの使用を検討してください

## トラブルシューティング

### Redis接続エラー

```
[RATE_LIMIT] Redis接続エラー: ...
```

**解決方法**:
- Redisサーバーが起動しているか確認
- `REDIS_URL` 環境変数が正しく設定されているか確認
- ファイアウォール設定を確認

### Redisパッケージが見つからない

```
[RATE_LIMIT] Redisパッケージがインストールされていません。
```

**解決方法**:
```bash
npm install redis
```

## 参考資料

- [Redis公式ドキュメント](https://redis.io/docs/)
- [node-redis公式ドキュメント](https://github.com/redis/node-redis)

