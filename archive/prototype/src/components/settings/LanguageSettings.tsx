/**
 * 言語設定セクション
 */

import React from 'react';
import { useI18n } from '../../contexts/I18nContext';
import type { AppSettings } from '../../types/settings';

/**
 * 言語設定のプロパティ
 */
interface LanguageSettingsProps {
  settings: AppSettings;
  onLanguageChange: (language: string) => Promise<void>;
}

/**
 * 言語設定セクション
 */
export const LanguageSettings: React.FC<LanguageSettingsProps> = ({
  settings,
  onLanguageChange,
}) => {
  const { locale, t } = useI18n();

  return (
    <section className="settings-section" aria-labelledby="language-heading">
      <h2 id="language-heading" className="settings-section-title">
        {t('settings.language.title')}
      </h2>
      <div className="settings-group">
        <label htmlFor="language">
          {t('settings.language.label')}
          <span className="settings-hint">{t('settings.language.hint')}</span>
        </label>
        <select
          id="language"
          value={settings.language || locale || 'ja'}
          onChange={async e => {
            await onLanguageChange(e.target.value);
          }}
          className="settings-select"
          aria-label={t('settings.language.label')}
        >
          <option value="ja">{t('settings.language.japanese')}</option>
          <option value="en">{t('settings.language.english')}</option>
          <option value="zh">{t('settings.language.chinese')}</option>
          <option value="ko">{t('settings.language.korean')}</option>
          <option value="es">{t('settings.language.spanish')}</option>
          <option value="fr">{t('settings.language.french')}</option>
          <option value="de">{t('settings.language.german')}</option>
        </select>
      </div>
    </section>
  );
};
