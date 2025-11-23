// useApiDeletion - API削除時の確認ダイアログ制御を担当するカスタムフック

import { useCallback } from 'react';
import { useI18n } from '../contexts/I18nContext';
import type { ConfirmDialogConfig } from './useConfirmDialog';

interface UseApiDeletionOptions {
  deleteApi: (apiId: string) => Promise<void>;
  openDialog: (config: ConfirmDialogConfig) => void;
}

/**
 * API削除時の確認ダイアログ表示と削除実行を統一的に扱うカスタムフック
 */
export const useApiDeletion = ({
  deleteApi,
  openDialog,
}: UseApiDeletionOptions) => {
  const { t } = useI18n();

  const confirmDelete = useCallback(
    (apiId: string, apiName: string, modelName?: string) => {
      let baseMessage = t('apiList.messages.deleteConfirm', { name: apiName });

      if (modelName) {
        baseMessage += t('apiList.messages.deleteModelConfirm', { modelName });
      }

      const executeDelete = () => {
        void deleteApi(apiId);
      };

      const maybeAskModelDeletion = () => {
        if (!modelName) {
          executeDelete();
          return;
        }

        // モデル名がある場合、二段階確認を行う
        // 注意: 実際にはモデルは削除されず、APIのみが削除されます
        const showModelDialog = () =>
          openDialog({
            message: t('apiList.messages.deleteModelQuestion', { modelName }),
            onConfirm: executeDelete,
            // キャンセル時は削除を中断（何もしない）
            onCancel: () => {
              // 削除をキャンセル - 何も実行しない
            },
          });

        if (typeof queueMicrotask === 'function') {
          queueMicrotask(showModelDialog);
        } else {
          setTimeout(showModelDialog, 0);
        }
      };

      openDialog({
        message: baseMessage,
        onConfirm: maybeAskModelDeletion,
      });
    },
    [deleteApi, openDialog, t]
  );

  return { confirmDelete };
};
