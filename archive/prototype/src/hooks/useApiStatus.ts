// useApiStatus - APIステータス管理カスタムフック

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { usePolling, type UsePollingOptions } from './usePolling';
import { useApiStatusBase } from './useApiStatusBase';
import {
  convertApiStatus,
  convertApiStatusesToRecord,
  areStatusRecordsEqual,
} from '../utils/apiStatusConverter';
import { REFRESH_INTERVALS, MIN_REQUEST_INTERVAL } from '../constants/config';
import type { ApiStatus } from '../utils/apiStatus';

/**
 * デフォルトのポーリング設定
 */
const DEFAULT_POLLING_OPTIONS: Omit<UsePollingOptions, 'interval' | 'enabled'> = {
  minRequestInterval: MIN_REQUEST_INTERVAL,
  skipWhenHidden: true,
} as const;

/**
 * ポーリング設定を作成するヘルパー関数
 */
function createPollingOptions(
  interval: number,
  enabled: boolean
): UsePollingOptions {
  return {
    ...DEFAULT_POLLING_OPTIONS,
    interval,
    enabled,
  };
}

// ApiStatus型を再エクスポート（後方互換性のため）
export type { ApiStatus };

/**
 * useApiStatusの戻り値の型
 */
export interface UseApiStatusReturn {
  /** 現在のAPIステータス */
  status: ApiStatus | null;
  /** ローディング中かどうか */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** 手動でステータスを更新する関数 */
  refresh: () => void;
}

/**
 * useApiStatusListの戻り値の型
 */
export interface UseApiStatusListReturn {
  /** API IDをキーとしたステータスのRecord */
  statuses: Record<string, ApiStatus>;
  /** ローディング中かどうか */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** 手動でステータスを更新する関数 */
  refresh: () => void;
}

/**
 * APIステータスのリアルタイム更新フック
 * 定期的にAPIステータスをポーリングして更新します
 *
 * @param apiId - 監視するAPIのID（nullの場合はポーリングを無効化）
 * @param interval - ポーリング間隔（ミリ秒、デフォルト: 5000ms）
 * @returns APIステータス、ローディング状態、エラー、リフレッシュ関数
 *
 * @example
 * ```tsx
 * const { status, loading, error, refresh } = useApiStatus('api-123');
 * ```
 */
export function useApiStatus(
  apiId: string | null,
  interval: number = REFRESH_INTERVALS.API_STATUS
): UseApiStatusReturn {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const { loading, error, fetchApis } = useApiStatusBase(interval);
  const currentApiIdRef = useRef<string | null>(null);

  // apiIdが変更された場合、ステータスをリセット
  useEffect(() => {
    const prevApiId = currentApiIdRef.current;
    if (prevApiId !== apiId) {
      currentApiIdRef.current = apiId;
      setStatus(null);
    }
  }, [apiId]);

  const fetchStatus = useCallback(
    async (options?: { force?: boolean }) => {
      // apiIdがnullの場合は処理をスキップ
      if (!apiId) {
        return;
      }

      // 処理開始時のapiIdを保存（非同期処理中に変更される可能性があるため）
      const targetApiId = apiId;
      const apis = await fetchApis(options);
      
      // API一覧の取得に失敗した場合はスキップ
      if (!apis) {
        return;
      }

      // 非同期処理完了時、apiIdが変更されていないか確認
      // 変更されていた場合は、古いデータで状態を更新しない
      if (currentApiIdRef.current !== targetApiId) {
        return;
      }

      const api = apis.find(a => a.id === targetApiId);
      const newStatus = api ? convertApiStatus(api.status) : null;

      // 状態が変わらない場合は更新をスキップ（パフォーマンス最適化）
      setStatus(prevStatus => (prevStatus === newStatus ? prevStatus : newStatus));
    },
    [apiId, fetchApis]
  );

  const pollingOptions = useMemo<UsePollingOptions>(
    () => ({
      ...createPollingOptions(interval, !!apiId),
      skipInitialLoad: false, // apiIdが設定された時のみ初回読み込みを実行
    }),
    [interval, apiId]
  );

  const { refresh } = usePolling(fetchStatus, pollingOptions);

  return useMemo(
    () => ({
      status,
      loading,
      error,
      refresh,
    }),
    [status, loading, error, refresh]
  );
}

/**
 * 複数のAPIステータスを一括管理するフック
 * すべてのAPIのステータスを定期的にポーリングして更新します
 *
 * @param interval - ポーリング間隔（ミリ秒、デフォルト: 5000ms）
 * @returns APIステータスのRecord、ローディング状態、エラー、リフレッシュ関数
 *
 * @example
 * ```tsx
 * const { statuses, loading, error, refresh } = useApiStatusList();
 * const apiStatus = statuses['api-123']; // 'running' | 'preparing' | 'stopped' | 'error'
 * ```
 */
export function useApiStatusList(
  interval: number = REFRESH_INTERVALS.API_STATUS
): UseApiStatusListReturn {
  const [statuses, setStatuses] = useState<Record<string, ApiStatus>>({});
  const { loading, error, fetchApis } = useApiStatusBase(interval);

  const fetchStatuses = useCallback(
    async (options?: { force?: boolean }) => {
      const apis = await fetchApis(options);
      
      // API一覧の取得に失敗した場合はスキップ
      if (!apis) {
        return;
      }

      const newStatuses = convertApiStatusesToRecord(apis);

      // 状態が変わらない場合は更新をスキップ（パフォーマンス最適化）
      setStatuses(prevStatuses => {
        if (areStatusRecordsEqual(prevStatuses, newStatuses)) {
          return prevStatuses;
        }
        return newStatuses;
      });
    },
    [fetchApis]
  );

  const pollingOptions = useMemo<UsePollingOptions>(
    () => ({
      ...createPollingOptions(interval, true),
      skipInitialLoad: false, // 初回読み込みを実行（useApiListとは別の用途）
    }),
    [interval]
  );

  const { refresh } = usePolling(fetchStatuses, pollingOptions);

  return useMemo(
    () => ({
      statuses,
      loading,
      error,
      refresh,
    }),
    [statuses, loading, error, refresh]
  );
}

