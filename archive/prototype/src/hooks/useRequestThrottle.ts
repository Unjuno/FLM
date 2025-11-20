// useRequestThrottle - リクエストのスロットリング機能を提供するカスタムフック

import { useRef, useCallback } from 'react';

/**
 * リクエストスロットリングのオプション
 */
export interface UseRequestThrottleOptions {
  /**
   * 最小リクエスト間隔（ミリ秒）
   */
  minInterval: number;
}

/**
 * リクエストのスロットリング機能を提供するカスタムフック
 *
 * @param options オプション
 * @returns スロットルチェック関数とリクエスト時刻更新関数
 */
export function useRequestThrottle(options: UseRequestThrottleOptions) {
  const { minInterval } = options;
  const lastRequestTimeRef = useRef<number>(0);

  /**
   * リクエストを実行できるかチェック
   *
   * @param force 強制実行するか
   * @returns 実行可能かどうか
   */
  const canRequest = useCallback(
    (force: boolean = false): boolean => {
      if (force) {
        return true;
      }

      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTimeRef.current;
      return timeSinceLastRequest >= minInterval;
    },
    [minInterval]
  );

  /**
   * リクエスト時刻を更新
   */
  const updateRequestTime = useCallback(() => {
    lastRequestTimeRef.current = Date.now();
  }, []);

  return {
    canRequest,
    updateRequestTime,
    lastRequestTimeRef,
  };
}
