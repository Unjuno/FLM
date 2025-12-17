// Anomaly Events View Component

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  fetchAnomalyDetections,
  AnomalyDetection,
  AnomalyFilter,
} from '../../services/security';
import { formatDateTime } from '../../utils/formatters';
import { createErrorHandler } from '../../utils/errorHandler';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import './AnomalyEventsView.css';

export const AnomalyEventsView: React.FC = () => {
  const [detections, setDetections] = useState<AnomalyDetection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [ipFilter, setIpFilter] = useState<string>('');
  const [anomalyTypeFilter, setAnomalyTypeFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);

  const handleLoadError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: '異常検知イベントの取得に失敗しました',
        showStderr: true,
      }),
    []
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
      const result = handleLoadError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
    } finally {
      setLoading(false);
    }
  }, [ipFilter, anomalyTypeFilter, page, limit, handleLoadError]);

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

  const exportToCSV = () => {
    const headers = [
      'ID',
      'IP',
      'Anomaly Type',
      'Score',
      'Details',
      'Created At',
    ];
    const rows = detections.map(detection => [
      detection.id,
      detection.ip,
      detection.anomalyType,
      detection.score.toString(),
      detection.details || '',
      detection.createdAt,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `anomaly-events-${new Date().toISOString()}.csv`;
    link.click();
    // why: メモリリークを防ぐため、URLオブジェクトを解放する
    // alt: URL.revokeObjectURLを呼び出さない（メモリリークの可能性）
    // evidence: URL.createObjectURLのベストプラクティス
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(detections, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `anomaly-events-${new Date().toISOString()}.json`;
    link.click();
    // why: メモリリークを防ぐため、URLオブジェクトを解放する
    // alt: URL.revokeObjectURLを呼び出さない（メモリリークの可能性）
    // evidence: URL.createObjectURLのベストプラクティス
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  if (loading && detections.length === 0) {
    return <LoadingSpinner size="medium" message="読み込み中..." />;
  }

  return (
    <div className="anomaly-events-view">
      <div className="filters">
        <div className="filter-group">
          <label htmlFor="ip-filter">IPアドレス:</label>
          <input
            id="ip-filter"
            type="text"
            className="form-input"
            value={ipFilter}
            onChange={e => setIpFilter(e.target.value)}
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
            onChange={e => setAnomalyTypeFilter(e.target.value)}
            placeholder="例: high_request_rate_1s"
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
        <button className="button-primary" onClick={loadDetections}>
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
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      <div className="anomaly-events-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>IPアドレス</th>
              <th>異常タイプ</th>
              <th>スコア</th>
              <th>詳細</th>
              <th>作成日時</th>
            </tr>
          </thead>
          <tbody>
            {detections.map(detection => (
              <tr key={detection.id}>
                <td>{detection.id}</td>
                <td>{detection.ip}</td>
                <td>{getAnomalyTypeLabel(detection.anomalyType)}</td>
                <td className={getScoreClass(detection.score)}>
                  {detection.score}
                </td>
                <td>{detection.details || '-'}</td>
                <td>{formatDateTime(detection.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="button-secondary"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          前へ
        </button>
        <span>ページ {page}</span>
        <button
          className="button-secondary"
          onClick={() => setPage(p => p + 1)}
          disabled={detections.length < limit}
        >
          次へ
        </button>
      </div>
    </div>
  );
};
