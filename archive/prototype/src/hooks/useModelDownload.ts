// SPDX-License-Identifier: MIT
// useModelDownload - モデルダウンロードロジックを管理するカスタムフック

import { useState, useCallback, useRef, useEffect } from 'react';
import { safeInvoke } from '../utils/tauri';
import { listen } from '@tauri-apps/api/event';
import { extractErrorMessage } from '../utils/errorHandler';
import type { ModelInfo } from './useModelSearch';

/**
 * ダウンロード進捗情報
 */
export interface DownloadProgress {
  progress: number;
  speed: number;
  remaining: number;
  downloaded: number;
  total: number;
}

/**
 * ダウンロードステータス
 */
export type DownloadStatus =
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'complete'
  | 'error';

/**
 * モデルダウンロードロジックを管理するカスタムフック
 */
export const useModelDownload = (onDownloadComplete?: () => void) => {
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);
  const [downloadStatus, setDownloadStatus] =
    useState<DownloadStatus>('downloading');

  const downloadAbortControllerRef = useRef<AbortController | null>(null);
  const unsubscribeProgressRef = useRef<(() => void) | null>(null);
  const pausedModelRef = useRef<ModelInfo | null>(null);

  // モデルダウンロード開始（useCallbackでメモ化）
  const handleDownload = useCallback(
    async (model: ModelInfo) => {
      if (!model.size) {
        throw new Error(
          'モデルサイズ情報がありません。このモデルは取得できません。'
        );
      }

      setDownloadingModel(model.name);
      setDownloadStatus('downloading');
      setDownloadProgress({
        progress: 0,
        speed: 0,
        remaining: 0,
        downloaded: 0,
        total: model.size,
      });

      const abortController = new AbortController();
      downloadAbortControllerRef.current = abortController;

      // 最終ステータスを追跡するローカル変数（finallyブロックで使用）
      let finalStatus: DownloadStatus = 'downloading';

      // ステータス文字列を内部ステータスにマッピングするヘルパー関数
      const mapStatus = (status: string): DownloadStatus => {
        if (status === 'completed' || status === 'success') return 'complete';
        if (status === 'paused') return 'paused';
        if (status === 'verifying') return 'verifying';
        if (status === 'error' || status === 'failed') return 'error';
        return 'downloading';
      };

      try {
        // 進捗イベントリスナーを設定
        const unsubscribe = await listen<{
          status: string;
          progress: number;
          downloaded_bytes: number;
          total_bytes: number;
          speed_bytes_per_sec: number;
          message?: string | null;
        }>('model_download_progress', event => {
          if (abortController.signal.aborted) {
            return;
          }

          const { status, downloaded_bytes, total_bytes, speed_bytes_per_sec } =
            event.payload;

          const downloaded = downloaded_bytes || 0;
          const total = total_bytes || model.size || 0;
          const speed = speed_bytes_per_sec || 0;
          const remaining =
            speed > 0 && total > 0 ? (total - downloaded) / speed : 0;
          const progressPercent = total > 0 ? (downloaded / total) * 100 : 0;

          // ステータスをマッピング
          const mappedStatus = mapStatus(status);
          finalStatus = mappedStatus;

          setDownloadStatus(mappedStatus);
          setDownloadProgress({
            progress: mappedStatus === 'complete' ? 100 : progressPercent,
            downloaded,
            speed,
            remaining: mappedStatus === 'complete' ? 0 : remaining,
            total: total || model.size || 0,
          });
        });

        unsubscribeProgressRef.current = unsubscribe;

        // 実際のIPCコマンドを呼び出し
        await safeInvoke('download_model', {
          modelName: model.name,
        });

        // ダウンロード完了通知
        if (!abortController.signal.aborted) {
          if (
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('取得完了', {
              body: `${model.name} の取得が完了しました`,
              icon: '/icon.png',
            });
          }
        }

        // ダウンロード完了時のコールバック
        if (onDownloadComplete) {
          onDownloadComplete();
        }
      } catch (err) {
        // Abortエラーは一時停止によるものなので、エラーとして扱わない
        if (abortController.signal.aborted) {
          finalStatus = 'paused';
          setDownloadStatus('paused');
          // 一時停止時はモデル情報を保持
          pausedModelRef.current = model;
        } else {
          finalStatus = 'error';
          setDownloadStatus('error');
          throw new Error(
            `ダウンロードに失敗しました: ${extractErrorMessage(err, '不明なエラー')}`
          );
        }
      } finally {
        // 完了またはエラー、一時停止以外の場合はクリーンアップ
        const status = finalStatus as DownloadStatus;

        switch (status) {
          case 'paused':
            // 一時停止時はモデル情報を保持
            pausedModelRef.current = model;
            // イベントリスナーは既にhandlePauseDownloadで解除されている
            break;
          case 'complete':
          case 'error':
            if (unsubscribeProgressRef.current) {
              try {
                unsubscribeProgressRef.current();
              } catch (error) {
                // ホットリロード時など、コールバックが見つからない場合は警告を抑制
                if (process.env.NODE_ENV === 'development') {
                  // eslint-disable-next-line no-console
                  console.debug(
                    'イベントリスナーのクリーンアップ中にエラーが発生しました（無視されます）',
                    error
                  );
                }
              }
              unsubscribeProgressRef.current = null;
            }
            pausedModelRef.current = null;
            downloadAbortControllerRef.current = null;
            break;
          default:
            if (unsubscribeProgressRef.current) {
              try {
                unsubscribeProgressRef.current();
              } catch (error) {
                // ホットリロード時など、コールバックが見つからない場合は警告を抑制
                if (process.env.NODE_ENV === 'development') {
                  // eslint-disable-next-line no-console
                  console.debug(
                    'イベントリスナーのクリーンアップ中にエラーが発生しました（無視されます）',
                    error
                  );
                }
              }
              unsubscribeProgressRef.current = null;
            }
            setDownloadingModel(null);
            setDownloadProgress(null);
            pausedModelRef.current = null;
            downloadAbortControllerRef.current = null;
            break;
        }
      }
    },
    [onDownloadComplete]
  );

  // ダウンロード一時停止（useCallbackでメモ化）
  const handlePauseDownload = useCallback(() => {
    if (downloadAbortControllerRef.current && downloadingModel) {
      // ダウンロードを中断
      downloadAbortControllerRef.current.abort();

      // 状態を一時停止に設定
      setDownloadStatus('paused');

      // イベントリスナーを解除（再開時に新しいものを設定するため）
      if (unsubscribeProgressRef.current) {
        try {
          unsubscribeProgressRef.current();
        } catch (error) {
          // ホットリロード時など、コールバックが見つからない場合は警告を抑制
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.debug(
              'イベントリスナーのクリーンアップ中にエラーが発生しました（無視されます）',
              error
            );
          }
        }
        unsubscribeProgressRef.current = null;
      }

      // AbortControllerは再開時に新しいものを作成するため、ここではnullにしない
    }
  }, [downloadingModel]);

  // ダウンロード再開（useCallbackでメモ化）
  const handleResumeDownload = useCallback(async () => {
    if (pausedModelRef.current && downloadingModel) {
      // 一時停止されたモデルでダウンロードを再開
      // handleDownloadを呼び出すことで、既存のロジックを再利用
      await handleDownload(pausedModelRef.current);
    }
  }, [downloadingModel, handleDownload]);

  // ダウンロードキャンセル（useCallbackでメモ化）
  const handleCancelDownload = useCallback(() => {
    if (downloadAbortControllerRef.current) {
      downloadAbortControllerRef.current.abort();
    }
    setDownloadingModel(null);
    setDownloadProgress(null);
    setDownloadStatus('downloading');
    downloadAbortControllerRef.current = null;
    pausedModelRef.current = null;
    // イベントリスナーを解除
    if (unsubscribeProgressRef.current) {
      try {
        unsubscribeProgressRef.current();
      } catch (error) {
        // ホットリロード時など、コールバックが見つからない場合は警告を抑制
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.debug(
            'イベントリスナーのクリーンアップ中にエラーが発生しました（無視されます）',
            error
          );
        }
      }
      unsubscribeProgressRef.current = null;
    }
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      // イベントリスナーのクリーンアップ（エラーハンドリング付き）
      if (unsubscribeProgressRef.current) {
        try {
          unsubscribeProgressRef.current();
        } catch (error) {
          // ホットリロード時など、コールバックが見つからない場合は警告を抑制
          // これは開発環境でのみ発生する問題で、本番環境では問題にならない
          if (process.env.NODE_ENV === 'development') {
            // 開発環境では警告をログに記録するが、エラーとして扱わない
            // eslint-disable-next-line no-console
            console.debug(
              'イベントリスナーのクリーンアップ中にエラーが発生しました（無視されます）',
              error
            );
          }
        }
        unsubscribeProgressRef.current = null;
      }
      if (downloadAbortControllerRef.current) {
        try {
          downloadAbortControllerRef.current.abort();
        } catch (error) {
          // AbortControllerのエラーも無視
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.debug(
              'AbortControllerのクリーンアップ中にエラーが発生しました（無視されます）',
              error
            );
          }
        }
        downloadAbortControllerRef.current = null;
      }
      pausedModelRef.current = null;
    };
  }, []);

  return {
    downloadingModel,
    downloadProgress,
    downloadStatus,
    handleDownload,
    handlePauseDownload,
    handleResumeDownload,
    handleCancelDownload,
  };
};
