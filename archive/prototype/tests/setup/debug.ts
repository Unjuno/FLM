// debug - デバッグログの統一管理
// 監査レポートの推奨事項に基づき、すべてのテストで使用可能な統一されたデバッグログ機能を提供

/**
 * デバッグログの統一管理
 * JEST_DEBUG環境変数またはNODE_ENV=developmentの時にログを出力
 * @param args - ログに出力する引数
 */
export const debugLog = (...args: unknown[]): void => {
  if (
    process.env.JEST_DEBUG === '1' ||
    process.env.NODE_ENV === 'development'
  ) {
    console.log('[TEST DEBUG]', ...args);
  }
};

/**
 * デバッグ警告ログ
 * @param args - ログに出力する引数
 */
export const debugWarn = (...args: unknown[]): void => {
  if (
    process.env.JEST_DEBUG === '1' ||
    process.env.NODE_ENV === 'development'
  ) {
    console.warn('[TEST WARN]', ...args);
  }
};

/**
 * デバッグエラーログ
 * @param args - ログに出力する引数
 */
export const debugError = (...args: unknown[]): void => {
  if (
    process.env.JEST_DEBUG === '1' ||
    process.env.NODE_ENV === 'development'
  ) {
    console.error('[TEST ERROR]', ...args);
  }
};

/**
 * デバッグ情報ログ
 * @param args - ログに出力する引数
 */
export const debugInfo = (...args: unknown[]): void => {
  if (
    process.env.JEST_DEBUG === '1' ||
    process.env.NODE_ENV === 'development'
  ) {
    console.info('[TEST INFO]', ...args);
  }
};

/**
 * デバッグモードが有効かどうかをチェック
 * @returns デバッグモードが有効な場合true、それ以外はfalse
 */
export const isDebugMode = (): boolean => {
  return (
    process.env.JEST_DEBUG === '1' || process.env.NODE_ENV === 'development'
  );
};
