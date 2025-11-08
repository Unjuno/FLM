// ConfirmDialog - 確認ダイアログコンポーネント
// 監査レポートの推奨事項に基づき、コードの重複を解消するための共通コンポーネント

import React, { useEffect } from 'react';
import './ConfirmDialog.css';

/**
 * 確認ダイアログのプロパティ
 */
export interface ConfirmDialogProps {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** ダイアログのタイトル（デフォルト: '確認'） */
  title?: string;
  /** ダイアログのメッセージ */
  message: string;
  /** 確認ボタンのラベル（デフォルト: '確認'） */
  confirmLabel?: string;
  /** キャンセルボタンのラベル（デフォルト: 'キャンセル'） */
  cancelLabel?: string;
  /** 確認ボタンの種類（デフォルト: 'primary'） */
  confirmVariant?: 'primary' | 'danger';
  /** 確認ボタンがクリックされたときのコールバック */
  onConfirm: () => void;
  /** キャンセルボタンがクリックされたときのコールバック */
  onCancel: () => void;
  /** ダイアログを閉じる（ESCキーやオーバーレイクリック時） */
  onClose?: () => void;
}

/**
 * 確認ダイアログコンポーネント
 * 削除や重要な操作の確認に使用します
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = '確認',
  message,
  confirmLabel = '確認',
  cancelLabel = 'キャンセル',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  onClose,
}) => {
  // ESCキーでダイアログを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onClose) {
          onClose();
        } else {
          onCancel();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel, onClose]);

  // オーバーレイクリックでダイアログを閉じる
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (onClose) {
        onClose();
      } else {
        onCancel();
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="confirm-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={handleOverlayClick}
    >
      <div className="confirm-dialog" role="document">
        <h3 id="confirm-dialog-title">{title}</h3>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button
            className="confirm-button cancel"
            onClick={onCancel}
            type="button"
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>
          <button
            className={`confirm-button confirm ${confirmVariant}`}
            onClick={onConfirm}
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

