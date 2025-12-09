// Audit Logs View Component

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { fetchAuditLogs, AuditLog, AuditLogsFilter } from '../../services/security';
import { formatDateTime } from '../../utils/formatters';
import { createErrorHandler } from '../../utils/errorHandler';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import './AuditLogsView.css';

export const AuditLogsView: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [ipFilter, setIpFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);

  const handleLoadError = useMemo(
    () => createErrorHandler({
      defaultMessage: '監査ログの取得に失敗しました',
      showStderr: true,
    }),
    []
  );

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: AuditLogsFilter = {
        eventType: eventTypeFilter.trim() || undefined,
        severity: severityFilter.trim() || undefined,
        ip: ipFilter.trim() || undefined,
        limit,
        offset: (page - 1) * limit,
      };
      const data = await fetchAuditLogs(filter);
      setAuditLogs(data);
    } catch (err) {
      const result = handleLoadError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
    } finally {
      setLoading(false);
    }
  }, [eventTypeFilter, severityFilter, ipFilter, page, limit, handleLoadError]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const handleFilterChange = () => {
    setPage(1);
    void loadAuditLogs();
  };

  const handleClearFilters = () => {
    setEventTypeFilter('');
    setSeverityFilter('');
    setIpFilter('');
    setPage(1);
  };

  const getSeverityClass = (severity: string | null) => {
    if (!severity) return '';
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'severity-critical';
      case 'high':
        return 'severity-high';
      case 'medium':
        return 'severity-medium';
      case 'low':
        return 'severity-low';
      default:
        return '';
    }
  };

  const getStatusClass = (status: number) => {
    if (status >= 200 && status < 300) return 'status-success';
    if (status >= 400 && status < 500) return 'status-client-error';
    if (status >= 500) return 'status-server-error';
    return 'status-info';
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Request ID', 'Endpoint', 'Status', 'Severity', 'IP', 'Event Type', 'Created At'];
    const rows = auditLogs.map(log => [
      log.id.toString(),
      log.requestId,
      log.endpoint,
      log.status.toString(),
      log.severity || '',
      log.ip || '',
      log.eventType || '',
      log.createdAt,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString()}.csv`;
    link.click();
    // why: メモリリークを防ぐため、URLオブジェクトを解放する
    // alt: URL.revokeObjectURLを呼び出さない（メモリリークの可能性）
    // evidence: URL.createObjectURLのベストプラクティス
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(auditLogs, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString()}.json`;
    link.click();
    // why: メモリリークを防ぐため、URLオブジェクトを解放する
    // alt: URL.revokeObjectURLを呼び出さない（メモリリークの可能性）
    // evidence: URL.createObjectURLのベストプラクティス
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  if (loading && auditLogs.length === 0) {
    return <LoadingSpinner size="medium" message="読み込み中..." />;
  }

  return (
    <div className="audit-logs-view">
      <div className="filters">
        <div className="filter-group">
          <label htmlFor="event-type-filter">イベントタイプ:</label>
          <input
            id="event-type-filter"
            type="text"
            className="form-input"
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            placeholder="例: auth_failure, intrusion"
          />
        </div>
        <div className="filter-group">
          <label htmlFor="severity-filter">重要度:</label>
          <select
            id="severity-filter"
            className="form-select"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="">すべて</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="critical">緊急</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="ip-filter">IPアドレス:</label>
          <input
            id="ip-filter"
            type="text"
            className="form-input"
            value={ipFilter}
            onChange={(e) => setIpFilter(e.target.value)}
            placeholder="例: 192.168.1.1"
          />
        </div>
        <div className="filter-actions">
          <button className="button-primary" onClick={handleFilterChange}>
            フィルター適用
          </button>
          <button className="button-secondary" onClick={handleClearFilters}>
            クリア
          </button>
        </div>
      </div>

      <div className="page-actions">
        <button className="button-primary" onClick={loadAuditLogs}>
          更新
        </button>
        <button className="button-secondary" onClick={exportToCSV}>
          CSVエクスポート
        </button>
        <button className="button-secondary" onClick={exportToJSON}>
          JSONエクスポート
        </button>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      <div className="audit-logs-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Request ID</th>
              <th>エンドポイント</th>
              <th>ステータス</th>
              <th>重要度</th>
              <th>IPアドレス</th>
              <th>イベントタイプ</th>
              <th>作成日時</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.id}</td>
                <td>{log.requestId}</td>
                <td>{log.endpoint}</td>
                <td className={getStatusClass(log.status)}>{log.status}</td>
                <td className={getSeverityClass(log.severity)}>
                  {log.severity || '-'}
                </td>
                <td>{log.ip || '-'}</td>
                <td>{log.eventType || '-'}</td>
                <td>{formatDateTime(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="button-secondary"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          前へ
        </button>
        <span>ページ {page}</span>
        <button
          className="button-secondary"
          onClick={() => setPage((p) => p + 1)}
          disabled={auditLogs.length < limit}
        >
          次へ
        </button>
      </div>
    </div>
  );
};

