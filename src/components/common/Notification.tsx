// Notification - 通知コンポーネント

import React, { useEffect, useState, useCallback } from 'react';
import { NOTIFICATION, TIMEOUT } from '../../constants/config';
import './Notification.css';

/**
 * 通知タイプ
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * 通知アクション
 */
export interface NotificationAction {
  label: string;
  onClick: () => void;
}

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
  action?: NotificationAction; // アクションボタン（オプション）
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

  /**
   * 通知を閉じる
   */
  const handleClose = useCallback(() => {
    setIsRemoving(true);
    // アニメーション完了後に削除
    setTimeout(() => {
      onClose(notification.id);
    }, TIMEOUT.ANIMATION_DURATION);
  }, [notification.id, onClose]);

  // アニメーション用の表示制御
  useEffect(() => {
    // マウント時にアニメーション開始
    const timer = setTimeout(
      () => setIsVisible(true),
      TIMEOUT.VISIBILITY_DELAY
    );
    return () => clearTimeout(timer);
  }, []);

  // 自動非表示
  useEffect(() => {
    if (notification.duration === 0) {
      return; // 自動非表示しない
    }

    const duration = notification.duration || NOTIFICATION.DEFAULT_DURATION;
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [notification.duration, handleClose]);

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
        {notification.action && (
          <button
            className="notification-action"
            onClick={() => {
              notification.action?.onClick();
              handleClose();
            }}
            aria-label={notification.action.label}
          >
            {notification.action.label}
          </button>
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
