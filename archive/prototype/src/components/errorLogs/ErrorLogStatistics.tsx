// ErrorLogStatistics - エラーログ統計コンポーネント

import React, { useMemo } from 'react';
import './ErrorLogStatistics.css';

/**
 * エラーログ情報
 */
export interface ErrorLogInfo {
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
 * ErrorLogStatisticsのプロパティ
 */
interface ErrorLogStatisticsProps {
  errorLogs: ErrorLogInfo[];
}

/**
 * エラーログ統計コンポーネント
 */
export const ErrorLogStatistics: React.FC<ErrorLogStatisticsProps> = ({
  errorLogs,
}) => {
  // カテゴリ別の統計
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    errorLogs.forEach((log: ErrorLogInfo) => {
      stats[log.error_category] = (stats[log.error_category] || 0) + 1;
    });
    return stats;
  }, [errorLogs]);

  if (Object.keys(categoryStats).length === 0) {
    return null;
  }

  return (
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
  );
};
