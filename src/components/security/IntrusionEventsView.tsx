// Intrusion Events View Component

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { fetchIntrusionAttempts, IntrusionAttempt, IntrusionFilter } from '../../services/security';
import { formatDateTime } from '../../utils/formatters';
import { createErrorHandler } from '../../utils/errorHandler';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import './IntrusionEventsView.css';

export const IntrusionEventsView: React.FC = () => {
  const [attempts, setAttempts] = useState<IntrusionAttempt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [ipFilter, setIpFilter] = useState<string>('');
  const [minScoreFilter, setMinScoreFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);

  const handleLoadError = useMemo(
    () => createErrorHandler({
      defaultMessage: '侵入検知イベントの取得に失敗しました',
      showStderr: true,
    }),
    []
  );

  const loadAttempts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: IntrusionFilter = {
        ip: ipFilter.trim() || undefined,
        minScore: minScoreFilter ? (() => {
          const parsed = parseInt(minScoreFilter, 10);
          return isNaN(parsed) ? undefined : parsed;
        })() : undefined,
        limit,
        offset: (page - 1) * limit,
      };
      const data = await fetchIntrusionAttempts(filter);
      setAttempts(data);
    } catch (err) {
      const result = handleLoadError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
    } finally {
      setLoading(false);
    }
  }, [ipFilter, minScoreFilter, page, limit, handleLoadError]);

  useEffect(() => {
    void loadAttempts();
  }, [loadAttempts]);

  const handleFilterChange = () => {
    setPage(1);
    void loadAttempts();
  };

  const handleClearFilters = () => {
    setIpFilter('');
    setMinScoreFilter('');
    setPage(1);
  };

  const getScoreClass = (score: number) => {
    if (score >= 100) return 'score-critical';
    if (score >= 50) return 'score-high';
    if (score >= 20) return 'score-medium';
    return 'score-low';
  };

  const exportToCSV = () => {
    const headers = ['ID', 'IP', 'Pattern', 'Score', 'Request Path', 'Method', 'User Agent', 'Created At'];
    const rows = attempts.map(attempt => [
      attempt.id,
      attempt.ip,
      attempt.pattern,
      attempt.score.toString(),
      attempt.requestPath || '',
      attempt.method || '',
      attempt.userAgent || '',
      attempt.createdAt,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `intrusion-events-${new Date().toISOString()}.csv`;
    link.click();
    // why: メモリリークを防ぐため、URLオブジェクトを解放する
    // alt: URL.revokeObjectURLを呼び出さない（メモリリークの可能性）
    // evidence: URL.createObjectURLのベストプラクティス
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(attempts, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `intrusion-events-${new Date().toISOString()}.json`;
    link.click();
    // why: メモリリークを防ぐため、URLオブジェクトを解放する
    // alt: URL.revokeObjectURLを呼び出さない（メモリリークの可能性）
    // evidence: URL.createObjectURLのベストプラクティス
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  if (loading && attempts.length === 0) {
    return <LoadingSpinner size="medium" message="読み込み中..." />;
  }

  return (
    <div className="intrusion-events-view">
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
          <label htmlFor="min-score-filter">最小スコア:</label>
          <input
            id="min-score-filter"
            type="number"
            className="form-input"
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(e.target.value)}
            placeholder="例: 50"
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
        <button className="button-primary" onClick={loadAttempts}>
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

      <div className="intrusion-events-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>IPアドレス</th>
              <th>パターン</th>
              <th>スコア</th>
              <th>リクエストパス</th>
              <th>メソッド</th>
              <th>User Agent</th>
              <th>作成日時</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt) => (
              <tr key={attempt.id}>
                <td>{attempt.id}</td>
                <td>{attempt.ip}</td>
                <td>{attempt.pattern}</td>
                <td className={getScoreClass(attempt.score)}>
                  {attempt.score}
                </td>
                <td>{attempt.requestPath || '-'}</td>
                <td>{attempt.method || '-'}</td>
                <td>{attempt.userAgent || '-'}</td>
                <td>{formatDateTime(attempt.createdAt)}</td>
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
          disabled={attempts.length < limit}
        >
          次へ
        </button>
      </div>
    </div>
  );
};

