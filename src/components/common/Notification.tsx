// Notification - 通知コンポーネント

import React, { useEffect, useState } from 'react';
import './Notification.css';

/**
 * 通知タイプ
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * 通知アイテム
 */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // 自動非表示までの時間（ミリ秒、0で自動非表示しない）
  timestamp: number;
}

/**
 * 通知コンポーネントのプロパティ
 */
interface NotificationProps {
  notification: NotificationItem;
  onClose: (id: string) => void;
}

/**
 * 個別の通知コンポーネント
 */
export const Notification: React.FC<NotificationProps> = ({
  notification,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // アニメーション用の表示制御
  useEffect(() => {
    // マウント時にアニメーション開始
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // 自動非表示
  useEffect(() => {
    if (notification.duration === 0) {
      return; // 自動非表示しない
    }

    const duration = notification.duration || 5000; // デフォルト5秒
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [notification.duration]);

  /**
   * 通知を閉じる
   */
  const handleClose = () => {
    setIsRemoving(true);
    // アニメーション完了後に削除
    setTimeout(() => {
      onClose(notification.id);
    }, 300); // CSSアニメーション時間に合わせる
  };

  // タイプに応じたアイコンを取得
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  };

  return (
    <div
      className={`notification notification-${notification.type} ${
        isVisible ? 'notification-visible' : ''
      } ${isRemoving ? 'notification-removing' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="notification-icon" aria-hidden="true">
        {getIcon()}
      </div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        {notification.message && (
          <div className="notification-message">{notification.message}</div>
        )}
      </div>
      <button
        className="notification-close"
        onClick={handleClose}
        aria-label="閉じる"
      >
        ✕
      </button>
    </div>
  );
};

