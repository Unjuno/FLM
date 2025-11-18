// rate-limit-redis - Redisを使用したレート制限機能（オプション）
// 本番環境で複数インスタンスを運用する場合に使用

import { Request, Response, NextFunction } from 'express';
import { hashApiKey, hashIpAddress } from './keygen.js';
import {
  getDefaultRateLimitConfig,
  clearRateLimitConfigCache,
  checkRateLimit as checkRateLimitMemory,
  getRequestIdentifier as getRequestIdentifierMemory,
} from './rate-limit.js';

// Redisモジュールの型定義（オプション依存のため、型安全な方法で定義）
// redisパッケージがインストールされていない場合でも型エラーを回避
interface RedisClientInterface {
  connect(): Promise<void>;
  quit(): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  on(event: string, callback: (err: Error) => void): void;
}

// 型安全なRedisClient型（オプション依存のため、unknownから型アサーションを使用）
type RedisClient = RedisClientInterface | null;

/**
 * Redis接続（オプション）
 * Redisが利用可能な場合のみ使用
 */
let redisClient: RedisClient | null = null;

/**
 * Redis接続を初期化（オプション）
 * 環境変数 REDIS_URL が設定されている場合のみ接続
 */
export async function initializeRedisRateLimit(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return false;
  }

  try {
    // Redisクライアントの動的インポート（オプション依存）
    // 注意: redisパッケージはオプション依存のため、インストールされていない場合はnullを返す
    // 型安全な方法で動的インポートを処理
    const redisModule = await import('redis').catch(() => null);
    if (!redisModule) {
      return false;
    }

    // 型安全な方法でcreateClientを取得
    const redis = redisModule as {
      createClient: (options: { url: string }) => RedisClientInterface;
    };
    if (!redis || !redis.createClient) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[RATE_LIMIT] Redisパッケージがインストールされていません。メモリ内ストアを使用します。'
        );
      }
      return false;
    }

    redisClient = redis.createClient({
      url: redisUrl,
    });

    redisClient.on('error', (err: Error) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[RATE_LIMIT] Redis接続エラー:', err);
      }
      // エラー時はメモリ内ストアにフォールバック
      redisClient = null;
    });

    await redisClient.connect();
    if (process.env.NODE_ENV === 'development') {
      console.log('[RATE_LIMIT] Redis接続が確立されました。');
    }
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[RATE_LIMIT] Redis接続に失敗しました。メモリ内ストアを使用します。',
        error
      );
    }
    redisClient = null;
    return false;
  }
}

/**
 * Redis接続をクリーンアップ
 */
export async function cleanupRedisRateLimit(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error) {
      // エラーは無視（既に切断されている可能性がある）
    }
    redisClient = null;
  }
}

/**
 * Redisを使用したレート制限チェック
 */
async function checkRateLimitRedis(
  identifier: string,
  config: { enabled: boolean; requests: number; windowSeconds: number }
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (!redisClient || !config.enabled) {
    // Redisが利用できない場合は、メモリ内ストアにフォールバック
    return {
      allowed: true,
      remaining: config.requests,
      resetAt: Date.now() + config.windowSeconds * 1000,
    };
  }

  try {
    const now = Date.now();
    const windowStart = Math.floor(now / (config.windowSeconds * 1000));
    const key = `rate_limit:${identifier}:${windowStart}`;
    const resetAt = (windowStart + 1) * config.windowSeconds * 1000;

    // Redisでカウントを取得・増加
    const count = await redisClient.incr(key);
    await redisClient.expire(key, config.windowSeconds);

    const remaining = Math.max(0, config.requests - count);
    const allowed = count <= config.requests;

    return {
      allowed,
      remaining,
      resetAt,
    };
  } catch (error) {
    // Redisエラー時はメモリ内ストアにフォールバック
    if (process.env.NODE_ENV === 'development') {
      console.error('[RATE_LIMIT] Redis操作エラー:', error);
    }
    return {
      allowed: true,
      remaining: config.requests,
      resetAt: Date.now() + config.windowSeconds * 1000,
    };
  }
}

/**
 * リクエストの識別子を取得（rate-limit.tsと同じロジック）
 */
function getRequestIdentifier(req: Request): string {
  const authHeader = req.headers.authorization;
  const apiId = process.env.API_ID || '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.replace('Bearer ', '');
    const apiKeyHash = hashApiKey(apiKey);
    return `${apiId}:key:${apiKeyHash}`;
  }

  // IPアドレスを取得（プロキシ経由の場合はX-Forwarded-Forヘッダーを確認）
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';

  // IPアドレスをハッシュ化（プライバシー保護）
  const ipHash = hashIpAddress(ip);
  return `${apiId}:ip:${ipHash}`;
}

/**
 * Redisを使用したレート制限ミドルウェア
 * Redisが利用可能な場合はRedisを使用、そうでない場合はメモリ内ストアにフォールバック
 */
export async function rateLimitMiddlewareRedis(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const identifier = getRequestIdentifier(req);
    const config = getDefaultRateLimitConfig();

    // Redisが利用可能な場合はRedisを使用、そうでない場合はメモリ内ストアを使用
    let result;
    if (redisClient) {
      result = await checkRateLimitRedis(identifier, config);
    } else {
      // メモリ内ストアを使用（rate-limit.tsの関数を使用）
      result = checkRateLimitMemory(identifier, config);
    }

    // レート制限ヘッダーを設定
    res.setHeader('X-RateLimit-Limit', String(config.requests));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(result.resetAt / 1000))
    );

    if (!result.allowed) {
      res.status(429).json({
        error: {
          message:
            'リクエストが多すぎます。しばらく待ってから再度お試しください。',
          type: 'rate_limit_error',
          code: 'too_many_requests',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
      });
      return;
    }

    next();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[RATE_LIMIT] レート制限チェックエラー:', error);
    }
    // エラー時はリクエストを許可（可用性を優先）
    next();
  }
}
