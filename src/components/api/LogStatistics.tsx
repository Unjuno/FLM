// LogStatistics - ログ統計情報コンポーネント

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from 'react';
import { safeInvoke } from '../../utils/tauri';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  HTTP_STATUS,
  FORMATTING,
  UI_WARNING_THRESHOLDS,
  CHART_CONFIG,
  CHART_COLORS,
} from '../../constants/config';
import { useI18n } from '../../contexts/I18nContext';
import {
  formatNumber,
  formatResponseTimeMs,
  formatErrorRate,
} from '../../utils/formatters';
import './LogStatistics.css';

/**
 * ステータスコード分布のタプル型
 * [ステータスコード, 件数]
 */
type StatusCodeTuple = [number, number];

/**
 * ログ統計情報
 *
 * @interface LogStatistics
 * @property {number} total_requests - 総リクエスト数（0以上）
 * @property {number} avg_response_time_ms - 平均レスポンス時間（ミリ秒、0以上）
 * @property {number} error_rate - エラー率（0-100の範囲、パーセンテージ）
 * @property {StatusCodeTuple[]} status_code_distribution - ステータスコード分布（[ステータスコード, 件数]の配列）
 */
interface LogStatistics {
  /** 総リクエスト数 */
  total_requests: number;
  /** 平均レスポンス時間（ミリ秒） */
  avg_response_time_ms: number;
  /** エラー率（0-100の範囲、パーセンテージ） */
  error_rate: number;
  /** ステータスコード分布（[ステータスコード, 件数]の配列） */
  status_code_distribution: StatusCodeTuple[];
}

/**
 * バックエンドから受け取る生データの型（検証前）
 */
interface RawLogStatistics {
  total_requests?: unknown;
  avg_response_time_ms?: unknown;
  error_rate?: unknown;
  status_code_distribution?: unknown;
}

/**
 * ステータスコードタプルが有効かどうかを検証
 * @param tuple - 検証するタプル
 * @returns 有効な場合はtrue
 */
function isValidStatusCodeTuple(tuple: unknown): tuple is StatusCodeTuple {
  if (!Array.isArray(tuple) || tuple.length !== 2) {
    return false;
  }
  const [status, count] = tuple;
  return (
    typeof status === 'number' &&
    isFinite(status) &&
    status >= 100 &&
    status < 600 &&
    typeof count === 'number' &&
    isFinite(count) &&
    count >= 0
  );
}

/**
 * 数値が有効な非負数かどうかを検証
 * @param value - 検証する値
 * @returns 有効な場合はtrue
 */
function isValidNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && value >= 0;
}

/**
 * ログ統計情報を検証して正規化する
 * @param raw - バックエンドから受け取った生データ
 * @returns 検証済みのLogStatisticsオブジェクト
 */
function validateAndNormalizeStatistics(raw: RawLogStatistics): LogStatistics {
  return {
    total_requests: isValidNonNegativeNumber(raw.total_requests)
      ? Math.floor(raw.total_requests)
      : 0,
    avg_response_time_ms: isValidNonNegativeNumber(raw.avg_response_time_ms)
      ? raw.avg_response_time_ms
      : 0,
    error_rate:
      typeof raw.error_rate === 'number' && isFinite(raw.error_rate)
        ? Math.max(0, Math.min(100, raw.error_rate))
        : 0,
    status_code_distribution: Array.isArray(raw.status_code_distribution)
      ? raw.status_code_distribution.filter(isValidStatusCodeTuple)
      : [],
  };
}

/**
 * ログ統計情報コンポーネントのプロパティ
 *
 * @interface LogStatisticsProps
 * @property {string | null} apiId - 表示するAPIのID（nullの場合は全てのAPI）
 * @property {string | null} [startDate] - データ取得の開始日時（ISO 8601形式、オプション）
 * @property {string | null} [endDate] - データ取得の終了日時（ISO 8601形式、オプション）
 * @property {boolean} [autoRefresh=true] - 自動更新を有効にするかどうか（デフォルト: true）
 * @property {number} [refreshInterval=30000] - 自動更新の間隔（ミリ秒、最小値: 1000ms、デフォルト: 30000ms）
 *
 * @example
 * ```tsx
 * <LogStatistics
 *   apiId="api-123"
 *   startDate="2024-01-01T00:00:00Z"
 *   endDate="2024-01-31T23:59:59Z"
 *   autoRefresh={true}
 *   refreshInterval={30000}
 * />
 * ```
 */
interface LogStatisticsProps {
  /** 表示するAPIのID（nullの場合は全てのAPI） */
  apiId: string | null;
  /** データ取得の開始日時（ISO 8601形式、オプション） */
  startDate?: string | null;
  /** データ取得の終了日時（ISO 8601形式、オプション） */
  endDate?: string | null;
  /** 自動更新を有効にするかどうか（デフォルト: true） */
  autoRefresh?: boolean;
  /** 自動更新の間隔（ミリ秒、最小値: 1000ms、デフォルト: 30000ms） */
  refreshInterval?: number;
}

/**
 * ログ統計情報コンポーネント
 *
 * APIのリクエスト統計情報を表示します。総リクエスト数、平均レスポンス時間、エラー率、
 * ステータスコード分布をグラフとカードで可視化します。
 *
 * 特徴:
 * - リアルタイム自動更新対応（オプション）
 * - エラーハンドリングと再試行機能
 * - アクセシビリティ対応（ARIA属性）
 * - パフォーマンス最適化（React.memo、useMemo、useCallback）
 * - 棒グラフと円グラフによるステータスコード分布の可視化
 *
 * @component
 * @param {LogStatisticsProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element} ログ統計情報コンポーネント
 *
 * @example
 * ```tsx
 * // 基本的な使用例
 * <LogStatistics apiId="api-123" />
 *
 * // 日時範囲を指定した使用例
 * <LogStatistics
 *   apiId="api-123"
 *   startDate="2024-01-01T00:00:00Z"
 *   endDate="2024-01-31T23:59:59Z"
 *   autoRefresh={true}
 * />
 * ```
 */
const LogStatisticsComponent: React.FC<LogStatisticsProps> = ({
  apiId,
  startDate = null,
  endDate = null,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const { t } = useI18n();
  const [statistics, setStatistics] = useState<LogStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

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

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 統計情報を取得（useCallbackでメモ化、メモリリーク対策）
  const loadStatistics = useCallback(async () => {
    if (!isMountedRef.current) return;

    if (!apiId) {
      if (isMountedRef.current) {
        setStatistics(null);
        setLoading(false);
      }
      return;
    }

    try {
      if (!isMountedRef.current) return;

      setLoading(true);
      setError(null);

      const request = {
        api_id: apiId,
        start_date: startDate || null,
        end_date: endDate || null,
      };
      const result = await safeInvoke<RawLogStatistics>(
        'get_log_statistics',
        request
      );

      if (!isMountedRef.current) return;

      // データのバリデーション（null/undefined、無効な値のチェック）
      if (!result || typeof result !== 'object') {
        setError(t('logStatistics.error.loadFailed'));
        return;
      }

      // 統計データの検証と正規化（型安全性の向上）
      const validatedStatistics = validateAndNormalizeStatistics(result);

      setStatistics(validatedStatistics);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(
        err instanceof Error ? err.message : t('logStatistics.error.loadFailed')
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiId, startDate, endDate, t]);

  // 初回読み込み
  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // 自動更新
  useEffect(() => {
    if (!autoRefresh || !apiId) {
      return;
    }

    const interval = setInterval(() => {
      loadStatistics();
    }, validRefreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, apiId, validRefreshInterval, loadStatistics]);

  // グラフ用データの準備（useMemoでメモ化してパフォーマンス最適化）
  const chartData = useMemo(() => {
    if (!statistics) return [];
    return statistics.status_code_distribution.map(([status, count]) => ({
      status: status.toString(),
      count,
    }));
  }, [statistics]);

  // 円グラフ用データ（useMemoでメモ化してパフォーマンス最適化）
  const pieData = useMemo(() => {
    return chartData.map(item => ({
      name: item.status,
      value: item.count,
    }));
  }, [chartData]);

  // ステータスコードの色を取得（useCallbackでメモ化）
  const getStatusColor = useCallback((status: number): string => {
    if (status >= HTTP_STATUS.OK && status < 300) return CHART_COLORS.SUCCESS;
    if (status >= 300 && status < HTTP_STATUS.MIN_ERROR_CODE)
      return CHART_COLORS.WARNING;
    if (status >= HTTP_STATUS.MIN_ERROR_CODE && status < 500)
      return CHART_COLORS.ERROR;
    if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR)
      return CHART_COLORS.ERROR_DARK;
    return CHART_COLORS.GRAY;
  }, []);

  // フォーマット関数（useCallbackでメモ化してパフォーマンス最適化）
  // ユーティリティ関数をラップして、コンポーネント内でのメモ化を維持
  const formatTotalRequests = useCallback((value: number): string => {
    if (
      typeof value !== 'number' ||
      isNaN(value) ||
      !isFinite(value) ||
      value < 0
    ) {
      return formatNumber(0);
    }
    return formatNumber(value);
  }, []);

  const formatResponseTime = useCallback((value: number): string => {
    return formatResponseTimeMs(value);
  }, []);

  const formatErrorRateValue = useCallback((value: number): string => {
    return formatErrorRate(value);
  }, []);

  // COLORS for pie chart（useMemoでメモ化）
  const COLORS = useMemo(() => {
    return chartData.map(item => {
      const status = parseInt(item.status, 10);
      // parseIntの結果がNaNでないことを確認
      if (isNaN(status) || !isFinite(status)) {
        return CHART_COLORS.GRAY;
      }
      return getStatusColor(status);
    });
  }, [chartData, getStatusColor]);

  // PieChartのlabel関数（useCallbackでメモ化）
  const pieLabelFormatter = useCallback(
    ({ name, percent }: { name: string; percent: number }): string => {
      return `${name}: ${(percent * FORMATTING.PERCENTAGE_MULTIPLIER).toFixed(FORMATTING.DECIMAL_PLACES_SHORT)}%`;
    },
    []
  );

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

  if (loading && !statistics) {
    return (
      <div
        className="log-statistics"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="loading-container">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>{t('logStatistics.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="log-statistics" role="alert" aria-live="assertive">
        <div className="error-container">
          <p className="error-message" role="alert">
            ⚠️ {error}
          </p>
          <button
            className="retry-button"
            onClick={loadStatistics}
            aria-label={t('logStatistics.retry')}
            type="button"
          >
            {t('logStatistics.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="log-statistics" role="status" aria-live="polite">
        <div className="empty-container">
          <p>{t('logStatistics.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="log-statistics"
      role="region"
      aria-labelledby="statistics-title"
    >
      <h3 className="statistics-title" id="statistics-title">
        {t('logStatistics.title')}
      </h3>

      {/* 統計サマリーカード */}
      <div
        className="statistics-summary"
        role="group"
        aria-label={t('logStatistics.summary.label')}
      >
        <div
          className="stat-card"
          role="group"
          aria-label={t('logStatistics.summary.totalRequests.label')}
        >
          <div className="stat-label">
            {t('logStatistics.summary.totalRequests.label')}
          </div>
          <div className="stat-value" aria-live="polite">
            {formatTotalRequests(statistics.total_requests)}
          </div>
        </div>
        <div
          className="stat-card"
          role="group"
          aria-label={t('logStatistics.summary.avgResponseTime.label')}
        >
          <div className="stat-label">
            {t('logStatistics.summary.avgResponseTime.label')}
          </div>
          <div className="stat-value" aria-live="polite">
            {formatResponseTime(statistics.avg_response_time_ms)}
          </div>
        </div>
        <div
          className="stat-card"
          role="group"
          aria-label={t('logStatistics.summary.errorRate.label')}
        >
          <div className="stat-label">
            {t('logStatistics.summary.errorRate.label')}
          </div>
          <div
            className={`stat-value ${statistics.error_rate > UI_WARNING_THRESHOLDS.ERROR_RATE_HIGH ? 'error-high' : ''}`}
            aria-live="polite"
            aria-label={t('logStatistics.summary.errorRate.ariaLabel', {
              rate: formatErrorRateValue(statistics.error_rate),
              warning:
                statistics.error_rate > UI_WARNING_THRESHOLDS.ERROR_RATE_HIGH
                  ? t('logStatistics.summary.errorRate.warningExceeded')
                  : '',
            })}
          >
            {formatErrorRateValue(statistics.error_rate)}
          </div>
        </div>
      </div>

      {/* ステータスコード分布グラフ */}
      {chartData.length > 0 && (
        <div
          className="statistics-charts"
          role="group"
          aria-label={t('logStatistics.charts.label')}
        >
          {/* 棒グラフ */}
          <div
            className="chart-container"
            role="img"
            aria-label={t('logStatistics.charts.barChart.ariaLabel')}
          >
            <h4 className="chart-title">
              {t('logStatistics.charts.barChart.title')}
            </h4>
            <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHT}>
              <BarChart
                data={chartData}
                margin={chartMargin}
                aria-label={t('logStatistics.charts.barChart.ariaLabel')}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="status"
                  aria-label={t('logStatistics.charts.barChart.xAxisLabel')}
                />
                <YAxis
                  aria-label={t('logStatistics.charts.barChart.yAxisLabel')}
                />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="count"
                  fill={CHART_COLORS.PRIMARY}
                  aria-label={t('logStatistics.charts.barChart.yAxisLabel')}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 円グラフ */}
          <div
            className="chart-container"
            role="img"
            aria-label={t('logStatistics.charts.pieChart.ariaLabel')}
          >
            <h4 className="chart-title">
              {t('logStatistics.charts.pieChart.title')}
            </h4>
            <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHT}>
              <PieChart
                margin={chartMargin}
                aria-label={t('logStatistics.charts.pieChart.ariaLabel')}
              >
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={pieLabelFormatter}
                  outerRadius={CHART_CONFIG.PIE_OUTER_RADIUS}
                  fill={CHART_COLORS.SECONDARY}
                  dataKey="value"
                  aria-label={t('logStatistics.charts.pieChart.dataLabel')}
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="empty-chart" role="status" aria-live="polite">
          <p>{t('logStatistics.charts.noData')}</p>
        </div>
      )}
    </div>
  );
};

// React.memoでメモ化して不要な再レンダリングを防止
export const LogStatistics = memo(LogStatisticsComponent);
