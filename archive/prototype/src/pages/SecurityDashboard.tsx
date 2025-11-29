// SPDX-License-Identifier: MIT
// SecurityDashboard - セキュリティダッシュボード（概要表示）

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import { formatDateTime } from '../utils/formatters';
import {
  fetchBlockedIps,
  fetchAuditLogs,
  fetchIntrusionAttempts,
  fetchAnomalyDetections,
  unblockIp,
  BlockedIp,
  AuditLog,
  IntrusionAttempt,
  AnomalyDetection,
} from '../services/security';
import './SecurityDashboard.css';

// IP Blocklist Manager Component
interface IPBlocklistManagerProps {
  blockedIps: BlockedIp[];
  onUnblock: () => void;
}

const IPBlocklistManager: React.FC<IPBlocklistManagerProps> = ({ blockedIps, onUnblock }) => {
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newIp, setNewIp] = useState<string>('');
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const { showError, showSuccess } = useNotifications();

  const handleUnblock = async (ip: string) => {
    setUnblocking(ip);
    try {
      await unblockIp(ip);
      showSuccess(`IP ${ip} のブロックを解除しました`);
      onUnblock();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : `IP ${ip} のブロック解除に失敗しました`
      );
    } finally {
      setUnblocking(null);
    }
  };

  const formatBlockReason = (ip: BlockedIp) => {
    if (ip.permanentBlock) {
      return '永続ブロック';
    }
    if (ip.blockedUntil) {
      return `ブロック期限: ${formatDateTime(ip.blockedUntil)}`;
    }
    return `認証失敗: ${ip.failureCount}回`;
  };

  if (blockedIps.length === 0) {
    return (
      <div className="ip-blocklist-empty">
        <p>ブロック済みIPはありません</p>
      </div>
    );
  }

  return (
    <div className="ip-blocklist-manager">
      <div className="blocklist-preview">
        {blockedIps.slice(0, 5).map((ip) => (
          <div key={ip.ip} className="blocklist-item">
            <div className="blocklist-item-info">
              <span className="blocklist-ip">{ip.ip}</span>
              <span className="blocklist-reason">{formatBlockReason(ip)}</span>
            </div>
            <button
              className="button-secondary button-small"
              onClick={() => void handleUnblock(ip.ip)}
              disabled={unblocking === ip.ip}
            >
              {unblocking === ip.ip ? '解除中...' : '解除'}
            </button>
          </div>
        ))}
        {blockedIps.length > 5 && (
          <div className="blocklist-more">
            他 {blockedIps.length - 5} 件のブロック済みIP
          </div>
        )}
      </div>
    </div>
  );
};

// Audit Log Timeline Component with filtering
interface AuditLogTimelineProps {
  logs: AuditLog[];
}

const AuditLogTimeline: React.FC<AuditLogTimelineProps> = ({ logs }) => {
  const [filterEventType, setFilterEventType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const eventTypes = ['all', 'auth_success', 'auth_failure', 'ip_blocked', 'intrusion', 'anomaly', 'rate_limit'];
  const severities = ['all', 'low', 'medium', 'high', 'critical'];

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterEventType !== 'all' && log.eventType !== filterEventType) {
        return false;
      }
      if (filterSeverity !== 'all' && log.severity?.toLowerCase() !== filterSeverity) {
        return false;
      }
      return true;
    });
  }, [logs, filterEventType, filterSeverity]);

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

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  if (logs.length === 0) {
    return <div className="empty-state">監査ログが見つかりません</div>;
  }

  return (
    <div className="audit-log-timeline">
      <div className="timeline-filters">
        <div className="filter-group">
          <label htmlFor="event-type-filter">イベントタイプ:</label>
          <select
            id="event-type-filter"
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="filter-select"
          >
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'すべて' : type}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="severity-filter">重大度:</label>
          <select
            id="severity-filter"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="filter-select"
          >
            {severities.map((severity) => (
              <option key={severity} value={severity}>
                {severity === 'all' ? 'すべて' : severity}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="timeline-list">
        {filteredLogs.length === 0 ? (
          <div className="empty-state">フィルタ条件に一致する監査ログが見つかりません</div>
        ) : (
          filteredLogs.map((log) => {
            const details = parseDetails(log.details);
            return (
              <div key={log.id} className="timeline-item">
                <div className="timeline-marker">
                  <span className={`severity-badge ${getSeverityClass(log.severity)}`}>
                    {log.severity || 'N/A'}
                  </span>
                </div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-event-type">{log.eventType || 'N/A'}</span>
                    <span className="timeline-time">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <div className="timeline-body">
                    <div className="timeline-endpoint">エンドポイント: {log.endpoint}</div>
                    {log.ip && <div className="timeline-ip">IP: {log.ip}</div>}
                    {log.status && (
                      <div className="timeline-status">ステータス: {log.status}</div>
                    )}
                    {details && (
                      <details className="timeline-details">
                        <summary>詳細情報</summary>
                        <pre className="details-json">
                          {typeof details === 'string' ? details : JSON.stringify(details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const SecurityDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showError } = useNotifications();

  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);
  const [recentIntrusions, setRecentIntrusions] = useState<IntrusionAttempt[]>([]);
  const [recentAnomalies, setRecentAnomalies] = useState<AnomalyDetection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'セキュリティ' },
    ],
    [t]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [blockedIpsData, auditLogsData, intrusionsData, anomaliesData] = await Promise.all([
        fetchBlockedIps(),
        fetchAuditLogs({ limit: 10, offset: 0 }),
        fetchIntrusionAttempts({ limit: 10, offset: 0 }),
        fetchAnomalyDetections({ limit: 10, offset: 0 }),
      ]);
      setBlockedIps(blockedIpsData);
      setRecentAuditLogs(auditLogsData);
      setRecentIntrusions(intrusionsData);
      setRecentAnomalies(anomaliesData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'セキュリティダッシュボードデータの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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

  const getScoreClass = (score: number) => {
    if (score >= 200) return 'score-critical';
    if (score >= 100) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  };

  if (loading) {
    return (
      <div className="security-dashboard">
        <Breadcrumb items={breadcrumbItems} />
        <div className="page-header">
          <h1>セキュリティダッシュボード</h1>
        </div>
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="security-dashboard">
      <Breadcrumb items={breadcrumbItems} />
      <div className="page-header">
        <h1>セキュリティダッシュボード</h1>
        <button className="button-primary" onClick={() => void loadDashboard()}>
          更新
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="security-summary">
        <div className="summary-card">
          <h3>ブロック済みIP</h3>
          <div className="summary-value">{blockedIps.length}</div>
          <IPBlocklistManager blockedIps={blockedIps} onUnblock={loadDashboard} />
          <button
            className="button-secondary button-small"
            onClick={() => navigate('/security/ip-blocklist')}
          >
            詳細を見る
          </button>
        </div>
        <div className="summary-card">
          <h3>最近の監査ログ</h3>
          <div className="summary-value">{recentAuditLogs.length}</div>
          <button
            className="button-secondary button-small"
            onClick={() => navigate('/security/audit-logs')}
          >
            詳細を見る
          </button>
        </div>
        <div className="summary-card">
          <h3>侵入検知イベント</h3>
          <div className="summary-value">{recentIntrusions.length}</div>
          <button
            className="button-secondary button-small"
            onClick={() => navigate('/security/intrusion')}
          >
            詳細を見る
          </button>
        </div>
        <div className="summary-card">
          <h3>異常検知イベント</h3>
          <div className="summary-value">{recentAnomalies.length}</div>
          <button
            className="button-secondary button-small"
            onClick={() => navigate('/security/anomaly')}
          >
            詳細を見る
          </button>
        </div>
      </div>

      <div className="security-details">
        <div className="detail-section">
          <h2>監査ログタイムライン</h2>
          <AuditLogTimeline logs={recentAuditLogs} />
          <button
            className="button-secondary"
            onClick={() => navigate('/security/audit-logs')}
          >
            すべての監査ログを見る
          </button>
        </div>

        <div className="detail-section">
          <h2>最近の侵入検知イベント</h2>
          {recentIntrusions.length === 0 ? (
            <div className="empty-state">侵入検知イベントが見つかりません</div>
          ) : (
            <div className="intrusion-list">
              {recentIntrusions.slice(0, 5).map((intrusion) => (
                <div key={intrusion.id} className="intrusion-item">
                  <div className="intrusion-header">
                    <span className={`score-badge ${getScoreClass(intrusion.score)}`}>
                      スコア: {intrusion.score}
                    </span>
                    <span className="intrusion-time">{formatDateTime(intrusion.createdAt)}</span>
                  </div>
                  <div className="intrusion-content">
                    <div className="intrusion-pattern">パターン: {intrusion.pattern}</div>
                    <div className="intrusion-ip">IP: {intrusion.ip}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            className="button-secondary"
            onClick={() => navigate('/security/intrusion')}
          >
            すべての侵入検知イベントを見る
          </button>
        </div>

        <div className="detail-section">
          <h2>最近の異常検知イベント</h2>
          {recentAnomalies.length === 0 ? (
            <div className="empty-state">異常検知イベントが見つかりません</div>
          ) : (
            <div className="anomaly-list">
              {recentAnomalies.slice(0, 5).map((anomaly) => (
                <div key={anomaly.id} className="anomaly-item">
                  <div className="anomaly-header">
                    <span className={`score-badge ${getScoreClass(anomaly.score)}`}>
                      スコア: {anomaly.score}
                    </span>
                    <span className="anomaly-time">{formatDateTime(anomaly.createdAt)}</span>
                  </div>
                  <div className="anomaly-content">
                    <div className="anomaly-type">タイプ: {anomaly.anomalyType}</div>
                    <div className="anomaly-ip">IP: {anomaly.ip}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            className="button-secondary"
            onClick={() => navigate('/security/anomaly')}
          >
            すべての異常検知イベントを見る
          </button>
        </div>
      </div>
    </div>
  );
};

