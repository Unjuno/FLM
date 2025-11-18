// SPDX-License-Identifier: MIT
// useFormSubmit - フォーム送信の共通ロジックを提供するカスタムフック

import { useCallback } from 'react';
import type { FormEvent } from 'react';
import { logger } from '../utils/logger';
import { isDev } from '../utils/env';
import { extractErrorMessage } from '../utils/errorHandler';

/**
 * フォーム送信の結果
 */
export interface FormSubmitResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * フォーム送信ハンドラーのオプション
 */
export interface UseFormSubmitOptions<T> {
  /**
   * 送信前のバリデーション関数
   */
  validate?: () => boolean | Promise<boolean>;
  /**
   * 送信処理
   */
  onSubmit: (data: T) => void | Promise<void>;
  /**
   * 送信成功時のコールバック
   */
  onSuccess?: () => void;
  /**
   * 送信失敗時のコールバック
   */
  onError?: (error: string) => void;
  /**
   * オートセーブキー（指定された場合、送信成功時に削除）
   */
  autosaveKey?: string;
  /**
   * ログ出力用のコンポーネント名
   */
  componentName?: string;
}

/**
 * フォーム送信の共通ロジックを提供するカスタムフック
 *
 * @param options フォーム送信のオプション
 * @returns フォーム送信ハンドラーと状態
 */
export function useFormSubmit<T>(options: UseFormSubmitOptions<T>) {
  const {
    validate,
    onSubmit,
    onSuccess,
    onError,
    autosaveKey,
    componentName = 'Form',
  } = options;

  /**
   * フォーム送信ハンドラー
   */
  const handleSubmit = useCallback(
    async (e: FormEvent, data: T) => {
      e.preventDefault();

      // バリデーション
      if (validate) {
        const isValid = await validate();
        if (!isValid) {
          if (isDev()) {
            logger.warn(
              `${componentName} - バリデーションエラー`,
              componentName
            );
          }
          return;
        }
      }

      try {
        // デバッグ: 送信するデータをログ出力（開発環境のみ）
        if (isDev()) {
          logger.debug(`${componentName} - 送信するデータ`, componentName, {
            data,
          });
        }

        // 送信処理
        await onSubmit(data);

        // オートセーブデータを削除
        if (autosaveKey) {
          try {
            localStorage.removeItem(autosaveKey);
          } catch (err) {
            // 削除エラーは無視
            logger.warn(
              'オートセーブデータの削除に失敗しました',
              componentName,
              err
            );
          }
        }

        // 成功コールバック
        if (onSuccess) {
          onSuccess();
        }
      } catch (error) {
        const errorMessage =
          extractErrorMessage(error) ?? '不明なエラーが発生しました';
        logger.error(
          `${componentName} - 送信エラー`,
          error,
          componentName
        );

        // エラーコールバック
        if (onError) {
          onError(errorMessage);
        }
      }
    },
    [validate, onSubmit, onSuccess, onError, autosaveKey, componentName]
  );

  return {
    handleSubmit,
  };
}

