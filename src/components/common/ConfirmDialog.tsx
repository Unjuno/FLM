// Confirm Dialog Component

import React, { useEffect } from 'react';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/**
 * Confirm dialog component
 * why: 頻繁に再レンダリングされる可能性があるため、React.memoで最適化
 * alt: 通常の関数コンポーネント（不要な再レンダリングが発生する可能性）
 * evidence: パフォーマンスベストプラクティス
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = React.memo(({
  message,
  onConfirm,
  onCancel,
  confirmText = '確認',
  cancelText = 'キャンセル',
  danger = false,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && e.target === e.currentTarget) {
      onConfirm();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onCancel]);

  return (
    <div 
      className="confirm-dialog-overlay" 
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-message"
    >
      <div 
        className="confirm-dialog" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div className="confirm-dialog-content">
          <p id="confirm-dialog-message">{message}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button
            className={`button-secondary ${danger ? 'button-danger' : ''}`}
            onClick={onCancel}
            autoFocus
          >
            {cancelText}
          </button>
          <button
            className={`button-primary ${danger ? 'button-danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';

