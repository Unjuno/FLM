// useApiStatus - APIステータス管理カスタムフック

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../utils/tauri';

/**
 * APIステータス情報
 */
export interface ApiStatus {
  id: string;
  status: 'running' | 'stopped' | 'error';
}

/**
 * APIステータスのリアルタイム更新フック
 * 定期的にAPIステータスをポーリングして更新します
 */
export function useApiStatus(apiId: string | null, interval: number = 5000) {
  const [status, setStatus] = useState<'running' | 'stopped' | 'error' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    if (!apiId) {
      if (isMountedRef.current) {
        setStatus(null);
      }
      return;
    }

    try {
      if (!isMountedRef.current) return;
      
      setLoading(true);
      setError(null);

      // API一覧を取得して該当APIのステータスを取得
      const apis = await safeInvoke<{
        id: string;
        status: string;
      }[]>('list_apis');
      
      if (!isMountedRef.current) return;
      
      const api = apis.find(a => a.id === apiId);
      if (api) {
        const newStatus = (api.status === 'running' ? 'running' : 
                          api.status === 'stopped' ? 'stopped' : 'error') as 'running' | 'stopped' | 'error';
        setStatus(newStatus);
      } else {
        setStatus(null);
        setError('APIが見つかりませんでした');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'ステータス取得に失敗しました');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiId]);

  useEffect(() => {
    if (!apiId) {
      return;
    }

    // 初回読み込み
    fetchStatus();

    // 定期的にポーリング
    const timer = setInterval(() => {
      fetchStatus();
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [apiId, interval, fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
  };
}

/**
 * 複数のAPIステータスを一括管理するフック
 */
export function useApiStatusList(interval: number = 5000) {
  const [statuses, setStatuses] = useState<Record<string, 'running' | 'stopped' | 'error'>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchStatuses = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      if (!isMountedRef.current) return;
      
      setLoading(true);
      setError(null);

      // API一覧を取得
      const apis = await safeInvoke<{
        id: string;
        status: string;
      }[]>('list_apis');
      
      if (!isMountedRef.current) return;
      
      const newStatuses: Record<string, 'running' | 'stopped' | 'error'> = {};
      apis.forEach(api => {
        newStatuses[api.id] = (api.status === 'running' ? 'running' : 
                               api.status === 'stopped' ? 'stopped' : 'error') as 'running' | 'stopped' | 'error';
      });
      
      setStatuses(newStatuses);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'ステータス一覧取得に失敗しました');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // 初回読み込み
    fetchStatuses();

    // 定期的にポーリング
    const timer = setInterval(() => {
      fetchStatuses();
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [interval, fetchStatuses]);

  return {
    statuses,
    loading,
    error,
    refresh: fetchStatuses,
  };
}

