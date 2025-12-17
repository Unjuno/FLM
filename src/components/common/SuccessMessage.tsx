// Success Message Component

import React, { useEffect } from 'react';
import './SuccessMessage.css';

interface SuccessMessageProps {
  message: string;
  onDismiss?: () => void;
  autoDismiss?: number; // milliseconds
}

/**
 * Success message component
 * why: 頻繁に再レンダリングされる可能性があるため、React.memoで最適化
 * alt: 通常の関数コンポーネント（不要な再レンダリングが発生する可能性）
 * evidence: パフォーマンスベストプラクティス
 */
export const SuccessMessage: React.FC<SuccessMessageProps> = React.memo(
  ({ message, onDismiss, autoDismiss = 3000 }) => {
    useEffect(() => {
      if (autoDismiss > 0 && onDismiss) {
        const timer = setTimeout(() => {
          onDismiss();
        }, autoDismiss);
        return () => clearTimeout(timer);
      }
    }, [autoDismiss, onDismiss]);

    return (
      <div className="success-message">
        <div className="success-message-header">
          <strong>成功:</strong>
          {onDismiss && (
            <button
              className="success-dismiss-button"
              onClick={onDismiss}
              aria-label="成功メッセージを閉じる"
            >
              ×
            </button>
          )}
        </div>
        <div className="success-message-content">{message}</div>
      </div>
    );
  }
);

SuccessMessage.displayName = 'SuccessMessage';
