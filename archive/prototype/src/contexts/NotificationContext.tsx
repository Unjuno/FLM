// NotificationContext - 通知コンテキスト

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { NOTIFICATION } from '../constants/config';
import type {
  NotificationItem,
  NotificationType,
  NotificationAction,
} from '../components/common/Notification';
import { Notification as NotificationComponent } from '../components/common/Notification';

/**
 * 通知コンテキストの値
 */
interface NotificationContextValue {
  /** 通知を追加する */
  showNotification: (
    type: NotificationType,
    title: string,
    message?: string,
    duration?: number,
    action?: NotificationAction
  ) => void;
  /** 成功通知を表示 */
  showSuccess: (
    title: string,
    message?: string,
    duration?: number,
    action?: NotificationAction
  ) => void;
  /** エラー通知を表示 */
  showError: (
    title: string,
    message?: string,
    duration?: number,
    action?: NotificationAction
  ) => void;
  /** 警告通知を表示 */
  showWarning: (
    title: string,
    message?: string,
    duration?: number,
    action?: NotificationAction
  ) => void;
  /** 情報通知を表示 */
  showInfo: (
    title: string,
    message?: string,
    duration?: number,
    action?: NotificationAction
  ) => void;
  /** 通知を削除する */
  removeNotification: (id: string) => void;
  /** 全ての通知を削除する */
  clearAll: () => void;
}

/**
 * 通知コンテキスト
 */
const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

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
  maxNotifications = NOTIFICATION.MAX_NOTIFICATIONS,
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
      duration?: number,
      action?: NotificationAction
    ) => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newNotification: NotificationItem = {
        id,
        type,
        title,
        message,
        duration:
          duration !== undefined ? duration : NOTIFICATION.DEFAULT_DURATION,
        timestamp: Date.now(),
        action,
      };

      setNotifications(prev => {
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
    (
      title: string,
      message?: string,
      duration?: number,
      action?: NotificationAction
    ) => {
      showNotification('success', title, message, duration, action);
    },
    [showNotification]
  );

  /**
   * エラー通知を表示
   */
  const showError = useCallback(
    (
      title: string,
      message?: string,
      duration?: number,
      action?: NotificationAction
    ) => {
      // エラーは長めに表示
      showNotification(
        'error',
        title,
        message,
        duration !== undefined ? duration : NOTIFICATION.ERROR_DURATION,
        action
      );
    },
    [showNotification]
  );

  /**
   * 警告通知を表示
   */
  const showWarning = useCallback(
    (
      title: string,
      message?: string,
      duration?: number,
      action?: NotificationAction
    ) => {
      showNotification('warning', title, message, duration, action);
    },
    [showNotification]
  );

  /**
   * 情報通知を表示
   */
  const showInfo = useCallback(
    (
      title: string,
      message?: string,
      duration?: number,
      action?: NotificationAction
    ) => {
      showNotification('info', title, message, duration, action);
    },
    [showNotification]
  );

  /**
   * 通知を削除する
   */
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  /**
   * 全ての通知を削除する
   */
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // コンテキスト値をメモ化（不要な再レンダリングを防止）
  const value: NotificationContextValue = useMemo(
    () => ({
      showNotification,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      removeNotification,
      clearAll,
    }),
    [
      showNotification,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      removeNotification,
      clearAll,
    ]
  );

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
      {notifications.map(notification => (
        <NotificationItemComponent
          key={notification.id}
          notification={notification}
          onClose={onRemove}
        />
      ))}
    </div>
  );
};

interface NotificationItemProps {
  notification: NotificationItem;
  onClose: (id: string) => void;
}

const NotificationItemComponent: React.FC<NotificationItemProps> = ({
  notification,
  onClose,
}) => {
  return (
    <NotificationComponent notification={notification} onClose={onClose} />
  );
};

/**
 * 通知コンテキストを使用するフック
 */
export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
};
