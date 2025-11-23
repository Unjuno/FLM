// ApiList - API一覧ページ

import React from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { Breadcrumb } from '../components/common/Breadcrumb';
import { ApiListHeader } from '../components/api/ApiListHeader';
import { ApiListLoading } from '../components/api/ApiListLoading';
import { ApiListContent } from '../components/api/ApiListContent';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useApiListData } from '../hooks/useApiListData';
import './ApiList.css';

/**
 * API一覧ページ
 * 作成済みのAPIを表示・管理します
 */
export const ApiList: React.FC = () => {
  useGlobalKeyboardShortcuts();

  const apiListData = useApiListData();
  const {
    apis,
    loading,
    combinedError,
    operatingApiIds,
    apiOperationProgress,
    selectedApiIds,
    selectedIds,
    isAllSelected,
    breadcrumbItems,
    refreshApis,
    toggleApiStatus,
    toggleSelection,
    handleSelectAll,
    handleImportComplete,
    handleCreate,
    handleDelete,
    clearErrors,
    getStatusText,
    confirmDialog,
  } = apiListData;

  // ローディング状態
  if (loading) {
    return (
      <ApiListLoading
        breadcrumbItems={breadcrumbItems}
        onRefresh={refreshApis}
      />
    );
  }

  return (
    <AppLayout>
      <div className="api-list-page">
        <div className="page-container api-list-container">
          <Breadcrumb items={breadcrumbItems} />
          <ApiListHeader onRefresh={refreshApis} />
          <ApiListContent
            apis={apis}
            combinedError={combinedError}
            selectedIds={selectedIds}
            selectedApiIds={selectedApiIds}
            operatingApiIds={operatingApiIds}
            apiOperationProgress={apiOperationProgress}
            isAllSelected={isAllSelected}
            onClearErrors={clearErrors}
            onImportComplete={handleImportComplete}
            onCreate={handleCreate}
            onSelectAll={handleSelectAll}
            onToggleSelection={toggleSelection}
            onToggleStatus={toggleApiStatus}
            onDelete={handleDelete}
            getStatusText={getStatusText}
          />
        </div>

        {/* 確認ダイアログ */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          message={confirmDialog.message}
          onConfirm={confirmDialog.handleConfirm}
          onCancel={confirmDialog.handleCancel}
        />
      </div>
    </AppLayout>
  );
};
