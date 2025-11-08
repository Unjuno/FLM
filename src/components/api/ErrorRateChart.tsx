// ErrorRateChart - エラー率グラフコンポーネント

import React, { useMemo, memo, useCallback } from 'react';
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
import { CHART_CONFIG, CHART_COLORS, FORMATTING } from '../../constants/config';
import { useI18n } from '../../contexts/I18nContext';
import { usePerformanceMetrics } from '../../hooks/usePerformanceMetrics';
import './ErrorRateChart.css';

/**
 * エラー率グラフコンポーネントのプロパティ
 *
 * @interface ErrorRateChartProps
 * @property {string} apiId - 表示するAPIのID（必須）
 * @property {string | null} [startDate] - データ取得の開始日時（ISO 8601形式、オプション）
 * @property {string | null} [endDate] - データ取得の終了日時（ISO 8601形式、オプション）
 * @property {boolean} [autoRefresh=true] - 自動更新を有効にするかどうか（デフォルト: true）
 * @property {number} [refreshInterval=30000] - 自動更新の間隔（ミリ秒、最小値: 1000ms、デフォルト: 30000ms）
 * @property {number} [alertThreshold=5.0] - アラートを表示するエラー率の閾値（0-100の範囲、デフォルト: 5.0%）
 *
 * @example
 * ```tsx
 * <ErrorRateChart
 *   apiId="api-123"
 *   startDate="2024-01-01T00:00:00Z"
 *   endDate="2024-01-31T23:59:59Z"
 *   autoRefresh={true}
 *   refreshInterval={30000}
 *   alertThreshold={5.0}
 * />
 * ```
 */
interface ErrorRateChartProps {
  /** 表示するAPIのID（必須） */
  apiId: string;
  /** データ取得の開始日時（ISO 8601形式、オプション） */
  startDate?: string | null;
  /** データ取得の終了日時（ISO 8601形式、オプション） */
  endDate?: string | null;
  /** 自動更新を有効にするかどうか（デフォルト: true） */
  autoRefresh?: boolean;
  /** 自動更新の間隔（ミリ秒、最小値: 1000ms、デフォルト: 30000ms） */
  refreshInterval?: number;
  /** アラートを表示するエラー率の閾値（0-100の範囲、デフォルト: 5.0%） */
  alertThreshold?: number;
}

/**
 * エラー率グラフコンポーネント
 *
 * APIのエラー率を時系列グラフとして表示します。バックエンドから取得したエラー率データ（0-100の範囲）を
 * パーセンテージ形式で表示し、設定された閾値を超えた場合にアラートを表示します。
 *
 * 特徴:
 * - リアルタイム自動更新対応（オプション）
 * - アラート閾値の設定と表示
 * - エラーハンドリングと再試行機能
 * - アクセシビリティ対応（ARIA属性）
 * - パフォーマンス最適化（React.memo、useMemo、useCallback）
 *
 * @component
 * @param {ErrorRateChartProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element} エラー率グラフコンポーネント
 *
 * @example
 * ```tsx
 * // 基本的な使用例
 * <ErrorRateChart apiId="api-123" />
 *
 * // 日時範囲を指定した使用例
 * <ErrorRateChart
 *   apiId="api-123"
 *   startDate="2024-01-01T00:00:00Z"
 *   endDate="2024-01-31T23:59:59Z"
 *   alertThreshold={10.0}
 * />
 * ```
 */
const ErrorRateChartComponent: React.FC<ErrorRateChartProps> = ({
  apiId,
  startDate,
  endDate,
  autoRefresh = true,
  refreshInterval = 30000,
  alertThreshold = 5.0,
}) => {
  const { t } = useI18n();

  // alertThresholdのバリデーション（0-100の範囲に制限、無効な値はデフォルト値を使用）
  const validAlertThreshold = useMemo(() => {
    if (
      typeof alertThreshold !== 'number' ||
      isNaN(alertThreshold) ||
      !isFinite(alertThreshold)
    ) {
      return 5.0;
    }
    // 0-100の範囲に制限
    return Math.max(0, Math.min(100, alertThreshold));
  }, [alertThreshold]);

  // refreshIntervalのバリデーション（最小値制限、無効な値はデフォルト値を使用）
  const validRefreshInterval = useMemo(() => {
    if (
      typeof refreshInterval !== 'number' ||
      isNaN(refreshInterval) ||
      !isFinite(refreshInterval) ||
      refreshInterval < 1000
    ) {
      return 30000; // デフォルト: 30秒
    }
    return refreshInterval;
  }, [refreshInterval]);

  // 値の丸め処理関数（データ取得時に使用、useCallbackでメモ化して無限ループを防止）
  // エラー率の値を小数点以下2桁に丸める
  // バックエンドからは0-100の範囲で値が返されるため、その範囲で丸める
  const valueFormatter = useCallback((value: number): number => {
    // 無効な値のチェック
    if (isNaN(value) || !isFinite(value)) {
      return 0;
    }
    // 値の範囲を0-100に制限（バックエンド仕様に準拠）
    const clampedValue = Math.max(0, Math.min(100, value));
    // 小数点以下2桁に丸める（パーセンテージ値の丸め処理）
    return (
      Math.round(clampedValue * FORMATTING.PERCENTAGE_MULTIPLIER) /
      FORMATTING.PERCENTAGE_MULTIPLIER
    );
  }, []);

  // 共通フックを使用してデータを取得
  const { data, loading, error, loadData, isEmpty } = usePerformanceMetrics({
    apiId,
    metricType: 'error_rate',
    startDate,
    endDate,
    autoRefresh,
    refreshInterval: validRefreshInterval,
    valueFormatter,
  });

  // 表示用の値フォーマット関数（Tooltip等で使用、useCallbackでメモ化）
  // エラー率をパーセンテージ文字列としてフォーマット（例: "5.00%"）
  // バックエンドからは0-100の範囲で値が返される
  const formatValue = useCallback((value: number): string => {
    // 無効な値のチェック
    if (isNaN(value) || !isFinite(value) || value < 0) {
      return '0.00%';
    }
    // 値の範囲を0-100に制限（バックエンド仕様に準拠）
    const clampedValue = Math.max(0, Math.min(100, value));
    return `${clampedValue.toFixed(2)}%`;
  }, []);

  // アラート閾値を超えているかチェック（useMemoでメモ化）
  // バックエンドからは0-100の範囲で値が返されるため、その範囲で比較
  const hasHighErrorRate = useMemo(() => {
    if (!data || data.length === 0) {
      return false;
    }
    return data.some(item => {
      const value = item.value;
      // 値の型チェックと範囲チェック（0-100の範囲内であることを確認）
      if (
        typeof value !== 'number' ||
        !isFinite(value) ||
        value < 0 ||
        value > 100
      ) {
        return false;
      }
      return value > validAlertThreshold;
    });
  }, [data, validAlertThreshold]);

  // チャートのマージン設定（useMemoでメモ化して再計算を防止）
  const chartMargin = useMemo(
    () => ({
      top: CHART_CONFIG.MARGIN.TOP,
      right: CHART_CONFIG.MARGIN.RIGHT,
      left: CHART_CONFIG.MARGIN.LEFT,
      bottom: CHART_CONFIG.MARGIN.BOTTOM,
    }),
    []
  );

  // YAxisのdomain設定（パーセンテージ値なので0-100の範囲、useMemoでメモ化）
  const yAxisDomain = useMemo(
    () => [0, CHART_CONFIG.PERCENTAGE_DOMAIN_MAX] as [number, number],
    []
  );

  // 自動更新間隔の表示用テキスト（秒単位、useMemoでメモ化）
  const refreshIntervalSeconds = useMemo(
    () => validRefreshInterval / 1000,
    [validRefreshInterval]
  );

  if (isEmpty) {
    return (
      <div className="error-rate-chart" role="status" aria-live="polite">
        <div className="empty-container">
          <p>{t('charts.errorRate.selectApi')}</p>
        </div>
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div
        className="error-rate-chart"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="loading-container">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>{t('charts.errorRate.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-rate-chart" role="alert" aria-live="assertive">
        <div className="error-container">
          <p className="error-message" role="alert">
            ⚠️ {error}
          </p>
          <button
            className="retry-button"
            onClick={loadData}
            aria-label={t('charts.errorRate.retry')}
            type="button"
          >
            {t('charts.errorRate.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="error-rate-chart" role="status" aria-live="polite">
        <div className="empty-container">
          <p>{t('charts.errorRate.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`error-rate-chart ${hasHighErrorRate ? 'alert-active' : ''}`}
      role="region"
      aria-labelledby="error-rate-chart-title"
    >
      <div className="chart-header">
        <h3 className="chart-title" id="error-rate-chart-title">
          {t('charts.errorRate.title')}
        </h3>
        {hasHighErrorRate && (
          <span className="alert-badge" role="alert" aria-live="polite">
            ⚠️ {t('charts.errorRate.highErrorRate')}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHT}>
        <LineChart
          data={data}
          margin={chartMargin}
          aria-label={t('charts.errorRate.ariaLabel')}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            angle={-45}
            textAnchor="end"
            height={CHART_CONFIG.X_AXIS_HEIGHT}
            aria-label={t('charts.errorRate.xAxisLabel')}
          />
          <YAxis
            domain={yAxisDomain}
            label={{
              value: t('charts.errorRate.yAxisLabel'),
              angle: -90,
              position: 'insideLeft',
            }}
            aria-label={t('charts.errorRate.yAxisLabel')}
          />
          {validAlertThreshold > 0 && (
            <YAxis
              yAxisId="threshold"
              orientation="right"
              domain={yAxisDomain}
              hide
            />
          )}
          <Tooltip
            formatter={(value: number | string | number[]): string => {
              // Rechartsのformatterは配列を返すことがあるため、最初の値を取得
              const numValue = Array.isArray(value) ? value[0] : value;
              // 無効な値のチェック（formatValue内でもチェックされるが、早期リターンで安全性を向上）
              if (
                typeof numValue !== 'number' ||
                isNaN(numValue) ||
                !isFinite(numValue)
              ) {
                return '0.00%';
              }
              // formatValue内で範囲チェック（0-100）が行われる
              return formatValue(numValue);
            }}
            labelFormatter={(label: string): string =>
              t('charts.errorRate.tooltipTime', { time: label })
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.ERROR}
            strokeWidth={CHART_CONFIG.STROKE_WIDTH}
            dot={{ r: CHART_CONFIG.DOT_RADIUS }}
            name={t('charts.errorRate.legendName')}
            aria-label={t('charts.errorRate.legendName')}
          />
          {validAlertThreshold > 0 && (
            <Line
              yAxisId="threshold"
              type="monotone"
              dataKey={() => validAlertThreshold}
              stroke={CHART_COLORS.WARNING}
              strokeWidth={CHART_CONFIG.THRESHOLD_STROKE_WIDTH}
              strokeDasharray={CHART_CONFIG.STROKE_DASHARRAY}
              dot={false}
              name={t('charts.errorRate.legendThreshold', {
                threshold: validAlertThreshold,
              })}
              aria-label={t('charts.errorRate.legendThreshold', {
                threshold: validAlertThreshold,
              })}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {autoRefresh && (
        <div className="chart-footer" role="status" aria-live="polite">
          <span className="auto-refresh-indicator">
            {t('charts.errorRate.autoRefresh', {
              interval: refreshIntervalSeconds,
            })}
          </span>
        </div>
      )}
    </div>
  );
};

// React.memoでメモ化して不要な再レンダリングを防止
export const ErrorRateChart = memo(ErrorRateChartComponent);
