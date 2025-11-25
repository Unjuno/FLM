// ApiListHeader - API一覧ページのヘッダーコンポーネント

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '../common/Tooltip';
import { useI18n } from '../../contexts/I18nContext';

/**
 * API一覧ヘッダーコンポーネントのプロパティ
 */
interface ApiListHeaderProps {
  onRefresh: () => void;
}

/**
 * API一覧ページのヘッダーコンポーネント
 */
export const ApiListHeader: React.FC<ApiListHeaderProps> = ({ onRefresh }) => {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <header className="page-header api-list-header">
      <div className="header-top">
        <Tooltip content={t('apiList.backToHomeTooltip')}>
          <button className="back-button" onClick={() => navigate('/')}>
            {t('apiList.backToHome')}
          </button>
        </Tooltip>
        <h1>{t('apiList.title')}</h1>
      </div>
      <div className="header-actions">
        <Tooltip content="APIプロンプトテンプレートを管理">
          <button
            className="secondary"
            onClick={() => navigate('/api/prompts')}
          >
            APIプロンプト
          </button>
        </Tooltip>
        <Tooltip content={t('apiList.createApiTooltip')}>
          <button
            className="create-button"
            onClick={() => navigate('/api/create')}
          >
            {t('apiList.createApi')}
          </button>
        </Tooltip>
        <Tooltip content={t('apiList.refreshTooltip')}>
          <button className="refresh-button" onClick={onRefresh}>
            {t('apiList.refresh')}
          </button>
        </Tooltip>
      </div>
    </header>
  );
};
