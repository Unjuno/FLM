// PerformanceSummary - パフォーマンス統計サマリーコンポーネント

import React, { useState, useEffect, useCallback } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { REFRESH_INTERVALS, FORMATTING, UI_WARNING_THRESHOLDS } from '../../constants/config';
import './PerformanceSummary.css';

/**
 * パフォーマンスサマリー情報
 */
interface PerformanceSummary {
  avg_response_time: number;
  max_response_time: number;
  min_response_time: number;
  request_count: number;
  error_rate: number;
  avg_cpu_usage: number;
  avg_memory_usage: number;
  total_token_usage: number;
}

/**
 * パフォーマンス統計サマリーコンポーネントのプロパティ
 */
interface PerformanceSummaryProps {
  apiId: string;
  period: '1h' | '24h' | '7d';
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
}

/**
 * 期間ラベル
 */
const PERIOD_LABELS: Record<'1h' | '24h' | '7d', string> = {
  '1h': '1時間',
  '24h': '24時間',
  '7d': '7日間',
};

/**
 * パフォーマンス統計サマリーコンポーネント
 * パフォーマンス統計をカード形式で表示します
 */
export const PerformanceSummary: React.FC<PerformanceSummaryProps> = ({
  apiId,
  period,
  autoRefresh = true,
  refreshInterval = REFRESH_INTERVALS.PERFORMANCE,
}) => {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // サマリーを取得
  const loadSummary = useCallback(async () => {
    if (!apiId) {
      setSummary(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request = {
        api_id: apiId,
        period: period,
      };
      const result = await safeInvoke<PerformanceSummary>('get_performance_summary', request);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'サマリーの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [apiId, period]);

  // 初回読み込み
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // 自動更新
  useEffect(() => {
    if (!autoRefresh || !apiId) {
      return;
    }

    const interval = setInterval(() => {
      loadSummary();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, apiId, refreshInterval, loadSummary]);

  if (loading && !summary) {
    return (
      <div className="performance-summary">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>パフォーマンス統計を読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="performance-summary">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={loadSummary}>
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="performance-summary">
        <div className="empty-container">
          <p>データがありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-summary">
      <h3 className="summary-title">
        パフォーマンス統計（{PERIOD_LABELS[period]}）
      </h3>
      <div className="summary-grid">
        <div className="summary-card">
          <div className="card-label">リクエスト数</div>
          <div className="card-value">{summary.request_count.toLocaleString()}</div>
          <div className="card-unit">件</div>
        </div>

        <div className="summary-card">
          <div className="card-label">平均レスポンス時間</div>
          <div className="card-value">{summary.avg_response_time.toFixed(FORMATTING.DECIMAL_PLACES)}</div>
          <div className="card-unit">ms</div>
        </div>

        <div className="summary-card">
          <div className="card-label">最大レスポンス時間</div>
          <div className="card-value">{summary.max_response_time.toFixed(FORMATTING.DECIMAL_PLACES)}</div>
          <div className="card-unit">ms</div>
        </div>

        <div className="summary-card">
          <div className="card-label">最小レスポンス時間</div>
          <div className="card-value">{summary.min_response_time.toFixed(FORMATTING.DECIMAL_PLACES)}</div>
          <div className="card-unit">ms</div>
        </div>

        <div className={`summary-card ${summary.error_rate > UI_WARNING_THRESHOLDS.ERROR_RATE_HIGH ? 'alert' : ''}`}>
          <div className="card-label">エラー率</div>
          <div className="card-value">{summary.error_rate.toFixed(FORMATTING.DECIMAL_PLACES)}</div>
          <div className="card-unit">%</div>
        </div>

        <div className="summary-card">
          <div className="card-label">平均CPU使用率</div>
          <div className="card-value">{summary.avg_cpu_usage.toFixed(FORMATTING.DECIMAL_PLACES)}</div>
          <div className="card-unit">%</div>
        </div>

        <div className="summary-card">
          <div className="card-label">平均メモリ使用量</div>
          <div className="card-value">{summary.avg_memory_usage.toFixed(FORMATTING.DECIMAL_PLACES)}</div>
          <div className="card-unit">MB</div>
        </div>

        <div className="summary-card">
          <div className="card-label">トークン使用量</div>
          <div className="card-value">{summary.total_token_usage.toLocaleString()}</div>
          <div className="card-unit">トークン</div>
        </div>
      </div>
      {autoRefresh && (
        <div className="summary-footer">
          <span className="auto-refresh-indicator">自動更新: {refreshInterval / FORMATTING.MS_PER_SECOND}秒間隔</span>
        </div>
      )}
    </div>
  );
};
