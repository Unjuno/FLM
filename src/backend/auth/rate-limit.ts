// rate-limit - レート制限機能
// DoS攻撃対策として、リクエストの頻度を制限します

import { Request, Response, NextFunction } from 'express';
import { hashApiKey, hashIpAddress } from './keygen.js';

/**
 * レート制限設定
 */
interface RateLimitConfig {
  enabled: boolean;
  requests: number; // リクエスト数
  windowSeconds: number; // 時間窓（秒）
}

/**
 * レート制限追跡情報
 */
interface RateLimitTracking {
  count: number;
  resetAt: number; // リセット時刻（Unix timestamp）
}

/**
 * メモリ内のレート制限追跡（シンプルな実装）
 * 本番環境では、Redisなどの外部ストアを使用することを推奨
 */
const rateLimitStore = new Map<string, RateLimitTracking>();

/**
 * レート制限ストアの最大サイズ（メモリ保護のため）
 * このサイズを超える場合は、古いエントリを削除
 */
const MAX_STORE_SIZE = 10000;

/**
 * レート制限追跡のクリーンアップ（古いエントリを削除）
 * メモリ保護のため、ストアサイズが上限を超える場合も古いエントリを削除
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  // 期限切れのエントリを特定
  for (const [key, tracking] of rateLimitStore.entries()) {
    if (now > tracking.resetAt) {
      entriesToDelete.push(key);
    }
  }

  // 期限切れのエントリを削除
  for (const key of entriesToDelete) {
    rateLimitStore.delete(key);
  }

  // ストアサイズが上限を超える場合、古いエントリを削除（FIFO方式）
  if (rateLimitStore.size > MAX_STORE_SIZE) {
    const sortedEntries = Array.from(rateLimitStore.entries()).sort(
      (a, b) => a[1].resetAt - b[1].resetAt
    );
    const toDelete = sortedEntries.slice(0, rateLimitStore.size - MAX_STORE_SIZE);
    for (const [key] of toDelete) {
      rateLimitStore.delete(key);
    }
  }
}

// 5分ごとにクリーンアップを実行
// グレースフルシャットダウン時にクリアするため、参照を保持
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * レート制限機能の初期化
 */
function initializeRateLimit(): void {
  cleanupInterval = setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

/**
 * レート制限機能のクリーンアップ（グレースフルシャットダウン用）
 */
export function cleanupRateLimit(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  rateLimitStore.clear();
}

// 初期化を実行
initializeRateLimit();

/**
 * レート制限設定のキャッシュ
 * 環境変数が変更された場合にのみ再読み込み
 */
let cachedConfig: RateLimitConfig | null = null;
let configCacheTimestamp = 0;
const CONFIG_CACHE_TTL = 5000; // 5秒間キャッシュ（環境変数の変更を検出可能）

/**
 * レート制限設定を取得（デフォルト値、キャッシュ付き）
 * 環境変数で設定可能
 */
export function getDefaultRateLimitConfig(): RateLimitConfig {
  const now = Date.now();

  // キャッシュが有効な場合は返す
  if (
    cachedConfig &&
    now - configCacheTimestamp < CONFIG_CACHE_TTL
  ) {
    return cachedConfig;
  }

  // 環境変数から設定を読み込み
  const enabled = process.env.RATE_LIMIT_ENABLED !== 'false'; // デフォルト: 有効
  const requests = parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10);
  const windowSeconds = parseInt(
    process.env.RATE_LIMIT_WINDOW_SECONDS || '60',
    10
  );

  const config: RateLimitConfig = {
    enabled,
    requests: Math.max(1, requests), // 最小1リクエスト
    windowSeconds: Math.max(1, windowSeconds), // 最小1秒
  };

  // キャッシュを更新
  cachedConfig = config;
  configCacheTimestamp = now;

  return config;
}

/**
 * レート制限設定のキャッシュをクリア（環境変数変更時の手動更新用）
 */
export function clearRateLimitConfigCache(): void {
  cachedConfig = null;
  configCacheTimestamp = 0;
}

/**
 * リクエストの識別子を取得
 * APIキーがある場合はハッシュ、ない場合はIPアドレスを使用
 */
export function getRequestIdentifier(req: Request): string {
  const authHeader = req.headers.authorization;
  const apiId = process.env.API_ID || '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.replace('Bearer ', '');
    // APIキーをハッシュ化して識別子として使用
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
 * レート制限をチェック
 * @param identifier リクエスト識別子
 * @param config レート制限設定
 * @returns 許可される場合はtrue、制限される場合はfalse
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  if (!config.enabled) {
    return {
      allowed: true,
      remaining: config.requests,
      resetAt: Date.now() + config.windowSeconds * 1000,
    };
  }

  const now = Date.now();
  const tracking = rateLimitStore.get(identifier);

  if (!tracking || now > tracking.resetAt) {
    // 新しい時間窓を開始
    const resetAt = now + config.windowSeconds * 1000;
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt,
    });
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetAt,
    };
  }

  // 既存の時間窓内
  if (tracking.count >= config.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: tracking.resetAt,
    };
  }

  // リクエスト数を増加
  tracking.count++;
  return {
    allowed: true,
    remaining: config.requests - tracking.count,
    resetAt: tracking.resetAt,
  };
}

/**
 * レート制限ミドルウェア
 * 認証が必要なエンドポイントに適用
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const identifier = getRequestIdentifier(req);
    const config = getDefaultRateLimitConfig();

    const result = checkRateLimit(identifier, config);

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
    // レート制限チェックでエラーが発生した場合、ログを出力してリクエストを許可
    // セキュリティよりも可用性を優先（レート制限はDoS対策であり、エラー時は許可する）
    if (process.env.NODE_ENV === 'development') {
      console.error('[RATE_LIMIT] レート制限チェックエラー:', error);
    }
    // エラー時はリクエストを許可（可用性を優先）
    next();
  }
}

