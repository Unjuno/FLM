// useApiListData - ApiListページ用にデータと操作をまとめて提供するカスタムフック

import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiList } from './useApiList';
import { useApiOperations } from './useApiOperations';
import { useApiSelection } from './useApiSelection';
import { useConfirmDialog } from './useConfirmDialog';
import { useApiDeletion } from './useApiDeletion';
import { useI18n } from '../contexts/I18nContext';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import { getStatusText as getStatusTextUtil } from '../utils/apiStatus';
import type { ApiStatus } from '../utils/apiStatus';
import type { BreadcrumbItem } from '../components/common/Breadcrumb';

/**
 * ApiListページに必要なデータと操作を集約して返すカスタムフック。
 * ページ本体ではUIロジックに集中できるようになる。
 */
export const useApiListData = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  // データ取得と操作フック
  const {
    apis,
    loading,
    error: apiListError,
    refreshApis,
    setError: setApiListError,
  } = useApiList();
  const {
    operatingApiIds,
    apiOperationProgress,
    error: operationError,
    toggleApiStatus,
    deleteApi,
    setError: setOperationError,
  } = useApiOperations(refreshApis);
  const {
    selectedApiIds,
    selectedCount,
    toggleSelection,
    selectAll,
    clearSelection,
    getSelectedIds,
    isAllSelected: checkIsAllSelected,
  } = useApiSelection();
  const confirmDialog = useConfirmDialog();
  const { confirmDelete } = useApiDeletion({
    deleteApi,
    openDialog: confirmDialog.openDialog,
  });

  const autoStartRef = useRef<Set<string>>(new Set());

  // エラーを統合（メモ化）
  const combinedError = useMemo(
    () => apiListError || operationError,
    [apiListError, operationError]
  );

  const clearErrors = useCallback(() => {
    setApiListError(null);
    setOperationError(null);
  }, [setApiListError, setOperationError]);

  const handleSelectAll = useCallback(() => {
    selectAll(apis.map(api => api.id));
  }, [apis, selectAll]);

  const handleImportComplete = useCallback(
    (result: { imported: number; skipped: number; renamed: number; errors: string[] }) => {
      void refreshApis();
      clearSelection();
      logger.info(
        t('apiList.messages.importComplete', {
          imported: result.imported,
          skipped: result.skipped,
          renamed: result.renamed,
        }),
        'ApiList'
      );
    },
    [refreshApis, clearSelection, t]
  );

  const handleCreate = useCallback(() => {
    navigate('/api/create');
  }, [navigate]);

  // 起動準備中APIの自動再起動
  useEffect(() => {
    for (const api of apis) {
      // 準備中でない場合はスキップ
      if (api.status !== 'preparing') {
        autoStartRef.current.delete(api.id);
        continue;
      }

      // 既に操作中または自動起動中の場合はスキップ
      if (operatingApiIds.has(api.id) || autoStartRef.current.has(api.id)) {
        continue;
      }

      // 自動起動を開始
      autoStartRef.current.add(api.id);
      void toggleApiStatus(api.id, api.status)
        .catch(err => {
          logger.warn(
            '自動起動に失敗しました',
            extractErrorMessage(err),
            'useApiListData'
          );
        })
        .finally(() => {
          autoStartRef.current.delete(api.id);
        });
    }
  }, [apis, operatingApiIds, toggleApiStatus]);

  // ステータステキスト取得関数（メモ化）
  const getStatusText = useCallback(
    (status: ApiStatus) => getStatusTextUtil(status, t),
    [t]
  );

  // パンくずリストの項目（メモ化）
  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('apiList.title') || 'API一覧' },
    ],
    [t]
  );

  return {
    // データ
    apis,
    loading,
    combinedError,
    operatingApiIds,
    apiOperationProgress,
    selectedApiIds,
    selectedCount,
    selectedIds: getSelectedIds(),
    isAllSelected: checkIsAllSelected(apis.length),

    // 操作
    refreshApis,
    toggleApiStatus,
    toggleSelection,
    handleSelectAll,
    handleImportComplete,
    handleCreate,
    handleDelete: confirmDelete,
    clearSelection,
    clearErrors,

    // ダイアログ
    confirmDialog,

    // ユーティリティ
    getStatusText,
    breadcrumbItems,
  };
};


