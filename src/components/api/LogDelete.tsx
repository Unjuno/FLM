// LogDelete - ログ削除コンポーネント

import React, { useState } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { Tooltip } from '../common/Tooltip';
import { logger } from '../../utils/logger';
import './LogDelete.css';

/**
 * ログ削除コンポーネントのプロパティ
 */
interface LogDeleteProps {
  apiId: string | null;
  onDeleteComplete?: (deletedCount: number) => void;
}

/**
 * ログ削除コンポーネント
 * 古いログを日付範囲指定で削除します
 */
export const LogDelete: React.FC<LogDeleteProps> = ({
  apiId,
  onDeleteComplete,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [beforeDate, setBeforeDate] = useState<string>('');
  const [confirmText, setConfirmText] = useState<string>('');

  /**
   * ログを削除します
   */
  const handleDelete = async () => {
    if (!apiId) {
      setError('APIが選択されていません');
      return;
    }

    if (!beforeDate) {
      setError('削除する日付を指定してください');
      return;
    }

    // 確認用テキスト（日付を表示）
    const confirmMessage = `指定した日付（${beforeDate}）より前のログをすべて削除しますか？\n\nこの操作は取り消せません。`;
    
    if (confirmText !== '削除') {
      setError('確認のため、「削除」と入力してください');
      return;
    }

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);
      setSuccessMessage(null);

      // delete_logs IPCコマンドを呼び出し
      const request = {
        api_id: apiId,
        before_date: beforeDate,
      };
      const response = await safeInvoke<{
        deleted_count: number;
      }>('delete_logs', { request });

      setSuccessMessage(`${response.deleted_count}件のログを削除しました`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // コールバックを呼び出し
      if (onDeleteComplete) {
        onDeleteComplete(response.deleted_count);
      }

      // フォームをリセット
      setBeforeDate('');
      setConfirmText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログの削除に失敗しました');
      logger.error('ログ削除エラー', err, 'LogDelete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="log-delete">
      <div className="log-delete-header">
        <h3>ログ削除</h3>
      </div>

      <div className="log-delete-content">
        <div className="delete-form">
          <div className="form-group">
            <Tooltip content="指定した日付より前のログをすべて削除します。例: 2024-01-01を指定すると、2024-01-01より前のすべてのログが削除されます。">
              <label htmlFor="before-date">
                削除する日付（この日付より前のログを削除）:
              </label>
            </Tooltip>
            <Tooltip content="指定した日付より前のログをすべて削除します。この操作は取り消せませんので、慎重に日付を選択してください。" position="bottom">
              <input
                id="before-date"
                type="date"
                value={beforeDate}
                onChange={(e) => setBeforeDate(e.target.value)}
                disabled={deleting || !apiId}
                className="date-input"
              />
            </Tooltip>
          </div>

          <div className="form-group">
            <Tooltip content="誤削除を防ぐため、「削除」と入力してください。この確認により、意図しない削除を防止します。">
              <label htmlFor="confirm-text">
                確認のため「削除」と入力してください:
              </label>
            </Tooltip>
            <Tooltip content="誤削除を防ぐため、「削除」と入力してください。" position="bottom">
              <input
                id="confirm-text"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={deleting || !apiId}
                placeholder="削除"
                className="confirm-input"
              />
            </Tooltip>
          </div>

          <Tooltip content="指定した日付より前のログを削除します。この操作は取り消せません。削除されたログは復元できませんので、十分に確認してください。" position="top">
            <button
              onClick={handleDelete}
              disabled={deleting || !apiId || !beforeDate || confirmText !== '削除'}
              className="delete-button"
            >
              {deleting ? '削除中...' : 'ログを削除'}
            </button>
          </Tooltip>
        </div>

        {error && (
          <div className="delete-error">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="delete-success">
            {successMessage}
          </div>
        )}
        {!apiId && (
          <div className="delete-warning">
            APIを選択してください
          </div>
        )}
      </div>
    </div>
  );
};
