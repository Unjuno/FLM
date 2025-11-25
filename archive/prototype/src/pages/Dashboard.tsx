// SPDX-License-Identifier: MIT
// Dashboard - Main dashboard page showing engine status, proxy status, and security alerts

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import {
  fetchEngineStatus,
  fetchProxyStatus,
  fetchSecurityAlerts,
  EngineStatus,
  ProxyStatus,
  SecurityAlert,
} from '../services/dashboard';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showError, showSuccess } = useNotifications();

  const [engines, setEngines] = useState<EngineStatus[]>([]);
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<boolean>(false);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [{ label: t('header.home') || 'ホーム', path: '/' }, { label: 'ダッシュボード' }],
    [t]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [enginesData, proxyData, securityData] = await Promise.all([
        fetchEngineStatus(fresh),
        fetchProxyStatus(),
        fetchSecurityAlerts(),
      ]);
      setEngines(enginesData);
      setProxyStatus(proxyData);
      setSecurityAlerts(securityData);
      setFresh(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'ダッシュボードデータの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  }, [fresh]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleRefresh = () => {
    setFresh(true);
    void loadDashboard();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'runninghealthy':
        return 'status-badge status-healthy';
      case 'runningdegraded':
        return 'status-badge status-degraded';
      case 'installedonly':
        return 'status-badge status-installed';
      case 'errornetwork':
      case 'errorapi':
        return 'status-badge status-error';
      default:
        return 'status-badge status-unknown';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'runninghealthy':
        return '正常稼働';
      case 'runningdegraded':
        return '性能低下';
      case 'installedonly':
        return 'インストール済み';
      case 'errornetwork':
        return 'ネットワークエラー';
      case 'errorapi':
        return 'APIエラー';
      default:
        return status;
    }
  };

  if (loading && engines.length === 0 && !proxyStatus && !securityAlerts) {
    return (
      <div className="dashboard">
        <Breadcrumb items={breadcrumbItems} />
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Breadcrumb items={breadcrumbItems} />
      <div className="page-header">
        <h1>ダッシュボード</h1>
        <div className="page-actions">
          <button
            className="button-secondary"
            onClick={() => navigate('/setup/wizard')}
          >
            外部公開セットアップ
          </button>
          <button className="button-primary" onClick={handleRefresh}>
            更新
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="dashboard-grid">
        {/* Engine Status */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>エンジン状態</h2>
            <button
              className="button-secondary button-small"
              onClick={() => {
                setFresh(true);
                void loadDashboard();
              }}
            >
              再検出
            </button>
          </div>
          <div className="card-content">
            {engines.length === 0 ? (
              <div className="empty-state">エンジンが見つかりません</div>
            ) : (
              <table className="engines-table">
                <thead>
                  <tr>
                    <th>エンジンID</th>
                    <th>状態</th>
                    <th>レイテンシ</th>
                    <th>機能</th>
                  </tr>
                </thead>
                <tbody>
                  {engines.map((engine) => (
                    <tr key={engine.engineId}>
                      <td>
                        <code>{engine.engineId}</code>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(engine.status)}>
                          {getStatusLabel(engine.status)}
                        </span>
                      </td>
                      <td>
                        {engine.latency !== undefined ? `${engine.latency}ms` : '-'}
                      </td>
                      <td>
                        {engine.capabilities && engine.capabilities.length > 0
                          ? engine.capabilities.join(', ')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Proxy Status */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>プロキシ状態</h2>
          </div>
          <div className="card-content">
            {!proxyStatus || !proxyStatus.running ? (
              <div className="empty-state">プロキシは停止中です</div>
            ) : (
              <div className="proxy-status">
                <div className="status-item">
                  <span className="label">モード:</span>
                  <span className="value">{proxyStatus.mode || '-'}</span>
                </div>
                <div className="status-item">
                  <span className="label">ポート:</span>
                  <span className="value">{proxyStatus.port || '-'}</span>
                </div>
                <div className="status-item">
                  <span className="label">Listenアドレス:</span>
                  <span className="value">{proxyStatus.listenAddr || '-'}</span>
                </div>
                {proxyStatus.acmeDomain && (
                  <div className="status-item">
                    <span className="label">ACMEドメイン:</span>
                    <span className="value">{proxyStatus.acmeDomain}</span>
                  </div>
                )}
                {proxyStatus.endpoints && (
                  <div className="endpoints">
                    <h3>エンドポイントURL</h3>
                    {proxyStatus.endpoints.localhost && (
                      <div className="endpoint-item">
                        <span className="endpoint-label">ローカルアクセス:</span>
                        <code className="endpoint-url">{proxyStatus.endpoints.localhost}</code>
                        <button
                          className="button-secondary button-small"
                          onClick={() => {
                            navigator.clipboard.writeText(proxyStatus.endpoints!.localhost!);
                            showSuccess('URLをクリップボードにコピーしました');
                          }}
                        >
                          コピー
                        </button>
                      </div>
                    )}
                    {proxyStatus.endpoints.localNetwork && (
                      <div className="endpoint-item">
                        <span className="endpoint-label">同一ネットワーク内:</span>
                        <code className="endpoint-url">
                          {proxyStatus.endpoints.localNetwork}
                        </code>
                        <button
                          className="button-secondary button-small"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              proxyStatus.endpoints!.localNetwork!
                            );
                            showSuccess('URLをクリップボードにコピーしました');
                          }}
                        >
                          コピー
                        </button>
                      </div>
                    )}
                    {proxyStatus.endpoints.external && (
                      <div className="endpoint-item">
                        <span className="endpoint-label">外部アクセス:</span>
                        <code className="endpoint-url">{proxyStatus.endpoints.external}</code>
                        <button
                          className="button-secondary button-small"
                          onClick={() => {
                            navigator.clipboard.writeText(proxyStatus.endpoints!.external!);
                            showSuccess('URLをクリップボードにコピーしました');
                          }}
                        >
                          コピー
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Security Alerts */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>セキュリティアラート</h2>
          </div>
          <div className="card-content">
            {!securityAlerts ? (
              <div className="empty-state">セキュリティ情報を読み込み中...</div>
            ) : (
              <div className="security-alerts">
                <div className="alert-item">
                  <span className="label">APIキー数:</span>
                  <span className="value">{securityAlerts.apiKeyCount}</span>
                </div>
                <div className="alert-item">
                  <span className="label">IPホワイトリスト:</span>
                  <span
                    className={`value ${securityAlerts.hasIpWhitelist ? 'configured' : 'not-configured'}`}
                  >
                    {securityAlerts.hasIpWhitelist ? '設定済み' : '未設定'}
                  </span>
                </div>
                <div className="alert-item">
                  <span className="label">レート制限:</span>
                  <span
                    className={`value ${securityAlerts.hasRateLimit ? 'configured' : 'not-configured'}`}
                  >
                    {securityAlerts.hasRateLimit ? '設定済み' : '未設定'}
                  </span>
                </div>
                <div className="alert-item">
                  <span className="label">CORS:</span>
                  <span
                    className={`value ${securityAlerts.hasCors ? 'configured' : 'not-configured'}`}
                  >
                    {securityAlerts.hasCors ? '設定済み' : '未設定'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

