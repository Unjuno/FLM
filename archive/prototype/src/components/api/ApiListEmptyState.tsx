// ApiListEmptyState - APIが存在しない場合の表示コンポーネント

import React from 'react';
import { useI18n } from '../../contexts/I18nContext';

interface ApiListEmptyStateProps {
  onCreate: () => void;
}

/**
 * APIが存在しない場合に表示する空状態コンポーネント
 */
export const ApiListEmptyState: React.FC<ApiListEmptyStateProps> = ({ onCreate }) => {
  const { t } = useI18n();

  return (
    <div className="empty-state">
      <div className="empty-icon"></div>
      <h2>{t('apiList.empty.title')}</h2>
      <p>{t('apiList.empty.message')}</p>
      <button className="create-button primary" onClick={onCreate}>
        {t('apiList.createApi')}
      </button>
    </div>
  );
};


