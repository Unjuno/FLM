// useApiStatus - APIステータス管理カスタムフック

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../utils/tauri';

/**
 * APIステータス情報
 */
export interface ApiStatus {
  id: string;
  status: 'running' | 'preparing' | 'stopped' | 'error';
}

/**
 * APIステータスのリアルタイム更新フック
 * 定期的にAPIステータスをポーリングして更新します
 */
export function useApiStatus(apiId: string | null, interval: number = 5000) {
  const [status, setStatus] = useState<'running' | 'preparing' | 'stopped' | 'error' | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  // 最後のリクエスト時刻を追跡するref（連続リクエストを防ぐ）
  const lastRequestTimeRef = useRef<number>(0);
  // 最小リクエスト間隔（ミリ秒）- 連続リクエストを防ぐ
  const MIN_REQUEST_INTERVAL = 3000; // 3秒
  const minRequestInterval = Math.min(interval, MIN_REQUEST_INTERVAL);

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchStatus = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;

    if (!isMountedRef.current) return;

    if (!apiId) {
      if (isMountedRef.current) {
        setStatus(null);
      }
      return;
    }

    // 最後のリクエストから一定時間経過していない場合はスキップ
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    if (!force && timeSinceLastRequest < minRequestInterval) {
      return;
    }

    try {
      if (!isMountedRef.current) return;

      lastRequestTimeRef.current = now;
      setLoading(true);
      setError(null);

      // API一覧を取得して該当APIのステータスを取得
      const apis = await safeInvoke<
        {
          id: string;
          status: string;
        }[]
      >('list_apis');

      if (!isMountedRef.current) return;

      const api = apis.find(a => a.id === apiId);
      if (api) {
        const newStatus = (
          api.status === 'running'
            ? 'running'
            : api.status === 'preparing'
              ? 'preparing'
              : api.status === 'stopped'
                ? 'stopped'
                : 'error'
        ) as 'running' | 'preparing' | 'stopped' | 'error';
        setStatus(newStatus);
      } else {
        setStatus(null);
        setError('APIが見つかりませんでした');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(
        err instanceof Error ? err.message : 'ステータス取得に失敗しました'
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiId, minRequestInterval]);

  useEffect(() => {
    if (!apiId) {
      return;
    }

    // 初回読み込み
    fetchStatus({ force: true });

    // 定期的にポーリング（ページが非表示の場合はスキップ）
    const timer = setInterval(() => {
      if (!document.hidden) {
        // 最後のリクエストから一定時間経過している場合のみ更新
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTimeRef.current;
        if (timeSinceLastRequest >= minRequestInterval) {
          fetchStatus();
        }
      }
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [apiId, interval, minRequestInterval, fetchStatus]);

  const refresh = useCallback(() => fetchStatus({ force: true }), [fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh,
  };
}

/**
 * 複数のAPIステータスを一括管理するフック
 */
export function useApiStatusList(interval: number = 5000) {
  const [statuses, setStatuses] = useState<
    Record<string, 'running' | 'preparing' | 'stopped' | 'error'>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  // 最後のリクエスト時刻を追跡するref（連続リクエストを防ぐ）
  const lastRequestTimeRef = useRef<number>(0);
  // 最小リクエスト間隔（ミリ秒）- 連続リクエストを防ぐ
  const MIN_REQUEST_INTERVAL = 3000; // 3秒
  const minRequestInterval = Math.min(interval, MIN_REQUEST_INTERVAL);

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchStatuses = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;

    if (!isMountedRef.current) return;

    // 最後のリクエストから一定時間経過していない場合はスキップ
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    if (!force && timeSinceLastRequest < minRequestInterval) {
      return;
    }

    try {
      if (!isMountedRef.current) return;

      lastRequestTimeRef.current = now;
      setLoading(true);
      setError(null);

      // API一覧を取得
      const apis = await safeInvoke<
        {
          id: string;
          status: string;
        }[]
      >('list_apis');

      if (!isMountedRef.current) return;

      const newStatuses: Record<string, 'running' | 'preparing' | 'stopped' | 'error'> = {};
      apis.forEach(api => {
        newStatuses[api.id] = (
          api.status === 'running'
            ? 'running'
            : api.status === 'preparing'
              ? 'preparing'
              : api.status === 'stopped'
                ? 'stopped'
                : 'error'
        ) as 'running' | 'preparing' | 'stopped' | 'error';
      });

      setStatuses(newStatuses);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(
        err instanceof Error ? err.message : 'ステータス一覧取得に失敗しました'
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [minRequestInterval]);

  useEffect(() => {
    // 初回読み込み
    fetchStatuses({ force: true });

    // 定期的にポーリング（ページが非表示の場合はスキップ）
    const timer = setInterval(() => {
      if (!document.hidden) {
        // 最後のリクエストから一定時間経過している場合のみ更新
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTimeRef.current;
        if (timeSinceLastRequest >= minRequestInterval) {
          fetchStatuses();
        }
      }
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [interval, minRequestInterval, fetchStatuses]);

  const refreshStatuses = useCallback(() => fetchStatuses({ force: true }), [fetchStatuses]);

  return {
    statuses,
    loading,
    error,
    refresh: refreshStatuses,
  };
}
