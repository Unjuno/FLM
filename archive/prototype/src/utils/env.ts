/**
 * 環境変数ユーティリティ
 * Jest環境とVite環境の両方で動作するように設計
 */

type RuntimeMode = 'development' | 'test' | 'production';

/**
 * 現在の実行モードを判定する
 * - process.env.NODE_ENV を参照
 * - それが無い場合は production 扱い
 * 
 * 注意: Jest環境ではimport.metaが使用できないため、process.env.NODE_ENVのみを使用
 * Vite環境でもprocess.env.NODE_ENVが設定されているため、この方法で動作します
 */
export function getRuntimeMode(): RuntimeMode {
  const nodeEnv =
    (typeof process !== 'undefined' && process.env?.NODE_ENV) || undefined;
  if (typeof nodeEnv === 'string' && nodeEnv.length > 0) {
    const normalized = nodeEnv.toLowerCase();
    if (normalized === 'development' || normalized === 'dev') {
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
