// ApiListControls - API一覧のコントロールコンポーネント

import React from 'react';
import { useI18n } from '../../contexts/I18nContext';

/**
 * API一覧コントロールコンポーネントのプロパティ
 */
interface ApiListControlsProps {
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  onSelectAll: () => void;
}

/**
 * API一覧のコントロールコンポーネント
 * 全選択/全解除機能を提供します
 */
export const ApiListControls: React.FC<ApiListControlsProps> = ({
  selectedCount,
  totalCount,
  isAllSelected,
  onSelectAll,
}) => {
  const { t } = useI18n();
  const summaryLabel = `${selectedCount}/${totalCount}`;

  return (
    <div className="api-list-controls">
      <label className="select-all-checkbox">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={onSelectAll}
          aria-label={`${t('apiList.selectAllAria')} (${summaryLabel})`}
        />
        <span>{t('apiList.selectAll', { count: selectedCount })}</span>
        <span className="select-count" aria-hidden="true">{summaryLabel}</span>
      </label>
    </div>
  );
};

