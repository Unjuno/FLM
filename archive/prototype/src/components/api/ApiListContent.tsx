// ApiListContent - API一覧ページのメインコンテンツコンポーネント

import React from 'react';
import { ErrorMessage } from '../common/ErrorMessage';
import { SettingsExport } from './SettingsExport';
import { ApiListEmptyState } from './ApiListEmptyState';
import { ApiListItems } from './ApiListItems';
import type { ApiInfoExtended } from '../../hooks/useApiList';
import type { ApiOperationProgress } from '../../hooks/useApiOperations';

/**
 * API一覧コンテンツコンポーネントのプロパティ
 */
interface ApiListContentProps {
  apis: ApiInfoExtended[];
  combinedError: string | null;
  selectedIds: string[];
  selectedApiIds: Set<string>;
  operatingApiIds: Set<string>;
  apiOperationProgress: Map<string, ApiOperationProgress>;
  isAllSelected: boolean;
  onClearErrors: () => void;
  onImportComplete: (result: {
    imported: number;
    skipped: number;
    renamed: number;
    errors: string[];
  }) => void;
  onCreate: () => void;
  onSelectAll: () => void;
  onToggleSelection: (apiId: string) => void;
  onToggleStatus: (
    apiId: string,
    currentStatus: 'running' | 'preparing' | 'stopped' | 'error'
  ) => Promise<void>;
  onDelete: (apiId: string, apiName: string, modelName?: string) => void;
  getStatusText: (
    status: 'running' | 'preparing' | 'stopped' | 'error'
  ) => string;
}

/**
 * API一覧ページのメインコンテンツコンポーネント
 */
export const ApiListContent: React.FC<ApiListContentProps> = ({
  apis,
  combinedError,
  selectedIds,
  selectedApiIds,
  operatingApiIds,
  apiOperationProgress,
  isAllSelected,
  onClearErrors,
  onImportComplete,
  onCreate,
  onSelectAll,
  onToggleSelection,
  onToggleStatus,
  onDelete,
  getStatusText,
}) => {
  return (
    <div className="api-list-content">
      {combinedError && (
        <ErrorMessage
          message={combinedError}
          type="api"
          onClose={onClearErrors}
        />
      )}

      {/* 設定エクスポート・インポート */}
      {apis.length > 0 && (
        <div className="settings-export-section">
          <SettingsExport
            selectedApiIds={selectedIds.length > 0 ? selectedIds : undefined}
            onImportComplete={onImportComplete}
          />
        </div>
      )}

      {apis.length === 0 ? (
        <ApiListEmptyState onCreate={onCreate} />
      ) : (
        <ApiListItems
          apis={apis}
          selectedApiIds={selectedApiIds}
          operatingApiIds={operatingApiIds}
          apiOperationProgress={apiOperationProgress}
          isAllSelected={isAllSelected}
          onSelectAll={onSelectAll}
          onToggleSelection={onToggleSelection}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
          getStatusText={getStatusText}
        />
      )}
    </div>
  );
};
