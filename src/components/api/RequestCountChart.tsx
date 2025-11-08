// RequestCountChart - リクエスト数グラフコンポーネント

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
import './RequestCountChart.css';

/**
 * リクエスト数グラフコンポーネントのプロパティ
 */
interface RequestCountChartProps {
  apiId: string;
  startDate?: string | null;
  endDate?: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
}

/**
 * リクエスト数グラフコンポーネント
 * リクエスト数の時系列グラフを表示します
 */
const RequestCountChartComponent: React.FC<RequestCountChartProps> = ({
  apiId,
  startDate = null,
  endDate = null,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const { t } = useI18n();

  // 共通フックを使用してデータを取得
  const { data, loading, error, loadData, isEmpty } = usePerformanceMetrics({
    apiId,
    metricType: 'request_count',
    startDate,
    endDate,
    autoRefresh,
    refreshInterval,
    // 整数値として保存（フォーマット関数なし）
  });

  // 値フォーマット関数（useCallbackでメモ化）
  const formatValue = useCallback((value: number): string => {
    return `${value}回`;
  }, []);

  if (isEmpty) {
    return (
      <div
        className="request-count-chart-container"
        role="status"
        aria-live="polite"
      >
        <div className="chart-empty">
          <p>{t('charts.requestCount.selectApi')}</p>
        </div>
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div
        className="request-count-chart-container"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="chart-loading">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>{t('charts.requestCount.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="request-count-chart-container"
        role="alert"
        aria-live="assertive"
      >
        <div className="chart-error">
          <p className="error-message" role="alert">
            ⚠️ {error}
          </p>
          <button
            className="retry-button"
            onClick={loadData}
            aria-label={t('charts.requestCount.retry')}
            type="button"
          >
            {t('charts.requestCount.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="request-count-chart-container"
        role="status"
        aria-live="polite"
      >
        <div className="chart-empty">
          <p>{t('charts.requestCount.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="request-count-chart-container"
      role="region"
      aria-labelledby="request-count-chart-title"
    >
      <h3 className="chart-title" id="request-count-chart-title">
        {t('charts.requestCount.title')}
      </h3>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHT}>
          <LineChart
            data={data}
            margin={{
              top: CHART_CONFIG.MARGIN.TOP,
              right: CHART_CONFIG.MARGIN.RIGHT,
              left: CHART_CONFIG.MARGIN.LEFT,
              bottom: CHART_CONFIG.MARGIN.BOTTOM,
            }}
            aria-label={t('charts.requestCount.ariaLabel')}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              angle={-45}
              textAnchor="end"
              height={CHART_CONFIG.X_AXIS_HEIGHT}
              aria-label={t('charts.requestCount.xAxisLabel')}
            />
            <YAxis
              label={{
                value: t('charts.requestCount.yAxisLabel'),
                angle: -90,
                position: 'insideLeft',
              }}
              aria-label={t('charts.requestCount.yAxisLabel')}
            />
            <Tooltip
              formatter={(value: number) => formatValue(value)}
              labelFormatter={label =>
                t('charts.requestCount.tooltipTime', { time: label })
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS.SUCCESS}
              strokeWidth={CHART_CONFIG.STROKE_WIDTH}
              dot={{ r: CHART_CONFIG.DOT_RADIUS }}
              name={t('charts.requestCount.legendName')}
              aria-label={t('charts.requestCount.legendName')}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// React.memoでメモ化して不要な再レンダリングを防止
export const RequestCountChart = memo(RequestCountChartComponent);
