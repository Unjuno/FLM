// Ollama関連のカスタムフック
// IPC通信を扱うフック

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../utils/tauri';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { OllamaStatus, DownloadProgress } from '../types/ollama';

/**
 * Ollama検出結果の状態管理
 */
export function useOllamaDetection() {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    setIsDetecting(true);
    setError(null);
    
    try {
      // バックエンドのコマンド名は detect_ollama
      const result = await safeInvoke<OllamaStatus>('detect_ollama');
      setStatus(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ollamaの検出に失敗しました';
      setError(errorMessage);
      setStatus(null);
    } finally {
      setIsDetecting(false);
    }
  }, []);

  useEffect(() => {
    // マウント時に自動検出
    detect();
  }, [detect]);

  return {
    status,
    isDetecting,
    error,
    detect, // 手動で再検出する場合
  };
}

/**
 * Ollamaダウンロードの状態管理
 */
export function useOllamaDownload() {
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'completed' | 'error'>('idle');
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
      const unlistenProgress = await listen<DownloadProgress>('ollama_download_progress', (event) => {
        const progressData = event.payload;
        setProgress(progressData);
        
        // 完了状態を検知（status='completed'の場合）
        if (progressData.status === 'completed') {
          setDownloadStatus('completed');
        } else if (progressData.status === 'error') {
          setError(progressData.message || 'ダウンロードに失敗しました');
          setDownloadStatus('error');
        }
      });

      // リスナーの参照を保存
      unlistenRef.current = unlistenProgress;

      // ダウンロード開始（進捗はイベント経由で受信）
      const downloadPath = await safeInvoke<string>('download_ollama', { platform: platform || null });
      setDownloadPath(downloadPath);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ダウンロードに失敗しました';
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

  const start = useCallback(async () => {
    setIsStarting(true);
    setError(null);

    try {
      await safeInvoke('start_ollama');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ollamaの起動に失敗しました';
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
      const errorMessage = err instanceof Error ? err.message : 'Ollamaの停止に失敗しました';
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

