// ErrorRateChart - エラー率グラフコンポーネント

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './ErrorRateChart.css';

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
 * エラー率グラフコンポーネントのプロパティ
 */
interface ErrorRateChartProps {
  apiId: string;
  startDate?: string | null;
  endDate?: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
  alertThreshold?: number; // アラート閾値（デフォルト: 5%）
}

/**
 * エラー率グラフコンポーネント
 * エラー率の時系列グラフを表示します
 */
export const ErrorRateChart: React.FC<ErrorRateChartProps> = ({
  apiId,
  startDate,
  endDate,
  autoRefresh = true,
  refreshInterval = 30000,
  alertThreshold = 5.0,
}) => {
  const [data, setData] = useState<Array<{ time: string; value: number }>>([]);
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
      // アンマウントチェック
      if (!isMountedRef.current) return;
      
      setLoading(true);
      setError(null);

      const request = {
        api_id: apiId,
        metric_type: 'error_rate',
        start_date: startDate || null,
        end_date: endDate || null,
      };

      const result = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', { request });

      // APIレスポンスがnullやundefined、または配列でない場合のチェック
      const safeMetrics: PerformanceMetricInfo[] = Array.isArray(result) ? result : [];

      // データを時間順にソートし、グラフ用フォーマットに変換
      // error_rateは既に%値として保存されているため、そのまま使用
      // 無効なデータをフィルタリング
      const validMetrics = safeMetrics.filter((metric) => {
        if (!metric.timestamp || typeof metric.value !== 'number' || isNaN(metric.value)) {
          return false;
        }
        const timestamp = new Date(metric.timestamp).getTime();
        return !isNaN(timestamp);
      });

      const sortedData = validMetrics
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((metric) => ({
          time: new Date(metric.timestamp).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          value: Math.round(metric.value * 100) / 100, // パーセンテージ（小数点以下2桁）
        }));

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
    loadData();
  }, [loadData]);

  // 自動更新
  useEffect(() => {
    if (!autoRefresh || !apiId) {
      return;
    }

    const interval = setInterval(() => {
      loadData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, apiId, refreshInterval, loadData]);

  // 値フォーマット関数（useCallbackでメモ化）
  const formatValue = useCallback((value: number): string => {
    if (value <= 0 || isNaN(value)) {
      return '0.00%';
    }
    return `${value.toFixed(2)}%`;
  }, []);

  // アラート閾値を超えているかチェック
  const hasHighErrorRate = data.some((item) => item.value > alertThreshold);

  if (loading && data.length === 0) {
    return (
      <div className="error-rate-chart">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>エラー率データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-rate-chart">
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
      <div className="error-rate-chart">
        <div className="empty-container">
          <p>エラー率データがありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`error-rate-chart ${hasHighErrorRate ? 'alert-active' : ''}`}>
      <div className="chart-header">
        <h3 className="chart-title">エラー率</h3>
        {hasHighErrorRate && (
          <span className="alert-badge">⚠️ 高エラー率</span>
        )}
      </div>
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
            label={{ value: 'エラー率 (%)', angle: -90, position: 'insideLeft' }}
          />
          {alertThreshold > 0 && (
            <YAxis 
              yAxisId="threshold"
              orientation="right"
              domain={[0, 100]}
              hide
            />
          )}
          <Tooltip 
            formatter={(value: number | string | number[]) => {
              // Rechartsのformatterは配列を返すことがあるため、最初の値を取得
              const numValue = Array.isArray(value) ? value[0] : value;
              if (typeof numValue !== 'number') {
                return String(numValue);
              }
              return formatValue(numValue);
            }}
            labelFormatter={(label) => `時間: ${label}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#f44336" 
            strokeWidth={2}
            dot={{ r: 3 }}
            name="エラー率"
          />
          {alertThreshold > 0 && (
            <Line
              yAxisId="threshold"
              type="monotone"
              dataKey={() => alertThreshold}
              stroke="#ff9800"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name={`アラート閾値 (${alertThreshold}%)`}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {autoRefresh && (
        <div className="chart-footer">
          <span className="auto-refresh-indicator">自動更新: {refreshInterval / 1000}秒間隔</span>
        </div>
      )}
    </div>
  );
};

