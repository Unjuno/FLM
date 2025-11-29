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
  BlockedIp,
  AuditLog,
  IntrusionAttempt,
  AnomalyDetection,
} from '../services/security';
import './SecurityDashboard.css';

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
          <h2>最近の監査ログ</h2>
          {recentAuditLogs.length === 0 ? (
            <div className="empty-state">監査ログが見つかりません</div>
          ) : (
            <div className="audit-logs-list">
              {recentAuditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="audit-log-item">
                  <div className="log-header">
                    <span className={`severity-badge ${getSeverityClass(log.severity)}`}>
                      {log.severity || 'N/A'}
                    </span>
                    <span className="log-time">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <div className="log-content">
                    <div className="log-event">{log.eventType || 'N/A'}</div>
                    <div className="log-endpoint">{log.endpoint}</div>
                    {log.ip && <div className="log-ip">IP: {log.ip}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
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

