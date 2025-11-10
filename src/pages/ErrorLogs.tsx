// ErrorLogs - エラーログ一覧ページ

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { safeInvoke } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useI18n } from '../contexts/I18nContext';
import { extractErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import './ErrorLogs.css';

/**
 * エラーログ情報
 */
interface ErrorLogInfo {
  id: string;
  error_category: string;
  error_message: string;
  error_stack?: string | null;
  context?: string | null;
  source?: string | null;
  api_id?: string | null;
  user_agent?: string | null;
  created_at: string;
}

/**
 * エラーログ一覧ページ
 */
export const ErrorLogs: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [errorLogs, setErrorLogs] = useState<ErrorLogInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({
    error_category: '',
    api_id: '',
    start_date: '',
    end_date: '',
  });

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: 'エラーログ' },
  ], [t]);

  // エラーログ一覧を取得
  const loadErrorLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await safeInvoke<ErrorLogInfo[]>('list_error_logs', {
        error_category: filters.error_category || null,
        api_id: filters.api_id || null,
        limit: 1000, // 最大1000件
        offset: 0,
        start_date: filters.start_date || null,
        end_date: filters.end_date || null,
      });

      setErrorLogs(result);
    } catch (err) {
      const errorMessage = extractErrorMessage(err, 'エラーログの取得に失敗しました');
      setError(errorMessage);
      logger.error('エラーログの取得エラー', err, 'ErrorLogs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 初回読み込み
  useEffect(() => {
    loadErrorLogs();
  }, [loadErrorLogs]);

  // エラーログをエクスポート
  const handleExport = useCallback(async (format: 'csv' | 'json' | 'txt') => {
    try {
      setExporting(true);
      setError(null);

      const filePath = await safeInvoke<string>('export_error_logs', {
        format,
        error_category: filters.error_category || null,
        api_id: filters.api_id || null,
        start_date: filters.start_date || null,
        end_date: filters.end_date || null,
      });

      logger.info(`エラーログをエクスポートしました: ${filePath}`, '', 'ErrorLogs');
      
      // ファイルパスをクリップボードにコピー
      await navigator.clipboard.writeText(filePath);
      alert(`エラーログをエクスポートしました。\nファイルパス: ${filePath}\n\n（ファイルパスをクリップボードにコピーしました）`);
    } catch (err) {
      const errorMessage = extractErrorMessage(err, 'エラーログのエクスポートに失敗しました');
      setError(errorMessage);
      logger.error('エラーログのエクスポートエラー', err, 'ErrorLogs');
    } finally {
      setExporting(false);
    }
  }, [filters]);

  // カテゴリ別の統計
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    errorLogs.forEach(log => {
      stats[log.error_category] = (stats[log.error_category] || 0) + 1;
    });
    return stats;
  }, [errorLogs]);

  // 日付をフォーマット
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ja-JP');
    } catch {
      return dateString;
    }
  };

  return (
    <AppLayout>
      <div className="error-logs-page">
        <div className="page-container error-logs-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header error-logs-header">
            <button className="back-button" onClick={() => navigate('/settings')}>
              ← 設定に戻る
            </button>
            <h1>エラーログ</h1>
            <div className="header-actions">
              <button
                className="export-button"
                onClick={() => handleExport('csv')}
                disabled={exporting || errorLogs.length === 0}
              >
                {exporting ? 'エクスポート中...' : 'CSVエクスポート'}
              </button>
              <button
                className="export-button"
                onClick={() => handleExport('json')}
                disabled={exporting || errorLogs.length === 0}
              >
                {exporting ? 'エクスポート中...' : 'JSONエクスポート'}
              </button>
              <button
                className="export-button"
                onClick={() => handleExport('txt')}
                disabled={exporting || errorLogs.length === 0}
              >
                {exporting ? 'エクスポート中...' : 'TXTエクスポート'}
              </button>
              <button className="refresh-button" onClick={loadErrorLogs}>
                更新
              </button>
            </div>
          </header>

          {error && (
            <ErrorMessage
              message={error}
              type="general"
              onClose={() => setError(null)}
            />
          )}

          {/* 統計情報 */}
          {Object.keys(categoryStats).length > 0 && (
            <section className="stats-section">
              <h2>エラー統計</h2>
              <div className="stats-grid">
                {Object.entries(categoryStats).map(([category, count]) => (
                  <div key={category} className="stat-card">
                    <span className="stat-label">{category}</span>
                    <span className="stat-value">{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* フィルター */}
          <section className="filters-section">
            <h2>フィルター</h2>
            <div className="filters-grid">
              <div className="filter-group">
                <label htmlFor="error-category">カテゴリ</label>
                <select
                  id="error-category"
                  value={filters.error_category}
                  onChange={e => setFilters({ ...filters, error_category: e.target.value })}
                >
                  <option value="">すべて</option>
                  <option value="general">一般</option>
                  <option value="api">API</option>
                  <option value="database">データベース</option>
                  <option value="network">ネットワーク</option>
                  <option value="ollama">Ollama</option>
                  <option value="model">モデル</option>
                  <option value="permission">権限</option>
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="start-date">開始日</label>
                <input
                  id="start-date"
                  type="date"
                  value={filters.start_date}
                  onChange={e => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label htmlFor="end-date">終了日</label>
                <input
                  id="end-date"
                  type="date"
                  value={filters.end_date}
                  onChange={e => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <button className="apply-filters-button" onClick={loadErrorLogs}>
                  フィルター適用
                </button>
                <button
                  className="clear-filters-button"
                  onClick={() => {
                    setFilters({
                      error_category: '',
                      api_id: '',
                      start_date: '',
                      end_date: '',
                    });
                  }}
                >
                  クリア
                </button>
              </div>
            </div>
          </section>

          {/* エラーログ一覧 */}
          <section className="logs-section">
            <h2>エラーログ一覧 ({errorLogs.length}件)</h2>
            {loading ? (
              <SkeletonLoader count={5} />
            ) : errorLogs.length === 0 ? (
              <div className="empty-state">
                <p>エラーログがありません</p>
              </div>
            ) : (
              <div className="error-logs-list">
                {errorLogs.map(log => (
                  <div key={log.id} className="error-log-card">
                    <div className="error-log-header">
                      <span className={`error-category category-${log.error_category}`}>
                        {log.error_category}
                      </span>
                      <span className="error-date">{formatDate(log.created_at)}</span>
                    </div>
                    <div className="error-message">{log.error_message}</div>
                    {log.error_stack && (
                      <details className="error-stack">
                        <summary>スタックトレース</summary>
                        <pre>{log.error_stack}</pre>
                      </details>
                    )}
                    {log.context && (
                      <div className="error-context">
                        <strong>コンテキスト:</strong> {log.context}
                      </div>
                    )}
                    {log.source && (
                      <div className="error-source">
                        <strong>ソース:</strong> {log.source}
                      </div>
                    )}
                    {log.api_id && (
                      <div className="error-api-id">
                        <strong>API ID:</strong> {log.api_id}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
};

