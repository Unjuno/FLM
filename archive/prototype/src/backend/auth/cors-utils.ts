// cors-utils - CORS設定共通ユーティリティ

type AllowedOriginsMode = 'allowAll' | 'explicit' | 'deny';

interface AllowedOriginsConfig {
  mode: AllowedOriginsMode;
  origins: Set<string>;
}

interface OriginDecision {
  allowed: boolean;
  value?: string;
}

let hasWarnedForMissingOrigins = false;

function normalizeOrigin(origin?: string | null): string | null {
  if (typeof origin !== 'string') {
    return null;
  }
  const trimmed = origin.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAllowedOriginsEnv(): string[] | null {
  const envValue = process.env.ALLOWED_ORIGINS;
  if (!envValue) {
    return null;
  }

  if (envValue.trim() === '*') {
    return ['*'];
  }

  return envValue
    .split(',')
    .map(value => value.trim())
    .filter(value => value.length > 0);
}

function resolveMode(): AllowedOriginsConfig {
  const originsFromEnv = parseAllowedOriginsEnv();

  if (originsFromEnv && originsFromEnv.length > 0) {
    if (originsFromEnv.includes('*')) {
      return { mode: 'allowAll', origins: new Set() };
    }
    return { mode: 'explicit', origins: new Set(originsFromEnv) };
  }

  const nodeEnv = (process.env.NODE_ENV || 'production').toLowerCase();
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return { mode: 'allowAll', origins: new Set() };
  }

  if (!hasWarnedForMissingOrigins) {
    console.warn(
      '[SECURITY] ALLOWED_ORIGINSが設定されていません。CORSリクエストは拒否されます。'
    );
    console.warn(
      '[SECURITY] 本番環境では、ALLOWED_ORIGINSを明示的に設定してください。'
    );
    hasWarnedForMissingOrigins = true;
  }

  return { mode: 'deny', origins: new Set() };
}

/**
 * リクエストオリジンが許可されているか判定する
 * @param origin リクエストのOriginヘッダー
 */
export function evaluateCorsOrigin(origin?: string | null): OriginDecision {
  const normalizedOrigin = normalizeOrigin(origin);
  const config = resolveMode();

  if (config.mode === 'allowAll') {
    return {
      allowed: true,
      value: normalizedOrigin || undefined,
    };
  }

  if (!normalizedOrigin) {
    // Originヘッダーが存在しない場合（例えば同一オリジン、または非ブラウザクライアント）は許可
    return { allowed: true };
  }

  if (config.mode === 'explicit') {
    if (config.origins.has(normalizedOrigin)) {
      return {
        allowed: true,
        value: normalizedOrigin,
      };
    }
    return { allowed: false };
  }

  return { allowed: false };
}
