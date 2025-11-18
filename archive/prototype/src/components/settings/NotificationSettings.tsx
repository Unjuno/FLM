/**
 * 通知設定セクション
 */

import React from 'react';
import { useI18n } from '../../contexts/I18nContext';
import type { AppSettings } from '../../types/settings';

/**
 * 通知設定のプロパティ
 */
interface NotificationSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * 通知設定セクション
 */
export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  settings,
  onSettingsChange,
}) => {
  const { t } = useI18n();

  return (
    <section
      className="settings-section"
      aria-labelledby="notifications-heading"
    >
      <h2 id="notifications-heading" className="settings-section-title">
        {t('settings.notifications.title')}
      </h2>
      <div className="settings-group">
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={settings.notifications_enabled ?? true}
            onChange={e =>
              onSettingsChange({
                ...settings,
                notifications_enabled: e.target.checked,
              })
            }
            aria-label={t('settings.notifications.label')}
          />
          <span>{t('settings.notifications.label')}</span>
        </label>
        <span className="settings-hint">
          {t('settings.notifications.hint')}
        </span>
      </div>
    </section>
  );
};

