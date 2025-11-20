// useApiStatusBase - APIステータス取得の共通ロジック

import { useState, useCallback } from 'react';
import { safeInvoke } from '../utils/tauri';
import { useIsMounted } from './useIsMounted';
import { extractErrorMessage } from '../utils/errorHandler';
import { useRequestThrottle } from './useRequestThrottle';
import { MIN_REQUEST_INTERVAL, REFRESH_INTERVALS } from '../constants/config';

/**
 * デフォルトのエラーメッセージ
 */
const DEFAULT_ERROR_MESSAGE = 'ステータス取得に失敗しました';

/**
 * APIステータス情報（生データ - バックエンドから取得した形式）
 */
export interface ApiStatusRaw {
  /** API ID */
  id: string;
  /** ステータス（文字列形式） */
  status: string;
}

/**
 * useApiStatusBaseの戻り値の型
 */
export interface UseApiStatusBaseReturn {
  /** ローディング中かどうか */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** API一覧を取得する関数 */
  fetchApis: (options?: { force?: boolean }) => Promise<ApiStatusRaw[] | null>;
}

/**
 * ステータス取得の共通ロジック
 *
 * @param interval - ポーリング間隔（ミリ秒、デフォルト: 5000ms）
 * @returns ローディング状態、エラー、API一覧取得関数
 */
export function useApiStatusBase(
  interval: number = REFRESH_INTERVALS.API_STATUS
): UseApiStatusBaseReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useIsMounted();
  const { canRequest, updateRequestTime } = useRequestThrottle({
    minInterval: Math.min(interval, MIN_REQUEST_INTERVAL),
  });

  /**
   * API一覧を取得する関数
   * スロットリングとアンマウントチェックを実装
   */
  const fetchApis = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;

      // 初期チェック: アンマウント状態とスロットリング
      if (!isMounted() || !canRequest(force)) {
        return null;
      }

      try {
        // リクエスト開始前に再度アンマウントチェック
        if (!isMounted()) {
          return null;
        }

        // リクエスト時間を更新してローディング状態を設定
        updateRequestTime();
        setLoading(true);
        setError(null);

        // API一覧を取得
        const apis = await safeInvoke<ApiStatusRaw[]>('list_apis');

        // 取得完了後にアンマウントチェック（古いデータで状態を更新しないため）
        if (!isMounted()) {
          return null;
        }

        return apis;
      } catch (err) {
        // エラー発生後にアンマウントチェック
        if (!isMounted()) {
          return null;
        }
        setError(extractErrorMessage(err) || DEFAULT_ERROR_MESSAGE);
        return null;
      } finally {
        // ローディング状態の更新前にアンマウントチェック
        if (isMounted()) {
          setLoading(false);
        }
      }
    },
    [isMounted, canRequest, updateRequestTime]
  );

  return {
    loading,
    error,
    fetchApis,
  };
}
