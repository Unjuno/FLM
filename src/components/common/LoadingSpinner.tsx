// Loading Spinner Component

import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

/**
 * Loading spinner component
 * why: 頻繁に再レンダリングされる可能性があるため、React.memoで最適化
 * alt: 通常の関数コンポーネント（不要な再レンダリングが発生する可能性）
 * evidence: パフォーマンスベストプラクティス
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = React.memo(
  ({ size = 'medium', message }) => {
    return (
      <div
        className={`loading-spinner-container ${size}`}
        role="status"
        aria-live="polite"
        aria-label={message || '読み込み中'}
      >
        <div className="loading-spinner" aria-hidden="true"></div>
        {message && (
          <p className="loading-message" id="loading-message">
            {message}
          </p>
        )}
      </div>
    );
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';
