// SPDX-License-Identifier: MIT
// SecurityIntrusion - 侵入検知イベント表示ページ

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import { formatDateTime } from '../utils/formatters';
import {
  fetchIntrusionAttempts,
  IntrusionAttempt,
  IntrusionFilter,
} from '../services/security';
import './SecurityIntrusion.css';

export const SecurityIntrusion: React.FC = () => {
  const { t } = useI18n();
  const { showError } = useNotifications();

  const [attempts, setAttempts] = useState<IntrusionAttempt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [ipFilter, setIpFilter] = useState<string>('');
  const [minScoreFilter, setMinScoreFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'セキュリティ', path: '/security' },
      { label: '侵入検知' },
    ],
    [t]
  );

  const loadAttempts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: IntrusionFilter = {
        ip: ipFilter.trim() || undefined,
        minScore: minScoreFilter ? parseInt(minScoreFilter, 10) : undefined,
        limit,
        offset: (page - 1) * limit,
      };
      const data = await fetchIntrusionAttempts(filter);
      setAttempts(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '侵入検知イベントの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  }, [ipFilter, minScoreFilter, page, limit]);

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

  if (loading && attempts.length === 0) {
    return (
      <div className="security-intrusion">
        <Breadcrumb items={breadcrumbItems} />
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="security-intrusion">
      <Breadcrumb items={breadcrumbItems} />
      <div className="page-header">
        <h1>侵入検知イベント</h1>
        <div className="page-actions">
          <button className="button-primary" onClick={loadAttempts}>
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
          <label htmlFor="min-score-filter">最小スコア:</label>
          <input
            id="min-score-filter"
            type="number"
            className="form-input"
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(e.target.value)}
            placeholder="例: 50"
            min="0"
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

      {attempts.length === 0 ? (
        <div className="empty-state">
          <p>侵入検知イベントが見つかりません</p>
        </div>
      ) : (
        <>
          <div className="intrusion-table">
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>IPアドレス</th>
                  <th>パターン</th>
                  <th>スコア</th>
                  <th>リクエストパス</th>
                  <th>HTTPメソッド</th>
                  <th>User-Agent</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{formatDateTime(attempt.createdAt)}</td>
                    <td>
                      <code>{attempt.ip}</code>
                    </td>
                    <td>
                      <span className="pattern-badge">{attempt.pattern}</span>
                    </td>
                    <td>
                      <span className={`score-badge ${getScoreClass(attempt.score)}`}>
                        {attempt.score}
                      </span>
                    </td>
                    <td>{attempt.requestPath || '-'}</td>
                    <td>{attempt.method || '-'}</td>
                    <td className="user-agent-cell">
                      {attempt.userAgent || '-'}
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
              ページ {page} (表示: {attempts.length}件)
            </span>
            <button
              className="button-secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={attempts.length < limit}
            >
              次へ
            </button>
          </div>
        </>
      )}
    </div>
  );
};

