// ApiLogs - ログ一覧ページ

import React, { useState, useEffect, useCallback, useMemo, useTransition, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AppLayout } from '../components/layout/AppLayout';
import { safeInvoke } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { LogFilter, LogFilterState } from '../components/api/LogFilter';
import { LogStatistics } from '../components/api/LogStatistics';
import { LogDetail } from '../components/api/LogDetail';
import { LogExport } from '../components/api/LogExport';
import { LogDelete } from '../components/api/LogDelete';
import { Tooltip } from '../components/common/Tooltip';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import { printSelector } from '../utils/print';
import {
  PAGINATION,
  REFRESH_INTERVALS,
  HTTP_STATUS,
  DISPLAY_LIMITS,
} from '../constants/config';
import type { ApiInfo } from '../types/api';
import { formatDateTime, formatResponseTime } from '../utils/formatters';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import './ApiLogs.css';

/**
 * リクエストログ情報
 */
interface RequestLogInfo {
  id: string;
  api_id: string;
  method: string;
  path: string;
  request_body: string | null;
  response_status: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

/**
 * ログ一覧ページ
 * リクエストログを表示・管理します
 */
export const ApiLogs: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [apis, setApis] = useState<ApiInfo[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [logs, setLogs] = useState<RequestLogInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(
    PAGINATION.DEFAULT_PAGE
  );
  const [totalLogs, setTotalLogs] = useState(0);
  const [selectedLog, setSelectedLog] = useState<RequestLogInfo | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'errors'>('all');

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();
  const [filter, setFilter] = useState<LogFilterState>({
    startDate: '',
    endDate: '',
    statusCodes: [],
    pathFilter: '',
    errorsOnly: false,
  });
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const POLLING_INTERVAL = REFRESH_INTERVALS.LOGS;
  const itemsPerPage = PAGINATION.DEFAULT_ITEMS_PER_PAGE;

  // 仮想スクロール用のref
  const parentRef = useRef<HTMLDivElement>(null);

  // API一覧を取得
  const loadApis = useCallback(async () => {
    try {
      const result = await safeInvoke<ApiInfo[]>('list_apis');
      setApis(result);

      // APIが1つ以上ある場合は、最初のAPIを選択（初期化時のみ）
      setSelectedApiId(prev => {
        if (!prev && result.length > 0) {
          return result[0].id;
        }
        return prev;
      });
    } catch (err) {
      const errorMessage =
        extractErrorMessage(err, t('apiLogs.messages.loadError'));
      logger.error(t('apiLogs.messages.loadError'), err, 'ApiLogs');
      setError(errorMessage);
      setLoading(false);
    }
  }, []);

  // ログ一覧を取得（フィルタ対応）
  const loadLogs = useCallback(
    async (
      apiId: string | null,
      page: number,
      filterState?: LogFilterState
    ) => {
      if (!apiId) {
        setLogs([]);
        setTotalLogs(0);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const offset = (page - 1) * itemsPerPage;
        const currentFilter = filterState || filter;

        // フィルタ条件をリクエストに追加
        const request: {
          api_id: string | null;
          limit: number;
          offset: number;
          start_date?: string;
          end_date?: string;
          status_codes?: number[];
          path_filter?: string;
          errors_only?: boolean;
        } = {
          api_id: apiId,
          limit: itemsPerPage,
          offset: offset,
        };

        // フィルタ条件を追加
        if (currentFilter.startDate) {
          request.start_date = currentFilter.startDate;
        }
        if (currentFilter.endDate) {
          request.end_date = currentFilter.endDate;
        }
        if (currentFilter.statusCodes.length > 0) {
          request.status_codes = currentFilter.statusCodes;
        }
        if (currentFilter.pathFilter) {
          request.path_filter = currentFilter.pathFilter;
        }
        if (currentFilter.errorsOnly) {
          request.errors_only = true;
        }

        // CODE-002修正: レスポンスに総件数が含まれるようになった
        const result = await safeInvoke<{
          logs: RequestLogInfo[];
          total_count: number;
        }>('get_request_logs', { request });

        // null/undefinedチェック
        if (!result || !Array.isArray(result.logs)) {
          logger.warn('ログ取得結果が無効です', 'ApiLogs', result);
          setLogs([]);
          setTotalLogs(0);
          return;
        }

        // CODE-002修正: バックエンドから正確な総件数を取得
        // errorsOnlyフィルタはバックエンドで処理されるため、フロントエンド側での追加フィルタリングは不要
        setTotalLogs(result.total_count);
        setLogs(result.logs);
      } catch (err) {
        const errorMessage = extractErrorMessage(err, 'ログの取得に失敗しました');
        logger.error('ログの取得に失敗しました', err, 'ApiLogs');
        setError(errorMessage);
        setLogs([]);
        setTotalLogs(0);
      } finally {
        setLoading(false);
      }
    },
    [filter, itemsPerPage]
  );

  // 初期化とAPI一覧取得
  useEffect(() => {
    loadApis();
  }, [loadApis]);

  // API選択時、ページ変更時にログを取得
  useEffect(() => {
    if (selectedApiId) {
      loadLogs(selectedApiId, currentPage, filter);
    } else {
      setLogs([]);
      setTotalLogs(0);
      setLoading(false);
    }
  }, [selectedApiId, currentPage, filter, loadLogs]);

  // リアルタイム更新（ポーリング）
  useEffect(() => {
    if (!autoRefresh || !selectedApiId) {
      return;
    }

    const interval = setInterval(() => {
      if (selectedApiId) {
        loadLogs(selectedApiId, currentPage, filter);
      }
    }, POLLING_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [
    autoRefresh,
    selectedApiId,
    currentPage,
    filter,
    loadLogs,
    POLLING_INTERVAL,
  ]);

  // ページが非表示の場合はポーリングを停止
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setAutoRefresh(false);
      } else if (selectedApiId) {
        setAutoRefresh(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedApiId]);

  // API選択変更ハンドラ（useCallbackでメモ化）
  const handleApiChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedApiId(event.target.value);
      setCurrentPage(1); // ページをリセット
    },
    []
  );

  // ページ変更ハンドラ（useCallbackでメモ化）
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ログ選択ハンドラ（useCallbackでメモ化）
  const handleLogClick = useCallback((log: RequestLogInfo) => {
    setSelectedLog(log);
  }, []);

  // ステータスコードの色を取得（useCallbackでメモ化）
  const getStatusColor = useCallback((status: number | null): string => {
    if (!status) return 'gray';
    if (status >= HTTP_STATUS.OK && status < 300) return 'green';
    if (status >= 300 && status < HTTP_STATUS.MIN_ERROR_CODE) return 'blue';
    if (status >= HTTP_STATUS.MIN_ERROR_CODE && status < 500) return 'orange';
    if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) return 'red';
    return 'gray';
  }, []);

  // ステータスコードのテキストを取得（useCallbackでメモ化）
  const getStatusText = useCallback((status: number | null): string => {
    if (!status) return '-';
    return status.toString();
  }, []);

  // メソッドの色を取得（useCallbackでメモ化）
  const getMethodColor = useCallback((method: string): string => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'blue';
      case 'POST':
        return 'green';
      case 'PUT':
        return 'orange';
      case 'DELETE':
        return 'red';
      case 'PATCH':
        return 'purple';
      default:
        return 'gray';
    }
  }, []);

  // 選択されたAPIの情報を取得（useMemoでメモ化）
  const selectedApi = useMemo(() => {
    return apis.find(api => api.id === selectedApiId);
  }, [apis, selectedApiId]);

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('apiLogs.title') || 'APIログ' },
    ];
    if (selectedApi) {
      items.splice(1, 0, {
        label: t('header.apiList') || 'API一覧',
        path: '/api/list',
      });
      items.push({
        label: selectedApi.name,
        path: `/api/details/${selectedApi.id}`,
      });
    }
    return items;
  }, [t, selectedApi]);

  // フィルタリングされたログ（バックエンド側でフィルタリング済み）
  const filteredLogs = useMemo(() => {
    // バックエンド側でフィルタリング済みのため、そのまま使用
    // errorsOnlyフィルタはバックエンドで処理されるため、フロントエンド側での追加フィルタリングは不要
    return logs;
  }, [logs]);

  // フィルタ変更ハンドラ
  const handleFilterChange = useCallback((newFilter: LogFilterState) => {
    setFilter(newFilter);
    setCurrentPage(1); // フィルタ変更時はページをリセット
    
    // タブの状態をフィルタに合わせて更新
    if (newFilter.errorsOnly && activeTab !== 'errors') {
      setActiveTab('errors');
    } else if (!newFilter.errorsOnly && activeTab !== 'all') {
      setActiveTab('all');
    }
  }, [activeTab]);

  // ページネーション計算（useMemoでメモ化）
  const { totalPages, startPage, endPage } = useMemo(() => {
    const filteredTotalLogs = filteredLogs.length;
    const totalPages = Math.ceil(filteredTotalLogs / itemsPerPage);
    const startPage = Math.max(
      PAGINATION.MIN_PAGE,
      currentPage - PAGINATION.PAGE_RANGE_DISPLAY
    );
    const endPage = Math.min(
      totalPages,
      currentPage + PAGINATION.PAGE_RANGE_DISPLAY
    );
    return { totalPages, startPage, endPage };
  }, [filteredLogs.length, currentPage, itemsPerPage]);

  // 表示用ログリスト（ページネーション適用）（useMemoでメモ化）
  const displayedLogs = useMemo(() => {
    return filteredLogs.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredLogs, currentPage, itemsPerPage]);

  // 仮想スクロールの設定（100件以上の場合に有効化）
  const shouldUseVirtualScroll = displayedLogs.length >= 100;
  const rowVirtualizer = useVirtualizer({
    count: displayedLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // 行の高さの推定値（px）
    overscan: 5, // 表示領域外のレンダリング数
    enabled: shouldUseVirtualScroll,
  });

  if (loading && logs.length === 0) {
    return (
      <AppLayout>
        <div className="api-logs-page">
          <div className="page-container api-logs-container">
            <Breadcrumb items={breadcrumbItems} />
            <header className="page-header api-logs-header">
              <div className="header-top">
                <h1>{t('apiLogs.title')}</h1>
              </div>
            </header>
            <div className="api-logs-content">
              {/* ログ統計情報のスケルトン */}
              <div className="log-statistics-section">
                <SkeletonLoader type="card" count={1} />
              </div>
              {/* ログフィルタのスケルトン */}
              <div className="log-filter-section">
                <SkeletonLoader type="form" count={3} />
              </div>
              {/* ログ一覧のスケルトン */}
              <div className="logs-table-container">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th><SkeletonLoader type="text" width="60px" /></th>
                      <th><SkeletonLoader type="text" width="80px" /></th>
                      <th><SkeletonLoader type="text" width="200px" /></th>
                      <th><SkeletonLoader type="text" width="80px" /></th>
                      <th><SkeletonLoader type="text" width="100px" /></th>
                      <th><SkeletonLoader type="text" width="80px" /></th>
                      <th><SkeletonLoader type="text" width="150px" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }).map((_, index) => (
                      <tr key={index}>
                        <td><SkeletonLoader type="text" width="60px" /></td>
                        <td><SkeletonLoader type="text" width="80px" /></td>
                        <td><SkeletonLoader type="text" width="200px" /></td>
                        <td><SkeletonLoader type="text" width="80px" /></td>
                        <td><SkeletonLoader type="text" width="100px" /></td>
                        <td><SkeletonLoader type="text" width="80px" /></td>
                        <td><SkeletonLoader type="text" width="150px" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="api-logs-page">
        <div className="page-container api-logs-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header api-logs-header">
            <div className="header-top">
              <Tooltip content={t('apiLogs.backToHomeTooltip')}>
                <button className="back-button" onClick={() => navigate('/')}>
                  {t('apiLogs.backToHome')}
                </button>
              </Tooltip>
              <h1>{t('apiLogs.title')}</h1>
            </div>
            <div className="header-actions">
              <Tooltip
                content={
                  autoRefresh
                    ? t('apiLogs.autoRefresh.disableTooltip')
                    : t('apiLogs.autoRefresh.enableTooltip')
                }
              >
                <button
                  className={`auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  {autoRefresh ? t('apiLogs.autoRefresh.on') : t('apiLogs.autoRefresh.off')}
                </button>
              </Tooltip>
              <Tooltip content={t('apiLogs.refreshTooltip')}>
                <button
                  className="refresh-button"
                  onClick={() =>
                    selectedApiId &&
                    loadLogs(selectedApiId, currentPage, filter)
                  }
                >
                  {t('apiLogs.refresh')}
                </button>
              </Tooltip>
              <Tooltip content={t('apiLogs.printTooltip')}>
                <button
                  className="print-button no-print"
                  onClick={() =>
                    printSelector('.api-logs-content', t('apiLogs.printTitle'))
                  }
                >
                  {t('apiLogs.print')}
                </button>
              </Tooltip>
            </div>
          </header>

          {error && (
            <ErrorMessage
              message={error}
              type="api"
              onClose={() => setError(null)}
              onRetry={() =>
                selectedApiId && loadLogs(selectedApiId, currentPage, filter)
              }
            />
          )}

          <div className="api-logs-content">
            {/* タブ切り替え */}
            <div className="log-tabs-section">
              <button
                className={`log-tab-button ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('all');
                  setFilter(prev => ({ ...prev, errorsOnly: false }));
                }}
                aria-label="すべてのログを表示"
              >
                すべてのログ
              </button>
              <button
                className={`log-tab-button ${activeTab === 'errors' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('errors');
                  setFilter(prev => ({ ...prev, errorsOnly: true }));
                }}
                aria-label="エラーログのみを表示"
              >
                エラーログのみ
              </button>
            </div>

            {/* ログ統計情報 */}
            {selectedApiId && (
              <div className="log-statistics-section">
                <LogStatistics
                  apiId={selectedApiId}
                  startDate={filter.startDate || null}
                  endDate={filter.endDate || null}
                  autoRefresh={true}
                  refreshInterval={POLLING_INTERVAL}
                />
              </div>
            )}

            {/* ログフィルタ */}
            <div className="log-filter-section">
              <LogFilter
                onFilterChange={handleFilterChange}
                initialFilter={filter}
              />
            </div>

            {/* ログエクスポート・削除 */}
            {selectedApiId && (
              <div className="log-management-section">
                <div className="log-export-section">
                  <LogExport
                    apiId={selectedApiId}
                    filter={filter}
                    onExportComplete={count => {
                      logger.info(
                        t('apiLogs.messages.exportComplete', { count }),
                        'ApiLogs'
                      );
                    }}
                  />
                </div>
                <div className="log-delete-section">
                  <LogDelete
                    apiId={selectedApiId}
                    onDeleteComplete={count => {
                      logger.info(t('apiLogs.messages.deleteComplete', { count }), 'ApiLogs');
                      // ログ一覧を再読み込み
                      if (selectedApiId) {
                        loadLogs(selectedApiId, currentPage);
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* API選択 */}
            <div className="api-selector">
              <Tooltip content={t('apiLogs.selectApiTooltip')}>
                <label htmlFor="api-select">{t('apiLogs.selectApi')}</label>
              </Tooltip>
              <Tooltip
                content={t('apiLogs.selectApiTooltip')}
                position="bottom"
              >
                <select
                  id="api-select"
                  value={selectedApiId}
                  onChange={handleApiChange}
                  className="api-select"
                  title={t('apiLogs.selectApi')}
                  aria-label={t('apiLogs.selectApi')}
                >
                  <option value="">{t('apiLogs.allApis')}</option>
                  {apis.map(api => (
                    <option key={api.id} value={api.id}>
                      {api.name} ({api.endpoint})
                    </option>
                  ))}
                </select>
              </Tooltip>
              {selectedApi && (
                <div className="selected-api-info">
                  <span className="info-label">{t('apiLogs.selectedApi')}</span>
                  <span className="info-value">{selectedApi.name}</span>
                </div>
              )}
            </div>

            {/* ログ一覧 */}
            {logs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h2>{t('apiLogs.empty.title')}</h2>
                <p>{t('apiLogs.empty.message')}</p>
              </div>
            ) : (
              <>
                <div className="logs-info" role="status" aria-live="polite" aria-atomic="false">
                  <p>
                    {t('apiLogs.info.total', { total: totalLogs })}{' '}
                    {t('apiLogs.info.matched', { count: filteredLogs.length > 0 ? filteredLogs.length : 0 })}
                    {filteredLogs.length !== logs.length && (
                      <span className="filter-indicator">
                        {' '}
                        {t('apiLogs.info.filtered', { total: logs.length, filtered: filteredLogs.length })}
                      </span>
                    )}
                  </p>
                </div>
                <div 
                  className="logs-table-container virtual-scroll-container"
                  ref={(el) => {
                    parentRef.current = el;
                    if (el) {
                      el.style.setProperty('--virtual-height', shouldUseVirtualScroll ? '600px' : 'auto');
                      el.style.setProperty('--virtual-overflow', shouldUseVirtualScroll ? 'auto' : 'visible');
                    }
                  }}
                >
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>{t('apiLogs.table.id')}</th>
                        <th>{t('apiLogs.table.method')}</th>
                        <th>{t('apiLogs.table.path')}</th>
                        <th>{t('apiLogs.table.status')}</th>
                        <th>{t('apiLogs.table.responseTime')}</th>
                        <th>{t('apiLogs.table.error')}</th>
                        <th>{t('apiLogs.table.datetime')}</th>
                      </tr>
                    </thead>
                    <tbody
                      ref={(el) => {
                        if (el && shouldUseVirtualScroll) {
                          el.style.setProperty('--virtual-height', `${rowVirtualizer.getTotalSize()}px`);
                          el.style.setProperty('--virtual-position', 'relative');
                        }
                      }}
                      className={shouldUseVirtualScroll ? 'virtual-scroll-container' : ''}
                    >
                      {shouldUseVirtualScroll
                        ? rowVirtualizer.getVirtualItems().map(virtualRow => {
                            const log = displayedLogs[virtualRow.index];
                            return (
                              <tr
                                key={log.id}
                                className="log-row log-row-clickable virtual-scroll-item"
                                ref={(el) => {
                                  if (el) {
                                    el.style.setProperty('--virtual-top', '0');
                                    el.style.setProperty('--virtual-left', '0');
                                    el.style.setProperty('--virtual-width', '100%');
                                    el.style.setProperty('--virtual-height', `${virtualRow.size}px`);
                                    el.style.setProperty('--virtual-transform', `translateY(${virtualRow.start}px)`);
                                  }
                                }}
                                onClick={() => {
                                  startTransition(() => {
                                    handleLogClick(log);
                                  });
                                }}
                              >
                                <td className="log-id">
                                  {log.id.substring(0, DISPLAY_LIMITS.LOG_ID_LENGTH)}
                                  ...
                                </td>
                                <td>
                                  <span
                                    className={`method-badge method-${getMethodColor(log.method)}`}
                                  >
                                    {log.method}
                                  </span>
                                </td>
                                <td className="log-path">{log.path}</td>
                                <td>
                                  <span
                                    className={`status-badge status-${getStatusColor(log.response_status)}`}
                                  >
                                    {getStatusText(log.response_status)}
                                  </span>
                                </td>
                                <td className="log-response-time">
                                  {formatResponseTime(log.response_time_ms)}
                                </td>
                                <td className="log-error">
                                  {log.error_message ? (
                                    <span
                                      className="error-indicator"
                                      title={log.error_message}
                                    >
                                      {log.error_message.substring(
                                        0,
                                        DISPLAY_LIMITS.ERROR_MESSAGE_LENGTH
                                      )}
                                      ...
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="log-datetime">
                                  {formatDateTime(log.created_at)}
                                </td>
                              </tr>
                            );
                          })
                        : displayedLogs.map(log => (
                        <tr
                          key={log.id}
                          className="log-row log-row-clickable"
                          onClick={() => {
                            startTransition(() => {
                              handleLogClick(log);
                            });
                          }}
                        >
                          <td className="log-id">
                            {log.id.substring(0, DISPLAY_LIMITS.LOG_ID_LENGTH)}
                            ...
                          </td>
                          <td>
                            <span
                              className={`method-badge method-${getMethodColor(log.method)}`}
                            >
                              {log.method}
                            </span>
                          </td>
                          <td className="log-path">{log.path}</td>
                          <td>
                            <span
                              className={`status-badge status-${getStatusColor(log.response_status)}`}
                            >
                              {getStatusText(log.response_status)}
                            </span>
                          </td>
                          <td className="log-response-time">
                            {formatResponseTime(log.response_time_ms)}
                          </td>
                          <td className="log-error">
                            {log.error_message ? (
                              <span
                                className="error-indicator"
                                title={log.error_message}
                              >
                                {log.error_message.substring(
                                  0,
                                  DISPLAY_LIMITS.ERROR_MESSAGE_LENGTH
                                )}
                                ...
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="log-datetime">
                            {formatDateTime(log.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ページネーション */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="pagination-button"
                      onClick={() => {
                        startTransition(() => {
                          handlePageChange(currentPage - 1);
                        });
                      }}
                      disabled={currentPage === 1 || isPending}
                    >
                      ← 前へ
                    </button>
                    <div className="pagination-pages">
                      {startPage > 1 && (
                        <>
                          <button
                            className="pagination-button"
                            onClick={() => {
                              startTransition(() => {
                                handlePageChange(1);
                              });
                            }}
                            disabled={isPending}
                          >
                            1
                          </button>
                          {startPage > 2 && (
                            <span className="pagination-ellipsis">...</span>
                          )}
                        </>
                      )}
                      {Array.from(
                        { length: endPage - startPage + 1 },
                        (_, i) => startPage + i
                      ).map(page => (
                        <button
                          key={page}
                          className={`pagination-button ${page === currentPage ? 'active' : ''}`}
                          onClick={() => {
                            startTransition(() => {
                              handlePageChange(page);
                            });
                          }}
                          disabled={isPending}
                        >
                          {page}
                        </button>
                      ))}
                      {endPage < totalPages && (
                        <>
                          {endPage < totalPages - 1 && (
                            <span className="pagination-ellipsis">...</span>
                          )}
                          <button
                            className="pagination-button"
                            onClick={() => {
                              startTransition(() => {
                                handlePageChange(totalPages);
                              });
                            }}
                            disabled={isPending}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      className="pagination-button"
                      onClick={() => {
                        startTransition(() => {
                          handlePageChange(currentPage + 1);
                        });
                      }}
                      disabled={currentPage === totalPages || isPending}
                    >
                      次へ →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ログ詳細モーダル */}
          {selectedLog && (
            <LogDetail log={selectedLog} onClose={() => setSelectedLog(null)} />
          )}
        </div>
      </div>
    </AppLayout>
  );
};
