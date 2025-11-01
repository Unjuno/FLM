// FLM - ログ削除コンポーネント
// フロントエンドエージェント (FE) 実装
// F008: データ管理・ユーティリティ機能 - ログ削除機能実装

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './LogDelete.css';

/**
 * ログ削除コンポーネントのプロパティ
 */
interface LogDeleteProps {
  apiId: string | null;
  onDeleteComplete?: (count: number) => void;
}

/**
 * ログ削除コンポーネント
 * 古いログを削除します
 */
export const LogDelete: React.FC<LogDeleteProps> = ({
  apiId,
  onDeleteComplete,
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteBeforeDate, setDeleteBeforeDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  /**
   * 削除ダイアログを開く
   */
  const handleOpenDeleteDialog = () => {
    if (!apiId) {
      setError('APIが選択されていません');
      return;
    }
    
    // デフォルトで30日前の日付を設定
    const date = new Date();
    date.setDate(date.getDate() - 30);
    setDeleteBeforeDate(date.toISOString().split('T')[0]);
    setShowDeleteDialog(true);
    setError(null);
  };

  /**
   * 削除ダイアログを閉じる
   */
  const handleCloseDeleteDialog = () => {
    setShowDeleteDialog(false);
    setDeleteBeforeDate('');
    setError(null);
  };

  /**
   * ログを削除する
   */
  const handleDelete = async () => {
    if (!apiId) {
      setError('APIが選択されていません');
      return;
    }

    if (!deleteBeforeDate) {
      setError('削除する日付を指定してください');
      return;
    }

    // 確認ダイアログ
    const confirmMessage = `指定した日付（${deleteBeforeDate}）より前のログを削除しますか？\nこの操作は取り消せません。`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      // delete_logs IPCコマンドを呼び出し
      const response = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: apiId,
          before_date: `${deleteBeforeDate}T00:00:00Z`, // ISO 8601形式に変換
        },
      });

      console.log(`${response.deleted_count}件のログを削除しました`);
      
      // コールバックを呼び出し
      if (onDeleteComplete) {
        onDeleteComplete(response.deleted_count);
      }

      // ダイアログを閉じる
      handleCloseDeleteDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログの削除に失敗しました');
      console.error('ログ削除エラー:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="log-delete">
      <button
        className="delete-button"
        onClick={handleOpenDeleteDialog}
        disabled={!apiId}
        title={!apiId ? 'APIを選択してください' : '古いログを削除'}
      >
        🗑️ ログを削除
      </button>

      {showDeleteDialog && (
        <div className="delete-dialog-overlay" onClick={handleCloseDeleteDialog}>
          <div className="delete-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="delete-dialog-header">
              <h2>ログ削除</h2>
              <button
                className="delete-dialog-close"
                onClick={handleCloseDeleteDialog}
                disabled={deleting}
              >
                ×
              </button>
            </div>
            
            <div className="delete-dialog-content">
              <p className="delete-dialog-description">
                指定した日付より前のログを削除します。
                この操作は取り消せませんので、注意してください。
              </p>
              
              <div className="delete-dialog-form">
                <label htmlFor="delete-before-date">
                  削除する日付（この日付より前のログを削除）:
                </label>
                <input
                  id="delete-before-date"
                  type="date"
                  value={deleteBeforeDate}
                  onChange={(e) => setDeleteBeforeDate(e.target.value)}
                  disabled={deleting}
                  className="delete-date-input"
                />
                <p className="delete-dialog-hint">
                  ※ デフォルトで30日前のログまで削除されます
                </p>
              </div>

              {error && (
                <div className="delete-error">
                  {error}
                </div>
              )}
            </div>

            <div className="delete-dialog-actions">
              <button
                className="delete-dialog-cancel"
                onClick={handleCloseDeleteDialog}
                disabled={deleting}
              >
                キャンセル
              </button>
              <button
                className="delete-dialog-confirm"
                onClick={handleDelete}
                disabled={deleting || !deleteBeforeDate}
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

