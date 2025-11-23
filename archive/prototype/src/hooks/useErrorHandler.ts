// SPDX-License-Identifier: MIT
// useErrorHandler - エラーハンドリングの共通ロジックを提供するカスタムフック

import { useCallback } from 'react';
import { logger } from '../utils/logger';
import {
  parseError,
  toError,
  ErrorCategory,
  type ErrorInfo,
} from '../utils/errorHandler';
import { isDev } from '../utils/env';

/**
 * エラーハンドリングのオプション
 */
export interface UseErrorHandlerOptions {
  /**
   * コンポーネント名（ログ出力用）
   */
  componentName?: string;
  /**
   * エラー発生時のコールバック
   */
  onError?: (errorInfo: ErrorInfo) => void;
  /**
   * エラーメッセージを表示するか
   */
  showError?: boolean;
}

/**
 * エラーハンドリングの共通ロジックを提供するカスタムフック
 *
 * @param options エラーハンドリングのオプション
 * @returns エラーハンドラー関数
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { componentName = 'Component', onError } = options;

  /**
   * エラーを処理する関数
   */
  const handleError = useCallback(
    (error: unknown, context?: string) => {
      const errorInfo = parseError(error);
      const contextMessage = context
        ? `${componentName} - ${context}`
        : componentName;

      // ログ出力
      const errorObj = toError(error);
      const shouldLogInProduction =
        errorInfo.category !== ErrorCategory.GENERAL || !errorInfo.retryable;
      if (isDev() || shouldLogInProduction) {
        logger.error(contextMessage, errorObj, componentName);
      }

      // コールバック実行
      if (onError) {
        onError(errorInfo);
      }

      return errorInfo;
    },
    [componentName, onError]
  );

  /**
   * 非同期処理をラップしてエラーハンドリングを行う関数
   */
  const withErrorHandling = useCallback(
    async <T>(fn: () => Promise<T>, context?: string): Promise<T | null> => {
      try {
        return await fn();
      } catch (error) {
        handleError(error, context);
        return null;
      }
    },
    [handleError]
  );

  return {
    handleError,
    withErrorHandling,
  };
}
