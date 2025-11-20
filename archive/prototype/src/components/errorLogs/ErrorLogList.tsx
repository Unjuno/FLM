// ErrorLogList - エラーログ一覧コンポーネント

import React from 'react';
import { formatDateTime } from '../../utils/formatters';
import { SkeletonLoader } from '../common/SkeletonLoader';
import type { ErrorLogInfo } from './ErrorLogStatistics';
import './ErrorLogList.css';

/**
 * ErrorLogListのプロパティ
 */
interface ErrorLogListProps {
  errorLogs: ErrorLogInfo[];
  loading: boolean;
}

/**
 * エラーログ一覧コンポーネント
 */
export const ErrorLogList: React.FC<ErrorLogListProps> = ({
  errorLogs,
  loading,
}) => {
  if (loading) {
    return <SkeletonLoader count={5} />;
  }

  if (errorLogs.length === 0) {
    return (
      <div className="empty-state">
        <p>エラーログがありません</p>
      </div>
    );
  }

  return (
    <div className="error-logs-list">
      {errorLogs.map(log => (
        <div key={log.id} className="error-log-card">
          <div className="error-log-header">
            <span className={`error-category category-${log.error_category}`}>
              {log.error_category}
            </span>
            <span className="error-date">{formatDateTime(log.created_at)}</span>
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
  );
};
