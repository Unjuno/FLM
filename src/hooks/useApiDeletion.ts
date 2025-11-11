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
export const useApiDeletion = ({ deleteApi, openDialog }: UseApiDeletionOptions) => {
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

        const showModelDialog = () =>
          openDialog({
            message: t('apiList.messages.deleteModelQuestion', { modelName }),
            onConfirm: executeDelete,
            onCancel: executeDelete,
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


