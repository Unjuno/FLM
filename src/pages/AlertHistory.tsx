// AlertHistory - アラート履歴ページ

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { logger } from '../utils/logger';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useNotifications } from '../contexts/NotificationContext';
import type { ApiInfo } from '../types/api';
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
 * アラート履歴ページ
 * 過去に検出されたアラートを表示します
 */
export const AlertHistory: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const [apiList, setApiList] = useState<ApiInfo[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
  const [showUnresolvedOnly, setShowUnresolvedOnly] = useState(false);
  const [alerts, setAlerts] = useState<AlertHistoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiNames, setApiNames] = useState<Map<string, string>>(new Map());
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  /**
   * API一覧を読み込む
   */
  const loadApiList = useCallback(async () => {
    try {
      const apis = await safeInvoke<ApiInfo[]>('list_apis');
      const apiMap = new Map<string, string>();
      apis.forEach(api => apiMap.set(api.id, api.name));
      setApiNames(apiMap);
      setApiList(apis);
    } catch (err) {
      if (import.meta.env.DEV) {
        logger.error('API一覧の取得に失敗しました', err instanceof Error ? err : new Error(String(err)), 'AlertHistory');
      }
      showError('API一覧の取得エラー', 'API一覧の取得に失敗しました');
    }
  }, [showError]);

  // API一覧を取得
  useEffect(() => {
    loadApiList();
  }, [loadApiList]);

  /**
   * アラート履歴を読み込む
   */
  const loadAlertHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await safeInvoke<AlertHistoryInfo[]>('get_alert_history', {
        request: {
          api_id: selectedApiId,
          unresolved_only: showUnresolvedOnly,
          limit: 100,
        },
      });

      setAlerts(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'アラート履歴の取得に失敗しました';
      setError(errorMessage);
      showError('アラート履歴の取得に失敗しました', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedApiId, showUnresolvedOnly, showError]);

  // アラート履歴を読み込む
  useEffect(() => {
    loadAlertHistory();
  }, [loadAlertHistory]);

  /**
   * アラートタイプのラベルを取得
   */
  const getAlertTypeLabel = (type: string): string => {
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
  const formatDateTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  /**
   * アラートを解決済みとしてマーク
   */
  const handleResolve = useCallback(async (alertId: string) => {
    try {
      await safeInvoke('resolve_alert', { alert_id: alertId });
      showSuccess('アラートを解決済みとしてマークしました');
      loadAlertHistory(); // 履歴を再読み込み
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'アラートの解決に失敗しました';
      setError(errorMessage);
      showError('アラートの解決に失敗しました', errorMessage);
    }
  }, [loadAlertHistory, showSuccess, showError]);

  /**
   * 複数のアラートを一括で解決済みとしてマーク
   */
  const handleResolveMultiple = useCallback(async () => {
    if (selectedAlerts.size === 0) return;
    
    if (!confirm(`${selectedAlerts.size}件のアラートを解決済みとしてマークしますか？`)) {
      return;
    }

    try {
      const resolvedCount = await safeInvoke<number>('resolve_alerts', { 
        alert_ids: Array.from(selectedAlerts) 
      });
      setSelectedAlerts(new Set()); // 選択をクリア
      showSuccess('アラート一括解決完了', `${resolvedCount}件のアラートを解決済みとしてマークしました`);
      loadAlertHistory(); // 履歴を再読み込み
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'アラートの一括解決に失敗しました';
      setError(errorMessage);
      showError('アラートの一括解決に失敗しました', errorMessage);
    }
  }, [selectedAlerts, loadAlertHistory, showSuccess, showError]);

  if (loading && alerts.length === 0) {
    return (
      <div className="alert-history-page">
        <div className="alert-history-container">
          <div className="alert-history-loading">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="alert-history-page">
      <div className="alert-history-container">
        <header className="alert-history-header">
          <button className="alert-history-back-button" onClick={() => navigate('/')}>
            ← ホームに戻る
          </button>
          <h1 className="alert-history-title">アラート履歴</h1>
          <p className="alert-history-subtitle">
            過去に検出されたアラートを確認できます
          </p>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="general"
            onClose={() => setError(null)}
          />
        )}

        <div className="alert-history-filters">
          <div className="alert-history-filter-group">
            <label htmlFor="api-filter">
              APIでフィルタ:
              <select
                id="api-filter"
                value={selectedApiId || ''}
                onChange={(e) => setSelectedApiId(e.target.value || null)}
                className="alert-history-api-select"
              >
                <option value="">すべてのAPI</option>
                {apiList.map((api) => (
                  <option key={api.id} value={api.id}>
                    {api.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="alert-history-filter-group">
            <label className="alert-history-checkbox-label">
              <input
                type="checkbox"
                checked={showUnresolvedOnly}
                onChange={(e) => setShowUnresolvedOnly(e.target.checked)}
              />
              <span>未解決のアラートのみ表示</span>
            </label>
          </div>

          {selectedAlerts.size > 0 && (
            <button
              className="alert-history-resolve-multiple-button"
              onClick={handleResolveMultiple}
              type="button"
            >
              ✓ {selectedAlerts.size}件を解決
            </button>
          )}
          <button
            className="alert-history-refresh-button"
            onClick={loadAlertHistory}
            type="button"
          >
            🔄 更新
          </button>
        </div>

        <div className="alert-history-content">
          {alerts.length === 0 ? (
            <div className="alert-history-empty">
              <p>アラート履歴がありません</p>
            </div>
          ) : (
            <div className="alert-history-list">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`alert-history-item ${alert.resolved_at ? 'resolved' : 'unresolved'}`}
                >
                  <div className="alert-history-item-header">
                    <div className="alert-history-item-type">
                      {!alert.resolved_at && (
                        <label className="alert-history-item-checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedAlerts.has(alert.id)}
                            onChange={(e) => {
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
                      <span>{getAlertTypeLabel(alert.alert_type)}</span>
                    </div>
                    <div className="alert-history-item-actions">
                      <div className="alert-history-item-status">
                        {alert.resolved_at ? (
                          <span className="status-badge resolved">解決済み</span>
                        ) : (
                          <span className="status-badge unresolved">未解決</span>
                        )}
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
                  <div className="alert-history-item-body">
                    <div className="alert-history-item-api">
                      API: {apiNames.get(alert.api_id) || alert.api_id}
                    </div>
                    <div className="alert-history-item-message">{alert.message}</div>
                    <div className="alert-history-item-details">
                      <span>
                        現在値: {alert.current_value.toFixed(2)}
                        {alert.alert_type === 'error_rate' ? '%' : alert.alert_type === 'response_time' ? 'ms' : '%'}
                      </span>
                      <span>
                        閾値: {alert.threshold.toFixed(2)}
                        {alert.alert_type === 'error_rate' ? '%' : alert.alert_type === 'response_time' ? 'ms' : '%'}
                      </span>
                    </div>
                    <div className="alert-history-item-timestamp">
                      検出時刻: {formatDateTime(alert.timestamp)}
                      {alert.resolved_at && (
                        <span className="resolved-timestamp">
                          {' | 解決時刻: '}
                          {formatDateTime(alert.resolved_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

