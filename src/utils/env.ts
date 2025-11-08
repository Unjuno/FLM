/**
 * 環境変数ユーティリティ
 * Jest環境とVite環境の両方で動作するように設計
 */

/**
 * 開発環境かどうかを判定する
 * Jest環境とVite環境の両方で動作する
 *
 * Vite環境では、ビルド時にprocess.env.NODE_ENVが適切に設定されるため、
 * process.envを使用することで両環境で動作する
 */
export function isDev(): boolean {
  // process.env.NODE_ENVを使用（Vite環境でも自動的に設定される）
  // Jest環境でもprocess.env.NODE_ENVが利用可能
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV !== 'production'
  );
}
