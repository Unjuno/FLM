// useModalFocusTrap - モーダルのフォーカストラップ機能を提供するカスタムフック

import { useEffect, useRef } from 'react';

/**
 * モーダルのフォーカストラップ機能を提供するカスタムフック
 *
 * @param isOpen モーダルが開いているかどうか
 * @param onClose モーダルを閉じる関数
 * @param modalRef モーダル要素のref
 */
export function useModalFocusTrap(
  isOpen: boolean,
  onClose: () => void,
  modalRef: React.RefObject<HTMLDivElement>
) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // モーダルが開いたときの処理
    previousActiveElement.current = document.activeElement as HTMLElement;

    // 最初のフォーカス可能な要素にフォーカスを移動
    const modal = modalRef.current;
    if (modal) {
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }

    // フォーカストラップのハンドラー
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modal) return;

      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: 逆方向
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: 順方向
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // ESCキーで閉じる
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscape);

    // クリーンアップ: モーダルが閉じたときに元の要素にフォーカスを戻す
    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscape);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose, modalRef]);
}

