// Error Message Component

import React from 'react';
import './ErrorMessage.css';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
  details?: string;
}

/**
 * Error message component
 * why: 頻繁に再レンダリングされる可能性があるため、React.memoで最適化
 * alt: 通常の関数コンポーネント（不要な再レンダリングが発生する可能性）
 * evidence: パフォーマンスベストプラクティス
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = React.memo(
  ({ message, onDismiss, details }) => {
    return (
      <div className="error-message">
        <div className="error-message-header">
          <strong>エラー:</strong>
          {onDismiss && (
            <button
              className="error-dismiss-button"
              onClick={onDismiss}
              aria-label="エラーメッセージを閉じる"
            >
              ×
            </button>
          )}
        </div>
        <div className="error-message-content">{message}</div>
        {details && (
          <details className="error-details">
            <summary>詳細情報</summary>
            <pre className="error-details-content">{details}</pre>
          </details>
        )}
      </div>
    );
  }
);

ErrorMessage.displayName = 'ErrorMessage';
