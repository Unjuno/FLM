// SPDX-License-Identifier: MIT
// usePerformanceMetrics - パフォーマンスメトリクス取得用カスタムフック

import { useState, useCallback } from 'react';
import { safeInvoke } from '../utils/tauri';
import { LOCALE } from '../constants/config';
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
 * グラフ用データポイント
 */
export interface ChartDataPoint {
  time: string;
  value: number;
}

/**
 * usePerformanceMetricsフックのオプション
 */
export interface UsePerformanceMetricsOptions {
  apiId: string;
  metricType: string;
  startDate?: string | null;
  endDate?: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number;
  valueFormatter?: (value: number) => number; // 値のフォーマット関数（例: パーセンテージ変換）
}

/**
 * パフォーマンスメトリクス取得用カスタムフック
 * グラフコンポーネント間で共通のデータ取得ロジックを提供します
 */
export const usePerformanceMetrics = (
  options: UsePerformanceMetricsOptions
) => {
  const {
    apiId,
    metricType,
    startDate = null,
    endDate = null,
    autoRefresh = true,
    refreshInterval = 30000,
    valueFormatter,
  } = options;

  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useIsMounted();

  // データを取得
  const loadData = useCallback(async (_options?: { force?: boolean }) => {
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

      const request = {
        api_id: apiId,
        metric_type: metricType,
        start_date: startDate || null,
        end_date: endDate || null,
      };

      const result = await safeInvoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        { request }
      );

      if (!isMounted()) return;

      const safeMetrics: PerformanceMetricInfo[] = Array.isArray(result)
        ? result
        : [];

      // データを時間順にソートし、グラフ用フォーマットに変換
      const validMetrics = safeMetrics.filter(metric => {
        if (
          !metric.timestamp ||
          typeof metric.value !== 'number' ||
          isNaN(metric.value)
        ) {
          return false;
        }
        const timestamp = new Date(metric.timestamp).getTime();
        return !isNaN(timestamp);
      });

      const sortedData = validMetrics
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
        .map(metric => {
          let formattedValue = metric.value;

          // 値のフォーマット関数が提供されている場合は適用
          if (valueFormatter) {
            formattedValue = valueFormatter(metric.value);
          } else {
            // デフォルト: 整数値に丸める
            formattedValue = Math.round(metric.value);
          }

          return {
            time: new Date(metric.timestamp).toLocaleTimeString(
              LOCALE.DEFAULT,
              {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }
            ),
            value: formattedValue,
          };
        });

      if (!isMounted()) return;
      setData(sortedData);
    } catch (err) {
      if (!isMounted()) return;
      setError(
        extractErrorMessage(err) || 'データの取得に失敗しました'
      );
    } finally {
      if (isMounted()) {
        setLoading(false);
      }
    }
  }, [apiId, metricType, startDate, endDate, valueFormatter, isMounted]);

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
