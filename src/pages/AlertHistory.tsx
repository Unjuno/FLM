// AlertHistory - アラート履歴ページ

import React, { useState, useEffect, useCallback, useTransition, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { safeInvoke } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { logger } from '../utils/logger';
import { isDev } from '../utils/env';
import { extractErrorMessage } from '../utils/errorHandler';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
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
  const { t, locale } = useI18n();
  const { showSuccess, showError } = useNotifications();
  const [apiList, setApiList] = useState<ApiInfo[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
  const [showUnresolvedOnly, setShowUnresolvedOnly] = useState(false);
  const [alerts, setAlerts] = useState<AlertHistoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiNames, setApiNames] = useState<Map<string, string>>(new Map());
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  // 確認ダイアログの状態（共通コンポーネントを使用）
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmVariant?: 'primary' | 'danger';
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    confirmVariant: 'primary',
  });

  // 仮想スクロール用のref
  const parentRef = useRef<HTMLDivElement>(null);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: t('alertHistory.title') || 'アラート履歴' },
  ], [t]);

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
      if (isDev()) {
        logger.error(
          t('alertHistory.messages.apiListErrorMessage'),
          err instanceof Error ? err : new Error(extractErrorMessage(err)),
          'AlertHistory'
        );
      }
      showError(t('alertHistory.messages.apiListError'), t('alertHistory.messages.apiListErrorMessage'));
    }
  }, [t, showError]);

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
      const errorMessage = extractErrorMessage(err, t('alertHistory.messages.loadError'));
      setError(errorMessage);
      showError(t('alertHistory.messages.loadError'), errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedApiId, showUnresolvedOnly, t, showError]);

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
        return t('alertHistory.alertType.responseTime');
      case 'error_rate':
        return t('alertHistory.alertType.errorRate');
      case 'cpu_usage':
        return t('alertHistory.alertType.cpuUsage');
      case 'memory_usage':
        return t('alertHistory.alertType.memoryUsage');
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
      return date.toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US', {
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
  const handleResolve = useCallback(
    async (alertId: string) => {
      try {
        await safeInvoke('resolve_alert', { alert_id: alertId });
        showSuccess(t('alertHistory.messages.resolveSuccess'));
        loadAlertHistory(); // 履歴を再読み込み
      } catch (err) {
        const errorMessage = extractErrorMessage(err, t('alertHistory.messages.resolveError'));
        setError(errorMessage);
        showError(t('alertHistory.messages.resolveError'), errorMessage);
      }
    },
    [loadAlertHistory, t, showSuccess, showError]
  );

  /**
   * 複数のアラートを一括で解決済みとしてマーク
   */
  const handleResolveMultiple = useCallback(async () => {
    if (selectedAlerts.size === 0) return;

    setConfirmDialog({
      isOpen: true,
      message: t('alertHistory.messages.resolveMultipleConfirm', { count: selectedAlerts.size }),
      confirmVariant: 'primary',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          const resolvedCount = await safeInvoke<number>('resolve_alerts', {
            alert_ids: Array.from(selectedAlerts),
          });
          setSelectedAlerts(new Set()); // 選択をクリア
          showSuccess(
            t('alertHistory.messages.resolveMultipleSuccess'),
            t('alertHistory.messages.resolveMultipleSuccessMessage', { count: resolvedCount })
          );
          loadAlertHistory(); // 履歴を再読み込み
        } catch (err) {
          const errorMessage = extractErrorMessage(err, t('alertHistory.messages.resolveMultipleError'));
          setError(errorMessage);
          showError(t('alertHistory.messages.resolveMultipleError'), errorMessage);
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [selectedAlerts, loadAlertHistory, t, showSuccess, showError]);

  // 仮想スクロールの設定（100件以上の場合に有効化）
  const shouldUseVirtualScroll = alerts.length >= 100;
  const rowVirtualizer = useVirtualizer({
    count: alerts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // アラート項目の高さの推定値（px）
    overscan: 5, // 表示領域外のレンダリング数
    enabled: shouldUseVirtualScroll,
  });

  if (loading && alerts.length === 0) {
    return (
      <div className="alert-history-page">
        <div className="alert-history-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="alert-history-header">
            <SkeletonLoader type="button" width="100px" />
            <SkeletonLoader type="title" width="200px" />
          </header>
          <div className="alert-history-content">
            <SkeletonLoader type="form" count={2} />
            <SkeletonLoader type="list" count={5} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="alert-history-page">
      <div className="alert-history-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="alert-history-header">
          <button
            className="alert-history-back-button"
            onClick={() => navigate('/')}
          >
            {t('alertHistory.backToHome')}
          </button>
          <h1 className="alert-history-title">{t('alertHistory.title')}</h1>
          <p className="alert-history-subtitle">
            {t('alertHistory.subtitle')}
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
              {t('alertHistory.filterByApi')}
              <select
                id="api-filter"
                value={selectedApiId || ''}
                onChange={e => setSelectedApiId(e.target.value || null)}
                className="alert-history-api-select"
              >
                <option value="">{t('alertHistory.allApis')}</option>
                {apiList.map(api => (
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
                onChange={e => setShowUnresolvedOnly(e.target.checked)}
              />
              <span>{t('alertHistory.showUnresolvedOnly')}</span>
            </label>
          </div>

          {selectedAlerts.size > 0 && (
            <button
              className="alert-history-resolve-multiple-button"
              onClick={handleResolveMultiple}
              type="button"
            >
              {t('alertHistory.resolveMultiple', { count: selectedAlerts.size })}
            </button>
          )}
          <button
            className="alert-history-refresh-button"
            onClick={loadAlertHistory}
            type="button"
          >
            更新
          </button>
        </div>

        <div className="alert-history-content">
          {alerts.length === 0 ? (
            <div className="alert-history-empty">
              <p>アラート履歴がありません</p>
            </div>
          ) : (
            <div
              ref={(el) => {
                parentRef.current = el;
                if (el) {
                  el.style.setProperty('--virtual-height', shouldUseVirtualScroll ? '600px' : 'auto');
                  el.style.setProperty('--virtual-overflow', shouldUseVirtualScroll ? 'auto' : 'visible');
                }
              }}
              className="alert-history-list virtual-scroll-container"
            >
              {shouldUseVirtualScroll ? (
                <div
                  ref={(el) => {
                    if (el) {
                      el.style.setProperty('--virtual-height', `${rowVirtualizer.getTotalSize()}px`);
                      el.style.setProperty('--virtual-width', '100%');
                      el.style.setProperty('--virtual-position', 'relative');
                    }
                  }}
                  className="virtual-scroll-container"
                >
                  {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const alert = alerts[virtualRow.index];
                    return (
                      <div
                        key={alert.id}
                        className="virtual-scroll-item"
                        ref={(el) => {
                          if (el) {
                            el.style.setProperty('--virtual-top', '0');
                            el.style.setProperty('--virtual-left', '0');
                            el.style.setProperty('--virtual-width', '100%');
                            el.style.setProperty('--virtual-height', `${virtualRow.size}px`);
                            el.style.setProperty('--virtual-transform', `translateY(${virtualRow.start}px)`);
                          }
                        }}
                      >
                        <div
                          className={`alert-history-item ${alert.resolved_at ? 'resolved' : 'unresolved'}`}
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
                      <span>{getAlertTypeLabel(alert.alert_type)}</span>
                    </div>
                    <div className="alert-history-item-actions">
                      <div className="alert-history-item-status">
                        {alert.resolved_at ? (
                          <span className="status-badge resolved">
                            解決済み
                          </span>
                        ) : (
                          <span className="status-badge unresolved">
                            未解決
                          </span>
                        )}
                      </div>
                      {!alert.resolved_at && (
                        <button
                          className="alert-history-resolve-button"
                          onClick={() => {
                            startTransition(() => {
                              handleResolve(alert.id);
                            });
                          }}
                          type="button"
                          title={t('alertHistory.actions.resolveTitle')}
                          disabled={isPending}
                        >
                          {t('alertHistory.actions.resolve')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="alert-history-item-body">
                    <div className="alert-history-item-api">
                      API: {apiNames.get(alert.api_id) || alert.api_id}
                    </div>
                    <div className="alert-history-item-message">
                      {alert.message}
                    </div>
                    <div className="alert-history-item-details">
                      <span>
                        現在値: {alert.current_value.toFixed(2)}
                        {alert.alert_type === 'error_rate'
                          ? '%'
                          : alert.alert_type === 'response_time'
                            ? 'ms'
                            : '%'}
                      </span>
                      <span>
                        閾値: {alert.threshold.toFixed(2)}
                        {alert.alert_type === 'error_rate'
                          ? '%'
                          : alert.alert_type === 'response_time'
                            ? 'ms'
                            : '%'}
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
                      </div>
                    );
                  })}
                </div>
              ) : (
                alerts.map(alert => (
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
                        <span>{getAlertTypeLabel(alert.alert_type)}</span>
                      </div>
                      <div className="alert-history-item-actions">
                        <div className="alert-history-item-status">
                          {alert.resolved_at ? (
                            <span className="status-badge resolved">
                              解決済み
                            </span>
                          ) : (
                            <span className="status-badge unresolved">
                              未解決
                            </span>
                          )}
                        </div>
                        {!alert.resolved_at && (
                          <button
                            className="alert-history-resolve-button"
                            onClick={() => {
                              startTransition(() => {
                                handleResolve(alert.id);
                              });
                            }}
                            type="button"
                            title={t('alertHistory.actions.resolveTitle')}
                            disabled={isPending}
                          >
                            {t('alertHistory.actions.resolve')}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="alert-history-item-body">
                      <div className="alert-history-item-api">
                        API: {apiNames.get(alert.api_id) || alert.api_id}
                      </div>
                      <div className="alert-history-item-message">
                        {alert.message}
                      </div>
                      <div className="alert-history-item-details">
                        <span>
                          現在値: {alert.current_value.toFixed(2)}
                          {alert.alert_type === 'error_rate'
                            ? '%'
                            : alert.alert_type === 'response_time'
                              ? 'ms'
                              : '%'}
                        </span>
                        <span>
                          閾値: {alert.threshold.toFixed(2)}
                          {alert.alert_type === 'error_rate'
                            ? '%'
                            : alert.alert_type === 'response_time'
                              ? 'ms'
                              : '%'}
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
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 確認ダイアログ（共通コンポーネントを使用） */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        confirmVariant={confirmDialog.confirmVariant || 'primary'}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
