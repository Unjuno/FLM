// FLM - モデルダウンロード進捗コンポーネント
// フロントエンドエージェント (FE) 実装
// F004: モデル管理機能 - モデルダウンロード進捗表示

import React, { useState, useEffect, useRef } from 'react';
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
  const [isPaused, setIsPaused] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // プログレスバーの幅を更新
  useEffect(() => {
    if (progressBarRef.current) {
      progressBarRef.current.style.setProperty('--progress', `${Math.min(progress.progress, 100)}%`);
    }
  }, [progress.progress]);

  // サイズをフォーマット
  const formatSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // 速度をフォーマット
  const formatSpeed = (bytesPerSecond: number): string => {
    const mbps = bytesPerSecond / (1024 * 1024);
    if (mbps >= 1) {
      return `${mbps.toFixed(2)} MB/s`;
    }
    const kbps = bytesPerSecond / 1024;
    return `${kbps.toFixed(2)} KB/s`;
  };

  // 残り時間をフォーマット
  const formatRemainingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}分${secs}秒`;
  };

  // 一時停止/再開の切り替え
  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      onResume?.();
    } else {
      setIsPaused(true);
      onPause?.();
    }
  };

  return (
    <div className="model-download-progress">
      <div className="download-progress-card">
        <div className="progress-header">
          <h3>モデルをダウンロード中</h3>
          <button className="close-button" onClick={onCancel}>
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
            data-progress={Math.min(progress.progress, 100)}
          >
            <span className="progress-percentage">
              {Math.round(progress.progress)}%
            </span>
          </div>
        </div>

        <div className="progress-details">
          <div className="detail-row">
            <span className="detail-label">ダウンロード済み:</span>
            <span className="detail-value">
              {formatSize(progress.downloaded)} / {formatSize(progress.total)}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">速度:</span>
            <span className="detail-value">
              {formatSpeed(progress.speed)}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">残り時間:</span>
            <span className="detail-value">
              {progress.remaining > 0 ? formatRemainingTime(progress.remaining) : '計算中...'}
            </span>
          </div>
        </div>

        <div className="progress-status">
          {status === 'verifying' && (
            <span className="status-badge verifying">検証中...</span>
          )}
          {status === 'complete' && (
            <span className="status-badge complete">✓ ダウンロード完了</span>
          )}
          {status === 'error' && (
            <span className="status-badge error">⚠️ エラーが発生しました</span>
          )}
        </div>

        <div className="progress-actions">
          {status === 'downloading' && (
            <button
              className="action-button pause-resume"
              onClick={handlePauseResume}
            >
              {isPaused ? '▶️ 再開' : '⏸️ 一時停止'}
            </button>
          )}
          <button
            className="action-button cancel"
            onClick={onCancel}
            disabled={status === 'complete'}
          >
            {status === 'complete' ? '閉じる' : '❌ キャンセル'}
          </button>
        </div>
      </div>
    </div>
  );
};
