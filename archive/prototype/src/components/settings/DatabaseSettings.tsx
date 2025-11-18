/**
 * データベース管理設定セクション
 */

import React from 'react';
import { useI18n } from '../../contexts/I18nContext';

/**
 * データベース管理設定セクション
 */
export const DatabaseSettings: React.FC = () => {
  const { t } = useI18n();

  return (
    <section
      className="settings-section"
      aria-labelledby="database-heading"
    >
      <h2 id="database-heading" className="settings-section-title">
        {t('settings.database.title')}
      </h2>
      <div className="settings-group">
        <p className="settings-info">{t('settings.database.info')}</p>
      </div>
    </section>
  );
};

