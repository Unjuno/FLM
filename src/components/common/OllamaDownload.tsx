// Ollamaダウンロード進捗表示UIコンポーネント

import React, { useRef, useEffect } from 'react';
import { useOllamaDownload } from '../../hooks/useOllama';
import './OllamaDownload.css';

/**
 * ダウンロード進捗情報のフォーマット用ユーティリティ
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatTime(remainingBytes: number, speedBytesPerSec: number): string {
  if (speedBytesPerSec === 0 || speedBytesPerSec < 0.1) return '計算中...';
  const seconds = Math.ceil(remainingBytes / speedBytesPerSec);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}分`;
  }
  return `${minutes}分${remainingSeconds}秒`;
}

/**
 * Ollamaダウンロード進捗表示コンポーネント
 */
interface OllamaDownloadProps {
  platform?: 'windows' | 'macos' | 'linux';
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export const OllamaDownload: React.FC<OllamaDownloadProps> = ({
  platform,
  onComplete,
  onError,
}) => {
  const { downloadStatus, progress, error, download, reset } = useOllamaDownload();

  React.useEffect(() => {
    if (downloadStatus === 'completed' && onComplete) {
      onComplete();
    }
    if (downloadStatus === 'error' && error && onError) {
      onError(error);
    }
  }, [downloadStatus, error, onComplete, onError]);

  const handleDownload = () => {
    download(platform);
  };

  const handleRetry = () => {
    reset();
    download(platform);
  };

  if (downloadStatus === 'idle') {
    return (
      <div className="ollama-download">
        <div className="download-prompt">
          <h3>Ollamaをダウンロード</h3>
          <p>Ollamaが見つかりませんでした。ダウンロードしてインストールしますか？</p>
          <button className="download-button" onClick={handleDownload}>
            ダウンロード開始
          </button>
        </div>
      </div>
    );
  }

  if (downloadStatus === 'downloading' && progress) {
    const remainingBytes = progress.total_bytes - progress.downloaded_bytes;
    const remainingTime = formatTime(remainingBytes, progress.speed_bytes_per_sec);
    const currentStatus = progress.status || 'downloading';
    const statusMessage = progress.message || 
      (currentStatus === 'extracting' ? 'ファイルを解凍しています...' : 'ダウンロード中...');
    
    const progressContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (progressContainerRef.current) {
        progressContainerRef.current.style.setProperty('--progress', String(Math.min(progress.progress, 100)));
      }
    }, [progress.progress]);

    return (
      <div className="ollama-download">
        <div className="download-progress-container">
          <h3>{statusMessage}</h3>
          
          {/* プログレスバー */}
          <div 
            ref={progressContainerRef}
            className="progress-bar-container"
          >
            <div className="progress-bar"></div>
          </div>

          {/* パーセンテージ表示 */}
          <div className="progress-percentage">
            {progress.progress.toFixed(1)}%
          </div>

          {/* 詳細情報 */}
          <div className="progress-details">
            <div className="progress-item">
              <span className="progress-label">ダウンロード済み:</span>
              <span className="progress-value">
                {formatBytes(progress.downloaded_bytes)} / {formatBytes(progress.total_bytes)}
              </span>
            </div>
            {currentStatus === 'downloading' && (
              <>
                <div className="progress-item">
                  <span className="progress-label">速度:</span>
                  <span className="progress-value">{formatSpeed(progress.speed_bytes_per_sec)}</span>
                </div>
                <div className="progress-item">
                  <span className="progress-label">残り時間:</span>
                  <span className="progress-value">{remainingTime}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (downloadStatus === 'completed') {
    return (
      <div className="ollama-download">
        <div className="download-success">
          <span className="success-icon">✅</span>
          <h3>ダウンロード完了</h3>
          <p>Ollamaのダウンロードが完了しました。</p>
        </div>
      </div>
    );
  }

  if (downloadStatus === 'error') {
    return (
      <div className="ollama-download">
        <div className="download-error">
          <span className="error-icon">❌</span>
          <h3>ダウンロードエラー</h3>
          <p className="error-message">{error || 'ダウンロードに失敗しました'}</p>
          <button className="retry-button" onClick={handleRetry}>
            再試行
          </button>
        </div>
      </div>
    );
  }

  return null;
};

