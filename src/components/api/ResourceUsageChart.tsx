// FLM - CPU/メモリ使用量グラフコンポーネント
// フロントエンドエージェント (FE) 実装
// F007: パフォーマンス監視機能 - CPU/メモリ使用量グラフ実装

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  startDate?: string;
  endDate?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
}

/**
 * CPU/メモリ使用量グラフコンポーネント
 * CPUとメモリの使用量を時系列グラフで表示します
 */
export const ResourceUsageChart: React.FC<ResourceUsageChartProps> = ({
  apiId,
  startDate,
  endDate,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [cpuMetrics, setCpuMetrics] = useState<PerformanceMetricInfo[]>([]);
  const [memoryMetrics, setMemoryMetrics] = useState<PerformanceMetricInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CPUメトリクスを取得
  const loadCpuMetrics = useCallback(async () => {
    if (!apiId) {
      setCpuMetrics([]);
      return;
    }

    try {
      const request = {
        api_id: apiId,
        metric_type: 'cpu_usage',
        start_date: startDate || null,
        end_date: endDate || null,
      };

      const result = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', { request });

      const sortedMetrics = result.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      setCpuMetrics(sortedMetrics);
    } catch (err) {
      console.error('CPUメトリクスの取得エラー:', err);
    }
  }, [apiId, startDate, endDate]);

  // メモリメトリクスを取得
  const loadMemoryMetrics = useCallback(async () => {
    if (!apiId) {
      setMemoryMetrics([]);
      return;
    }

    try {
      const request = {
        api_id: apiId,
        metric_type: 'memory_usage',
        start_date: startDate || null,
        end_date: endDate || null,
      };

      const result = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', { request });

      const sortedMetrics = result.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      setMemoryMetrics(sortedMetrics);
    } catch (err) {
      console.error('メモリメトリクスの取得エラー:', err);
    }
  }, [apiId, startDate, endDate]);

  // メトリクスを読み込み
  const loadMetrics = useCallback(async () => {
    if (!apiId) {
      setCpuMetrics([]);
      setMemoryMetrics([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await Promise.all([loadCpuMetrics(), loadMemoryMetrics()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メトリクスの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [apiId, loadCpuMetrics, loadMemoryMetrics]);

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

  // グラフ用データの準備（CPUとメモリを同じタイムスタンプでマージ）
  const chartData = useMemo(() => {
    const dataMap: { [key: string]: { time: string; cpu: number | null; memory: number | null } } = {};

    // CPUメトリクスを追加
    cpuMetrics.forEach((metric) => {
      const date = new Date(metric.timestamp);
      const timeKey = date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (!dataMap[timeKey]) {
        dataMap[timeKey] = { time: timeKey, cpu: null, memory: null };
      }
      dataMap[timeKey].cpu = metric.value;
    });

    // メモリメトリクスを追加
    memoryMetrics.forEach((metric) => {
      const date = new Date(metric.timestamp);
      const timeKey = date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (!dataMap[timeKey]) {
        dataMap[timeKey] = { time: timeKey, cpu: null, memory: null };
      }
      dataMap[timeKey].memory = metric.value;
    });

    return Object.values(dataMap).sort((a, b) => a.time.localeCompare(b.time));
  }, [cpuMetrics, memoryMetrics]);

  if (loading && chartData.length === 0) {
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
          <button className="retry-button" onClick={loadMetrics}>
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="resource-usage-chart">
        <div className="empty-container">
          <p>リソース使用量データがありません</p>
        </div>
      </div>
    );
  }

  const avgCpu = chartData.filter(d => d.cpu !== null).length > 0
    ? (chartData.filter(d => d.cpu !== null).reduce((sum, d) => sum + (d.cpu || 0), 0) / chartData.filter(d => d.cpu !== null).length).toFixed(2)
    : '0.00';
  const avgMemory = chartData.filter(d => d.memory !== null).length > 0
    ? (chartData.filter(d => d.memory !== null).reduce((sum, d) => sum + (d.memory || 0), 0) / chartData.filter(d => d.memory !== null).length).toFixed(2)
    : '0.00';
  const maxMemory = Math.max(...chartData.map(d => d.memory || 0));

  return (
    <div className="resource-usage-chart">
      <h3 className="chart-title">CPU/メモリ使用量</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            yAxisId="left"
            label={{ value: 'CPU使用率 (%)', angle: -90, position: 'insideLeft' }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            label={{ value: 'メモリ (MB)', angle: 90, position: 'insideRight' }}
          />
          <Tooltip 
            formatter={(value: number, name: string) => {
              if (name === 'CPU使用率') {
                return `${value.toFixed(2)}%`;
              }
              return `${value.toFixed(2)}MB`;
            }}
            labelFormatter={(label) => `時刻: ${label}`}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="cpu"
            stroke="#ff9800"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="CPU使用率"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="memory"
            stroke="#2196f3"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="メモリ使用量"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="chart-stats">
        <span className="stat-item">
          平均CPU使用率: {avgCpu}%
        </span>
        <span className="stat-item">
          平均メモリ使用量: {avgMemory}MB
        </span>
        <span className="stat-item">
          最大メモリ使用量: {maxMemory.toFixed(2)}MB
        </span>
      </div>
    </div>
  );
};
