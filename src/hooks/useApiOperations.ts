// useApiOperations - APIの起動/停止/削除操作用カスタムフック

import { useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { safeInvoke, clearInvokeCache } from '../utils/tauri';
import { useIsMounted } from './useIsMounted';
import { useI18n } from '../contexts/I18nContext';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';

/**
 * API操作の進捗情報
 */
export interface ApiOperationProgress {
  operation: string;
  step: string;
  progress: number;
}

/**
 * APIの起動/停止/削除操作用カスタムフック
 * 
 * @param loadApis - API一覧を再読み込みする関数
 * @returns API操作の状態と操作関数
 */
export const useApiOperations = (loadApis: () => Promise<void>) => {
  const { t } = useI18n();
  const isMounted = useIsMounted();
  
  // API起動/停止中の状態を管理
  const [operatingApiIds, setOperatingApiIds] = useState<Set<string>>(new Set());
  // API操作の進捗情報を管理
  const [apiOperationProgress, setApiOperationProgress] = useState<Map<string, ApiOperationProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);

  /**
   * 操作中のAPI IDを追加
   */
  const addOperatingApi = useCallback((apiId: string) => {
    setOperatingApiIds(prev => new Set(prev).add(apiId));
    setApiOperationProgress(prev => {
      const next = new Map(prev);
      next.delete(apiId);
      return next;
    });
  }, []);

  /**
   * 操作中のAPI IDを削除
   */
  const removeOperatingApi = useCallback((apiId: string) => {
    setOperatingApiIds(prev => {
      const next = new Set(prev);
      next.delete(apiId);
      return next;
    });
    setApiOperationProgress(prev => {
      const next = new Map(prev);
      next.delete(apiId);
      return next;
    });
  }, []);

  /**
   * APIの起動/停止
   */
  const toggleApiStatus = useCallback(async (apiId: string, currentStatus: 'running' | 'preparing' | 'stopped' | 'error') => {
    if (!isMounted()) return;
    
    // 既に操作中の場合はスキップ
    if (operatingApiIds.has(apiId)) {
      return;
    }
    
    let unsubscribeProgress: (() => void) | null = null;
    
    try {
      if (isMounted()) {
        setError(null);
        addOperatingApi(apiId);
      }
      
      // 進捗イベントリスナーを設定
      try {
        unsubscribeProgress = await listen('api_operation_progress', (event) => {
          if (!isMounted()) return;
          
          const payload = event.payload as {
            api_id: string;
            operation: string;
            step: string;
            progress: number;
          };
          const { api_id, operation, step, progress } = payload;
          if (api_id === apiId) {
            setApiOperationProgress(prev => {
              const next = new Map(prev);
              next.set(api_id, { operation, step, progress });
              return next;
            });
          }
        });
      } catch (err) {
        logger.warn('進捗イベントリスナーの設定に失敗しました', err instanceof Error ? err.message : String(err), 'useApiOperations');
      }
      
      // バックエンドのIPCコマンドを呼び出し
      const shouldStop = currentStatus === 'running';

      if (shouldStop) {
        await safeInvoke('stop_api', { apiId });
      } else {
        await safeInvoke('start_api', { apiId });
      }
      
      // キャッシュをクリアして最新データを取得
      clearInvokeCache('list_apis');
      
      // アンマウントチェック
      if (!isMounted()) return;
      
      // 一覧を再読み込み
      await loadApis();
    } catch (err) {
      const errorMessage = extractErrorMessage(err, t('apiList.messages.statusChangeError'));
      if (isMounted()) {
        setError(errorMessage);
      }
      logger.error(t('apiList.messages.statusChangeError'), err instanceof Error ? err : new Error(extractErrorMessage(err)), 'useApiOperations');
    } finally {
      // 進捗イベントリスナーを解除
      if (unsubscribeProgress) {
        unsubscribeProgress();
      }
      
      // 操作完了後、操作中のAPI IDと進捗情報を削除
      if (isMounted()) {
        removeOperatingApi(apiId);
      }
    }
  }, [isMounted, operatingApiIds, addOperatingApi, removeOperatingApi, loadApis, t]);

  /**
   * APIの削除
   */
  const deleteApi = useCallback(async (apiId: string) => {
    if (!isMounted()) return;

    try {
      if (isMounted()) {
        setError(null);
      }

      await safeInvoke('delete_api', { apiId });

      clearInvokeCache('list_apis');

      if (!isMounted()) return;

      await loadApis();
    } catch (err) {
      const errorMessage = extractErrorMessage(err, t('apiList.messages.deleteError'));
      if (isMounted()) {
        setError(errorMessage);
      }
      logger.error(
        t('apiList.messages.deleteError'),
        err instanceof Error ? err : new Error(errorMessage),
        'useApiOperations'
      );
    }
  }, [isMounted, loadApis, t]);

  return {
    operatingApiIds,
    apiOperationProgress,
    error,
    toggleApiStatus,
    deleteApi,
    setError,
  };
};

