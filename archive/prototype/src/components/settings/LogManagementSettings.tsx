/**
 * ログ管理設定セクション
 */

import React from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { LOG_RETENTION } from '../../constants/config';
import type { AppSettings } from '../../types/settings';

/**
 * ログ管理設定のプロパティ
 */
interface LogManagementSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * ログ管理設定セクション
 */
export const LogManagementSettings: React.FC<LogManagementSettingsProps> = ({
  settings,
  onSettingsChange,
}) => {
  const { t } = useI18n();

  return (
    <section
      className="settings-section"
      aria-labelledby="log-management-heading"
    >
      <h2
        id="log-management-heading"
        className="settings-section-title"
      >
        {t('settings.logManagement.title')}
      </h2>
      <div className="settings-group">
        <label htmlFor="log-retention-days">
          {t('settings.logManagement.label')}
          <span className="settings-hint">
            {t('settings.logManagement.hint')}
          </span>
        </label>
        <input
          id="log-retention-days"
          type="number"
          min={LOG_RETENTION.MIN_DAYS}
          max={LOG_RETENTION.MAX_DAYS}
          value={
            settings.log_retention_days || LOG_RETENTION.DEFAULT_DAYS
          }
          onChange={e => {
            const parsed = parseInt(e.target.value, 10);
            onSettingsChange({
              ...settings,
              log_retention_days: isNaN(parsed)
                ? LOG_RETENTION.DEFAULT_DAYS
                : parsed,
            });
          }}
          className="settings-input"
          aria-label={`ログ保持期間（日数）。最小${LOG_RETENTION.MIN_DAYS}日、最大${LOG_RETENTION.MAX_DAYS}日。`}
        />
      </div>
      <div className="settings-group">
        <label htmlFor="audit-log-retention-days">
          監査ログ保持期間（日数）
          <span className="settings-hint">
            監査ログを保持する日数を設定します（最小1日、最大365日、デフォルト: 90日）
          </span>
        </label>
        <input
          id="audit-log-retention-days"
          type="number"
          min={LOG_RETENTION.MIN_DAYS}
          max={LOG_RETENTION.MAX_DAYS}
          value={
            settings.audit_log_retention_days ?? 90
          }
          onChange={e => {
            const parsed = parseInt(e.target.value, 10);
            onSettingsChange({
              ...settings,
              audit_log_retention_days: isNaN(parsed) ? 90 : parsed,
            });
          }}
          className="settings-input"
          aria-label={`監査ログ保持期間（日数）。最小${LOG_RETENTION.MIN_DAYS}日、最大${LOG_RETENTION.MAX_DAYS}日。`}
        />
      </div>
    </section>
  );
};

