// retry - 自動リトライユーティリティ

/**
 * リトライ設定
 */
export interface RetryConfig {
  /** 最大リトライ回数（デフォルト: 3） */
  maxRetries?: number;
  /** リトライ間隔（ミリ秒、デフォルト: 1000） */
  retryDelay?: number;
  /** リトライ間隔を段階的に延長するか（デフォルト: true） */
  exponentialBackoff?: boolean;
  /** リトライ可能なエラーかどうかを判定する関数 */
  shouldRetry?: (error: unknown) => boolean;
  /** リトライ中の進捗コールバック */
  onRetry?: (attempt: number, maxRetries: number) => void;
}

/**
 * デフォルトのリトライ設定
 */
const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
};

/**
 * 自動リトライ機能付きで関数を実行
 *
 * @param fn 実行する関数
 * @param config リトライ設定
 * @returns 実行結果
 * @throws すべてのリトライが失敗した場合、最後のエラーをスロー
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => await fetch('/api/data'),
 *   {
 *     maxRetries: 3,
 *     retryDelay: 1000,
 *     onRetry: (attempt, max) => console.log(`リトライ中... (${attempt}/${max})`),
 *   }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_CONFIG.maxRetries,
    retryDelay = DEFAULT_CONFIG.retryDelay,
    exponentialBackoff = DEFAULT_CONFIG.exponentialBackoff,
    shouldRetry,
    onRetry,
  } = config;

  let lastError: unknown;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // リトライ可能かどうかを判定
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      attempt++;

      // 最後の試行の場合はエラーをスロー
      if (attempt >= maxRetries) {
        break;
      }

      // リトライ中の進捗コールバック
      if (onRetry) {
        onRetry(attempt, maxRetries);
      }

      // リトライ間隔を計算（段階的に延長する場合）
      const delay = exponentialBackoff ? retryDelay * attempt : retryDelay;

      // リトライ前に待機
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // すべてのリトライが失敗した場合
  throw lastError;
}

/**
 * リトライ可能なエラーかどうかを判定（デフォルト実装）
 *
 * @param error エラーオブジェクト
 * @returns リトライ可能な場合true
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const retryablePatterns = [
      'network',
      'connection',
      'timeout',
      'temporary',
      '503',
      '429',
      '一時的',
      '接続',
      'タイムアウト',
    ];
    return retryablePatterns.some(pattern => message.includes(pattern));
  }
  return false;
}
