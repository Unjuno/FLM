// usePerformanceMetrics - パフォーマンスメトリクス取得用カスタムフック

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../utils/tauri';
import { LOCALE } from '../constants/config';

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
export const usePerformanceMetrics = (options: UsePerformanceMetricsOptions) => {
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

      const request = {
        api_id: apiId,
        metric_type: metricType,
        start_date: startDate || null,
        end_date: endDate || null,
      };

      const result = await safeInvoke<PerformanceMetricInfo[]>('get_performance_metrics', { request });
      
      if (!isMountedRef.current) return;

      const safeMetrics: PerformanceMetricInfo[] = Array.isArray(result) ? result : [];

      // データを時間順にソートし、グラフ用フォーマットに変換
      const validMetrics = safeMetrics.filter((metric) => {
        if (!metric.timestamp || typeof metric.value !== 'number' || isNaN(metric.value)) {
          return false;
        }
        const timestamp = new Date(metric.timestamp).getTime();
        return !isNaN(timestamp);
      });

      const sortedData = validMetrics
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((metric) => {
          let formattedValue = metric.value;
          
          // 値のフォーマット関数が提供されている場合は適用
          if (valueFormatter) {
            formattedValue = valueFormatter(metric.value);
          } else {
            // デフォルト: 整数値に丸める
            formattedValue = Math.round(metric.value);
          }

          return {
            time: new Date(metric.timestamp).toLocaleTimeString(LOCALE.DEFAULT, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            value: formattedValue,
          };
        });

      if (!isMountedRef.current) return;
      setData(sortedData);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiId, metricType, startDate, endDate, valueFormatter]); // tを依存関係から除外（useI18nが安定した参照を提供）

  // 初回読み込み
  useEffect(() => {
    loadData();
  }, [loadData]);

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

