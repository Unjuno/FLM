// SPDX-License-Identifier: MIT
// useResourceUsageMetrics - CPU/メモリ使用率取得用カスタムフック

import { useState, useCallback } from 'react';
import { safeInvoke } from '../utils/tauri';
import { FORMATTING, LOCALE } from '../constants/config';
import { useIsMounted } from './useIsMounted';
import { extractErrorMessage } from '../utils/errorHandler';
import { usePolling } from './usePolling';
import { isBlank } from '../utils/stringHelpers';

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
  const isMounted = useIsMounted();

  // データを取得
  const loadData = useCallback(
    async (_options?: { force?: boolean }) => {
      if (!isMounted()) return;

      if (isBlank(apiId)) {
        if (isMounted()) {
          setData([]);
          setLoading(false);
          setError(null);
        }
        return;
      }

      try {
        if (!isMounted()) return;

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

        if (!isMounted()) return;

        // APIレスポンスがnullやundefined、または配列でない場合のチェック
        const safeCpuMetrics: PerformanceMetricInfo[] = Array.isArray(
          cpuMetrics
        )
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

        if (!isMounted()) return;
        setData(sortedData);
      } catch (err) {
        if (!isMounted()) return;
        setError(extractErrorMessage(err) || 'データの取得に失敗しました');
      } finally {
        if (isMounted()) {
          setLoading(false);
        }
      }
    },
    [apiId, startDate, endDate, isMounted]
  );

  // ポーリング設定
  usePolling(loadData, {
    interval: refreshInterval,
    minRequestInterval: 3000,
    enabled: autoRefresh && !isBlank(apiId),
    skipWhenHidden: true,
  });

  return {
    data,
    loading,
    error,
    loadData,
    isEmpty: isBlank(apiId),
  };
};
