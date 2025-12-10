// Model Comparison page

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import {
  fetchEngineHealthHistory,
  EngineHealthLog,
} from '../services/engineHealth';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { formatDateTime } from '../utils/formatters';
import './ModelComparison.css';

type TimeRange = '24h' | '7d' | '30d';

export const ModelComparison: React.FC = () => {
  const { t } = useI18n();
  const [logs, setLogs] = useState<EngineHealthLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [engineFilter, setEngineFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');

  const hoursMap = useMemo<Record<TimeRange, number>>(() => ({
    '24h': 24,
    '7d': 168,
    '30d': 720,
  }), []);

  const loadHealthHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEngineHealthHistory({
        engine: engineFilter.trim() || undefined,
        model: modelFilter.trim() || undefined,
        hours: hoursMap[timeRange],
        limit: 1000,
      });
      setLogs(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('modelComparison.fetchError') || 'Failed to fetch health history'
      );
    } finally {
      setLoading(false);
    }
  }, [engineFilter, modelFilter, timeRange, t, hoursMap]);

  useEffect(() => {
    void loadHealthHistory();
  }, [loadHealthHistory]);

  // Calculate summary statistics
  const summary = React.useMemo(() => {
    if (logs.length === 0) {
      return null;
    }

    const healthy = logs.filter((log) => log.status === 'healthy').length;
    const degraded = logs.filter((log) => log.status === 'degraded').length;
    const unreachable = logs.filter((log) => log.status === 'unreachable').length;
    const total = logs.length;
    const successRate = total > 0 ? (healthy / total) * 100 : 0;

    const latencies = logs
      .map((log) => log.latency_ms)
      .filter((latency): latency is number => latency !== null);
    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
        : null;

    const avgErrorRate =
      logs.reduce((sum, log) => sum + log.error_rate, 0) / logs.length;

    return {
      total,
      healthy,
      degraded,
      unreachable,
      successRate,
      avgLatency,
      avgErrorRate,
    };
  }, [logs]);

  // Group logs by engine
  const logsByEngine = React.useMemo(() => {
    const grouped: Record<string, EngineHealthLog[]> = {};
    for (const log of logs) {
      if (!grouped[log.engine_id]) {
        grouped[log.engine_id] = [];
      }
      grouped[log.engine_id].push(log);
    }
    return grouped;
  }, [logs]);

  // Group logs by model
  const logsByModel = React.useMemo(() => {
    const grouped: Record<string, EngineHealthLog[]> = {};
    for (const log of logs) {
      if (!log.model_id) continue;
      if (!grouped[log.model_id]) {
        grouped[log.model_id] = [];
      }
      grouped[log.model_id].push(log);
    }
    return grouped;
  }, [logs]);

  return (
    <div className="model-comparison-page">
      <h1>{t('modelComparison.title') || 'Model Comparison & Health History'}</h1>
      <p className="page-description">
        {t('modelComparison.description') ||
          'View engine health history and compare model performance over time.'}
      </p>

      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      <div className="model-comparison-content">
        <div className="model-comparison-filters">
          <div className="filter-group">
            <label htmlFor="time-range">
              {t('modelComparison.timeRange') || 'Time Range'}
            </label>
            <select
              id="time-range"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              disabled={loading}
            >
              <option value="24h">
                {t('modelComparison.last24Hours') || 'Last 24 Hours'}
              </option>
              <option value="7d">
                {t('modelComparison.last7Days') || 'Last 7 Days'}
              </option>
              <option value="30d">
                {t('modelComparison.last30Days') || 'Last 30 Days'}
              </option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="engine-filter">
              {t('modelComparison.filterByEngine') || 'Filter by Engine'}
            </label>
            <input
              id="engine-filter"
              type="text"
              value={engineFilter}
              onChange={(e) => setEngineFilter(e.target.value)}
              placeholder={t('modelComparison.enginePlaceholder') || 'e.g., ollama'}
              disabled={loading}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="model-filter">
              {t('modelComparison.filterByModel') || 'Filter by Model'}
            </label>
            <input
              id="model-filter"
              type="text"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder={t('modelComparison.modelPlaceholder') || 'e.g., llama3'}
              disabled={loading}
            />
          </div>
          <button
            className="btn-primary"
            onClick={loadHealthHistory}
            disabled={loading}
          >
            {t('common.refresh') || 'Refresh'}
          </button>
        </div>

        {loading ? (
          <LoadingSpinner message={t('common.loading') || 'Loading...'} />
        ) : summary ? (
          <>
            <div className="summary-cards">
              <div className="summary-card">
                <h3>{t('modelComparison.totalChecks') || 'Total Checks'}</h3>
                <p className="summary-value">{summary.total}</p>
              </div>
              <div className="summary-card">
                <h3>{t('modelComparison.successRate') || 'Success Rate'}</h3>
                <p className="summary-value">{summary.successRate.toFixed(1)}%</p>
              </div>
              <div className="summary-card">
                <h3>{t('modelComparison.avgLatency') || 'Avg Latency'}</h3>
                <p className="summary-value">
                  {summary.avgLatency
                    ? `${summary.avgLatency.toFixed(0)}ms`
                    : t('modelComparison.nA') || 'N/A'}
                </p>
              </div>
              <div className="summary-card">
                <h3>{t('modelComparison.avgErrorRate') || 'Avg Error Rate'}</h3>
                <p className="summary-value">
                  {(summary.avgErrorRate * 100).toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="status-breakdown">
              <h2>{t('modelComparison.statusBreakdown') || 'Status Breakdown'}</h2>
              <div className="status-cards">
                <div className="status-card healthy">
                  <h4>{t('modelComparison.healthy') || 'Healthy'}</h4>
                  <p>{summary.healthy}</p>
                </div>
                <div className="status-card degraded">
                  <h4>{t('modelComparison.degraded') || 'Degraded'}</h4>
                  <p>{summary.degraded}</p>
                </div>
                <div className="status-card unreachable">
                  <h4>{t('modelComparison.unreachable') || 'Unreachable'}</h4>
                  <p>{summary.unreachable}</p>
                </div>
              </div>
            </div>

            <div className="engine-summary">
              <h2>{t('modelComparison.engineSummary') || 'Engine Summary'}</h2>
              <div className="summary-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t('modelComparison.engine') || 'Engine'}</th>
                      <th>{t('modelComparison.totalChecks') || 'Total Checks'}</th>
                      <th>{t('modelComparison.healthy') || 'Healthy'}</th>
                      <th>{t('modelComparison.degraded') || 'Degraded'}</th>
                      <th>{t('modelComparison.unreachable') || 'Unreachable'}</th>
                      <th>{t('modelComparison.avgLatency') || 'Avg Latency'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(logsByEngine).map(([engineId, engineLogs]) => {
                      const engineHealthy = engineLogs.filter(
                        (log) => log.status === 'healthy'
                      ).length;
                      const engineDegraded = engineLogs.filter(
                        (log) => log.status === 'degraded'
                      ).length;
                      const engineUnreachable = engineLogs.filter(
                        (log) => log.status === 'unreachable'
                      ).length;
                      const engineLatencies = engineLogs
                        .map((log) => log.latency_ms)
                        .filter((latency): latency is number => latency !== null);
                      const engineAvgLatency =
                        engineLatencies.length > 0
                          ? engineLatencies.reduce((sum, lat) => sum + lat, 0) /
                            engineLatencies.length
                          : null;

                      return (
                        <tr key={engineId}>
                          <td>{engineId}</td>
                          <td>{engineLogs.length}</td>
                          <td>{engineHealthy}</td>
                          <td>{engineDegraded}</td>
                          <td>{engineUnreachable}</td>
                          <td>
                            {engineAvgLatency
                              ? `${engineAvgLatency.toFixed(0)}ms`
                              : t('modelComparison.nA') || 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="model-summary">
              <h2>{t('modelComparison.modelSummary') || 'Model Summary'}</h2>
              {Object.keys(logsByModel).length > 0 ? (
                <div className="summary-table">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('modelComparison.model') || 'Model'}</th>
                        <th>{t('modelComparison.totalChecks') || 'Total Checks'}</th>
                        <th>{t('modelComparison.healthy') || 'Healthy'}</th>
                        <th>{t('modelComparison.degraded') || 'Degraded'}</th>
                        <th>{t('modelComparison.unreachable') || 'Unreachable'}</th>
                        <th>{t('modelComparison.avgLatency') || 'Avg Latency'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(logsByModel).map(([modelId, modelLogs]) => {
                        const modelHealthy = modelLogs.filter(
                          (log) => log.status === 'healthy'
                        ).length;
                        const modelDegraded = modelLogs.filter(
                          (log) => log.status === 'degraded'
                        ).length;
                        const modelUnreachable = modelLogs.filter(
                          (log) => log.status === 'unreachable'
                        ).length;
                        const modelLatencies = modelLogs
                          .map((log) => log.latency_ms)
                          .filter((latency): latency is number => latency !== null);
                        const modelAvgLatency =
                          modelLatencies.length > 0
                            ? modelLatencies.reduce((sum, lat) => sum + lat, 0) /
                              modelLatencies.length
                            : null;

                        return (
                          <tr key={modelId}>
                            <td>{modelId}</td>
                            <td>{modelLogs.length}</td>
                            <td>{modelHealthy}</td>
                            <td>{modelDegraded}</td>
                            <td>{modelUnreachable}</td>
                            <td>
                              {modelAvgLatency
                                ? `${modelAvgLatency.toFixed(0)}ms`
                                : t('modelComparison.nA') || 'N/A'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-message">
                  {t('modelComparison.noModelData') ||
                    'No model-specific data available'}
                </p>
              )}
            </div>

            <div className="recent-logs">
              <h2>{t('modelComparison.recentLogs') || 'Recent Logs'}</h2>
              <div className="logs-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t('modelComparison.timestamp') || 'Timestamp'}</th>
                      <th>{t('modelComparison.engine') || 'Engine'}</th>
                      <th>{t('modelComparison.model') || 'Model'}</th>
                      <th>{t('modelComparison.status') || 'Status'}</th>
                      <th>{t('modelComparison.latency') || 'Latency'}</th>
                      <th>{t('modelComparison.errorRate') || 'Error Rate'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 50).map((log) => (
                      <tr key={log.id}>
                        <td>{formatDateTime(log.created_at)}</td>
                        <td>{log.engine_id}</td>
                        <td>{log.model_id || '-'}</td>
                        <td>
                          <span className={`status-badge status-${log.status}`}>
                            {log.status}
                          </span>
                        </td>
                        <td>
                          {log.latency_ms
                            ? `${log.latency_ms}ms`
                            : t('modelComparison.nA') || 'N/A'}
                        </td>
                        <td>{(log.error_rate * 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <p className="empty-message">
            {t('modelComparison.noData') || 'No health history data available'}
          </p>
        )}
      </div>
    </div>
  );
};

