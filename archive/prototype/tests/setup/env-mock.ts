// env-mock - env.tsのモック（Jest環境でimport.metaを回避するため）

type RuntimeMode = 'development' | 'test' | 'production';

/**
 * 現在の実行モードを判定する
 */
export function getRuntimeMode(): RuntimeMode {
  const nodeEnv =
    (typeof process !== 'undefined' && process.env?.NODE_ENV) || undefined;
  if (typeof nodeEnv === 'string' && nodeEnv.length > 0) {
    const normalized = nodeEnv.toLowerCase();
    if (normalized === 'development') {
      return 'development';
    }
    if (normalized === 'test') {
      return 'test';
    }
  }

  return 'production';
}

/**
 * 開発モードかどうか
 */
export function isDev(): boolean {
  return getRuntimeMode() === 'development';
}

/**
 * テストモードかどうか
 */
export function isTest(): boolean {
  return getRuntimeMode() === 'test';
}

/**
 * 本番モードかどうか
 */
export function isProd(): boolean {
  return getRuntimeMode() === 'production';
}

