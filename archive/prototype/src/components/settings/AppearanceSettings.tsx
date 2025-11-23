/**
 * 外観設定セクション
 */

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import type { AppSettings } from '../../types/settings';

/**
 * 外観設定のプロパティ
 */
interface AppearanceSettingsProps {
  settings: AppSettings;
  onThemeChange: (theme: 'light' | 'dark' | 'auto') => Promise<void>;
  onToggleTheme: () => void;
}

/**
 * 外観設定セクション
 */
export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
  settings,
  onThemeChange,
  onToggleTheme,
}) => {
  const { theme, actualTheme } = useTheme();
  const { t } = useI18n();

  return (
    <section className="settings-section" aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" className="settings-section-title">
        {t('settings.appearance.title')}
      </h2>
      <div className="settings-group">
        <label htmlFor="theme">
          {t('settings.appearance.theme')}
          <span className="settings-hint">
            {t('settings.appearance.themeHint', {
              currentTheme:
                actualTheme === 'dark'
                  ? t('settings.appearance.themeDark')
                  : t('settings.appearance.themeLight'),
            })}
          </span>
        </label>
        <select
          id="theme"
          value={settings.theme || theme}
          onChange={e =>
            onThemeChange(e.target.value as 'light' | 'dark' | 'auto')
          }
          className="settings-select"
          aria-label={t('settings.appearance.theme')}
        >
          <option value="auto">{t('settings.appearance.themeAuto')}</option>
          <option value="light">{t('settings.appearance.themeLight')}</option>
          <option value="dark">{t('settings.appearance.themeDark')}</option>
        </select>
        <div className="settings-theme-preview">
          <button
            type="button"
            className="settings-theme-toggle"
            onClick={onToggleTheme}
            aria-label={t('settings.appearance.theme')}
            title={t('settings.appearance.theme')}
          >
            {t('settings.appearance.quickToggle')}
          </button>
        </div>
      </div>
    </section>
  );
};
