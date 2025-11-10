// AuditLogs - 監査ログ表示ページ
// すべてのAPI操作の記録を表示

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { safeInvoke } from '../utils/tauri';
// import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import { AuditLogExport } from '../components/api/AuditLogExport';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import './AuditLogs.css';

/**
 * 監査ログエントリ
 */
interface AuditLogEntry {
  id: string;
  api_id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  timestamp: string;
}

/**
 * 監査ログ表示ページ
 */
export const AuditLogs: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  // const { showError } = useNotifications();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterSuccess, setFilterSuccess] = useState<string>('all');

  // 仮想スクロール用のref
  const parentRef = useRef<HTMLDivElement>(null);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: 'APIログ', path: '/logs' },
    { label: '監査ログ' },
  ], [t]);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAction, filterSuccess]);

  /**
   * ログ一覧を読み込む
   */
  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      // 監査ログを取得
      const request = {
        api_id: null,
        action: filterAction || null,
        resource_type: null,
        start_date: null,
        end_date: null,
        limit: 100,
      };
      const logsData = await safeInvoke<AuditLogEntry[]>('search_audit_logs', {
        request,
      });
      setLogs(logsData);
    } catch (err) {
      setError(
        extractErrorMessage(err, 'ログの読み込みに失敗しました')
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * アクション名の表示名を取得
   */
  const getActionName = (action: string): string => {
    const names: { [key: string]: string } = {
      create: '作成',
      read: '読み取り',
      update: '更新',
      delete: '削除',
      start: '起動',
      stop: '停止',
      login: 'ログイン',
      logout: 'ログアウト',
      share: '共有',
      unshare: '共有解除',
    };
    return names[action] || action;
  };

  /**
   * フィルタリングされたログを取得
   */
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterAction && log.action !== filterAction) {
        return false;
      }
      if (filterSuccess === 'success' && !log.success) {
        return false;
      }
      if (filterSuccess === 'failure' && log.success) {
        return false;
      }
      return true;
    });
  }, [logs, filterAction, filterSuccess]);

  // 仮想スクロールの設定（100件以上の場合に有効化）
  const shouldUseVirtualScroll = filteredLogs.length >= 100;
  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // 行の高さの推定値（px）
    overscan: 5, // 表示領域外のレンダリング数
    enabled: shouldUseVirtualScroll,
  });

  if (loading) {
    return (
      <div className="audit-logs-page">
        <div className="audit-logs-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="audit-logs-header">
            <button className="back-button" onClick={() => navigate('/logs')}>
              ← 戻る
            </button>
            <h1>監査ログ</h1>
          </header>
          <div className="audit-logs-content">
            <SkeletonLoader type="title" width="200px" />
            <SkeletonLoader type="paragraph" count={2} />
            <div className="margin-top-md">
              <SkeletonLoader type="form" count={2} />
            </div>
            <div className="margin-top-xl">
              <SkeletonLoader type="list" count={5} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-logs-page">
      <div className="audit-logs-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="audit-logs-header">
          <button className="back-button" onClick={() => navigate('/logs')}>
            ← 戻る
          </button>
          <h1>監査ログ</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="audit-logs-content">
          <div className="audit-logs-info-banner">
            <h2>監査ログ機能</h2>
            <p>
              すべてのAPI操作の記録を表示できます。セキュリティ監査やトラブルシューティングに役立ちます。
            </p>
            <ul className="audit-logs-features-list">
              <li>すべてのAPI操作の記録（作成、更新、削除、起動、停止等）</li>
              <li>アクセス履歴の保存・検索</li>
              <li>セキュリティイベントの記録</li>
              <li>IPアドレス・ユーザーエージェント情報</li>
            </ul>
          </div>

          <div className="audit-logs-filters">
            <div className="filter-group">
              <label className="form-label" htmlFor="filter-action">
                アクション
              </label>
              <select
                id="filter-action"
                className="form-select"
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
              >
                <option value="">すべて</option>
                <option value="create">作成</option>
                <option value="update">更新</option>
                <option value="delete">削除</option>
                <option value="start">起動</option>
                <option value="stop">停止</option>
                <option value="share">共有</option>
                <option value="unshare">共有解除</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="form-label" htmlFor="filter-success">
                ステータス
              </label>
              <select
                id="filter-success"
                className="form-select"
                value={filterSuccess}
                onChange={e => setFilterSuccess(e.target.value)}
              >
                <option value="all">すべて</option>
                <option value="success">成功</option>
                <option value="failure">失敗</option>
              </select>
            </div>
          </div>

          {/* 監査ログエクスポート */}
          <div className="audit-logs-export-section">
            <AuditLogExport
              onExportComplete={count => {
                logger.info(
                  `監査ログのエクスポートが完了しました: ${count}件`,
                  'AuditLogs'
                );
              }}
            />
          </div>

          {filteredLogs.length === 0 ? (
            <div className="audit-logs-empty">
              <p>ログがありません</p>
              <p className="audit-logs-empty-hint">監査ログを表示します。</p>
            </div>
          ) : (
            <div className="audit-logs-list">
              {filteredLogs.map(log => (
                <div
                  key={log.id}
                  className={`audit-log-item ${log.success ? 'success' : 'failure'}`}
                >
                  <div className="audit-log-header">
                    <div className="audit-log-action">
                      <span
                        className={`audit-log-action-badge ${log.success ? 'success' : 'failure'}`}
                      >
                        {getActionName(log.action)}
                      </span>
                      <span className="audit-log-resource">
                        {log.resource_type}{' '}
                        {log.resource_id ? `(${log.resource_id})` : ''}
                      </span>
                    </div>
                    <span className="audit-log-timestamp">
                      {new Date(log.timestamp).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <div className="audit-log-details">
                    {log.details && (
                      <p className="audit-log-detail-text">{log.details}</p>
                    )}
                    <div className="audit-log-meta">
                      {log.ip_address && (
                        <span className="audit-log-meta-item">
                          IP: {log.ip_address}
                        </span>
                      )}
                      {log.user_id && (
                        <span className="audit-log-meta-item">
                          ユーザー: {log.user_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
