// ip-whitelist - IPホワイトリスト機能
// 外部公開時のセキュリティ強化のため、許可されたIPアドレスのみアクセスを許可

import { Request, Response, NextFunction } from 'express';

/**
 * IPアドレスがCIDR表記の範囲内かチェック
 * @param ip IPアドレス（例: "192.168.1.1"）
 * @param cidr CIDR表記（例: "192.168.1.0/24"）
 * @returns 範囲内の場合true
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const [network, prefixLengthStr] = cidr.split('/');
  const prefixLength = parseInt(prefixLengthStr, 10);

  if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    return false;
  }

  const ipToNumber = (ip: string): number => {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return 0;
    }
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  };

  const networkNum = ipToNumber(network);
  const ipNum = ipToNumber(ip);
  const mask = ~((1 << (32 - prefixLength)) - 1);

  return (networkNum & mask) === (ipNum & mask);
}

/**
 * IPアドレスがホワイトリストに含まれているかチェック
 * @param ip IPアドレス
 * @param whitelist ホワイトリスト（IPアドレスまたはCIDR表記の配列）
 * @returns 許可されている場合true
 */
function isIpAllowed(ip: string, whitelist: string[]): boolean {
  // localhostは常に許可
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }

  for (const entry of whitelist) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // CIDR表記の場合
    if (trimmed.includes('/')) {
      if (isIpInCidr(ip, trimmed)) {
        return true;
      }
    } else {
      // 完全一致の場合
      if (ip === trimmed) {
        return true;
      }
    }
  }

  return false;
}

/**
 * リクエストからIPアドレスを取得
 * @param req Expressリクエスト
 * @returns IPアドレス
 */
function getClientIp(req: Request): string {
  // X-Forwarded-Forヘッダーから取得（プロキシ経由の場合）
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(
      ','
    );
    return ips[0].trim();
  }

  // X-Real-IPヘッダーから取得
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }

  // ソケットから直接取得
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }

  // 接続情報から取得
  if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress;
  }

  return 'unknown';
}

/**
 * IPホワイトリストを環境変数から取得
 * @returns IPホワイトリスト（配列）
 */
function getIpWhitelistFromEnv(): string[] {
  const envValue = process.env.IP_WHITELIST;
  if (!envValue) {
    return [];
  }

  return envValue
    .split(',')
    .map(ip => ip.trim())
    .filter(ip => ip.length > 0);
}

/**
 * IPホワイトリストをデータベースから取得（非同期）
 * @param apiId API ID
 * @returns IPホワイトリスト（配列）、存在しない場合は空配列
 */
async function getIpWhitelistFromDatabase(apiId: string): Promise<string[]> {
  try {
    const { getIpWhitelist } = await import('./database.js');
    const whitelist = await getIpWhitelist(apiId);
    return whitelist || [];
  } catch (err) {
    // データベースアクセスエラーの場合は空配列を返す
    if (process.env.NODE_ENV === 'development') {
      console.warn('[IP_WHITELIST] データベースからの取得エラー:', err);
    }
    return [];
  }
}

/**
 * IPホワイトリストを取得（環境変数優先、データベースはフォールバック）
 * @param apiId API ID（データベースから取得する場合に使用）
 * @returns IPホワイトリスト（配列）
 */
async function getIpWhitelist(apiId?: string): Promise<string[]> {
  // 環境変数から取得を試みる
  const envWhitelist = getIpWhitelistFromEnv();
  if (envWhitelist.length > 0) {
    return envWhitelist;
  }

  // 環境変数が空で、API IDが指定されている場合はデータベースから取得
  if (apiId) {
    return await getIpWhitelistFromDatabase(apiId);
  }

  return [];
}

/**
 * IPホワイトリストが有効かどうか
 * @returns 有効な場合true
 */
export function isIpWhitelistEnabled(): boolean {
  const envValue = process.env.ENABLE_IP_WHITELIST;
  if (!envValue) {
    return false; // デフォルトは無効
  }

  const normalized = envValue.toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

// IPホワイトリストのキャッシュ（リクエスト間で共有）
let ipWhitelistCache: string[] | null = null;
let ipWhitelistCacheApiId: string | null = null;
const IP_WHITELIST_CACHE_TTL = 60000; // 1分
let ipWhitelistCacheTimestamp = 0;

/**
 * IPホワイトリストを取得（キャッシュ付き）
 * @param apiId API ID（データベースから取得する場合に使用）
 * @returns IPホワイトリスト（配列）
 */
async function getIpWhitelistCached(apiId?: string): Promise<string[]> {
  const now = Date.now();

  // キャッシュが有効で、API IDが一致する場合はキャッシュを返す
  if (
    ipWhitelistCache !== null &&
    ipWhitelistCacheApiId === (apiId || null) &&
    now - ipWhitelistCacheTimestamp < IP_WHITELIST_CACHE_TTL
  ) {
    return ipWhitelistCache;
  }

  // キャッシュが無効またはAPI IDが異なる場合は再取得
  const whitelist = await getIpWhitelist(apiId);
  ipWhitelistCache = whitelist;
  ipWhitelistCacheApiId = apiId || null;
  ipWhitelistCacheTimestamp = now;
  return whitelist;
}

/**
 * IPホワイトリストミドルウェア
 * ホワイトリストが有効な場合、許可されたIPアドレスのみアクセスを許可
 */
export async function ipWhitelistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // IPホワイトリストが無効な場合はスキップ
  if (!isIpWhitelistEnabled()) {
    return next();
  }

  const clientIp = getClientIp(req);
  const apiId = process.env.API_ID;
  const whitelist = await getIpWhitelistCached(apiId);

  // ホワイトリストが空の場合は警告
  if (whitelist.length === 0) {
    console.warn(
      '[SECURITY] IPホワイトリストが有効ですが、ホワイトリストが空です。すべてのアクセスが拒否されます。'
    );
    res.status(403).json({
      error: {
        message:
          'アクセスが拒否されました。IPホワイトリストに登録されていません。',
        type: 'access_denied',
        code: 'ip_not_whitelisted',
      },
    });
    return;
  }

  // IPアドレスがホワイトリストに含まれているかチェック
  if (!isIpAllowed(clientIp, whitelist)) {
    console.warn(
      `[SECURITY] IPアドレス ${clientIp} からのアクセスが拒否されました（ホワイトリストに含まれていません）`
    );
    res.status(403).json({
      error: {
        message:
          'アクセスが拒否されました。IPホワイトリストに登録されていません。',
        type: 'access_denied',
        code: 'ip_not_whitelisted',
        client_ip: clientIp, // デバッグ用（本番環境では削除を推奨）
      },
    });
    return;
  }

  // 許可されたIPアドレスの場合、リクエストを続行
  next();
}
