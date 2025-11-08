// useResourceUsageMetrics - CPU/メモリ使用率取得用カスタムフック

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../utils/tauri';
import { FORMATTING, LOCALE } from '../constants/config';

/**
 * パフォーマンスメトリクス情報
 */
export interface PerformanceMetricInfo {
  id: number;
  api_id: string;
  metric_type: string;
  value: number;
  timestamp: string;
}

/**
 * リソース使用率データポイント
 */
export interface ResourceUsageDataPoint {
  time: string;
  cpu: number;
  memory: number;
}

/**
 * useResourceUsageMetricsフックのオプション
 */
export interface UseResourceUsageMetricsOptions {
  apiId: string;
  startDate?: string | null;
  endDate?: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * CPU/メモリ使用率取得用カスタムフック
 * CPUとメモリの両方を同時に取得してマージします
 */
export const useResourceUsageMetrics = (
  options: UseResourceUsageMetricsOptions
) => {
  const {
    apiId,
    startDate = null,
    endDate = null,
    autoRefresh = true,
    refreshInterval = 30000,
  } = options;

  const [data, setData] = useState<ResourceUsageDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      if (!isMountedRef.current) return;

      setLoading(true);
      setError(null);

      // CPU使用率とメモリ使用率を同時に取得
      const [cpuMetrics, memoryMetrics] = await Promise.all([
        safeInvoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: apiId,
            metric_type: 'cpu_usage',
            start_date: startDate || null,
            end_date: endDate || null,
          },
        }),
        safeInvoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: apiId,
            metric_type: 'memory_usage',
            start_date: startDate || null,
            end_date: endDate || null,
          },
        }),
      ]);

      if (!isMountedRef.current) return;

      // APIレスポンスがnullやundefined、または配列でない場合のチェック
      const safeCpuMetrics: PerformanceMetricInfo[] = Array.isArray(cpuMetrics)
        ? cpuMetrics
        : [];
      const safeMemoryMetrics: PerformanceMetricInfo[] = Array.isArray(
        memoryMetrics
      )
        ? memoryMetrics
        : [];

      // タイムスタンプをキーとしてデータをマージ
      const dataMap = new Map<
        number,
        { timestamp: string; cpu?: number; memory?: number }
      >();

      safeCpuMetrics.forEach(metric => {
        // timestampとvalueのバリデーション
        if (
          !metric.timestamp ||
          typeof metric.value !== 'number' ||
          isNaN(metric.value)
        ) {
          return; // 無効なデータはスキップ
        }

        const timestamp = new Date(metric.timestamp).getTime();
        if (isNaN(timestamp)) {
          return; // 無効なタイムスタンプはスキップ
        }

        if (!dataMap.has(timestamp)) {
          dataMap.set(timestamp, {
            timestamp: new Date(metric.timestamp).toLocaleTimeString(
              LOCALE.DEFAULT,
              {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }
            ),
          });
        }
        const entry = dataMap.get(timestamp);
        if (entry) {
          // CPU使用率はパーセンテージ（0-100）で保存されている
          entry.cpu =
            Math.round(metric.value * FORMATTING.PERCENTAGE_MULTIPLIER) /
            FORMATTING.PERCENTAGE_MULTIPLIER;
        }
      });

      safeMemoryMetrics.forEach(metric => {
        // timestampとvalueのバリデーション
        if (
          !metric.timestamp ||
          typeof metric.value !== 'number' ||
          isNaN(metric.value)
        ) {
          return; // 無効なデータはスキップ
        }

        const timestamp = new Date(metric.timestamp).getTime();
        if (isNaN(timestamp)) {
          return; // 無効なタイムスタンプはスキップ
        }

        if (!dataMap.has(timestamp)) {
          dataMap.set(timestamp, {
            timestamp: new Date(metric.timestamp).toLocaleTimeString(
              LOCALE.DEFAULT,
              {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }
            ),
          });
        }
        const entry = dataMap.get(timestamp);
        if (entry) {
          // メモリ使用率は既にパーセンテージ（0-100）で保存されている
          entry.memory =
            Math.round(metric.value * FORMATTING.PERCENTAGE_MULTIPLIER) /
            FORMATTING.PERCENTAGE_MULTIPLIER;
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
        .map(({ timestamp: _timestamp, ...rest }) => rest);

      if (!isMountedRef.current) return;
      setData(sortedData);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(
        err instanceof Error ? err.message : 'データの取得に失敗しました'
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiId, startDate, endDate]); // tを依存関係から除外

  // 初回読み込み
  useEffect(() => {
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

  return {
    data,
    loading,
    error,
    loadData,
    isEmpty: !apiId || apiId.trim() === '',
  };
};
