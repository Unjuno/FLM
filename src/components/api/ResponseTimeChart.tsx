// ResponseTimeChart - レスポンス時間グラフコンポーネント

import React, { memo, useCallback } from 'react';
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
import { usePerformanceMetrics } from '../../hooks/usePerformanceMetrics';
import './ResponseTimeChart.css';

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
const ResponseTimeChartComponent: React.FC<ResponseTimeChartProps> = ({
  apiId,
  startDate = null,
  endDate = null,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const { t } = useI18n();

  // 値フォーマット関数（useCallbackでメモ化して、無限ループを防止）
  // レスポンス時間はミリ秒単位なので、そのまま使用（フォーマットは表示時のみ）
  const valueFormatter = useCallback((value: number): number => {
    if (isNaN(value) || !isFinite(value)) {
      return 0;
    }
    // 整数値に丸める（ミリ秒単位）
    return Math.round(value);
  }, []);

  // 共通フックを使用してデータを取得
  const { data, loading, error, loadData, isEmpty } = usePerformanceMetrics({
    apiId,
    metricType: 'avg_response_time',
    startDate,
    endDate,
    autoRefresh,
    refreshInterval,
    valueFormatter,
  });

  // 値フォーマット関数（useCallbackでメモ化）
  const formatValue = useCallback((value: number): string => {
    return `${value}ms`;
  }, []);

  if (isEmpty) {
    return (
      <div
        className="response-time-chart-container"
        role="status"
        aria-live="polite"
      >
        <div className="chart-empty">
          <p>{t('charts.responseTime.selectApi')}</p>
        </div>
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div
        className="response-time-chart"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="chart-loading">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>{t('charts.responseTime.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="response-time-chart" role="alert" aria-live="assertive">
        <div className="chart-error">
          <p className="error-message" role="alert">
            ⚠️ {error}
          </p>
          <button
            className="retry-button"
            onClick={loadData}
            aria-label={t('charts.responseTime.retry')}
            type="button"
          >
            {t('charts.responseTime.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="response-time-chart" role="status" aria-live="polite">
        <div className="chart-empty">
          <p>{t('charts.responseTime.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="response-time-chart"
      role="region"
      aria-labelledby="response-time-chart-title"
    >
      <h3 className="chart-title" id="response-time-chart-title">
        {t('charts.responseTime.title')}
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
          aria-label={t('charts.responseTime.ariaLabel')}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            angle={-45}
            textAnchor="end"
            height={CHART_CONFIG.X_AXIS_HEIGHT}
            aria-label={t('charts.responseTime.xAxisLabel')}
          />
          <YAxis
            label={{
              value: t('charts.responseTime.yAxisLabel'),
              angle: -90,
              position: 'insideLeft',
            }}
            aria-label={t('charts.responseTime.yAxisLabel')}
          />
          <Tooltip
            formatter={(value: number) => formatValue(value)}
            labelFormatter={label =>
              t('charts.responseTime.tooltipTime', { time: label })
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.PRIMARY}
            strokeWidth={CHART_CONFIG.STROKE_WIDTH}
            dot={{ r: CHART_CONFIG.DOT_RADIUS }}
            name={t('charts.responseTime.legendName')}
            aria-label={t('charts.responseTime.legendName')}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// React.memoでメモ化して不要な再レンダリングを防止
export const ResponseTimeChart = memo(ResponseTimeChartComponent);
