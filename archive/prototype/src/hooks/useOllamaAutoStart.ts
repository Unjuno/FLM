// useOllamaAutoStart - Ollama自動起動ロジックを提供するカスタムフック

import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { useOllamaDetection, useOllamaProcess } from './useOllama';
import { useErrorHandler } from './useErrorHandler';

/**
 * Ollama自動起動のオプション
 */
export interface UseOllamaAutoStartOptions {
  /**
   * 自動起動を有効にするか
   */
  enabled?: boolean;
}

/**
 * Ollama自動起動ロジックを提供するカスタムフック
 *
 * @param options オプション
 */
export function useOllamaAutoStart(options: UseOllamaAutoStartOptions = {}) {
  const { enabled = true } = options;
  const {
    status,
    isDetecting: isOllamaDetecting,
    detect,
  } = useOllamaDetection();
  const { start } = useOllamaProcess();
  const { handleError } = useErrorHandler({ componentName: 'OllamaAutoStart' });
  const hasAttemptedStartRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const autoStartOllamaIfNeeded = async () => {
      logger.info('=== Ollama自動起動チェック開始 ===', 'OllamaAutoStart');
      logger.info(
        `status状態: ${status ? JSON.stringify(status) : 'null'}`,
        'OllamaAutoStart'
      );

      if (!status) {
        logger.info(
          'statusがnullのため、自動起動をスキップします',
          'OllamaAutoStart'
        );
        hasAttemptedStartRef.current = false;
        return;
      }

      logger.info(
        `Ollama状態: installed=${status.installed}, portable=${status.portable}, running=${status.running}`,
        'OllamaAutoStart'
      );

      if (status.running) {
        logger.info(
          'Ollamaは既に実行中です。フラグをリセットします',
          'OllamaAutoStart'
        );
        hasAttemptedStartRef.current = false;
        return;
      }

      if (!status.installed && !status.portable) {
        logger.info(
          'Ollamaがインストールされていないため、自動起動をスキップします',
          'OllamaAutoStart'
        );
        hasAttemptedStartRef.current = false;
        return;
      }

      if (isOllamaDetecting) {
        logger.info(
          '現在検出処理中のため、自動起動を保留します',
          'OllamaAutoStart'
        );
        return;
      }

      if (hasAttemptedStartRef.current) {
        logger.info(
          '既に自動起動を試行中のため、今回はスキップします',
          'OllamaAutoStart'
        );
        return;
      }

      hasAttemptedStartRef.current = true;

      try {
        logger.info('Ollama起動コマンドを実行します...', 'OllamaAutoStart');
        const ollamaPath = status.portable_path || status.system_path || null;
        logger.info(
          `使用するOllamaパス: ${ollamaPath || '自動検出'}`,
          'OllamaAutoStart'
        );
        await start(ollamaPath || undefined);
        logger.info(
          '✓ Ollamaを自動起動しました。状態を再検出します',
          'OllamaAutoStart'
        );

        if (!cancelled) {
          await detect();
          logger.info('再検出が完了しました', 'OllamaAutoStart');
        }
      } catch (startErr) {
        hasAttemptedStartRef.current = false;
        handleError(startErr, 'Ollamaの自動起動に失敗しました');
      }
    };

    autoStartOllamaIfNeeded();

    return () => {
      cancelled = true;
    };
  }, [status, isOllamaDetecting, enabled, start, detect, handleError]);
}
