// ConfirmDialog - 確認ダイアログコンポーネント

import React, { useCallback, useEffect } from 'react';

/**
 * 確認ダイアログコンポーネントのプロパティ
 */
interface ConfirmDialogProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose?: () => void;
  confirmVariant?: 'primary' | 'danger';
}

/**
 * 確認ダイアログコンポーネント
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  message,
  onConfirm,
  onCancel,
  onClose,
  title = '確認',
  confirmLabel = '確認',
  cancelLabel = 'キャンセル',
  confirmVariant = 'primary',
}) => {
  const handleDialogDismiss = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      onCancel();
    }
  }, [onClose, onCancel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        handleDialogDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleDialogDismiss, isOpen]);

  if (!isOpen) return null;

  const handleConfirmClick = () => {
    onConfirm();
    if (onClose) {
      onClose();
    }
  };

  const handleCancelClick = () => {
    onCancel();
    if (onClose) {
      onClose();
    }
  };

  const confirmButtonClassName = `confirm-button confirm ${confirmVariant}`;

  return (
    <div
      className="confirm-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="confirm-dialog"
        role="document"
      >
        <h3 id="confirm-dialog-title">{title}</h3>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button
            className="confirm-button cancel"
            onClick={handleCancelClick}
            type="button"
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>
          <button
            className={confirmButtonClassName}
            onClick={handleConfirmClick}
            type="button"
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
