// useConfirmDialog - 確認ダイアログの状態管理用カスタムフック

import { useState, useEffect, useCallback } from 'react';

/**
 * 確認ダイアログの設定
 */
export interface ConfirmDialogConfig {
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * 確認ダイアログの状態管理用カスタムフック
 * 
 * @returns 確認ダイアログの状態と操作関数
 * 
 * @example
 * ```tsx
 * const { isOpen, message, openDialog, closeDialog, handleConfirm, handleCancel } = useConfirmDialog();
 * 
 * const handleDelete = () => {
 *   openDialog({
 *     message: '削除しますか？',
 *     onConfirm: async () => {
 *       await deleteItem();
 *       closeDialog();
 *     },
 *   });
 * };
 * ```
 */
export const useConfirmDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);
  const [onCancelCallback, setOnCancelCallback] = useState<(() => void) | null>(null);

  /**
   * 確認ダイアログを閉じる
   */
  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setMessage('');
    setOnConfirmCallback(null);
    setOnCancelCallback(null);
  }, []);

  // ESCキーでダイアログを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDialog();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeDialog]);

  /**
   * 確認ダイアログを開く
   */
  const openDialog = useCallback((config: ConfirmDialogConfig) => {
    setMessage(config.message);
    setOnConfirmCallback(() => config.onConfirm);
    setOnCancelCallback(() => config.onCancel || (() => {}));
    setIsOpen(true);
  }, []);

  /**
   * 確認ボタンがクリックされたときの処理
   */
  const handleConfirm = useCallback(() => {
    if (onConfirmCallback) {
      onConfirmCallback();
    }
    closeDialog();
  }, [onConfirmCallback, closeDialog]);

  /**
   * キャンセルボタンがクリックされたときの処理
   */
  const handleCancel = useCallback(() => {
    if (onCancelCallback) {
      onCancelCallback();
    }
    closeDialog();
  }, [onCancelCallback, closeDialog]);

  return {
    isOpen,
    message,
    openDialog,
    closeDialog,
    handleConfirm,
    handleCancel,
  };
};

