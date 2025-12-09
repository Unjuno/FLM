// Notification System Component
// Provides toast notifications for alerts and system messages

import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import './NotificationSystem.css';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  message: string;
  severity: NotificationSeverity;
  timestamp: number;
  duration?: number; // Auto-dismiss duration in ms (0 = no auto-dismiss)
}

interface NotificationSystemProps {
  maxNotifications?: number;
  defaultDuration?: number;
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  maxNotifications = 5,
  defaultDuration = 5000,
}) => {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp'>) => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newNotification: Notification = {
        ...notification,
        id,
        timestamp: Date.now(),
        duration: notification.duration ?? defaultDuration,
      };

      setNotifications((prev) => {
        const updated = [newNotification, ...prev];
        return updated.slice(0, maxNotifications);
      });

      // Auto-dismiss if duration is set
      if (newNotification.duration && newNotification.duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, newNotification.duration);
      }
    },
    [defaultDuration, maxNotifications, removeNotification]
  );

  // Expose addNotification via window for global access
  useEffect(() => {
    (window as unknown as { flmNotifications?: { add: typeof addNotification } }).flmNotifications = {
      add: addNotification,
    };

    return () => {
      delete (window as unknown as { flmNotifications?: unknown }).flmNotifications;
    };
  }, [addNotification]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-system" role="region" aria-label="Notifications">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.severity}`}
          role="alert"
          aria-live={notification.severity === 'error' ? 'assertive' : 'polite'}
        >
          <div className="notification-content">
            <span className="notification-message">{notification.message}</span>
            <button
              className="notification-dismiss"
              onClick={() => removeNotification(notification.id)}
              aria-label={t('common.dismiss') || 'Dismiss'}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// Hook for adding notifications
export const useNotifications = () => {
  const addNotification = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp'>) => {
      const system = (window as unknown as { flmNotifications?: { add: typeof addNotification } })
        .flmNotifications;
      if (system) {
        system.add(notification);
      } else {
        // NotificationSystem not mounted - this is expected during initialization
        // Using logger would cause circular dependency, so we skip logging here
      }
    },
    []
  );

  return { addNotification };
};

