// SPDX-License-Identifier: MIT
// SecurityAuditLogs - 監査ログ表示ページ

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import { formatDateTime } from '../utils/formatters';
import {
  fetchAuditLogs,
  AuditLog,
  AuditLogsFilter,
} from '../services/security';
import './SecurityAuditLogs.css';

export const SecurityAuditLogs: React.FC = () => {
  const { t } = useI18n();
  const { showError } = useNotifications();

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [ipFilter, setIpFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'セキュリティ', path: '/security' },
      { label: '監査ログ' },
    ],
    [t]
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
      setError(
        err instanceof Error ? err.message : '監査ログの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  }, [eventTypeFilter, severityFilter, ipFilter, page, limit]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const handleFilterChange = () => {
    setPage(1); // Reset to first page when filter changes
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

  if (loading && auditLogs.length === 0) {
    return (
      <div className="security-audit-logs">
        <Breadcrumb items={breadcrumbItems} />
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="security-audit-logs">
      <Breadcrumb items={breadcrumbItems} />
      <div className="page-header">
        <h1>監査ログ</h1>
        <div className="page-actions">
          <button className="button-primary" onClick={loadAuditLogs}>
            更新
          </button>
        </div>
      </div>

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
            フィルタ適用
          </button>
          <button className="button-secondary" onClick={handleClearFilters}>
            クリア
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {auditLogs.length === 0 ? (
        <div className="empty-state">
          <p>監査ログが見つかりません</p>
        </div>
      ) : (
        <>
          <div className="audit-logs-table">
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>エンドポイント</th>
                  <th>ステータス</th>
                  <th>イベントタイプ</th>
                  <th>重要度</th>
                  <th>IPアドレス</th>
                  <th>レイテンシ</th>
                  <th>詳細</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>
                      <code>{log.endpoint}</code>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td>{log.eventType || '-'}</td>
                    <td>
                      {log.severity && (
                        <span className={`severity-badge ${getSeverityClass(log.severity)}`}>
                          {log.severity}
                        </span>
                      )}
                    </td>
                    <td>{log.ip || '-'}</td>
                    <td>{log.latencyMs !== null ? `${log.latencyMs}ms` : '-'}</td>
                    <td>
                      {log.details && (
                        <details>
                          <summary>詳細</summary>
                          <pre>{log.details}</pre>
                        </details>
                      )}
                    </td>
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
            <span className="page-info">
              ページ {page} (表示: {auditLogs.length}件)
            </span>
            <button
              className="button-secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={auditLogs.length < limit}
            >
              次へ
            </button>
          </div>
        </>
      )}
    </div>
  );
};

