// FLM - リクエスト数グラフコンポーネント
// フロントエンドエージェント (FE) 実装
// F007: パフォーマンス監視機能 - FE-007-04

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
import './RequestCountChart.css';

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
 * リクエスト数グラフコンポーネントのプロパティ
 */
interface RequestCountChartProps {
  apiId: string | null;
  period: '1h' | '24h' | '7d';
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
}

/**
 * リクエスト数グラフコンポーネント
 * リクエスト数の時系列グラフを表示します
 */
export const RequestCountChart: React.FC<RequestCountChartProps> = ({
  apiId,
  period,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [data, setData] = useState<Array<{ time: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 期間を日時に変換
  const getDateRange = useCallback((period: '1h' | '24h' | '7d') => {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    return {
      start: startDate.toISOString(),
      end: now.toISOString(),
    };
  }, []);

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

      const dateRange = getDateRange(period);
      const request = {
        api_id: apiId,
        metric_type: 'request_count',
        start_date: dateRange.start,
        end_date: dateRange.end,
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
          value: Math.round(metric.value), // 整数値
        }));

      setData(sortedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [apiId, period, getDateRange]);

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

  // 値フォーマット関数
  const formatValue = (value: number): string => {
    return `${value}回`;
  };

  if (loading && data.length === 0) {
    return (
      <div className="request-count-chart">
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <p>リクエスト数データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="request-count-chart">
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
      <div className="request-count-chart">
        <div className="chart-empty">
          <p>リクエスト数データがありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="request-count-chart">
      <h3 className="chart-title">リクエスト数</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            label={{ value: 'リクエスト数', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value: number) => formatValue(value)}
            labelFormatter={(label) => `時間: ${label}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#4caf50" 
            strokeWidth={2}
            dot={{ r: 3 }}
            name="リクエスト数"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
