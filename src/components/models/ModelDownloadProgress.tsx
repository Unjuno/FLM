// ModelDownloadProgress - モデルダウンロード進捗コンポーネント

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import './ModelDownloadProgress.css';

/**
 * ダウンロード進捗情報
 */
interface DownloadProgress {
  progress: number;
  speed: number;        // バイト/秒
  remaining: number;    // 残り秒数
  downloaded: number;   // ダウンロード済みバイト数
  total: number;        // 総バイト数
}

/**
 * ダウンロード状態
 */
type DownloadStatus = 'downloading' | 'paused' | 'verifying' | 'complete' | 'error';

/**
 * モデルダウンロード進捗コンポーネント
 */
interface ModelDownloadProgressProps {
  modelName: string;
  progress: DownloadProgress;
  status?: DownloadStatus;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

export const ModelDownloadProgress: React.FC<ModelDownloadProgressProps> = ({
  modelName,
  progress,
  status = 'downloading',
  onPause,
  onResume,
  onCancel,
}) => {
  const { t } = useI18n();
  const progressBarRef = useRef<HTMLDivElement>(null);

  // 一時停止状態を判定（statusプロップから）
  const isPaused = status === 'paused';

  // プログレスバーの値を計算（useMemoでメモ化、progressPercentage も同時に計算）
  const { progressValue, progressPercentage } = useMemo(() => {
    const value = Math.min(progress.progress, 100);
    return {
      progressValue: value,
      progressPercentage: Math.round(value),
    };
  }, [progress.progress]);

  // プログレスバーの幅を更新
  useEffect(() => {
    if (progressBarRef.current) {
      progressBarRef.current.style.setProperty('--progress', `${progressValue}%`);
    }
  }, [progressValue]);

  // サイズをフォーマット（useCallbackでメモ化）
  const formatSize = useCallback((bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }, []);

  // 速度をフォーマット（useCallbackでメモ化）
  const formatSpeed = useCallback((bytesPerSecond: number): string => {
    const mbps = bytesPerSecond / (1024 * 1024);
    if (mbps >= 1) {
      return `${mbps.toFixed(2)} MB/s`;
    }
    const kbps = bytesPerSecond / 1024;
    return `${kbps.toFixed(2)} KB/s`;
  }, []);

  // 残り時間をフォーマット（useCallbackでメモ化）
  const formatRemainingTime = useCallback((seconds: number): string => {
    if (seconds < 60) {
      const sec = Math.round(seconds);
      return t('modelDownloadProgress.time.seconds', { seconds: sec });
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return t('modelDownloadProgress.time.minutesSeconds', { minutes, seconds: secs });
  }, [t]);

  // フォーマット済みの値を計算（useMemoでメモ化）
  const formattedDownloaded = useMemo(() => formatSize(progress.downloaded), [formatSize, progress.downloaded]);
  const formattedTotal = useMemo(() => formatSize(progress.total), [formatSize, progress.total]);
  const formattedSpeed = useMemo(() => formatSpeed(progress.speed), [formatSpeed, progress.speed]);
  const formattedRemaining = useMemo(() => {
    return progress.remaining > 0 ? formatRemainingTime(progress.remaining) : t('modelDownloadProgress.calculating');
  }, [formatRemainingTime, progress.remaining, t]);

  // 一時停止/再開の切り替え
  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      onResume?.();
    } else {
      onPause?.();
    }
  }, [isPaused, onPause, onResume]);

  return (
    <div className="model-download-progress">
      <div className="download-progress-card">
        <div className="progress-header">
          <h3>{t('modelDownloadProgress.title')}</h3>
          <button 
            className="close-button" 
            onClick={onCancel}
            aria-label={t('modelDownloadProgress.actions.close')}
          >
            ✕
          </button>
        </div>

        <div className="progress-model-name">
          <strong>{modelName}</strong>
        </div>

        <div className="progress-bar-container">
          <div 
            ref={progressBarRef}
            className="progress-bar"
            role="progressbar"
            {...{
              'aria-valuenow': progressPercentage,
              'aria-valuemin': 0,
              'aria-valuemax': 100,
              'aria-label': t('modelDownloadProgress.aria.progress', { percentage: progressPercentage })
            }}
          >
          </div>
          <span className="progress-percentage" aria-hidden="true">
            {progressPercentage}%
          </span>
        </div>

        <div className="progress-details">
          <div className="detail-row">
            <span className="detail-label">{t('modelDownloadProgress.downloaded')}</span>
            <span className="detail-value">
              {formattedDownloaded} / {formattedTotal}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('modelDownloadProgress.speed')}</span>
            <span className="detail-value">
              {formattedSpeed}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('modelDownloadProgress.remaining')}</span>
            <span className="detail-value">
              {formattedRemaining}
            </span>
          </div>
        </div>

        {status !== 'downloading' && (
          <div className="progress-status">
            {status === 'verifying' && (
              <span className="status-badge verifying" role="status" aria-live="polite">
                {t('modelDownloadProgress.status.verifying')}
              </span>
            )}
            {status === 'complete' && (
              <span className="status-badge complete" role="status" aria-live="polite">
                {t('modelDownloadProgress.status.complete')}
              </span>
            )}
            {status === 'error' && (
              <span className="status-badge error" role="alert" aria-live="assertive">
                {t('modelDownloadProgress.status.error')}
              </span>
            )}
            {status === 'paused' && (
              <span className="status-badge paused" role="status" aria-live="polite">
                {t('modelDownloadProgress.status.paused')}
              </span>
            )}
          </div>
        )}

        <div className="progress-actions">
          {(status === 'downloading' || status === 'paused') && (
            <button
              className="action-button pause-resume"
              onClick={handlePauseResume}
              aria-label={isPaused ? t('modelDownloadProgress.aria.resume') : t('modelDownloadProgress.aria.pause')}
            >
              {isPaused ? t('modelDownloadProgress.actions.resume') : t('modelDownloadProgress.actions.pause')}
            </button>
          )}
          <button
            className="action-button cancel"
            onClick={onCancel}
            disabled={status === 'complete'}
            aria-label={status === 'complete' ? t('modelDownloadProgress.aria.close') : t('modelDownloadProgress.aria.cancel')}
          >
            {status === 'complete' ? t('modelDownloadProgress.actions.close') : t('modelDownloadProgress.actions.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
