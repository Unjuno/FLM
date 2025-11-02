// FLM - 通知コンテキスト
// フロントエンドエージェント (FE) 実装
// FE-012-01: 通知システム実装

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { NotificationItem, NotificationType } from '../components/common/Notification';

/**
 * 通知コンテキストの値
 */
interface NotificationContextValue {
  /** 通知を追加する */
  showNotification: (
    type: NotificationType,
    title: string,
    message?: string,
    duration?: number
  ) => void;
  /** 成功通知を表示 */
  showSuccess: (title: string, message?: string, duration?: number) => void;
  /** エラー通知を表示 */
  showError: (title: string, message?: string, duration?: number) => void;
  /** 警告通知を表示 */
  showWarning: (title: string, message?: string, duration?: number) => void;
  /** 情報通知を表示 */
  showInfo: (title: string, message?: string, duration?: number) => void;
  /** 通知を削除する */
  removeNotification: (id: string) => void;
  /** 全ての通知を削除する */
  clearAll: () => void;
}

/**
 * 通知コンテキスト
 */
const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

/**
 * 通知プロバイダーのプロパティ
 */
interface NotificationProviderProps {
  children: React.ReactNode;
  maxNotifications?: number; // 最大表示数
}

/**
 * 通知プロバイダー
 * アプリケーション全体で通知を管理します
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  maxNotifications = 5,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  /**
   * 通知を追加する
   */
  const showNotification = useCallback(
    (
      type: NotificationType,
      title: string,
      message?: string,
      duration?: number
    ) => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newNotification: NotificationItem = {
        id,
        type,
        title,
        message,
        duration: duration !== undefined ? duration : 5000, // デフォルト5秒
        timestamp: Date.now(),
      };

      setNotifications((prev) => {
        const updated = [newNotification, ...prev];
        // 最大表示数を超える場合は古いものを削除
        return updated.slice(0, maxNotifications);
      });
    },
    [maxNotifications]
  );

  /**
   * 成功通知を表示
   */
  const showSuccess = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification('success', title, message, duration);
    },
    [showNotification]
  );

  /**
   * エラー通知を表示
   */
  const showError = useCallback(
    (title: string, message?: string, duration?: number) => {
      // エラーは長めに表示（デフォルト8秒）
      showNotification('error', title, message, duration !== undefined ? duration : 8000);
    },
    [showNotification]
  );

  /**
   * 警告通知を表示
   */
  const showWarning = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification('warning', title, message, duration);
    },
    [showNotification]
  );

  /**
   * 情報通知を表示
   */
  const showInfo = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification('info', title, message, duration);
    },
    [showNotification]
  );

  /**
   * 通知を削除する
   */
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  /**
   * 全ての通知を削除する
   */
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const value: NotificationContextValue = {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onRemove={removeNotification}
      />
    </NotificationContext.Provider>
  );
};

/**
 * 通知コンテナコンポーネント
 */
interface NotificationContainerProps {
  notifications: NotificationItem[];
  onRemove: (id: string) => void;
}

/**
 * 通知コンテナ
 * 通知を表示するコンテナです
 */
const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onRemove,
}) => {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-container" role="region" aria-label="通知">
      {notifications.map((notification) => (
        <NotificationItemComponent
          key={notification.id}
          notification={notification}
          onClose={onRemove}
        />
      ))}
    </div>
  );
};

/**
 * 通知アイテムコンポーネント（Notificationをインポート）
 */
import { Notification as NotificationComponent } from '../components/common/Notification';

interface NotificationItemProps {
  notification: NotificationItem;
  onClose: (id: string) => void;
}

const NotificationItemComponent: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  return <NotificationComponent notification={notification} onClose={onClose} />;
};

/**
 * 通知コンテキストを使用するフック
 */
export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

