// FLM - CPU/メモリ使用量グラフコンポーネント
// フロントエンドエージェント (FE) 実装
// F007: パフォーマンス監視機能 - CPU/メモリ使用量グラフ実装

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
import './ResourceUsageChart.css';

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
 * CPU/メモリ使用量グラフコンポーネントのプロパティ
 */
interface ResourceUsageChartProps {
  apiId: string;
  startDate?: string | null;
  endDate?: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
}

/**
 * CPU/メモリ使用量グラフコンポーネント
 * CPUとメモリの使用量を時系列グラフで表示します
 */
export const ResourceUsageChart: React.FC<ResourceUsageChartProps> = ({
  apiId,
  startDate = null,
  endDate = null,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [data, setData] = useState<Array<{ time: string; cpu: number; memory: number }>>([]);
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

      // CPU使用率とメモリ使用量を同時に取得
      const [cpuMetrics, memoryMetrics] = await Promise.all([
        invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: apiId,
            metric_type: 'cpu_usage',
            start_date: startDate || null,
            end_date: endDate || null,
          },
        }),
        invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: apiId,
            metric_type: 'memory_usage',
            start_date: startDate || null,
            end_date: endDate || null,
          },
        }),
      ]);

      // タイムスタンプをキーとしてデータをマージ
      const dataMap = new Map<string, { cpu?: number; memory?: number }>();

      cpuMetrics.forEach((metric) => {
        const timeKey = new Date(metric.timestamp).toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        if (!dataMap.has(timeKey)) {
          dataMap.set(timeKey, {});
        }
        const entry = dataMap.get(timeKey)!;
        entry.cpu = Math.round(metric.value * 100) / 100;
      });

      memoryMetrics.forEach((metric) => {
        const timeKey = new Date(metric.timestamp).toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        if (!dataMap.has(timeKey)) {
          dataMap.set(timeKey, {});
        }
        const entry = dataMap.get(timeKey)!;
        entry.memory = Math.round(metric.value * 100) / 100;
      });

      // マップを配列に変換し、時間順にソート
      const sortedData = Array.from(dataMap.entries())
        .map(([time, values]) => ({
          time,
          cpu: values.cpu ?? 0,
          memory: values.memory ?? 0,
        }))
        .sort((a, b) => {
          const timeA = a.time.split(':').map(Number);
          const timeB = b.time.split(':').map(Number);
          for (let i = 0; i < 3; i++) {
            if (timeA[i] !== timeB[i]) {
              return timeA[i] - timeB[i];
            }
          }
          return 0;
        });

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

  // CPU使用率フォーマット関数
  const formatCpu = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  // メモリ使用量フォーマット関数
  const formatMemory = (value: number): string => {
    if (value < 1024) {
      return `${value.toFixed(1)}MB`;
    }
    return `${(value / 1024).toFixed(2)}GB`;
  };

  if (loading && data.length === 0) {
    return (
      <div className="resource-usage-chart">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>リソース使用量データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="resource-usage-chart">
        <div className="error-container">
          <p className="error-message">⚠️ {error}</p>
          <button className="retry-button" onClick={loadData}>
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="resource-usage-chart">
        <div className="empty-container">
          <p>リソース使用量データがありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="resource-usage-chart">
      <h3 className="chart-title">CPU/メモリ使用量</h3>
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
            yAxisId="cpu"
            orientation="left"
            label={{ value: 'CPU使用率 (%)', angle: -90, position: 'insideLeft' }}
          />
          <YAxis 
            yAxisId="memory"
            orientation="right"
            label={{ value: 'メモリ使用量 (MB)', angle: 90, position: 'insideRight' }}
          />
          <Tooltip 
            formatter={(value: number, name: string) => {
              if (name === 'cpu') {
                return formatCpu(value);
              }
              return formatMemory(value);
            }}
            labelFormatter={(label) => `時間: ${label}`}
          />
          <Legend />
          <Line 
            yAxisId="cpu"
            type="monotone" 
            dataKey="cpu" 
            stroke="#ff9800" 
            strokeWidth={2}
            dot={{ r: 3 }}
            name="CPU使用率"
          />
          <Line 
            yAxisId="memory"
            type="monotone" 
            dataKey="memory" 
            stroke="#2196f3" 
            strokeWidth={2}
            dot={{ r: 3 }}
            name="メモリ使用量"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
