// AlertHistory - アラート履歴コンポーネント

import React, { useState, useEffect, useCallback } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { useNotifications } from '../../contexts/NotificationContext';
import { logger } from '../../utils/logger';
import { extractErrorMessage } from '../../utils/errorHandler';
import './AlertHistory.css';

/**
 * アラート履歴情報
 */
interface AlertHistoryInfo {
  id: string;
  api_id: string;
  alert_type: string;
  current_value: number;
  threshold: number;
  message: string;
  timestamp: string;
  resolved_at: string | null;
}

/**
 * アラート履歴セクションのプロパティ
 */
interface AlertHistorySectionProps {
  apiId: string | null;
  isGlobalSettings: boolean;
}

/**
 * アラート履歴セクションコンポーネント
 */
export const AlertHistorySection: React.FC<AlertHistorySectionProps> = ({
  apiId,
  isGlobalSettings,
}) => {
  const { showSuccess, showError } = useNotifications();
  const [history, setHistory] = useState<AlertHistoryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [apiNames, setApiNames] = useState<Map<string, string>>(new Map());
  // 確認ダイアログの状態
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // ESCキーで確認ダイアログを閉じる
  useEffect(() => {
    if (!confirmDialog.isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [confirmDialog.isOpen]);

  /**
   * アラート履歴を読み込む
   */
  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const result = await safeInvoke<AlertHistoryInfo[]>('get_alert_history', {
        request: {
          api_id: isGlobalSettings ? null : apiId,
          unresolved_only: !showResolved,
          limit: 50,
        },
      });
      setHistory(result);
    } catch (err) {
      logger.error('アラート履歴の読み込みに失敗しました', err, 'AlertHistory');
      const errorMessage = extractErrorMessage(err, 'アラート履歴の読み込みに失敗しました');
      showError('アラート履歴の読み込みエラー', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [apiId, isGlobalSettings, showResolved, showError]);

  /**
   * API一覧を読み込む
   */
  const loadApiList = useCallback(async () => {
    try {
      const apis = await safeInvoke<
        Array<{
          id: string;
          name: string;
        }>
      >('list_apis');
      const apiMap = new Map<string, string>();
      apis.forEach(api => apiMap.set(api.id, api.name));
      setApiNames(apiMap);
    } catch (err) {
      logger.error('API一覧の取得に失敗しました', err, 'AlertHistory');
      // API名の取得に失敗しても履歴表示は継続できるため、エラー通知は省略
    }
  }, []);

  useEffect(() => {
    loadApiList();
  }, [loadApiList]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /**
   * アラートを解決済みとしてマーク
   */
  const handleResolve = useCallback(
    async (alertId: string) => {
      try {
        await safeInvoke('resolve_alert', { alert_id: alertId });
        showSuccess('アラートを解決済みとしてマークしました');
        loadHistory(); // 履歴を再読み込み
      } catch (err) {
        logger.error('アラートの解決に失敗しました', err, 'AlertHistory');
        const errorMessage = extractErrorMessage(err, 'アラートの解決に失敗しました');
        showError('アラートの解決エラー', errorMessage);
      }
    },
    [loadHistory, showSuccess, showError]
  );

  /**
   * 複数のアラートを一括で解決済みとしてマーク
   */
  const handleResolveMultiple = useCallback(
    async (alertIds: string[]) => {
      if (alertIds.length === 0) return;

      setConfirmDialog({
        isOpen: true,
        message: `${alertIds.length}件のアラートを解決済みとしてマークしますか？`,
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          try {
            const resolvedCount = await safeInvoke<number>('resolve_alerts', {
              alert_ids: alertIds,
            });
            showSuccess(
              'アラート一括解決完了',
              `${resolvedCount}件のアラートを解決済みとしてマークしました`
            );
            setSelectedAlerts(new Set()); // 選択をクリア
            loadHistory(); // 履歴を再読み込み
          } catch (err) {
            logger.error('アラートの一括解決に失敗しました', err, 'AlertHistory');
            const errorMessage =
              extractErrorMessage(err, 'アラートの一括解決に失敗しました');
            showError('アラート一括解決エラー', errorMessage);
          }
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        },
      });
    },
    [loadHistory, showSuccess, showError]
  );

  /**
   * アラートタイプの日本語名を取得
   */
  const getAlertTypeName = (type: string): string => {
    switch (type) {
      case 'response_time':
        return 'レスポンス時間';
      case 'error_rate':
        return 'エラー率';
      case 'cpu_usage':
        return 'CPU使用率';
      case 'memory_usage':
        return 'メモリ使用率';
      default:
        return type;
    }
  };

  /**
   * 日時をフォーマット
   */
  const formatDateTime = (dateTimeStr: string): string => {
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateTimeStr;
    }
  };

  return (
    <section className="alert-history-section">
      <div className="alert-history-header">
        <h2 className="alert-history-title">アラート履歴</h2>
        <div className="alert-history-controls">
          <label className="alert-history-filter-label">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
            />
            <span>解決済みも表示</span>
          </label>
          {selectedAlerts.size > 0 && (
            <button
              className="alert-history-resolve-multiple-button"
              onClick={() => handleResolveMultiple(Array.from(selectedAlerts))}
              type="button"
            >
              ✓ {selectedAlerts.size}件を解決
            </button>
          )}
          <button
            className="alert-history-refresh-button"
            onClick={loadHistory}
            disabled={loading}
            type="button"
          >
            {loading ? '読み込み中...' : '🔄 更新'}
          </button>
        </div>
      </div>

      {loading && history.length === 0 ? (
        <div className="alert-history-loading">読み込み中...</div>
      ) : history.length === 0 ? (
        <div className="alert-history-empty">
          <p>アラート履歴がありません</p>
        </div>
      ) : (
        <div className="alert-history-list">
          {history.map(alert => (
            <div
              key={alert.id}
              className={`alert-history-item ${alert.resolved_at ? 'resolved' : 'active'}`}
            >
              <div className="alert-history-item-header">
                <div className="alert-history-item-type">
                  {!alert.resolved_at && (
                    <label className="alert-history-item-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedAlerts.has(alert.id)}
                        onChange={e => {
                          const newSelected = new Set(selectedAlerts);
                          if (e.target.checked) {
                            newSelected.add(alert.id);
                          } else {
                            newSelected.delete(alert.id);
                          }
                          setSelectedAlerts(newSelected);
                        }}
                        className="alert-history-item-checkbox"
                        aria-label={`アラート ${alert.id} を選択`}
                      />
                      <span className="sr-only">アラートを選択</span>
                    </label>
                  )}
                  <span className="alert-history-type-badge">
                    {getAlertTypeName(alert.alert_type)}
                  </span>
                  {alert.resolved_at ? (
                    <span className="alert-history-status-badge resolved">
                      解決済み
                    </span>
                  ) : (
                    <span className="alert-history-status-badge active">
                      アクティブ
                    </span>
                  )}
                </div>
                <div className="alert-history-item-actions">
                  <div className="alert-history-item-time">
                    {formatDateTime(alert.timestamp)}
                  </div>
                  {!alert.resolved_at && (
                    <button
                      className="alert-history-resolve-button"
                      onClick={() => handleResolve(alert.id)}
                      type="button"
                      title="解決済みとしてマーク"
                    >
                      ✓ 解決
                    </button>
                  )}
                </div>
              </div>
              {isGlobalSettings && (
                <div className="alert-history-item-api">
                  API: {apiNames.get(alert.api_id) || alert.api_id}
                </div>
              )}
              <div className="alert-history-item-message">{alert.message}</div>
              <div className="alert-history-item-details">
                <span>
                  現在値: {alert.current_value.toFixed(2)}
                  {alert.alert_type === 'response_time' ? 'ms' : '%'}
                </span>
                <span>
                  閾値: {alert.threshold.toFixed(2)}
                  {alert.alert_type === 'response_time' ? 'ms' : '%'}
                </span>
              </div>
              {alert.resolved_at && (
                <div className="alert-history-item-resolved">
                  解決日時: {formatDateTime(alert.resolved_at)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 確認ダイアログ */}
      {confirmDialog.isOpen && (
        <div
          className="confirm-dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div
            className="confirm-dialog"
            role="document"
          >
            <h3 id="confirm-dialog-title">確認</h3>
            <p>{confirmDialog.message}</p>
            <div className="confirm-dialog-actions">
              <button
                className="confirm-button cancel"
                onClick={confirmDialog.onCancel}
                type="button"
              >
                キャンセル
              </button>
              <button
                className="confirm-button confirm"
                onClick={confirmDialog.onConfirm}
                type="button"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
