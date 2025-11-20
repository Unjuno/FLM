// usePolling - 汎用的なポーリング機能を提供するカスタムフック

import { useEffect, useRef, useCallback } from 'react';

/**
 * ポーリングのオプション
 */
export interface UsePollingOptions {
  /**
   * ポーリング間隔（ミリ秒）
   */
  interval: number;
  /**
   * 最小リクエスト間隔（ミリ秒）- 連続リクエストを防ぐ
   */
  minRequestInterval?: number;
  /**
   * ポーリングを有効にするか
   */
  enabled?: boolean;
  /**
   * ページが非表示の時にポーリングをスキップするか
   */
  skipWhenHidden?: boolean;
  /**
   * 初回読み込みをスキップするか（外部で初回読み込みを実行する場合に使用）
   */
  skipInitialLoad?: boolean;
}

/**
 * 汎用的なポーリング機能を提供するカスタムフック
 *
 * @param fetchFn データ取得関数
 * @param options ポーリングオプション
 * @returns 手動リフレッシュ関数
 */
export function usePolling(
  fetchFn: (options?: { force?: boolean }) => Promise<void>,
  options: UsePollingOptions
) {
  const {
    interval,
    minRequestInterval = 3000,
    enabled = true,
    skipWhenHidden = true,
    skipInitialLoad = false,
  } = options;

  const lastRequestTimeRef = useRef<number>(0);
  const actualMinInterval = Math.min(interval, minRequestInterval);
  // 初回読み込みが実行されたかどうかを追跡
  const hasInitialLoadRef = useRef(false);
  // 前回のenabled状態を追跡
  const prevEnabledRef = useRef(enabled);
  // 最新のfetchFnを保持するref（依存配列からfetchFnを削除するため）
  const fetchFnRef = useRef(fetchFn);

  // fetchFnを常に最新に保つ
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  /**
   * 手動リフレッシュ関数
   */
  const refresh = useCallback(() => {
    fetchFnRef.current({ force: true });
  }, []);

  useEffect(() => {
    if (!enabled) {
      // enabledがfalseになったら、初回読み込みフラグをリセット
      hasInitialLoadRef.current = false;
      prevEnabledRef.current = enabled;
      return;
    }

    // 初回読み込みの実行
    // skipInitialLoadがtrueの場合はスキップ
    // enabledがfalseからtrueに変わった時、または最初からtrueの場合に実行
    const wasDisabled = !prevEnabledRef.current;
    const isFirstTime = !hasInitialLoadRef.current;

    if (!skipInitialLoad && (wasDisabled || isFirstTime) && isFirstTime) {
      hasInitialLoadRef.current = true;
      fetchFnRef.current({ force: true });
    } else if (skipInitialLoad && isFirstTime) {
      // skipInitialLoadがtrueの場合は、初回読み込みフラグを設定してスキップ
      hasInitialLoadRef.current = true;
    }
    prevEnabledRef.current = enabled;

    // 定期的にポーリング
    const timer = setInterval(() => {
      if (skipWhenHidden && document.hidden) {
        return;
      }

      // 最後のリクエストから一定時間経過している場合のみ更新
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTimeRef.current;
      if (timeSinceLastRequest >= actualMinInterval) {
        lastRequestTimeRef.current = now;
        fetchFnRef.current();
      }
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [enabled, interval, actualMinInterval, skipWhenHidden, skipInitialLoad]);

  return {
    refresh,
    lastRequestTimeRef,
  };
}
