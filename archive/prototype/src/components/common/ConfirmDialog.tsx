// ConfirmDialog - 確認ダイアログコンポーネント

import React, { useCallback, useEffect, useRef } from 'react';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleDialogDismiss = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      onCancel();
    }
  }, [onClose, onCancel]);

  // アクセシビリティ: ダイアログが開いたときにフォーカスを管理
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;

      setTimeout(() => {
        if (confirmButtonRef.current) {
          confirmButtonRef.current.focus();
        } else if (dialogRef.current) {
          const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusableElements.length > 0) {
            focusableElements[0].focus();
          }
        }
      }, 0);
    } else {
      // ダイアログが閉じたときにフォーカスを元の要素に戻す
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
    }
  }, [isOpen]);

  // アクセシビリティ: Tabキーでフォーカスをダイアログ内に閉じ込める（フォーカストラップ）
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleDialogDismiss();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = dialogRef.current!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tabで最初の要素から前へ移動しようとしたら、最後の要素に移動
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tabで最後の要素から次へ移動しようとしたら、最初の要素に移動
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
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
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDialogDismiss();
        }
      }}
    >
      <div
        ref={dialogRef}
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
            ref={confirmButtonRef}
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
