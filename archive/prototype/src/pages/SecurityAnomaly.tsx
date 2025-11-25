// SPDX-License-Identifier: MIT
// SecurityAnomaly - 異常検知イベント表示ページ

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import { formatDateTime } from '../utils/formatters';
import {
  fetchAnomalyDetections,
  AnomalyDetection,
  AnomalyFilter,
} from '../services/security';
import './SecurityAnomaly.css';

export const SecurityAnomaly: React.FC = () => {
  const { t } = useI18n();
  const { showError } = useNotifications();

  const [detections, setDetections] = useState<AnomalyDetection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [ipFilter, setIpFilter] = useState<string>('');
  const [anomalyTypeFilter, setAnomalyTypeFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'セキュリティ', path: '/security' },
      { label: '異常検知' },
    ],
    [t]
  );

  const loadDetections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: AnomalyFilter = {
        ip: ipFilter.trim() || undefined,
        anomalyType: anomalyTypeFilter.trim() || undefined,
        limit,
        offset: (page - 1) * limit,
      };
      const data = await fetchAnomalyDetections(filter);
      setDetections(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '異常検知イベントの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  }, [ipFilter, anomalyTypeFilter, page, limit]);

  useEffect(() => {
    void loadDetections();
  }, [loadDetections]);

  const handleFilterChange = () => {
    setPage(1);
    void loadDetections();
  };

  const handleClearFilters = () => {
    setIpFilter('');
    setAnomalyTypeFilter('');
    setPage(1);
  };

  const getScoreClass = (score: number) => {
    if (score >= 200) return 'score-critical';
    if (score >= 100) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  };

  const getAnomalyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      high_request_rate_1s: '高リクエストレート (1秒)',
      high_request_rate_1m: '高リクエストレート (1分)',
      large_request_body: '大きなリクエストボディ',
      long_request_duration: '長時間リクエスト',
      non_existent_endpoint_access: '存在しないエンドポイントアクセス',
      repeated_request_pattern: '繰り返しリクエストパターン',
    };
    return labels[type] || type;
  };

  if (loading && detections.length === 0) {
    return (
      <div className="security-anomaly">
        <Breadcrumb items={breadcrumbItems} />
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="security-anomaly">
      <Breadcrumb items={breadcrumbItems} />
      <div className="page-header">
        <h1>異常検知イベント</h1>
        <div className="page-actions">
          <button className="button-primary" onClick={loadDetections}>
            更新
          </button>
        </div>
      </div>

      <div className="filters">
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
        <div className="filter-group">
          <label htmlFor="anomaly-type-filter">異常タイプ:</label>
          <input
            id="anomaly-type-filter"
            type="text"
            className="form-input"
            value={anomalyTypeFilter}
            onChange={(e) => setAnomalyTypeFilter(e.target.value)}
            placeholder="例: high_request_rate_1s"
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

      {detections.length === 0 ? (
        <div className="empty-state">
          <p>異常検知イベントが見つかりません</p>
        </div>
      ) : (
        <>
          <div className="anomaly-table">
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>IPアドレス</th>
                  <th>異常タイプ</th>
                  <th>スコア</th>
                  <th>詳細</th>
                </tr>
              </thead>
              <tbody>
                {detections.map((detection) => (
                  <tr key={detection.id}>
                    <td>{formatDateTime(detection.createdAt)}</td>
                    <td>
                      <code>{detection.ip}</code>
                    </td>
                    <td>
                      <span className="anomaly-type-badge">
                        {getAnomalyTypeLabel(detection.anomalyType)}
                      </span>
                    </td>
                    <td>
                      <span className={`score-badge ${getScoreClass(detection.score)}`}>
                        {detection.score}
                      </span>
                    </td>
                    <td>
                      {detection.details && (
                        <details>
                          <summary>詳細</summary>
                          <pre>{detection.details}</pre>
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
              ページ {page} (表示: {detections.length}件)
            </span>
            <button
              className="button-secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={detections.length < limit}
            >
              次へ
            </button>
          </div>
        </>
      )}
    </div>
  );
};

