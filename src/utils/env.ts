/**
 * 環境変数ユーティリティ
 * Jest環境とVite環境の両方で動作するように設計
 */

type RuntimeMode = 'development' | 'test' | 'production';

/**
 * import.meta.env から MODE を取得（利用可能な環境のみ）
 */
function getImportMetaMode(): string | undefined {
  try {
    const meta = import.meta as unknown as { env?: { MODE?: string } };
    return meta?.env?.MODE;
  } catch (_error) {
    return undefined;
  }
}

/**
 * 現在の実行モードを判定する
 * - import.meta.env.MODE を優先
 * - それが無い場合は process.env.NODE_ENV を参照
 * - いずれも取得できない場合は production 扱い
 */
export function getRuntimeMode(): RuntimeMode {
  const importMetaMode = getImportMetaMode();
  if (typeof importMetaMode === 'string' && importMetaMode.length > 0) {
    const normalized = importMetaMode.toLowerCase();
    if (normalized === 'development' || normalized === 'dev') {
      return 'development';
    }
    if (normalized === 'test') {
      return 'test';
    }
    return 'production';
  }

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
