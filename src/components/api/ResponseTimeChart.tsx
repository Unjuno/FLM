// FLM - レスポンス時間グラフコンポーネント
// フロントエンドエージェント (FE) 実装
// F007: パフォーマンス監視機能 - FE-007-03

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import './ResponseTimeChart.css';

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
 * レスポンス時間グラフコンポーネントのプロパティ
 */
interface ResponseTimeChartProps {
  apiId: string;
  startDate?: string | null;
  endDate?: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
}

/**
 * レスポンス時間グラフコンポーネント
 * レスポンス時間の時系列グラフを表示します
 */
export const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({
  apiId,
  startDate = null,
  endDate = null,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [data, setData] = useState<Array<{ time: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // データを取得
  const loadData = useCallback(async () => {
    if (!apiId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request = {
        api_id: apiId,
        metric_type: 'avg_response_time',
        start_date: startDate || null,
        end_date: endDate || null,
      };

      const result = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', { request });
      
      // データを時間順にソートし、グラフ用フォーマットに変換
      const sortedData = result
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((metric) => ({
          time: new Date(metric.timestamp).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          value: Math.round(metric.value * 100) / 100, // 小数点以下2桁
        }));

      setData(sortedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [apiId, startDate, endDate]);

  // 初回読み込み
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 自動更新
  useEffect(() => {
    if (!autoRefresh || !apiId) {
      return;
    }

    const interval = setInterval(() => {
      loadData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, apiId, refreshInterval, loadData]);

  // 時間フォーマット関数
  const formatTime = (time: string): string => {
    return time;
  };

  // 値フォーマット関数
  const formatValue = (value: number): string => {
    return `${value}ms`;
  };

  if (!apiId) {
    return (
      <div className="response-time-chart-container">
        <div className="chart-empty">
          <p>APIを選択してください</p>
        </div>
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div className="response-time-chart">
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <p>レスポンス時間データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="response-time-chart">
        <div className="chart-error">
          <p>⚠️ {error}</p>
          <button className="retry-button" onClick={loadData}>
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="response-time-chart">
        <div className="chart-empty">
          <p>レスポンス時間データがありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="response-time-chart">
      <h3 className="chart-title">レスポンス時間</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            tickFormatter={formatTime}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            label={{ value: 'レスポンス時間 (ms)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value: number) => formatValue(value)}
            labelFormatter={(label) => `時間: ${label}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#667eea" 
            strokeWidth={2}
            dot={{ r: 3 }}
            name="レスポンス時間"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
