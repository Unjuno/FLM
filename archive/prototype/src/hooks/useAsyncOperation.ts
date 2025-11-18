/**
 * 非同期操作の共通パターンを提供するカスタムフック
 * 
 * エラーハンドリング、ローディング状態管理、リトライ機能などを統一します。
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { extractErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';

/**
 * 非同期操作の状態
 */
export interface AsyncOperationState<T> {
  /** データ */
  data: T | null;
  /** ローディング中かどうか */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
}

/**
 * 非同期操作の戻り値
 */
export interface UseAsyncOperationReturn<T> extends AsyncOperationState<T> {
  /** 操作を実行する関数 */
  execute: () => Promise<void>;
  /** エラーをクリアする関数 */
  clearError: () => void;
  /** データをリセットする関数 */
  reset: () => void;
}

/**
 * 非同期操作を管理するカスタムフック
 * 
 * @param operation 実行する非同期操作
 * @param options オプション設定
 * @returns 非同期操作の状態と操作関数
 */
export function useAsyncOperation<T>(
  operation: () => Promise<T>,
  options?: {
    /** 自動実行するかどうか */
    autoExecute?: boolean;
    /** エラーをログに記録するかどうか */
    logErrors?: boolean;
    /** コンテキスト名（ログ用） */
    context?: string;
  }
): UseAsyncOperationReturn<T> {
  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const operationRef = useRef(operation);
  operationRef.current = operation;

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await operationRef.current();
      setState({
        data: result,
        loading: false,
        error: null,
      });
    } catch (err) {
      const errorMessage = extractErrorMessage(err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      if (options?.logErrors !== false) {
        logger.error(
          errorMessage,
          err,
          options?.context || 'AsyncOperation'
        );
      }
    }
  }, [options?.logErrors, options?.context]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  // 自動実行
  useEffect(() => {
    if (options?.autoExecute) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    execute,
    clearError,
    reset,
  };
}

