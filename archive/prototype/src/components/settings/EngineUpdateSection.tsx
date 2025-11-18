/**
 * エンジンアップデートセクション
 */

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useI18n } from '../../contexts/I18nContext';
import { safeInvoke } from '../../utils/tauri';
import { TIMEOUT } from '../../constants/config';
import { logger } from '../../utils/logger';
import { ErrorMessage } from '../common/ErrorMessage';
import { InfoBanner } from '../common/InfoBanner';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EngineProgressBar } from './ProgressBar';
import type { 
  EngineUpdateCheck, 
  EngineDownloadProgress, 
  EngineDetectionResult,
  OllamaUpdateCheck
} from '../../types/settings';
import type { DownloadProgress } from '../../types/ollama';

/**
 * エンジンアップデートセクション
 */
export const EngineUpdateSection: React.FC = () => {
  const { t } = useI18n();
  const [engines] = useState(['ollama', 'lm_studio', 'vllm', 'llama_cpp']);
  const [engineNames] = useState<Record<string, string>>({
    ollama: 'Ollama',
    lm_studio: 'LM Studio',
    vllm: 'vLLM',
    llama_cpp: 'llama.cpp',
  });
  const [checking, setChecking] = useState<{ [key: string]: boolean }>({});
  const [updating, setUpdating] = useState<{ [key: string]: boolean }>({});
  const [installing, setInstalling] = useState<{ [key: string]: boolean }>({});
  const [starting, setStarting] = useState<{ [key: string]: boolean }>({});
  const [stopping, setStopping] = useState<{ [key: string]: boolean }>({});
  const [updateInfo, setUpdateInfo] = useState<{
    [key: string]: EngineUpdateCheck | null;
  }>({});
  const [detectionResults, setDetectionResults] = useState<{
    [key: string]: EngineDetectionResult | null;
  }>({});
  const [error, setError] = useState<{ [key: string]: string | null }>({});
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<{
    [key: string]: string | null;
  }>({});
  const successMessageTimeoutsRef = useRef<Record<string, NodeJS.Timeout | null>>({});
  const [progress, setProgress] = useState<{
    [key: string]: EngineDownloadProgress | null;
  }>({});
  const [startProgress, setStartProgress] = useState<{
    [key: string]: { progress: number; message: string } | null;
  }>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmVariant?: 'primary' | 'danger';
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });
  const autoStartAttemptedRef = useRef<Record<string, boolean>>({});

  // エンジン検出
  const detectEngine = useCallback(async (engineType: string) => {
    try {
      const result = await safeInvoke<EngineDetectionResult>('detect_engine', { engineType });
      setDetectionResults(prev => ({ ...prev, [engineType]: result }));
      
      // インストール済みだが停止中の場合は自動起動を試みる（非同期で実行）
      if (
        result.installed &&
        !result.running &&
        !autoStartAttemptedRef.current[engineType] &&
        !stopping[engineType] &&
        !starting[engineType]
      ) {
        autoStartAttemptedRef.current[engineType] = true;
        
        // 非同期で自動起動を実行（タイムアウトエラーを無視するため）
        (async () => {
          try {
            setStarting(prev => ({ ...prev, [engineType]: true }));
            setStartProgress(prev => ({ ...prev, [engineType]: { progress: 0, message: '自動起動中...' } }));
            logger.info(
              `${engineNames[engineType]}を自動起動します`,
              '',
              'EngineUpdateSection'
            );
            
            // タイムアウトエラーをキャッチして処理を続行
            try {
              setStartProgress(prev => ({ ...prev, [engineType]: { progress: 20, message: '起動コマンドを実行中...' } }));
              await safeInvoke('start_engine', {
                engineType: engineType,
                config: null,
              });
              setStartProgress(prev => ({ ...prev, [engineType]: { progress: 50, message: '起動コマンドが完了しました' } }));
            } catch (startErr) {
              // タイムアウトエラーの場合でも、エンジンが起動している可能性があるため
              // エラーを無視して状態確認を続行
              const errorMessage = startErr instanceof Error ? startErr.message : String(startErr);
              if (errorMessage.includes('タイムアウト')) {
                setStartProgress(prev => ({ ...prev, [engineType]: { progress: 50, message: '起動処理は継続中です...' } }));
                logger.info(
                  `${engineNames[engineType]}の起動コマンドがタイムアウトしましたが、起動処理は継続中です`,
                  '',
                  'EngineUpdateSection'
                );
              } else {
                throw startErr;
              }
            }
            
            // 起動確認のため少し待機（タイムアウトした場合でも待機）
            setStartProgress(prev => ({ ...prev, [engineType]: { progress: 60, message: '起動確認中...' } }));
            await new Promise(resolve => setTimeout(resolve, 1000));
            setStartProgress(prev => ({ ...prev, [engineType]: { progress: 70, message: 'エンジンの状態を確認中...' } }));
            await new Promise(resolve => setTimeout(resolve, 1000));
            setStartProgress(prev => ({ ...prev, [engineType]: { progress: 80, message: '最終確認中...' } }));
            
            // 起動後の状態を再検出（最大3回リトライ）
            let recheckResult: EngineDetectionResult | null = null;
            for (let retry = 0; retry < 3; retry++) {
              await new Promise(resolve => setTimeout(resolve, 1000 + retry * 1000));
              try {
                recheckResult = await safeInvoke<EngineDetectionResult>('detect_engine', { engineType });
                setDetectionResults(prev => ({ ...prev, [engineType]: recheckResult! }));
                if (recheckResult.running) {
                  break;
                }
              } catch (detectErr) {
                logger.warn(
                  `自動起動後の検出に失敗しました（試行 ${retry + 1}/3）`,
                  detectErr instanceof Error ? detectErr.message : String(detectErr),
                  'EngineUpdateSection'
                );
                if (retry === 2) {
                  // 最後の試行でも失敗した場合
                  autoStartAttemptedRef.current[engineType] = false;
                  return;
                }
              }
            }
            
            // 状態を確認してから成功メッセージを表示
            if (recheckResult && recheckResult.running) {
              setStartProgress(prev => ({ ...prev, [engineType]: { progress: 100, message: '確認完了' } }));
              
              // 少し待ってからプログレスバーを非表示
              await new Promise(resolve => setTimeout(resolve, 500));
              setStartProgress(prev => ({ ...prev, [engineType]: null }));
              setSuccessMessage(prev => ({
                ...prev,
                [engineType]: `${engineNames[engineType]}を自動起動しました`,
              }));
              const existingTimeout = successMessageTimeoutsRef.current[engineType];
              if (existingTimeout) {
                clearTimeout(existingTimeout);
              }
              const timeoutId = setTimeout(() => {
                setSuccessMessage(prev => ({ ...prev, [engineType]: null }));
                successMessageTimeoutsRef.current[engineType] = null;
              }, TIMEOUT.SUCCESS_MESSAGE);
              successMessageTimeoutsRef.current[engineType] = timeoutId;
            } else {
              // 起動に失敗した場合、自動起動試行フラグをリセット
              autoStartAttemptedRef.current[engineType] = false;
            }
          } catch (startErr) {
            setStartProgress(prev => ({ ...prev, [engineType]: null }));
            // 自動起動に失敗してもエラーは表示しない（サイレント失敗）
            const errorMessage = startErr instanceof Error ? startErr.message : String(startErr);
            // タイムアウトエラーは既に処理済みなので、ログに記録しない
            if (!errorMessage.includes('タイムアウト')) {
              logger.warn(
                `${engineNames[engineType]}の自動起動に失敗しました`,
                errorMessage,
                'EngineUpdateSection'
              );
            }
            // 自動起動試行フラグをリセットして、次回も試行可能にする
            autoStartAttemptedRef.current[engineType] = false;
          } finally {
            setStarting(prev => ({ ...prev, [engineType]: false }));
          }
        })();
      }
    } catch (err) {
      setError(prev => ({
        ...prev,
        [engineType]:
          err instanceof Error ? err.message : 'エンジン検出に失敗しました',
      }));
    }
  }, [engineNames, stopping, starting]);

  // アップデートチェック
  const checkUpdate = useCallback(async (engineType: string) => {
    try {
      setChecking(prev => ({ ...prev, [engineType]: true }));
      setError(prev => ({ ...prev, [engineType]: null }));

      let result: EngineUpdateCheck;
      if (engineType === 'ollama') {
        const ollamaResult = await safeInvoke<OllamaUpdateCheck>(
          'check_ollama_update'
        );
        result = {
          update_available: ollamaResult.update_available,
          current_version: ollamaResult.current_version,
          latest_version: ollamaResult.latest_version,
        };
      } else {
        result = await safeInvoke<EngineUpdateCheck>('check_engine_update', {
          engineType,
        });
      }

      setUpdateInfo(prev => ({ ...prev, [engineType]: result }));
    } catch (err) {
      setError(prev => ({
        ...prev,
        [engineType]:
          err instanceof Error
            ? err.message
            : 'アップデートチェックに失敗しました',
      }));
    } finally {
      setChecking(prev => ({ ...prev, [engineType]: false }));
    }
  }, []);

  // インストール実行
  const handleInstall = useCallback(
    async (engineType: string) => {
      setConfirmDialog({
        isOpen: true,
        message: `${engineNames[engineType]}をインストールしますか？`,
        confirmVariant: 'primary',
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));

          try {
            setInstalling(prev => ({ ...prev, [engineType]: true }));
            setError(prev => ({ ...prev, [engineType]: null }));
            setProgress(prev => ({ ...prev, [engineType]: null }));

            // 進捗イベントをリッスン
            const unlisten = await listen<DownloadProgress>('engine_install_progress', event => {
              if (event.payload && typeof event.payload.progress === 'number') {
                setProgress(prev => ({
                  ...prev,
                  [engineType]: {
                    downloaded: event.payload.downloaded_bytes || 0,
                    total: event.payload.total_bytes || 0,
                    percentage: event.payload.progress || 0,
                  },
                }));
              }
            });

            // インストール実行
            try {
              await safeInvoke('install_engine', { engineType });
            } catch (installErr) {
              // タイムアウトエラーの場合、インストールが実際に完了しているか確認
              const errorMessage = installErr instanceof Error ? installErr.message : String(installErr);
              if (errorMessage.includes('タイムアウト')) {
                logger.info(
                  `${engineNames[engineType]}のインストールコマンドがタイムアウトしましたが、インストール処理は継続中です`,
                  '',
                  'EngineUpdateSection'
                );
                // インストール確認のため少し待機
                await new Promise(resolve => setTimeout(resolve, 3000));
              } else {
                throw installErr;
              }
            }

            // イベントリスナーを解除
            unlisten();
            setProgress(prev => ({ ...prev, [engineType]: null }));

            // インストール後に再度検出して状態を確認（最大3回リトライ）
            let recheckResult: EngineDetectionResult | null = null;
            for (let retry = 0; retry < 3; retry++) {
              await new Promise(resolve => setTimeout(resolve, 1000 + retry * 1000));
              try {
                recheckResult = await safeInvoke<EngineDetectionResult>('detect_engine', { engineType });
                setDetectionResults(prev => ({ ...prev, [engineType]: recheckResult! }));
                if (recheckResult.installed) {
                  break;
                }
              } catch (detectErr) {
                logger.warn(
                  `インストール後の検出に失敗しました（試行 ${retry + 1}/3）`,
                  detectErr instanceof Error ? detectErr.message : String(detectErr),
                  'EngineUpdateSection'
                );
                if (retry === 2) {
                  // 最後の試行でも失敗した場合
                  throw new Error('インストール後の検出に失敗しました。エンジンがインストールされているか確認してください。');
                }
              }
            }
            
            // 状態を確認してから成功メッセージを表示
            if (recheckResult && recheckResult.installed) {
              setSuccessMessage(prev => ({
                ...prev,
                [engineType]: `${engineNames[engineType]}のインストールが完了しました`,
              }));
              const existingTimeout = successMessageTimeoutsRef.current[engineType];
              if (existingTimeout) {
                clearTimeout(existingTimeout);
              }
              const timeoutId = setTimeout(() => {
                setSuccessMessage(prev => ({ ...prev, [engineType]: null }));
                successMessageTimeoutsRef.current[engineType] = null;
              }, TIMEOUT.SUCCESS_MESSAGE);
              successMessageTimeoutsRef.current[engineType] = timeoutId;
            } else {
              // インストールに失敗した場合
              throw new Error('インストールが完了しませんでした。エンジンがインストールされているか確認してください。');
            }
            
            // インストール後に自動的に起動を試みる
            try {
              setStartProgress(prev => ({ ...prev, [engineType]: { progress: 0, message: 'インストール後の自動起動中...' } }));
              setStartProgress(prev => ({ ...prev, [engineType]: { progress: 20, message: '起動コマンドを実行中...' } }));
              
              try {
                await safeInvoke('start_engine', {
                  engineType: engineType,
                  config: null,
                });
                setStartProgress(prev => ({ ...prev, [engineType]: { progress: 50, message: '起動コマンドが完了しました' } }));
              } catch (startErr) {
                const errorMessage = startErr instanceof Error ? startErr.message : String(startErr);
                if (errorMessage.includes('タイムアウト')) {
                  setStartProgress(prev => ({ ...prev, [engineType]: { progress: 50, message: '起動処理は継続中です...' } }));
                } else {
                  throw startErr;
                }
              }
              
              // 起動確認のため少し待機
              setStartProgress(prev => ({ ...prev, [engineType]: { progress: 60, message: '起動確認中...' } }));
              await new Promise(resolve => setTimeout(resolve, 1000));
              setStartProgress(prev => ({ ...prev, [engineType]: { progress: 70, message: 'エンジンの状態を確認中...' } }));
              await new Promise(resolve => setTimeout(resolve, 1000));
              setStartProgress(prev => ({ ...prev, [engineType]: { progress: 80, message: '最終確認中...' } }));
              
              // 起動後の状態を再検出（最大3回リトライ）
              let startRecheckResult: EngineDetectionResult | null = null;
              for (let retry = 0; retry < 3; retry++) {
                await new Promise(resolve => setTimeout(resolve, 1000 + retry * 1000));
                try {
                  startRecheckResult = await safeInvoke<EngineDetectionResult>('detect_engine', { engineType });
                  setDetectionResults(prev => ({ ...prev, [engineType]: startRecheckResult! }));
                  if (startRecheckResult.running) {
                    break;
                  }
                } catch (detectErr) {
                  logger.warn(
                    `インストール後の自動起動検出に失敗しました（試行 ${retry + 1}/3）`,
                    detectErr instanceof Error ? detectErr.message : String(detectErr),
                    'EngineUpdateSection'
                  );
                  if (retry === 2) {
                    // 最後の試行でも失敗した場合
                    setStartProgress(prev => ({ ...prev, [engineType]: null }));
                    logger.warn(
                      `${engineNames[engineType]}の自動起動に失敗しました。エンジンが起動しているか確認してください。`,
                      '',
                      'EngineUpdateSection'
                    );
                    return;
                  }
                }
              }
              
              // 状態を確認してから成功メッセージを表示
              if (startRecheckResult && startRecheckResult.running) {
                setStartProgress(prev => ({ ...prev, [engineType]: { progress: 100, message: '起動が完了しました' } }));
                
                // 少し待ってからプログレスバーを非表示
                await new Promise(resolve => setTimeout(resolve, 500));
                setStartProgress(prev => ({ ...prev, [engineType]: null }));
                
                setSuccessMessage(prev => ({
                  ...prev,
                  [engineType]: `${engineNames[engineType]}のインストールと起動が完了しました`,
                }));
              } else {
                // 起動に失敗した場合
                setStartProgress(prev => ({ ...prev, [engineType]: null }));
                logger.warn(
                  `${engineNames[engineType]}の自動起動に失敗しました。エンジンが起動しているか確認してください。`,
                  '',
                  'EngineUpdateSection'
                );
              }
            } catch (startErr) {
              setStartProgress(prev => ({ ...prev, [engineType]: null }));
              // 起動に失敗してもインストールは成功しているので、警告のみ
              logger.warn(
                `${engineNames[engineType]}の自動起動に失敗しました`,
                startErr instanceof Error ? startErr.message : String(startErr),
                'EngineUpdateSection'
              );
            }
          } catch (err) {
            setError(prev => ({
              ...prev,
              [engineType]:
                err instanceof Error ? err.message : 'インストールに失敗しました',
            }));
          } finally {
            setInstalling(prev => ({ ...prev, [engineType]: false }));
            setProgress(prev => ({ ...prev, [engineType]: null }));
          }
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        },
      });
    },
    [engineNames]
  );

  // エンジン起動
  const handleStartEngine = useCallback(
    async (engineType: string) => {
      try {
        setStarting(prev => ({ ...prev, [engineType]: true }));
        setError(prev => ({ ...prev, [engineType]: null }));
        setStartProgress(prev => ({ ...prev, [engineType]: { progress: 0, message: '起動コマンドを実行中...' } }));

        // 起動コマンド実行中（0-50%）
        try {
          setStartProgress(prev => ({ ...prev, [engineType]: { progress: 20, message: '起動コマンドを実行中...' } }));
          await safeInvoke('start_engine', {
            engineType: engineType,
            config: null,
          });
          setStartProgress(prev => ({ ...prev, [engineType]: { progress: 50, message: '起動コマンドが完了しました' } }));
        } catch (startErr) {
          // タイムアウトエラーの場合でも処理を続行
          const errorMessage = startErr instanceof Error ? startErr.message : String(startErr);
          if (errorMessage.includes('タイムアウト')) {
            setStartProgress(prev => ({ ...prev, [engineType]: { progress: 50, message: '起動処理は継続中です...' } }));
          } else {
            throw startErr;
          }
        }

        // 起動確認待機中（50-80%）
        setStartProgress(prev => ({ ...prev, [engineType]: { progress: 60, message: '起動確認中...' } }));
        await new Promise(resolve => setTimeout(resolve, 1000));
        setStartProgress(prev => ({ ...prev, [engineType]: { progress: 70, message: 'エンジンの状態を確認中...' } }));
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 状態確認中（80-100%）
        setStartProgress(prev => ({ ...prev, [engineType]: { progress: 80, message: '最終確認中...' } }));
        
        // 起動後の状態を確認（最大3回リトライ）
        let recheckResult: EngineDetectionResult | null = null;
        for (let retry = 0; retry < 3; retry++) {
          await new Promise(resolve => setTimeout(resolve, 1000 + retry * 1000));
          try {
            recheckResult = await safeInvoke<EngineDetectionResult>('detect_engine', { engineType });
            setDetectionResults(prev => ({ ...prev, [engineType]: recheckResult! }));
            if (recheckResult.running) {
              break;
            }
          } catch (detectErr) {
            logger.warn(
              `起動後の検出に失敗しました（試行 ${retry + 1}/3）`,
              detectErr instanceof Error ? detectErr.message : String(detectErr),
              'EngineUpdateSection'
            );
            if (retry === 2) {
              // 最後の試行でも失敗した場合
              setStartProgress(prev => ({ ...prev, [engineType]: null }));
              throw new Error('エンジンの起動に失敗しました。エンジンが起動しているか確認してください。');
            }
          }
        }
        
        // 状態を確認してから成功メッセージを表示
        if (recheckResult && recheckResult.running) {
          setStartProgress(prev => ({ ...prev, [engineType]: { progress: 100, message: '起動が完了しました' } }));
          
          // 少し待ってからプログレスバーを非表示
          await new Promise(resolve => setTimeout(resolve, 500));
          setStartProgress(prev => ({ ...prev, [engineType]: null }));

          setSuccessMessage(prev => ({
            ...prev,
            [engineType]: `${engineNames[engineType]}を起動しました`,
          }));
          const existingTimeout = successMessageTimeoutsRef.current[engineType];
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }
          const timeoutId = setTimeout(() => {
            setSuccessMessage(prev => ({ ...prev, [engineType]: null }));
            successMessageTimeoutsRef.current[engineType] = null;
          }, TIMEOUT.SUCCESS_MESSAGE);
          successMessageTimeoutsRef.current[engineType] = timeoutId;
        } else {
          // 起動に失敗した場合
          setStartProgress(prev => ({ ...prev, [engineType]: null }));
          throw new Error('エンジンの起動に失敗しました。エンジンが起動しているか確認してください。');
        }
      } catch (err) {
        setStartProgress(prev => ({ ...prev, [engineType]: null }));
        setError(prev => ({
          ...prev,
          [engineType]:
            err instanceof Error ? err.message : 'エンジンの起動に失敗しました',
        }));
      } finally {
        setStarting(prev => ({ ...prev, [engineType]: false }));
      }
    },
    [engineNames]
  );

  // エンジン停止
  const handleStopEngine = useCallback(
    async (engineType: string) => {
      try {
        setStopping(prev => ({ ...prev, [engineType]: true }));
        setError(prev => ({ ...prev, [engineType]: null }));

        await safeInvoke('stop_engine', { engineType });

        // 停止後に再度検出して状態を更新（自動起動は試みない）
        // 停止が成功したかを確認するため、少し待機してから検出
        await new Promise(resolve => setTimeout(resolve, 1000));
        const result = await safeInvoke<EngineDetectionResult>('detect_engine', { engineType });
        setDetectionResults(prev => ({ ...prev, [engineType]: result }));

        // 停止が成功したかどうかを確認
        if (result.running) {
          // まだ実行中の場合はエラーを表示
          setError(prev => ({
            ...prev,
            [engineType]: `${engineNames[engineType]}の停止に失敗しました。エンジンがまだ実行中です。`,
          }));
          return;
        }

        // 停止が成功した場合
        setSuccessMessage(prev => ({
          ...prev,
          [engineType]: `${engineNames[engineType]}を停止しました`,
        }));
        const existingTimeout = successMessageTimeoutsRef.current[engineType];
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        const timeoutId = setTimeout(() => {
          setSuccessMessage(prev => ({ ...prev, [engineType]: null }));
          successMessageTimeoutsRef.current[engineType] = null;
        }, TIMEOUT.SUCCESS_MESSAGE);
        successMessageTimeoutsRef.current[engineType] = timeoutId;
      } catch (err) {
        setError(prev => ({
          ...prev,
          [engineType]:
            err instanceof Error ? err.message : 'エンジンの停止に失敗しました',
        }));
      } finally {
        setStopping(prev => ({ ...prev, [engineType]: false }));
      }
    },
    [engineNames]
  );

  // アップデート実行
  const handleUpdate = useCallback(
    async (engineType: string) => {
      setConfirmDialog({
        isOpen: true,
        message: `${engineNames[engineType]}を最新版に更新しますか？更新中は${engineNames[engineType]}が一時的に停止します。`,
        confirmVariant: 'primary',
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));

          try {
            setUpdating(prev => ({ ...prev, [engineType]: true }));
            setError(prev => ({ ...prev, [engineType]: null }));
            setProgress(prev => ({ ...prev, [engineType]: null }));

            // 進捗イベントをリッスン
            const eventName =
              engineType === 'ollama'
                ? 'ollama_update_progress'
                : 'engine_update_progress';
            const unlisten = await listen<DownloadProgress>(eventName, event => {
              if (event.payload && typeof event.payload.progress === 'number') {
                setProgress(prev => ({
                  ...prev,
                  [engineType]: {
                    downloaded: event.payload.downloaded_bytes || 0,
                    total: event.payload.total_bytes || 0,
                    percentage: event.payload.progress || 0,
                  },
                }));
              }
            });

            // アップデート実行
            if (engineType === 'ollama') {
              await safeInvoke('update_ollama');
            } else {
              await safeInvoke('update_engine', { engineType });
            }

            // イベントリスナーを解除
            unlisten();

            setSuccessMessage(prev => ({
              ...prev,
              [engineType]: `${engineNames[engineType]}を最新版に更新しました`,
            }));
            const existingTimeout = successMessageTimeoutsRef.current[engineType];
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }
            const timeoutId = setTimeout(() => {
              setSuccessMessage(prev => ({ ...prev, [engineType]: null }));
              successMessageTimeoutsRef.current[engineType] = null;
            }, TIMEOUT.SUCCESS_MESSAGE);
            successMessageTimeoutsRef.current[engineType] = timeoutId;
            setUpdateInfo(prev => ({ ...prev, [engineType]: null }));
            setProgress(prev => ({ ...prev, [engineType]: null }));

            // 更新後に再度チェック
            await checkUpdate(engineType);
          } catch (err) {
            setError(prev => ({
              ...prev,
              [engineType]:
                err instanceof Error ? err.message : 'アップデートに失敗しました',
            }));
          } finally {
            setUpdating(prev => ({ ...prev, [engineType]: false }));
            setProgress(prev => ({ ...prev, [engineType]: null }));
          }
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        },
      });
    },
    [engineNames, checkUpdate]
  );

  useEffect(() => {
    return () => {
      Object.values(successMessageTimeoutsRef.current).forEach(timeout => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
      successMessageTimeoutsRef.current = {};
    };
  }, []);

  // 初回マウント時に全エンジンを検出・チェック
  useEffect(() => {
    engines.forEach(engineType => {
      detectEngine(engineType);
      if (engineType === 'ollama') {
        checkUpdate(engineType);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回マウント時のみ実行

  return (
    <section
      className="settings-section"
      aria-labelledby="engine-update-heading"
    >
      <h2 id="engine-update-heading" className="settings-section-title">
        {t('settings.engineUpdate.title') || 'エンジン管理'}
      </h2>
      <div className="settings-group">
        {engines.map(engineType => {
          const detection = detectionResults[engineType];
          const update = updateInfo[engineType];
          const isInstalled = detection?.installed || false;
          const isRunning = detection?.running || false;
          const isChecking = checking[engineType] || false;
          const isUpdating = updating[engineType] || false;
          const isInstalling = installing[engineType] || false;
          const isStarting = starting[engineType] || false;
          const isStopping = stopping[engineType] || false;
          const engineError = error[engineType];
          const engineSuccess = successMessage[engineType];
          const engineProgress = progress[engineType];

          return (
            <div key={engineType} className="settings-engine-update">
              <div className="settings-engine-update-header">
                <div>
                  <h3>{engineNames[engineType]}</h3>
                  <div className="settings-engine-status">
                    {isInstalled ? (
                      <>
                        <span className="status-badge success">
                          インストール済み
                        </span>
                        {isRunning ? (
                          <span className="status-badge success">実行中</span>
                        ) : (
                          <span className="status-badge warning">停止中</span>
                        )}
                        {detection?.version && (
                          <span className="settings-engine-version">
                            バージョン: {detection.version}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="status-badge error">未インストール</span>
                    )}
                  </div>
                  {update && (
                    <div className="settings-engine-version-info">
                      {update.current_version && (
                        <span className="settings-engine-version">
                          {t('settings.engineUpdate.currentVersion') ||
                            '現在のバージョン'}
                          : {update.current_version}
                        </span>
                      )}
                      <span className="settings-engine-version">
                        {t('settings.engineUpdate.latestVersion') ||
                          '最新バージョン'}
                        : {update.latest_version}
                      </span>
                    </div>
                  )}
                </div>
                <div className="settings-engine-actions">
                  {!isInstalled ? (
                    <button
                      type="button"
                      className="settings-button primary"
                      onClick={() => {
                        startTransition(() => {
                          handleInstall(engineType);
                        });
                      }}
                      disabled={isInstalling || isPending}
                    >
                      {isInstalling ? 'インストール中...' : 'インストール'}
                    </button>
                  ) : (
                    <>
                      {!isRunning ? (
                        <button
                          type="button"
                          className="settings-button primary"
                          onClick={() => {
                            startTransition(() => {
                              handleStartEngine(engineType);
                            });
                          }}
                          disabled={isStarting || isStopping || isPending}
                        >
                          {isStarting ? '起動中...' : '起動'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="settings-button danger"
                          onClick={() => {
                            startTransition(() => {
                              handleStopEngine(engineType);
                            });
                          }}
                          disabled={isStarting || isStopping || isPending}
                        >
                          {isStopping ? '停止中...' : '停止'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="settings-button secondary"
                        onClick={() => {
                          startTransition(() => {
                            checkUpdate(engineType);
                          });
                        }}
                        disabled={isChecking || isUpdating || isStarting || isStopping || isPending}
                      >
                        {isChecking ? '確認中...' : 'アップデート確認'}
                      </button>
                      {update && update.update_available && (
                        <button
                          type="button"
                          className="settings-button primary"
                          onClick={() => {
                            startTransition(() => {
                              handleUpdate(engineType);
                            });
                          }}
                          disabled={isUpdating || isStarting || isStopping || isPending}
                        >
                          {isUpdating ? '更新中...' : '更新'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {engineError && (
                <ErrorMessage
                  message={engineError}
                  type="general"
                  onClose={() =>
                    setError(prev => ({ ...prev, [engineType]: null }))
                  }
                />
              )}

              {engineSuccess && (
                <InfoBanner
                  type="success"
                  message={engineSuccess}
                  dismissible
                  onDismiss={() =>
                    setSuccessMessage(prev => ({ ...prev, [engineType]: null }))
                  }
                />
              )}

              {engineProgress && (
                <EngineProgressBar 
                  progress={engineProgress.percentage}
                  message={engineProgress.message || `${engineProgress.downloaded.toLocaleString()} / ${engineProgress.total.toLocaleString()} bytes (${engineProgress.percentage.toFixed(1)}%)`}
                />
              )}

              {startProgress[engineType] && (
                <EngineProgressBar 
                  progress={startProgress[engineType]!.progress}
                  message={startProgress[engineType]!.message}
                />
              )}

              {update && !update.update_available && isInstalled && (
                <InfoBanner
                  type="success"
                  message={`${engineNames[engineType]}は最新版です`}
                />
              )}

              {/* 診断情報の表示: 未インストールの場合、またはインストールされているが起動していない場合 */}
              {detection?.message && (
                <InfoBanner 
                  type={!isInstalled ? "warning" : isRunning ? "info" : "warning"} 
                  message={detection.message}
                  dismissible={isInstalled && isRunning}
                />
              )}
            </div>
          );
        })}
      </div>
      {confirmDialog.isOpen && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
          confirmVariant={confirmDialog.confirmVariant || 'primary'}
        />
      )}
    </section>
  );
};

