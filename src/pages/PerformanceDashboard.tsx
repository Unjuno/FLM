// FLM - パフォーマンスダッシュボードページ
// フロントエンドエージェント (FE) 実装
// F007: パフォーマンス監視機能 - パフォーマンスダッシュボード基本実装

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { ResponseTimeChart } from '../components/api/ResponseTimeChart';
import { RequestCountChart } from '../components/api/RequestCountChart';
import { ResourceUsageChart } from '../components/api/ResourceUsageChart';
import { ErrorRateChart } from '../components/api/ErrorRateChart';
import { PerformanceSummary } from '../components/api/PerformanceSummary';
import './PerformanceDashboard.css';

/**
 * API情報
 */
interface ApiInfo {
  id: string;
  name: string;
  model_name: string;
  port: number;
  status: string;
  endpoint: string;
  created_at: string;
  updated_at: string;
}

/**
 * 期間選択オプション
 */
type PeriodOption = '1h' | '24h' | '7d';

const PERIOD_OPTIONS: Array<{ value: PeriodOption; label: string }> = [
  { value: '1h', label: '1時間' },
  { value: '24h', label: '24時間' },
  { value: '7d', label: '7日間' },
];

/**
 * パフォーマンスダッシュボードページ
 * APIのパフォーマンスメトリクスを表示・監視します
 */
export const PerformanceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [apis, setApis] = useState<ApiInfo[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API一覧を取得
  const loadApis = useCallback(async () => {
    try {
      const result = await invoke<ApiInfo[]>('list_apis');
      setApis(result);
      
      // APIが1つ以上ある場合は、最初のAPIを選択
      if (result.length > 0 && !selectedApiId) {
        setSelectedApiId(result[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [selectedApiId]);

  // 初期化とAPI一覧取得
  useEffect(() => {
    loadApis();
  }, [loadApis]);

  // API選択変更ハンドラ
  const handleApiChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedApiId(event.target.value);
  };

  // 期間選択変更ハンドラ
  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(event.target.value as PeriodOption);
  };

  // 期間に応じた日時範囲を計算
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    
    switch (selectedPeriod) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '24h':
        start.setHours(start.getHours() - 24);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
    }
    
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [selectedPeriod]);

  // 選択されたAPIの情報を取得
  const selectedApi = apis.find(api => api.id === selectedApiId);

  if (loading && apis.length === 0) {
    return (
      <div className="performance-dashboard-page">
        <div className="performance-dashboard-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>パフォーマンスダッシュボードを読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-dashboard-page">
      <div className="performance-dashboard-container">
        <header className="performance-dashboard-header">
          <div className="header-top">
            <button className="back-button" onClick={() => navigate('/')}>
              ← ホームに戻る
            </button>
            <h1>パフォーマンスダッシュボード</h1>
          </div>
          <div className="header-actions">
            <button className="refresh-button" onClick={loadApis}>
              🔄 更新
            </button>
          </div>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
            onRetry={loadApis}
          />
        )}

        <div className="performance-dashboard-content">
          {/* コントロールパネル */}
          <div className="controls-panel">
            {/* API選択 */}
            <div className="control-group">
              <label htmlFor="api-select">監視するAPI:</label>
              <select
                id="api-select"
                value={selectedApiId}
                onChange={handleApiChange}
                className="api-select"
              >
                <option value="">APIを選択してください</option>
                {apis.map((api) => (
                  <option key={api.id} value={api.id}>
                    {api.name} ({api.endpoint})
                  </option>
                ))}
              </select>
              {selectedApi && (
                <div className="selected-api-info">
                  <span className="info-label">選択中:</span>
                  <span className="info-value">{selectedApi.name}</span>
                </div>
              )}
            </div>

            {/* 期間選択 */}
            <div className="control-group">
              <label htmlFor="period-select">期間:</label>
              <select
                id="period-select"
                value={selectedPeriod}
                onChange={handlePeriodChange}
                className="period-select"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ダッシュボードコンテンツ */}
          {selectedApiId ? (
            <div className="dashboard-content">
              {/* 統計サマリーカード */}
              <PerformanceSummary
                apiId={selectedApiId}
                period={selectedPeriod}
                autoRefresh={true}
                refreshInterval={30000}
              />

              {/* グラフセクション */}
              <div className="charts-grid">
                {/* レスポンス時間グラフ */}
                <div className="chart-item">
                  <ResponseTimeChart
                    apiId={selectedApiId}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    autoRefresh={true}
                    refreshInterval={30000}
                  />
                </div>

                {/* リクエスト数グラフ */}
                <div className="chart-item">
                  <RequestCountChart
                    apiId={selectedApiId}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    autoRefresh={true}
                    refreshInterval={30000}
                  />
                </div>

                {/* CPU/メモリ使用量グラフ */}
                <div className="chart-item">
                  <ResourceUsageChart
                    apiId={selectedApiId}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    autoRefresh={true}
                    refreshInterval={30000}
                  />
                </div>

                {/* エラー率グラフ */}
                <div className="chart-item">
                  <ErrorRateChart
                    apiId={selectedApiId}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    autoRefresh={true}
                    refreshInterval={30000}
                    alertThreshold={5.0}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h2>APIを選択してください</h2>
              <p>監視したいAPIを選択すると、パフォーマンスメトリクスが表示されます。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

