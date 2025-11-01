// FLM - ログ統計情報コンポーネント
// フロントエンドエージェント (FE) 実装
// F006: ログ表示機能 - ログ統計情報コンポーネント実装

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './LogStatistics.css';

/**
 * ログ統計情報
 */
interface LogStatistics {
  total_requests: number;
  avg_response_time_ms: number;
  error_rate: number;
  status_code_distribution: Array<[number, number]>;
}

/**
 * ログ統計情報コンポーネントのプロパティ
 */
interface LogStatisticsProps {
  apiId: string | null;
  startDate?: string | null;
  endDate?: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
}

/**
 * ログ統計情報コンポーネント
 * リクエスト統計情報を表示します
 */
export const LogStatistics: React.FC<LogStatisticsProps> = ({
  apiId,
  startDate = null,
  endDate = null,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [statistics, setStatistics] = useState<LogStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 統計情報を取得
  const loadStatistics = useCallback(async () => {
    if (!apiId) {
      setStatistics(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const request = {
        api_id: apiId,
        start_date: startDate || null,
        end_date: endDate || null,
      };
      const result = await invoke<LogStatistics>('get_log_statistics', request);

      setStatistics(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '統計情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [apiId, startDate, endDate]);

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
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, apiId, refreshInterval, loadStatistics]);

  // グラフ用データの準備
  const chartData = statistics
    ? statistics.status_code_distribution.map(([status, count]) => ({
        status: status.toString(),
        count,
      }))
    : [];

  // 円グラフ用データ
  const pieData = chartData.map((item) => ({
    name: item.status,
    value: item.count,
  }));

  // ステータスコードの色を取得
  const getStatusColor = (status: number): string => {
    if (status >= 200 && status < 300) return '#4caf50';
    if (status >= 300 && status < 400) return '#ff9800';
    if (status >= 400 && status < 500) return '#f44336';
    if (status >= 500) return '#d32f2f';
    return '#757575';
  };

  // COLORS for pie chart
  const COLORS = chartData.map((item) => getStatusColor(parseInt(item.status)));

  if (loading && !statistics) {
    return (
      <div className="log-statistics">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>統計情報を読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="log-statistics">
        <div className="error-container">
          <p className="error-message">⚠️ {error}</p>
          <button className="retry-button" onClick={loadStatistics}>
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="log-statistics">
        <div className="empty-container">
          <p>統計情報がありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="log-statistics">
      <h3 className="statistics-title">統計情報</h3>

      {/* 統計サマリーカード */}
      <div className="statistics-summary">
        <div className="stat-card">
          <div className="stat-label">リクエスト総数</div>
          <div className="stat-value">{statistics.total_requests.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">平均レスポンス時間</div>
          <div className="stat-value">
            {statistics.avg_response_time_ms.toFixed(2)}ms
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">エラー率</div>
          <div className={`stat-value ${statistics.error_rate > 5 ? 'error-high' : ''}`}>
            {statistics.error_rate.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* ステータスコード分布グラフ */}
      {chartData.length > 0 && (
        <div className="statistics-charts">
          {/* 棒グラフ */}
          <div className="chart-container">
            <h4 className="chart-title">ステータスコード分布（棒グラフ）</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#667eea" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 円グラフ */}
          <div className="chart-container">
            <h4 className="chart-title">ステータスコード分布（円グラフ）</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
        <div className="empty-chart">
          <p>ステータスコード分布データがありません</p>
        </div>
      )}
    </div>
  );
};
