// Ollama検出中のローディング画面コンポーネント

import React, { memo } from 'react';
import type { OllamaStatus } from '../../types/ollama';
import type { AutoSetupStepState } from '../../services/ollamaAutoSetup';
import './OllamaDetection.css';

interface OllamaDetectionProps {
  status: OllamaStatus | null;
  isDetecting: boolean;
  error: string | null;
  autoSteps: AutoSetupStepState[];
  autoStatus: 'idle' | 'running' | 'completed' | 'error';
  autoError: string | null;
  onRetryAuto?: () => void;
}

const statusToClass = (status: string) => {
  switch (status) {
    case 'success':
      return 'status success';
    case 'warning':
      return 'status warning';
    case 'error':
      return 'status error';
    default:
      return 'status info';
  }
};

const OllamaDetectionComponent: React.FC<OllamaDetectionProps> = ({
  status,
  isDetecting,
  error,
  autoSteps,
  autoStatus,
  autoError,
  onRetryAuto,
}) => {
  const hasAutoSteps = autoSteps.length > 0;

  if (isDetecting) {
    return (
      <div className="ollama-detection">
        <div className="detection-spinner">
          <div className="spinner"></div>
        </div>
        <p className="detection-message">Ollamaを検出しています...</p>
        <p className="detection-submessage">
          システムをスキャン中です。しばらくお待ちください。
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ollama-detection">
        <div className="detection-error">
          <span className="error-icon">!</span>
          <p className="error-message">{error}</p>
          {onRetryAuto && (
            <button className="retry-button" onClick={onRetryAuto}>
              自動セットアップを再実行
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ollama-detection">
      <div className="detection-status-card">
        <div className="status-header">
          <span className="status-icon">{status?.running ? '✅' : '🔍'}</span>
          <div>
            <p className="status-title">
              {status?.running
                ? 'Ollamaは稼働中です'
                : status?.installed || status?.portable
                  ? 'Ollamaを起動しています'
                  : 'Ollamaを自動セットアップ中です'}
            </p>
            {status?.version && (
              <p className="status-detail">バージョン: {status.version}</p>
            )}
          </div>
        </div>
        {autoStatus === 'running' && (
          <p className="auto-status-message">
            自動セットアップを実行しています...
          </p>
        )}
        {autoStatus === 'completed' && !status?.running && (
          <p className="auto-status-message muted">
            セットアップ完了を確認しています...
          </p>
        )}
        {autoStatus === 'error' && !autoError && (
          <p className="auto-status-message error">
            自動セットアップに失敗しました。手動手順を試してください。
          </p>
        )}
        {hasAutoSteps && (
          <div className="auto-steps">
            {autoSteps.map(step => (
              <div className="auto-step" key={step.id}>
                <div className={statusToClass(step.status)}>
                  <span className="step-label">{step.label}</span>
                  {step.progress !== undefined && (
                    <span className="step-progress">
                      {Math.round(step.progress)}%
                    </span>
                  )}
                </div>
                {step.message && <p className="step-message">{step.message}</p>}
              </div>
            ))}
          </div>
        )}

        {autoError && (
          <div className="auto-error">
            <p className="error-text">{autoError}</p>
            {onRetryAuto && (
              <button className="retry-button" onClick={onRetryAuto}>
                自動セットアップを再実行
              </button>
            )}
          </div>
        )}

        {!hasAutoSteps && !autoError && (
          <p className="waiting-message">準備状態を確認しています...</p>
        )}
      </div>
    </div>
  );
};

// React.memoでメモ化して不要な再レンダリングを防止
export const OllamaDetection = memo(OllamaDetectionComponent);
