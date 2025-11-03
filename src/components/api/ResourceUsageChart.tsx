// ResourceUsageChart - CPU/メモリ使用率グラフコンポーネント

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
 * CPU/メモリ使用率グラフコンポーネントのプロパティ
 */
interface ResourceUsageChartProps {
  apiId: string;
  startDate?: string | null;
  endDate?: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
}

/**
 * CPU/メモリ使用率グラフコンポーネント
 * CPUとメモリの使用率を時系列グラフで表示します
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
  
  // アンマウント状態を追跡するためのref
  const isMountedRef = useRef(true);

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // データを取得
  const loadData = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    if (!apiId || apiId.trim() === '') {
      if (isMountedRef.current) {
        setData([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    try {
      // アンマウントチェック（state更新前）
      if (!isMountedRef.current) return;
      
      setLoading(true);
      setError(null);

      // CPU使用率とメモリ使用率を同時に取得
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

      // アンマウントチェック（API呼び出し後）
      if (!isMountedRef.current) return;

      // APIレスポンスがnullやundefined、または配列でない場合のチェック
      const safeCpuMetrics: PerformanceMetricInfo[] = Array.isArray(cpuMetrics) ? cpuMetrics : [];
      const safeMemoryMetrics: PerformanceMetricInfo[] = Array.isArray(memoryMetrics) ? memoryMetrics : [];

      // タイムスタンプをキーとしてデータをマージ
      const dataMap = new Map<number, { timestamp: string; cpu?: number; memory?: number }>();

      safeCpuMetrics.forEach((metric) => {
        // timestampとvalueのバリデーション
        if (!metric.timestamp || typeof metric.value !== 'number' || isNaN(metric.value)) {
          return; // 無効なデータはスキップ
        }

        const timestamp = new Date(metric.timestamp).getTime();
        if (isNaN(timestamp)) {
          return; // 無効なタイムスタンプはスキップ
        }

        if (!dataMap.has(timestamp)) {
          dataMap.set(timestamp, {
            timestamp: new Date(metric.timestamp).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          });
        }
        const entry = dataMap.get(timestamp);
        if (entry) {
          // CPU使用率はパーセンテージ（0-100）で保存されている
          entry.cpu = Math.round(metric.value * 100) / 100;
        }
      });

      safeMemoryMetrics.forEach((metric) => {
        // timestampとvalueのバリデーション
        if (!metric.timestamp || typeof metric.value !== 'number' || isNaN(metric.value)) {
          return; // 無効なデータはスキップ
        }

        const timestamp = new Date(metric.timestamp).getTime();
        if (isNaN(timestamp)) {
          return; // 無効なタイムスタンプはスキップ
        }

        if (!dataMap.has(timestamp)) {
          dataMap.set(timestamp, {
            timestamp: new Date(metric.timestamp).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          });
        }
        const entry = dataMap.get(timestamp);
        if (entry) {
          // メモリ使用率は既にパーセンテージ（0-100）で保存されている
          entry.memory = Math.round(metric.value * 100) / 100;
        }
      });

      // マップを配列に変換し、タイムスタンプでソート
      const sortedData = Array.from(dataMap.entries())
        .map(([timestamp, values]) => ({
          time: values.timestamp,
          cpu: values.cpu ?? 0,
          memory: values.memory ?? 0,
          timestamp,
        }))
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(({ timestamp, ...rest }) => rest);

      // アンマウントチェック
      if (!isMountedRef.current) return;
      setData(sortedData);
    } catch (err) {
      // アンマウントチェック
      if (!isMountedRef.current) return;
      
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
      // エラー時も既存のデータを保持する（前回のデータが表示され続ける）
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiId, startDate, endDate]);

  // 初回読み込み
  useEffect(() => {
    // apiIdが空の場合はデータを取得しない
    if (apiId && apiId.trim() !== '') {
      loadData();
    } else {
      setLoading(false);
      setData([]);
      setError(null);
    }
  }, [apiId, loadData]);

  // 自動更新
  useEffect(() => {
    if (!autoRefresh || !apiId || apiId.trim() === '') {
      return;
    }

    const interval = setInterval(() => {
      loadData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, apiId, refreshInterval, loadData]);

  // CPU使用率フォーマット関数（useCallbackでメモ化）
  const formatCpu = useCallback((value: number): string => {
    if (value <= 0 || isNaN(value)) {
      return '0%';
    }
    return `${value.toFixed(1)}%`;
  }, []);

  // メモリ使用率フォーマット関数（useCallbackでメモ化）
  // メモリ値は使用率（%）として保存されているため、%単位で表示
  const formatMemory = useCallback((value: number): string => {
    if (value <= 0 || isNaN(value)) {
      return '0%';
    }
    return `${value.toFixed(1)}%`;
  }, []);

  // apiIdが空の場合は早期リターン
  if (!apiId || apiId.trim() === '') {
    return (
      <div className="resource-usage-chart">
        <div className="empty-container">
          <p>APIを選択してください</p>
        </div>
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div className="resource-usage-chart">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>リソース使用率データを読み込んでいます...</p>
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
          <p>リソース使用率データがありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="resource-usage-chart">
      <h3 className="chart-title">CPU/メモリ使用率</h3>
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
            label={{ value: 'メモリ使用率 (%)', angle: 90, position: 'insideRight' }}
          />
          <Tooltip 
            formatter={(value: number | string | number[], name: string) => {
              // Rechartsのformatterは配列を返すことがあるため、最初の値を取得
              const numValue = Array.isArray(value) ? (value.length > 0 ? value[0] : 0) : value;
              if (typeof numValue !== 'number' || isNaN(numValue)) {
                return '0%';
              }
              if (name === 'cpu' || name === 'CPU使用率') {
                return formatCpu(numValue);
              }
              if (name === 'memory' || name === 'メモリ使用率') {
                return formatMemory(numValue);
              }
              return String(numValue);
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
            name="メモリ使用率"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
