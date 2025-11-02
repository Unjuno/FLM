// FLM - ログ一覧ページ
// フロントエンドエージェント (FE) 実装
// F006: ログ表示機能 - ログ一覧ページ基本実装

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LogFilter, LogFilterState } from '../components/api/LogFilter';
import { LogStatistics } from '../components/api/LogStatistics';
import { LogDetail } from '../components/api/LogDetail';
import { LogExport } from '../components/api/LogExport';
import { LogDelete } from '../components/api/LogDelete';
import { Tooltip } from '../components/common/Tooltip';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { printSelector } from '../utils/print';
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
 * API情報
 */
interface ApiInfo {
  id: string;
  name: string;
  model_name: string;
  port: number;
  status: string;
  endpoint: string;
  created_at: string;
  updated_at: string;
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
  const [currentPage, setCurrentPage] = useState(1);
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
  const POLLING_INTERVAL = 30000; // 30秒
  const itemsPerPage = 20;

  // API一覧を取得
  const loadApis = useCallback(async () => {
    try {
      const result = await invoke<ApiInfo[]>('list_apis');
      setApis(result);
      
      // APIが1つ以上ある場合は、最初のAPIを選択（初期化時のみ）
      setSelectedApiId(prev => {
        if (!prev && result.length > 0) {
          return result[0].id;
        }
        return prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API一覧の取得に失敗しました');
      setLoading(false);
    }
  }, []);

  // ログ一覧を取得（フィルタ対応 - FE-006-05）
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

      const result = await invoke<RequestLogInfo[]>('get_request_logs', { request });
      
      // エラーのみ表示フィルタ（フロントエンド側で適用）
      let filteredResult = result;
      if (currentFilter.errorsOnly) {
        filteredResult = result.filter(log => log.response_status !== null && log.response_status >= 400);
      }
      
      setLogs(filteredResult);
      // 総件数は取得したログ数から推定（実際には別途取得が必要な場合あり）
      setTotalLogs(filteredResult.length >= itemsPerPage ? page * itemsPerPage + 1 : (page - 1) * itemsPerPage + filteredResult.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログの取得に失敗しました');
      setLogs([]);
      setTotalLogs(0);
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApiId, currentPage]);
  
  // フィルタ変更時にログを再取得
  useEffect(() => {
    if (selectedApiId) {
      loadLogs(selectedApiId, currentPage, filter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

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
  }, [autoRefresh, selectedApiId, currentPage]);

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

  // API選択変更ハンドラ
  const handleApiChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedApiId(event.target.value);
    setCurrentPage(1); // ページをリセット
  };

  // ページ変更ハンドラ
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ステータスコードの色を取得
  const getStatusColor = (status: number | null): string => {
    if (!status) return 'gray';
    if (status >= 200 && status < 300) return 'green';
    if (status >= 300 && status < 400) return 'blue';
    if (status >= 400 && status < 500) return 'orange';
    if (status >= 500) return 'red';
    return 'gray';
  };

  // ステータスコードのテキストを取得
  const getStatusText = (status: number | null): string => {
    if (!status) return '-';
    return status.toString();
  };

  // メソッドの色を取得
  const getMethodColor = (method: string): string => {
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
  };

  // 日時をフォーマット
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

  // 選択されたAPIの情報を取得
  const selectedApi = apis.find(api => api.id === selectedApiId);

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

  // ページネーション計算（フィルタ後のログ数を使用）
  const filteredTotalLogs = filteredLogs.length;
  const totalPages = Math.ceil(filteredTotalLogs / itemsPerPage);
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

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
          {/* ログ統計情報（FE-006-05で統合） */}
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

          {/* ログフィルタ（FE-006-05で統合） */}
          <div className="log-filter-section">
            <LogFilter
              onFilterChange={handleFilterChange}
              initialFilter={filter}
            />
          </div>

          {/* ログエクスポート・削除（FE-008-01, FE-008-03で追加） */}
          {selectedApiId && (
            <div className="log-management-section">
              <div className="log-export-section">
                <LogExport
                  apiId={selectedApiId}
                  filter={filter}
                  onExportComplete={(count) => {
                    console.log(`${count}件のログをエクスポートしました`);
                  }}
                />
              </div>
              <div className="log-delete-section">
                <LogDelete
                  apiId={selectedApiId}
                  onDeleteComplete={(count) => {
                    console.log(`${count}件のログを削除しました`);
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
                    {filteredLogs
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((log) => (
                      <tr 
                        key={log.id} 
                        className="log-row log-row-clickable"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="log-id">{log.id.substring(0, 8)}...</td>
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
                          {log.response_time_ms !== null ? `${log.response_time_ms}ms` : '-'}
                        </td>
                        <td className="log-error">
                          {log.error_message ? (
                            <span className="error-indicator" title={log.error_message}>
                              ⚠️ {log.error_message.substring(0, 20)}...
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

