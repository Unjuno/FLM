// FLM - エラー率グラフコンポーネント
// フロントエンドエージェント (FE) 実装
// F007: パフォーマンス監視機能 - エラー率グラフコンポーネント実装

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import './ErrorRateChart.css';

/**
 * パフォーマンスメトリクス情報
 */
interface PerformanceMetricInfo {
  id: number;
  api_id: string;
  metric_type: string;
  value: number;
  timestamp: string;
}

/**
 * エラー率グラフコンポーネントのプロパティ
 */
interface ErrorRateChartProps {
  apiId: string;
  startDate?: string | null;
  endDate?: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
  alertThreshold?: number; // アラート閾値（デフォルト: 5%）
}

/**
 * エラー率グラフコンポーネント
 * エラー率の時系列データを表示します
 */
export const ErrorRateChart: React.FC<ErrorRateChartProps> = ({
  apiId,
  startDate = null,
  endDate = null,
  autoRefresh = true,
  refreshInterval = 30000,
  alertThreshold = 5,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetricInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // メトリクスを取得
  const loadMetrics = useCallback(async () => {
    if (!apiId) {
      setMetrics([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request = {
        api_id: apiId,
        metric_type: 'error_rate',
        start_date: startDate || null,
        end_date: endDate || null,
      };
      const result = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', request);

      // 時系列でソート
      const sorted = result.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setMetrics(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メトリクスの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [apiId, startDate, endDate]);

  // 初回読み込み
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // 自動更新
  useEffect(() => {
    if (!autoRefresh || !apiId) {
      return;
    }

    const interval = setInterval(() => {
      loadMetrics();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, apiId, refreshInterval, loadMetrics]);

  // グラフ用データの準備（時刻フォーマット: HH:mm）
  // エラー率は0-100%の範囲
  const chartData = metrics.map((metric) => ({
    time: new Date(metric.timestamp).toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    timestamp: metric.timestamp,
    value: Math.min(100, Math.max(0, Math.round(metric.value * 100) / 100)), // 0-100%にクランプ
  }));

  // アラート状態の確認（閾値を超えているデータポイントがあるか）
  const hasHighErrorRate = chartData.some((data) => data.value >= alertThreshold);

  if (loading && metrics.length === 0) {
    return (
      <div className="error-rate-chart">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>エラー率データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-rate-chart">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={loadMetrics}>
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="error-rate-chart">
        <h3 className="chart-title">エラー率</h3>
        <div className="empty-container">
          <p>データがありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`error-rate-chart ${hasHighErrorRate ? 'alert-active' : ''}`}>
      <div className="chart-header">
        <h3 className="chart-title">エラー率</h3>
        {hasHighErrorRate && (
          <span className="alert-badge">⚠️ 高エラー率</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            domain={[0, 100]}
            label={{ value: 'エラー率 (%)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc' }}
            formatter={(value: number) => [`${value}%`, 'エラー率']}
            labelFormatter={(label) => `時刻: ${label}`}
          />
          <Legend />
          <ReferenceLine 
            y={alertThreshold} 
            stroke="#f44336" 
            strokeDasharray="5 5" 
            label={{ value: `閾値: ${alertThreshold}%`, position: 'top' }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={hasHighErrorRate ? "#f44336" : "#ff9800"} 
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="エラー率"
          />
        </LineChart>
      </ResponsiveContainer>
      {autoRefresh && (
        <div className="chart-footer">
          <span className="auto-refresh-indicator">自動更新: {refreshInterval / 1000}秒間隔</span>
        </div>
      )}
    </div>
  );
};
