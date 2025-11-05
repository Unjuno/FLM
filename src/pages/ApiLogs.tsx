// ApiLogs - ログ一覧ページ

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LogFilter, LogFilterState } from '../components/api/LogFilter';
import { LogStatistics } from '../components/api/LogStatistics';
import { LogDetail } from '../components/api/LogDetail';
import { LogExport } from '../components/api/LogExport';
import { LogDelete } from '../components/api/LogDelete';
import { Tooltip } from '../components/common/Tooltip';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { printSelector } from '../utils/print';
import { PAGINATION, REFRESH_INTERVALS, HTTP_STATUS, DISPLAY_LIMITS } from '../constants/config';
import type { ApiInfo } from '../types/api';
import { formatDateTime, formatResponseTime } from '../utils/formatters';
import { logger } from '../utils/logger';
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
  const [apis, setApis] = useState<ApiInfo[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [logs, setLogs] = useState<RequestLogInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(PAGINATION.DEFAULT_PAGE);
  const [totalLogs, setTotalLogs] = useState(0);
  const [selectedLog, setSelectedLog] = useState<RequestLogInfo | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();
  const [filter, setFilter] = useState<LogFilterState>({
    startDate: '',
    endDate: '',
    statusCodes: [],
    pathFilter: '',
    errorsOnly: false,
  });
  const POLLING_INTERVAL = REFRESH_INTERVALS.LOGS;
  const itemsPerPage = PAGINATION.DEFAULT_ITEMS_PER_PAGE;

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
      const errorMessage = err instanceof Error ? err.message : 'API一覧の取得に失敗しました';
      logger.error('API一覧の取得に失敗しました', err, 'ApiLogs');
      setError(errorMessage);
      setLoading(false);
    }
  }, []);

  // ログ一覧を取得（フィルタ対応）
  const loadLogs = useCallback(async (apiId: string | null, page: number, filterState?: LogFilterState) => {
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
      
      // エラーのみ表示フィルタ（フロントエンド側で適用）
      let filteredResult = result.logs;
      if (currentFilter.errorsOnly) {
        filteredResult = result.logs.filter(log => log.response_status !== null && log.response_status >= HTTP_STATUS.MIN_ERROR_CODE);
        // エラーのみ表示フィルタ適用時は、総件数も再計算が必要だが、
        // バックエンドで正確な総件数を取得するのは困難なため、フロントエンド側でフィルタ後の件数を表示
        // 注意: これは正確な総件数ではなく、現在のページのフィルタ後の件数
        setTotalLogs(filteredResult.length < itemsPerPage 
          ? (page - 1) * itemsPerPage + filteredResult.length 
          : page * itemsPerPage + 1);
      } else {
        // CODE-002修正: バックエンドから正確な総件数を取得
        setTotalLogs(result.total_count);
      }
      
      setLogs(filteredResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ログの取得に失敗しました';
      logger.error('ログの取得に失敗しました', err, 'ApiLogs');
      setError(errorMessage);
      setLogs([]);
      setTotalLogs(0);
    } finally {
      setLoading(false);
    }
  }, [filter, itemsPerPage]);

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
  }, [autoRefresh, selectedApiId, currentPage, filter, loadLogs]);

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
  const handleApiChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedApiId(event.target.value);
    setCurrentPage(1); // ページをリセット
  }, []);

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

  // フィルタリングされたログ（バックエンド側でフィルタリング済み、errorsOnlyのみフロントエンド側で処理）
  const filteredLogs = useMemo(() => {
    let filtered = [...logs];

    // errorsOnlyフィルタのみフロントエンド側で処理（バックエンドにerrorsOnlyフィルタがないため）
    if (filter.errorsOnly) {
      filtered = filtered.filter(log => log.response_status !== null && log.response_status >= 400);
    }

    return filtered;
  }, [logs, filter.errorsOnly]);

  // フィルタ変更ハンドラ
  const handleFilterChange = useCallback((newFilter: LogFilterState) => {
    setFilter(newFilter);
    setCurrentPage(1); // フィルタ変更時はページをリセット
  }, []);

  // ページネーション計算（useMemoでメモ化）
  const { totalPages, startPage, endPage } = useMemo(() => {
    const filteredTotalLogs = filteredLogs.length;
    const totalPages = Math.ceil(filteredTotalLogs / itemsPerPage);
    const startPage = Math.max(PAGINATION.MIN_PAGE, currentPage - PAGINATION.PAGE_RANGE_DISPLAY);
    const endPage = Math.min(totalPages, currentPage + PAGINATION.PAGE_RANGE_DISPLAY);
    return { totalPages, startPage, endPage };
  }, [filteredLogs.length, currentPage, itemsPerPage]);

  // 表示用ログリスト（ページネーション適用）（useMemoでメモ化）
  const displayedLogs = useMemo(() => {
    return filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  if (loading && logs.length === 0) {
    return (
      <div className="api-logs-page">
        <div className="api-logs-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>ログ一覧を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-logs-page">
      <div className="api-logs-container">
        <header className="api-logs-header">
          <div className="header-top">
            <Tooltip content="ホーム画面に戻ります">
              <button className="back-button" onClick={() => navigate('/')}>
                ← ホームに戻る
              </button>
            </Tooltip>
            <h1>APIログ</h1>
          </div>
          <div className="header-actions">
            <Tooltip content={autoRefresh ? '自動更新を停止します。ログは手動で更新する必要があります。' : '30秒ごとにログを自動更新します。最新のログを常に表示できます。'}>
              <button
                className={`auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? '⏸️ 自動更新: ON' : '▶️ 自動更新: OFF'}
              </button>
            </Tooltip>
            <Tooltip content="ログ一覧を最新の状態に更新します。フィルタ条件は維持されます。">
              <button className="refresh-button" onClick={() => selectedApiId && loadLogs(selectedApiId, currentPage, filter)}>
                🔄 更新
              </button>
            </Tooltip>
            <Tooltip content="現在のログ一覧を印刷します。">
              <button 
                className="print-button no-print" 
                onClick={() => printSelector('.api-logs-content', 'APIログ一覧')}
              >
                🖨️ 印刷
              </button>
            </Tooltip>
          </div>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
            onRetry={() => selectedApiId && loadLogs(selectedApiId, currentPage, filter)}
          />
        )}

        <div className="api-logs-content">
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
                  onExportComplete={(count) => {
                    logger.info(`${count}件のログをエクスポートしました`, 'ApiLogs');
                  }}
                />
              </div>
              <div className="log-delete-section">
                <LogDelete
                  apiId={selectedApiId}
                  onDeleteComplete={(count) => {
                    logger.info(`${count}件のログを削除しました`, 'ApiLogs');
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
            <Tooltip content="表示するAPIを選択します。特定のAPIを選択すると、そのAPIのログのみが表示されます。">
              <label htmlFor="api-select">表示するAPI:</label>
            </Tooltip>
            <Tooltip content="表示するAPIを選択します。特定のAPIを選択すると、そのAPIのログのみが表示されます。" position="bottom">
              <select
                id="api-select"
                value={selectedApiId}
                onChange={handleApiChange}
                className="api-select"
                title="表示するAPI"
                aria-label="表示するAPI"
              >
                <option value="">すべてのAPI</option>
                {apis.map((api) => (
                  <option key={api.id} value={api.id}>
                    {api.name} ({api.endpoint})
                  </option>
                ))}
              </select>
            </Tooltip>
            {selectedApi && (
              <div className="selected-api-info">
                <span className="info-label">選択中:</span>
                <span className="info-value">{selectedApi.name}</span>
              </div>
            )}
          </div>

          {/* ログ一覧 */}
          {logs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h2>ログがまだありません</h2>
              <p>APIを使用すると、ここにリクエストログが表示されます。</p>
            </div>
          ) : (
            <>
              <div className="logs-info">
                <p>
                  全{totalLogs}件中 {filteredLogs.length > 0 ? filteredLogs.length : 0}件がフィルタ条件に一致
                  {filteredLogs.length !== logs.length && (
                    <span className="filter-indicator"> ({logs.length}件中{filteredLogs.length}件表示)</span>
                  )}
                </p>
              </div>
              <div className="logs-table-container">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>メソッド</th>
                      <th>パス</th>
                      <th>ステータス</th>
                      <th>レスポンス時間</th>
                      <th>エラー</th>
                      <th>日時</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLogs.map((log) => (
                      <tr 
                        key={log.id} 
                        className="log-row log-row-clickable"
                        onClick={() => handleLogClick(log)}
                      >
                        <td className="log-id">{log.id.substring(0, DISPLAY_LIMITS.LOG_ID_LENGTH)}...</td>
                        <td>
                          <span className={`method-badge method-${getMethodColor(log.method)}`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="log-path">{log.path}</td>
                        <td>
                          <span className={`status-badge status-${getStatusColor(log.response_status)}`}>
                            {getStatusText(log.response_status)}
                          </span>
                        </td>
                        <td className="log-response-time">
                          {formatResponseTime(log.response_time_ms)}
                        </td>
                        <td className="log-error">
                          {log.error_message ? (
                            <span className="error-indicator" title={log.error_message}>
                              ⚠️ {log.error_message.substring(0, DISPLAY_LIMITS.ERROR_MESSAGE_LENGTH)}...
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="log-datetime">{formatDateTime(log.created_at)}</td>
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
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ← 前へ
                  </button>
                  <div className="pagination-pages">
                    {startPage > 1 && (
                      <>
                        <button
                          className="pagination-button"
                          onClick={() => handlePageChange(1)}
                        >
                          1
                        </button>
                        {startPage > 2 && <span className="pagination-ellipsis">...</span>}
                      </>
                    )}
                    {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((page) => (
                      <button
                        key={page}
                        className={`pagination-button ${page === currentPage ? 'active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    ))}
                    {endPage < totalPages && (
                      <>
                        {endPage < totalPages - 1 && <span className="pagination-ellipsis">...</span>}
                        <button
                          className="pagination-button"
                          onClick={() => handlePageChange(totalPages)}
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    className="pagination-button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
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
          <LogDetail
            log={selectedLog}
            onClose={() => setSelectedLog(null)}
          />
        )}
      </div>
    </div>
  );
};

