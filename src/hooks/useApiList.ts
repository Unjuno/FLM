// useApiList - API一覧の取得と管理用カスタムフック

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke, clearInvokeCache } from '../utils/tauri';
import { REFRESH_INTERVALS } from '../constants/config';
import { useIsMounted } from './useIsMounted';
import { useI18n } from '../contexts/I18nContext';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import type { ApiInfo } from '../types/api';

/**
 * API情報（拡張版 - errorステータスを含む）
 */
export interface ApiInfoExtended extends Omit<ApiInfo, 'status'> {
  status: 'running' | 'preparing' | 'stopped' | 'error';
}

/**
 * API一覧の取得と管理用カスタムフック
 * 
 * @returns API一覧の状態と操作関数
 */
export const useApiList = () => {
  const { t } = useI18n();
  const isMounted = useIsMounted();
  const [apis, setApis] = useState<ApiInfoExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 最新のt関数を保持するためのref（無限ループを防ぐ）
  const tRef = useRef(t);
  // ローディング状態を追跡するref（重複リクエストを防ぐ）
  const isLoadingRef = useRef(false);
  // 最後のリクエスト時刻を追跡するref（連続リクエストを防ぐ）
  const lastRequestTimeRef = useRef<number>(0);
  // 最小リクエスト間隔（ミリ秒）- 連続リクエストを防ぐ
  const MIN_REQUEST_INTERVAL = 3000; // 3秒（過剰な呼び出しを防ぐため延長）
  
  // refを最新の値に更新
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  /**
   * API一覧を取得
   */
  const loadApis = useCallback(async () => {
    if (!isMounted()) return;
    
    // 既にローディング中の場合はスキップ
    if (isLoadingRef.current) {
      return;
    }
    
    // 最後のリクエストから一定時間経過していない場合はスキップ
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      return;
    }
    
    isLoadingRef.current = true;
    lastRequestTimeRef.current = now;
    
    const currentT = tRef.current;
    
    try {
      if (isMounted()) {
        setLoading(true);
        setError(null);
      }

      // バックエンドのIPCコマンドを呼び出し
      const result = await safeInvoke<Array<{
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        enable_auth: boolean;
        status: string;
        created_at: string;
        updated_at: string;
      }>>('list_apis');

      // 結果が配列でない場合の処理
      if (!Array.isArray(result)) {
        logger.warn('list_apisの結果が配列ではありません', 'useApiList');
        if (isMounted()) {
          setApis([]);
        }
        return;
      }

      // レスポンスをApiInfo形式に変換
      const apiInfos: ApiInfoExtended[] = result.map(api => {
        const status =
          api.status === 'running'
            ? 'running'
            : api.status === 'preparing'
              ? 'preparing'
              : api.status === 'stopped'
                ? 'stopped'
                : 'error';

        return {
          id: api.id,
          name: api.name,
          model_name: api.model_name,
          port: api.port,
          status,
          endpoint: api.endpoint,
          created_at: api.created_at,
          updated_at: api.updated_at,
        };
      });

      // アンマウントチェック
      if (isMounted()) {
        setApis(apiInfos);
      }
    } catch (err) {
      const errorMessage = extractErrorMessage(err, currentT('apiList.messages.loadError'));
      if (isMounted()) {
        setError(errorMessage);
      }
      logger.error(currentT('apiList.messages.loadError'), err instanceof Error ? err : new Error(extractErrorMessage(err)), 'useApiList');
    } finally {
      // アンマウントチェック
      if (isMounted()) {
        setLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, [isMounted]);

  // 初回読み込みと定期更新
  useEffect(() => {
    // 初回読み込み
    loadApis();
    
    // ステータスを定期的に更新
    const interval = setInterval(() => {
      // ページが非表示の場合は更新をスキップ
      if (!document.hidden) {
        // 最後のリクエストから一定時間経過している場合のみ更新
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTimeRef.current;
        if (timeSinceLastRequest >= MIN_REQUEST_INTERVAL) {
          loadApis();
        }
      }
    }, REFRESH_INTERVALS.API_LIST);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // loadApisを依存配列から削除して無限ループを防ぐ

  // ページが非表示の場合は自動更新を停止
  useEffect(() => {
    const handleVisibilityChange = () => {
      // ページが表示された時に一度更新（最後のリクエストから一定時間経過している場合のみ）
      if (!document.hidden) {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTimeRef.current;
        // 最後のリクエストから5秒以上経過している場合のみ更新
        if (timeSinceLastRequest >= 5000) {
          loadApis();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // loadApisを依存配列から削除して無限ループを防ぐ

  /**
   * キャッシュをクリアしてAPI一覧を再読み込み
   * 明示的なリフレッシュのため、最小間隔チェックは緩和
   */
  const refreshApis = useCallback(async () => {
    // 既にローディング中の場合はスキップ（明示的なリフレッシュでも重複を防ぐ）
    if (isLoadingRef.current) {
      return;
    }
    clearInvokeCache('list_apis');
    await loadApis();
  }, [loadApis]);

  return {
    apis,
    loading,
    error,
    loadApis,
    refreshApis,
    setError,
  };
};

