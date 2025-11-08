// Ollama関連のカスタムフック
// IPC通信を扱うフック

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../utils/tauri';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { OllamaStatus, DownloadProgress } from '../types/ollama';
import {
  autoSetupOllama,
  type AutoSetupResult,
  type AutoSetupStepState,
} from '../services/ollamaAutoSetup';

type AutoSetupLifecycleStatus = 'idle' | 'running' | 'completed' | 'error';

interface SharedOllamaDetectionState {
  status: OllamaStatus | null;
  isDetecting: boolean;
  error: string | null;
  autoSteps: AutoSetupStepState[];
  autoStatus: AutoSetupLifecycleStatus;
  autoError: string | null;
}

const sharedDetectionState: SharedOllamaDetectionState = {
  status: null,
  isDetecting: false,
  error: null,
  autoSteps: [],
  autoStatus: 'idle',
  autoError: null,
};

type DetectionListener = (state: SharedOllamaDetectionState) => void;
const detectionListeners = new Set<DetectionListener>();

const getSharedSnapshot = (): SharedOllamaDetectionState => ({
  status: sharedDetectionState.status,
  isDetecting: sharedDetectionState.isDetecting,
  error: sharedDetectionState.error,
  autoSteps: [...sharedDetectionState.autoSteps],
  autoStatus: sharedDetectionState.autoStatus,
  autoError: sharedDetectionState.autoError,
});

const notifyDetectionListeners = () => {
  const snapshot = getSharedSnapshot();
  detectionListeners.forEach(listener => listener(snapshot));
};

let detectInFlight: Promise<OllamaStatus | null> | null = null;
let autoSetupInFlight: Promise<AutoSetupResult | void> | null = null;
let autoSetupRunning = false;

/**
 * Ollama検出結果の状態管理
 */
export function useOllamaDetection() {
  const [state, setState] = useState<SharedOllamaDetectionState>(() =>
    getSharedSnapshot()
  );

  const detect = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.log('[useOllamaDetection] Ollama検出を開始します...');
    sharedDetectionState.isDetecting = true;
    sharedDetectionState.error = null;
    notifyDetectionListeners();

    if (!detectInFlight) {
      detectInFlight = (async () => {
        try {
          // eslint-disable-next-line no-console
          console.log(
            '[useOllamaDetection] detect_ollamaコマンドを呼び出します...'
          );
          const result = await safeInvoke<OllamaStatus>('detect_ollama');
          // eslint-disable-next-line no-console
          console.log('[useOllamaDetection] 検出結果:', result);
          sharedDetectionState.status = result;
          sharedDetectionState.error = null;
          // eslint-disable-next-line no-console
          console.log('[useOllamaDetection] 検出が完了しました');
          return result;
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : 'Ollamaの検出に失敗しました';
          // eslint-disable-next-line no-console
          console.error('[useOllamaDetection] 検出エラー:', errorMessage);
          // eslint-disable-next-line no-console
          console.error('[useOllamaDetection] エラー詳細:', err);
          sharedDetectionState.error = errorMessage;
          sharedDetectionState.status = null;
          return null;
        } finally {
          sharedDetectionState.isDetecting = false;
          notifyDetectionListeners();
          detectInFlight = null;
        }
      })();
    }

    await detectInFlight;
  }, []);

  const runAutoSetup = useCallback(async () => {
    if (autoSetupRunning) {
      await (autoSetupInFlight ?? Promise.resolve());
      return;
    }

    autoSetupRunning = true;
    sharedDetectionState.autoStatus = 'running';
    sharedDetectionState.autoError = null;
    sharedDetectionState.autoSteps = [];
    notifyDetectionListeners();

    autoSetupInFlight = (async () => {
      try {
        const result: AutoSetupResult = await autoSetupOllama(updatedSteps => {
          sharedDetectionState.autoSteps = [...updatedSteps];
          notifyDetectionListeners();
        });

        sharedDetectionState.autoSteps = [...result.steps];

        if (result.status) {
          sharedDetectionState.status = result.status;
          sharedDetectionState.error = null;
        }

        if (result.error) {
          sharedDetectionState.autoStatus = 'error';
          sharedDetectionState.autoError = result.error;
        } else {
          sharedDetectionState.autoStatus = 'completed';
          sharedDetectionState.autoError = null;
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Ollamaの自動セットアップに失敗しました';
        sharedDetectionState.autoStatus = 'error';
        sharedDetectionState.autoError = message;
      } finally {
        autoSetupRunning = false;
        autoSetupInFlight = null;
        notifyDetectionListeners();
      }
    })();

    await autoSetupInFlight;
  }, []);

  // マウント時に自動検出（重複を防ぐため、一度だけ実行）
  const hasDetectedRef = useRef(false);

  useEffect(() => {
    const listener: DetectionListener = nextState => {
      setState(nextState);
    };

    detectionListeners.add(listener);

    return () => {
      detectionListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (hasDetectedRef.current) {
      return;
    }

    hasDetectedRef.current = true;

    detect()
      .then(() => {
        if (!autoSetupRunning) {
          sharedDetectionState.autoSteps = [];
          notifyDetectionListeners();
        }
      })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error('[useOllamaDetection] 自動検出エラー:', err);
        hasDetectedRef.current = false;
      });
  }, [detect]);

  useEffect(() => {
    if (state.isDetecting) {
      return;
    }

    if (!state.status) {
      if (state.autoStatus === 'idle') {
        runAutoSetup().catch(err => {
          // eslint-disable-next-line no-console
          console.error('[useOllamaDetection] 自動セットアップエラー:', err);
        });
      }
      return;
    }

    const needsDownload = !state.status.installed && !state.status.portable;
    const needsStart = !state.status.running;

    if (needsDownload || needsStart) {
      if (state.autoStatus !== 'running') {
        runAutoSetup().catch(err => {
          // eslint-disable-next-line no-console
          console.error('[useOllamaDetection] 自動セットアップエラー:', err);
        });
      }
    } else {
      if (sharedDetectionState.autoStatus === 'running') {
        sharedDetectionState.autoStatus = 'completed';
        notifyDetectionListeners();
      }
    }
  }, [state.status, state.autoStatus, state.isDetecting, runAutoSetup]);

  return {
    status: state.status,
    isDetecting: state.isDetecting,
    error: state.error,
    detect,
    autoSteps: state.autoSteps,
    autoStatus: state.autoStatus,
    autoError: state.autoError,
    runAutoSetup,
  };
}

/**
 * Ollamaダウンロードの状態管理
 */
export function useOllamaDownload() {
  const [downloadStatus, setDownloadStatus] = useState<
    'idle' | 'downloading' | 'completed' | 'error'
  >('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadPath, setDownloadPath] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const download = useCallback(async (platform?: string) => {
    setDownloadStatus('downloading');
    setError(null);
    setProgress(null);
    setDownloadPath(null);

    // 既存のリスナーをクリーンアップ
    if (unlistenRef.current) {
      try {
        await unlistenRef.current();
      } catch (err) {
        // クリーンアップエラーは無視
      }
      unlistenRef.current = null;
    }

    try {
      // 進捗イベントのリスナーを設定
      const unlistenProgress = await listen<DownloadProgress>(
        'ollama_download_progress',
        event => {
          const progressData = event.payload;
          setProgress(progressData);

          // 完了状態を検知（status='completed'の場合）
          if (progressData.status === 'completed') {
            setDownloadStatus('completed');
          } else if (progressData.status === 'error') {
            setError(progressData.message || 'ダウンロードに失敗しました');
            setDownloadStatus('error');
          }
        }
      );

      // リスナーの参照を保存
      unlistenRef.current = unlistenProgress;

      // ダウンロード開始（進捗はイベント経由で受信）
      const downloadPath = await safeInvoke<string>('download_ollama', {
        platform: platform || null,
      });
      setDownloadPath(downloadPath);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'ダウンロードに失敗しました';
      setError(errorMessage);
      setDownloadStatus('error');

      // エラー時もリスナーをクリーンアップ
      if (unlistenRef.current) {
        try {
          // UnlistenFnは通常Promise<void>を返す
          await unlistenRef.current();
        } catch (cleanupErr) {
          // クリーンアップエラーは無視（型チェックを回避するためanyを使用）
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ignored = cleanupErr as any;
          void ignored;
        }
        unlistenRef.current = null;
      }
    }
  }, []);

  // コンポーネントのアンマウント時にイベントリスナーをクリーンアップ
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        // アンマウント時は同期的にクリーンアップできないため、Promiseを無視
        // UnlistenFnがPromiseを返す場合でも、アンマウント時の非同期処理は完了を待たない
        try {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          unlistenRef.current();
        } catch {
          // クリーンアップエラーは無視
        }
        unlistenRef.current = null;
      }
    };
  }, []);

  const reset = useCallback(() => {
    setDownloadStatus('idle');
    setProgress(null);
    setError(null);
    setDownloadPath(null);
  }, []);

  return {
    downloadStatus,
    progress,
    error,
    downloadPath,
    download,
    reset,
  };
}

/**
 * Ollamaプロセスの起動・停止管理
 */
export function useOllamaProcess() {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (ollama_path?: string | null) => {
    // eslint-disable-next-line no-console
    console.log(
      '[useOllamaProcess] Ollama起動を開始します...',
      ollama_path ? `パス: ${ollama_path}` : 'パス自動検出'
    );
    setIsStarting(true);
    setError(null);

    try {
      // eslint-disable-next-line no-console
      console.log(
        '[useOllamaProcess] start_ollamaコマンドを呼び出します...',
        ollama_path ? `指定パス: ${ollama_path}` : ''
      );
      const args = ollama_path ? { ollama_path } : undefined;
      const result = await safeInvoke<number>('start_ollama', args);
      // eslint-disable-next-line no-console
      console.log('[useOllamaProcess] 起動結果 (PID):', result);
      // eslint-disable-next-line no-console
      console.log(
        '[useOllamaProcess] Ollamaの起動が完了しました (PID:',
        result,
        ')'
      );
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Ollamaの起動に失敗しました';
      // eslint-disable-next-line no-console
      console.error('[useOllamaProcess] 起動エラー:', errorMessage);
      // eslint-disable-next-line no-console
      console.error('[useOllamaProcess] エラー詳細:', err);
      // eslint-disable-next-line no-console
      console.error(
        '[useOllamaProcess] エラーオブジェクト:',
        JSON.stringify(err, Object.getOwnPropertyNames(err))
      );
      setError(errorMessage);
      throw err;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setIsStopping(true);
    setError(null);

    try {
      await safeInvoke('stop_ollama');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Ollamaの停止に失敗しました';
      setError(errorMessage);
      throw err;
    } finally {
      setIsStopping(false);
    }
  }, []);

  return {
    start,
    stop,
    isStarting,
    isStopping,
    error,
  };
}
