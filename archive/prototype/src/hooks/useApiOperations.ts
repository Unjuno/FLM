// useApiOperations - APIの起動/停止/削除操作用カスタムフック

import { useState, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { safeInvoke, clearInvokeCache } from '../utils/tauri';
import { useIsMounted } from './useIsMounted';
import { useI18n } from '../contexts/I18nContext';
import { logger } from '../utils/logger';
import { extractErrorMessage, toError } from '../utils/errorHandler';
import { addToSet, removeFromSet, setInMap, removeFromMap } from '../utils/stateHelpers';

/**
 * API操作の進捗情報
 */
export interface ApiOperationProgress {
  operation: string;
  step: string;
  progress: number;
}

/**
 * 進捗イベントのペイロード
 */
interface ApiOperationProgressEvent {
  api_id: string;
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

  // 進捗イベントリスナーの参照（各操作ごとに設定）
  const unsubscribeProgressRef = useRef<(() => void) | null>(null);

  /**
   * 進捗イベントリスナーをクリーンアップ
   */
  const cleanupProgressListener = useCallback(() => {
    if (unsubscribeProgressRef.current) {
      try {
        unsubscribeProgressRef.current();
      } catch (error) {
        // ホットリロード時など、コールバックが見つからない場合は警告を抑制
        // これは開発環境でのみ発生する問題で、本番環境では問題にならない
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.debug('イベントリスナーのクリーンアップ中にエラーが発生しました（無視されます）', error);
        }
      }
      unsubscribeProgressRef.current = null;
    }
  }, []);

  /**
   * 操作中のAPI IDを追加
   */
  const addOperatingApi = useCallback((apiId: string) => {
    setOperatingApiIds(prev => addToSet(prev, apiId));
    setApiOperationProgress(prev => removeFromMap(prev, apiId));
  }, []);

  /**
   * 操作中のAPI IDを削除
   */
  const removeOperatingApi = useCallback((apiId: string) => {
    setOperatingApiIds(prev => removeFromSet(prev, apiId));
    setApiOperationProgress(prev => removeFromMap(prev, apiId));
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
    
    try {
      setError(null);
      addOperatingApi(apiId);
      
      // 進捗イベントリスナーを設定（特定のAPI IDのみ処理）
      try {
        unsubscribeProgressRef.current = await listen<ApiOperationProgressEvent>(
          'api_operation_progress',
          (event) => {
            if (!isMounted()) return;
            
            const { api_id, operation, step, progress } = event.payload;
            if (api_id === apiId) {
              setApiOperationProgress(prev => 
                setInMap(prev, api_id, { operation, step, progress })
              );
            }
          }
        );
      } catch (err) {
        logger.warn('進捗イベントリスナーの設定に失敗しました', extractErrorMessage(err), 'useApiOperations');
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
      logger.error(t('apiList.messages.statusChangeError'), toError(err), 'useApiOperations');
    } finally {
      cleanupProgressListener();
      
      // 操作完了後、操作中のAPI IDと進捗情報を削除
      if (isMounted()) {
        removeOperatingApi(apiId);
      }
    }
  }, [isMounted, operatingApiIds, addOperatingApi, removeOperatingApi, loadApis, t, cleanupProgressListener]);

  /**
   * APIの削除
   */
  const deleteApi = useCallback(async (apiId: string) => {
    if (!isMounted()) return;

    try {
      setError(null);
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
        toError(err, errorMessage),
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

