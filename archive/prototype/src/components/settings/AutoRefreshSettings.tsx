/**
 * 自動更新設定セクション
 */

import React from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { AUTO_REFRESH } from '../../constants/config';
import type { AppSettings } from '../../types/settings';

/**
 * 自動更新設定のプロパティ
 */
interface AutoRefreshSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * 自動更新設定セクション
 */
export const AutoRefreshSettings: React.FC<AutoRefreshSettingsProps> = ({
  settings,
  onSettingsChange,
}) => {
  const { t } = useI18n();

  return (
    <section
      className="settings-section"
      aria-labelledby="auto-refresh-heading"
    >
      <h2 id="auto-refresh-heading" className="settings-section-title">
        {t('settings.autoRefresh.title')}
      </h2>
      <div className="settings-group">
        <label htmlFor="auto-refresh-interval">
          {t('settings.autoRefresh.label')}
          <span className="settings-hint">
            {t('settings.autoRefresh.hint')}
          </span>
        </label>
        <input
          id="auto-refresh-interval"
          type="number"
          min={AUTO_REFRESH.MIN_INTERVAL}
          max={AUTO_REFRESH.MAX_INTERVAL}
          step="5"
          value={
            settings.auto_refresh_interval || AUTO_REFRESH.DEFAULT_INTERVAL
          }
          onChange={e => {
            const parsed = parseInt(e.target.value, 10);
            onSettingsChange({
              ...settings,
              auto_refresh_interval: isNaN(parsed)
                ? AUTO_REFRESH.DEFAULT_INTERVAL
                : parsed,
            });
          }}
          className="settings-input"
          aria-label={`自動更新間隔（秒）。最小${AUTO_REFRESH.MIN_INTERVAL}秒、最大${AUTO_REFRESH.MAX_INTERVAL}秒。`}
        />
      </div>
    </section>
  );
};
