/**
 * タイムアウト管理ユーティリティ
 */

/**
 * 指定した時間だけ待機するPromiseを返す
 * @param ms - 待機時間（ミリ秒）
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * await delay(1000); // 1秒待機
 * ```
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * タイムアウト付きPromiseを作成
 * @param promise - 実行するPromise
 * @param timeoutMs - タイムアウト時間（ミリ秒）
 * @param errorMessage - タイムアウト時のエラーメッセージ（オプション）
 * @returns Promise<T>
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(errorMessage || `操作がタイムアウトしました (${timeoutMs}ms)`)
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * タイムアウトIDを管理するクラス
 */
export class TimeoutManager {
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * タイムアウトを設定
   * @param key - タイムアウトの識別キー
   * @param callback - タイムアウト時に実行するコールバック
   * @param delayMs - 遅延時間（ミリ秒）
   */
  set(key: string, callback: () => void, delayMs: number): void {
    // 既存のタイムアウトをクリア
    this.clear(key);

    const timeoutId = setTimeout(() => {
      this.timeouts.delete(key);
      callback();
    }, delayMs);

    this.timeouts.set(key, timeoutId);
  }

  /**
   * タイムアウトをクリア
   * @param key - タイムアウトの識別キー
   */
  clear(key: string): void {
    const timeoutId = this.timeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(key);
    }
  }

  /**
   * すべてのタイムアウトをクリア
   */
  clearAll(): void {
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();
  }

  /**
   * タイムアウトが存在するかチェック
   * @param key - タイムアウトの識別キー
   * @returns タイムアウトが存在するかどうか
   */
  has(key: string): boolean {
    return this.timeouts.has(key);
  }
}
