// SPDX-License-Identifier: MIT
// ResourceUsageChart - CPU/メモリ使用率グラフコンポーネント

import React, { useCallback, memo } from 'react';
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
import { CHART_CONFIG, CHART_COLORS } from '../../constants/config';
import { useI18n } from '../../contexts/I18nContext';
import { useResourceUsageMetrics } from '../../hooks/useResourceUsageMetrics';
import './ResourceUsageChart.css';

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
const ResourceUsageChartComponent: React.FC<ResourceUsageChartProps> = ({
  apiId,
  startDate = null,
  endDate = null,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const { t } = useI18n();

  // 共通フックを使用してデータを取得
  const { data, loading, error, loadData, isEmpty } = useResourceUsageMetrics({
    apiId,
    startDate,
    endDate,
    autoRefresh,
    refreshInterval,
  });

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
  if (isEmpty) {
    return (
      <div className="resource-usage-chart" role="status" aria-live="polite">
        <div className="empty-container">
          <p>{t('charts.resourceUsage.selectApi')}</p>
        </div>
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div
        className="resource-usage-chart"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="loading-container">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>{t('charts.resourceUsage.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="resource-usage-chart" role="alert" aria-live="assertive">
        <div className="error-container">
          <p className="error-message" role="alert">
            ⚠️ {error}
          </p>
          <button
            className="retry-button"
            onClick={() => loadData({ force: true })}
            aria-label={t('charts.resourceUsage.retry')}
            type="button"
          >
            {t('charts.resourceUsage.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="resource-usage-chart" role="status" aria-live="polite">
        <div className="empty-container">
          <p>{t('charts.resourceUsage.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="resource-usage-chart"
      role="region"
      aria-labelledby="resource-usage-chart-title"
    >
      <h3 className="chart-title" id="resource-usage-chart-title">
        {t('charts.resourceUsage.title')}
      </h3>
      <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHT}>
        <LineChart
          data={data}
          margin={{
            top: CHART_CONFIG.MARGIN.TOP,
            right: CHART_CONFIG.MARGIN.RIGHT,
            left: CHART_CONFIG.MARGIN.LEFT,
            bottom: CHART_CONFIG.MARGIN.BOTTOM,
          }}
          aria-label={t('charts.resourceUsage.ariaLabel')}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            angle={-45}
            textAnchor="end"
            height={CHART_CONFIG.X_AXIS_HEIGHT}
            aria-label={t('charts.resourceUsage.xAxisLabel')}
          />
          <YAxis
            yAxisId="cpu"
            orientation="left"
            label={{
              value: t('charts.resourceUsage.yAxisLabelCpu'),
              angle: -90,
              position: 'insideLeft',
            }}
            aria-label={t('charts.resourceUsage.yAxisLabelCpu')}
          />
          <YAxis
            yAxisId="memory"
            orientation="right"
            label={{
              value: t('charts.resourceUsage.yAxisLabelMemory'),
              angle: 90,
              position: 'insideRight',
            }}
            aria-label={t('charts.resourceUsage.yAxisLabelMemory')}
          />
          <Tooltip
            formatter={(value: number | string | number[], name: string) => {
              // Rechartsのformatterは配列を返すことがあるため、最初の値を取得
              const numValue = Array.isArray(value)
                ? value.length > 0
                  ? value[0]
                  : 0
                : value;
              if (typeof numValue !== 'number' || isNaN(numValue)) {
                return '0%';
              }
              if (
                name === 'cpu' ||
                name === t('charts.resourceUsage.legendNameCpu')
              ) {
                return formatCpu(numValue);
              }
              if (
                name === 'memory' ||
                name === t('charts.resourceUsage.legendNameMemory')
              ) {
                return formatMemory(numValue);
              }
              return String(numValue);
            }}
            labelFormatter={label =>
              t('charts.resourceUsage.tooltipTime', { time: label })
            }
          />
          <Legend />
          <Line
            yAxisId="cpu"
            type="monotone"
            dataKey="cpu"
            stroke={CHART_COLORS.ORANGE}
            strokeWidth={CHART_CONFIG.STROKE_WIDTH}
            dot={{ r: CHART_CONFIG.DOT_RADIUS }}
            name={t('charts.resourceUsage.legendNameCpu')}
            aria-label={t('charts.resourceUsage.legendNameCpu')}
          />
          <Line
            yAxisId="memory"
            type="monotone"
            dataKey="memory"
            stroke={CHART_COLORS.BLUE}
            strokeWidth={CHART_CONFIG.STROKE_WIDTH}
            dot={{ r: CHART_CONFIG.DOT_RADIUS }}
            name={t('charts.resourceUsage.legendNameMemory')}
            aria-label={t('charts.resourceUsage.legendNameMemory')}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// React.memoでメモ化して不要な再レンダリングを防止
export const ResourceUsageChart = memo(ResourceUsageChartComponent);
