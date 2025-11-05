// PerformanceDashboard - パフォーマンスダッシュボードページ

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { ResponseTimeChart } from '../components/api/ResponseTimeChart';
import { RequestCountChart } from '../components/api/RequestCountChart';
import { ResourceUsageChart } from '../components/api/ResourceUsageChart';
import { ErrorRateChart } from '../components/api/ErrorRateChart';
import { PerformanceSummary } from '../components/api/PerformanceSummary';
import { Tooltip } from '../components/common/Tooltip';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import { printSelector } from '../utils/print';
import { REFRESH_INTERVALS } from '../constants/config';
import { logger } from '../utils/logger';
import type { ApiInfo } from '../types/api';
import './PerformanceDashboard.css';

/**
 * 期間選択オプション
 */
type PeriodOption = '1h' | '24h' | '7d';

// PERIOD_OPTIONSは多言語対応のためにコンポーネント内で動的に生成

/**
 * パフォーマンスダッシュボードページ
 * APIのパフォーマンスメトリクスを表示・監視します
 */
export const PerformanceDashboard: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [apis, setApis] = useState<ApiInfo[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // 期間選択オプション（多言語対応）
  const periodOptions = useMemo(() => [
    { value: '1h' as PeriodOption, label: t('performanceDashboard.period1h') },
    { value: '24h' as PeriodOption, label: t('performanceDashboard.period24h') },
    { value: '7d' as PeriodOption, label: t('performanceDashboard.period7d') },
  ], [t]);

  // API一覧を取得
  const loadApis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // バックエンドのIPCコマンドを呼び出し（safeInvokeが内部でチェックを行う）
      const result = await safeInvoke<Array<{
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        status: string;
        created_at: string;
        updated_at: string;
      }>>('list_apis');
      
      // レスポンスをApiInfo形式に変換
      const apiInfos: ApiInfo[] = result.map(api => ({
        id: api.id,
        name: api.name,
        model_name: api.model_name,
        port: api.port,
        status: (api.status === 'running' ? 'running' : 'stopped') as 'running' | 'stopped',
        endpoint: api.endpoint,
        created_at: api.created_at,
        updated_at: api.updated_at,
      }));
      
      setApis(apiInfos);
      
      // APIが1つ以上ある場合は、最初のAPIを選択（初期化時のみ）
      setSelectedApiId(prev => {
        if (!prev && apiInfos.length > 0) {
          return apiInfos[0].id;
        }
        return prev;
      });
      
      // APIが存在しない場合は、エラーではなく空の状態として扱う
      if (apiInfos.length === 0) {
        setSelectedApiId('');
        setError(null); // エラーをクリア（空の状態は正常）
      }
    } catch (err) {
      // エラーの詳細情報を取得
      let errorMessage = t('performanceDashboard.error.loadApisError');
      if (err instanceof Error) {
        errorMessage = err.message;
        // invokeが未定義の場合の特別な処理
        if (errorMessage.includes('invoke') || errorMessage.includes('undefined') || errorMessage.includes('Cannot read properties') || errorMessage.includes('アプリケーションが正しく起動')) {
          errorMessage = 'Tauri環境が初期化されていません。アプリケーションを再起動してください。';
          logger.warn('Tauri環境が初期化されていません', 'PerformanceDashboard');
        } else {
          logger.error('API一覧取得エラー詳細', err instanceof Error ? err : new Error(String(err)), 'PerformanceDashboard');
        }
      } else {
        logger.error('API一覧取得エラー（非Error型）', err, 'PerformanceDashboard');
        errorMessage = String(err);
      }
      
      // エラーメッセージを表示
      setError(errorMessage);
      
      // エラー時も空のリストとして扱い、ユーザーが操作できるようにする
      setApis([]);
      setSelectedApiId('');
    } finally {
      setLoading(false);
    }
  }, []);

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
            <p>{t('performanceDashboard.loading')}</p>
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
            <Tooltip content={t('header.home')}>
              <button className="back-button" onClick={() => navigate('/')}>
                {t('performanceDashboard.backToHome')}
              </button>
            </Tooltip>
            <h1>{t('performanceDashboard.title')}</h1>
          </div>
          <div className="header-actions">
            <Tooltip content={t('performanceDashboard.refresh')}>
              <button className="refresh-button" onClick={loadApis}>
                {t('performanceDashboard.refresh')}
              </button>
            </Tooltip>
            <Tooltip content={t('performanceDashboard.print')}>
              <button 
                className="print-button no-print" 
                onClick={() => printSelector('.performance-dashboard-content', t('performanceDashboard.title'))}
              >
                {t('performanceDashboard.print')}
              </button>
            </Tooltip>
          </div>
        </header>

        {error && apis.length === 0 && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
            onRetry={loadApis}
            suggestion={t('performanceDashboard.error.noApisSuggestion')}
          />
        )}

        <div className="performance-dashboard-content">
          {/* コントロールパネル */}
          <div className="controls-panel">
            {/* API選択 */}
            <div className="control-group">
              <Tooltip content={t('performanceDashboard.selectApiHint')}>
                <label htmlFor="api-select">{t('performanceDashboard.selectApi')}</label>
              </Tooltip>
              <Tooltip content={t('performanceDashboard.selectApiHint')} position="bottom">
                <select
                  id="api-select"
                  value={selectedApiId}
                  onChange={handleApiChange}
                  className="api-select"
                  title={t('performanceDashboard.selectApi')}
                  aria-label={t('performanceDashboard.selectApi')}
                >
                  <option value="">{t('performanceDashboard.selectApiPlaceholder')}</option>
                  {apis.map((api) => (
                    <option key={api.id} value={api.id}>
                      {api.name} ({api.endpoint})
                    </option>
                  ))}
                </select>
              </Tooltip>
              {selectedApi && (
                <div className="selected-api-info">
                  <span className="info-label">{t('performanceDashboard.selectedApi')}</span>
                  <span className="info-value">{selectedApi.name}</span>
                </div>
              )}
            </div>

            {/* 期間選択 */}
            <div className="control-group">
              <Tooltip content={t('performanceDashboard.periodHint')}>
                <label htmlFor="period-select">{t('performanceDashboard.period')}</label>
              </Tooltip>
              <Tooltip content={t('performanceDashboard.periodHint')} position="bottom">
                <select
                  id="period-select"
                  value={selectedPeriod}
                  onChange={handlePeriodChange}
                  className="period-select"
                  title={t('performanceDashboard.period')}
                  aria-label={t('performanceDashboard.period')}
                >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                </select>
              </Tooltip>
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
                refreshInterval={REFRESH_INTERVALS.PERFORMANCE}
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
                    refreshInterval={REFRESH_INTERVALS.PERFORMANCE}
                  />
                </div>

                {/* リクエスト数グラフ */}
                <div className="chart-item">
                  <RequestCountChart
                    apiId={selectedApiId}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    autoRefresh={true}
                    refreshInterval={REFRESH_INTERVALS.PERFORMANCE}
                  />
                </div>

                {/* CPU/メモリ使用量グラフ */}
                <div className="chart-item">
                  <ResourceUsageChart
                    apiId={selectedApiId}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    autoRefresh={true}
                    refreshInterval={REFRESH_INTERVALS.PERFORMANCE}
                  />
                </div>

                {/* エラー率グラフ */}
                <div className="chart-item">
                  <ErrorRateChart
                    apiId={selectedApiId}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    autoRefresh={true}
                    refreshInterval={REFRESH_INTERVALS.PERFORMANCE}
                    alertThreshold={5.0}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h2>
                {apis.length === 0 && !error ? t('performanceDashboard.emptyState.noApiTitle') : t('performanceDashboard.emptyState.selectApiTitle')}
              </h2>
              <p>
                {apis.length === 0 && !error ? (
                  <>
                    {t('performanceDashboard.emptyState.noApiMessage')}
                    <br />
                    <button 
                      className="create-api-button"
                      onClick={() => navigate('/api/create')}
                    >
                      {t('performanceDashboard.emptyState.createApi')}
                    </button>
                  </>
                ) : (
                  t('performanceDashboard.emptyState.selectApiMessage')
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

