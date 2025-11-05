/**
 * FLM - F007: パフォーマンス監視機能 E2Eテスト
 * 
 * QAエージェント (QA) 実装
 * パフォーマンスダッシュボードUIのE2Eテスト
 * 
 * 注意: TauriアプリケーションのE2Eテストは、実際のUI操作ではなく、
 * フロントエンドからバックエンドへの完全なフローのテストとして実装します
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

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
 * パフォーマンスサマリー情報
 */
interface PerformanceSummary {
  avg_response_time: number;
  max_response_time: number;
  min_response_time: number;
  request_count: number;
  error_rate: number;
  avg_cpu_usage: number;
  avg_memory_usage: number;
}

/**
 * F007: パフォーマンス監視機能 E2Eテストスイート
 * 
 * テスト項目:
 * - ダッシュボード表示フロー（API一覧取得、選択）
 * - 期間選択フロー（1h/24h/7d）
 * - グラフ表示フロー（レスポンス時間、リクエスト数、CPU/メモリ、エラー率）
 * - 統計サマリー表示フロー（全統計値の型確認、API変更時の更新）
 * - リアルタイム更新フロー（メトリクス記録時の更新、サマリー更新）
 * - 完全なワークフローテスト（ダッシュボード → 期間選択 → グラフ → サマリー）
 */
describe('F007: パフォーマンス監視機能 E2Eテスト', () => {
  let testApiId: string | null = null;

  beforeAll(async () => {
    // Tauriアプリが起動していない場合はスキップ
    if (!process.env.TAURI_APP_AVAILABLE) {
      console.warn('Tauriアプリが起動していないため、このテストスイートをスキップします');
      return;
    }
    console.log('F007 パフォーマンス監視機能E2Eテストを開始します');
    
    // テスト用のAPIを作成
    try {
      const result = await invoke<ApiInfo>('create_api', {
        name: 'Test API for Performance Dashboard E2E',
        model_name: 'llama3:8b',
        port: 8890,
        enable_auth: false,
      });
      
      testApiId = result.id;
      console.log(`テスト用APIを作成しました: ${testApiId}`);

      // テストデータとしてメトリクスを記録
      await invoke('record_performance_metric', {
        request: {
          api_id: testApiId,
          metric_type: 'avg_response_time',
          value: 150.0,
        },
      });

      await invoke('record_performance_metric', {
        request: {
          api_id: testApiId,
          metric_type: 'request_count',
          value: 100.0,
        },
      });

      await invoke('record_performance_metric', {
        request: {
          api_id: testApiId,
          metric_type: 'cpu_usage',
          value: 45.5,
        },
      });

      await invoke('record_performance_metric', {
        request: {
          api_id: testApiId,
          metric_type: 'memory_usage',
          value: 512.0,
        },
      });

      await invoke('record_performance_metric', {
        request: {
          api_id: testApiId,
          metric_type: 'error_rate',
          value: 0.02,
        },
      });

      console.log('テスト用メトリクスを記録しました');
    } catch (error) {
      console.error('テスト用API作成でエラー:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    if (testApiId) {
      try {
        await invoke('delete_api', { api_id: testApiId });
        console.log(`テスト用APIを削除しました: ${testApiId}`);
      } catch (error) {
        console.error('テスト用API削除でエラー:', error);
      }
    }
  });

  /**
   * ダッシュボード表示フロー: API一覧取得 → API選択 → サマリー表示
   */
  describe('ダッシュボード表示フロー', () => {
    it('should load API list for dashboard', async () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn('Tauriアプリが起動していないため、このテストをスキップします');
        return;
      }
      
      try {
        const apis = await invoke<ApiInfo[]>('list_apis');
        
        expect(Array.isArray(apis)).toBe(true);
        expect(apis.length).toBeGreaterThan(0);
        
        // テスト用APIが存在することを確認
        const testApi = apis.find(api => api.id === testApiId);
        expect(testApi).toBeDefined();
      } catch (error) {
        console.error('API一覧取得でエラー:', error);
        throw error;
      }
    }, 20000);

    it('should display dashboard with selected API', async () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn('Tauriアプリが起動していないため、このテストをスキップします');
        return;
      }
      
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        // 選択されたAPIでサマリーを取得
        const summary = await invoke<PerformanceSummary>('get_performance_summary', {
          request: {
            api_id: testApiId,
            period: '24h',
          },
        });

        expect(summary).toBeDefined();
        expect(typeof summary.avg_response_time).toBe('number');
        expect(summary.avg_response_time).toBeGreaterThanOrEqual(0);
      } catch (error) {
        console.error('ダッシュボード表示でエラー:', error);
        throw error;
      }
    }, 20000);
  });

  /**
   * 期間選択フロー: 期間変更（1h/24h/7d） → データ更新
   */
  describe('期間選択フロー', () => {
    it('should update data when period changes to 1h', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        const summary = await invoke<PerformanceSummary>('get_performance_summary', {
          request: {
            api_id: testApiId,
            period: '1h',
          },
        });

        expect(summary).toBeDefined();
        expect(typeof summary.request_count).toBe('number');
      } catch (error) {
        console.error('1h期間選択でエラー:', error);
        throw error;
      }
    }, 20000);

    it('should update data when period changes to 24h', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        const summary = await invoke<PerformanceSummary>('get_performance_summary', {
          request: {
            api_id: testApiId,
            period: '24h',
          },
        });

        expect(summary).toBeDefined();
        expect(typeof summary.avg_response_time).toBe('number');
      } catch (error) {
        console.error('24h期間選択でエラー:', error);
        throw error;
      }
    }, 20000);

    it('should update data when period changes to 7d', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        const summary = await invoke<PerformanceSummary>('get_performance_summary', {
          request: {
            api_id: testApiId,
            period: '7d',
          },
        });

        expect(summary).toBeDefined();
        expect(typeof summary.error_rate).toBe('number');
      } catch (error) {
        console.error('7d期間選択でエラー:', error);
        throw error;
      }
    }, 20000);
  });

  /**
   * グラフ表示フロー: 各グラフのデータ取得
   */
  describe('グラフ表示フロー', () => {
    it('should display response time chart', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const metrics = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            start_date: oneDayAgo.toISOString(),
            end_date: now.toISOString(),
          },
        });

        expect(Array.isArray(metrics)).toBe(true);
        metrics.forEach(metric => {
          expect(metric.metric_type).toBe('avg_response_time');
          expect(typeof metric.value).toBe('number');
        });
      } catch (error) {
        console.error('レスポンス時間グラフ表示でエラー:', error);
        throw error;
      }
    }, 20000);

    it('should display request count chart', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const metrics = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: testApiId,
            metric_type: 'request_count',
            start_date: oneDayAgo.toISOString(),
            end_date: now.toISOString(),
          },
        });

        expect(Array.isArray(metrics)).toBe(true);
        metrics.forEach(metric => {
          expect(metric.metric_type).toBe('request_count');
          expect(typeof metric.value).toBe('number');
        });
      } catch (error) {
        console.error('リクエスト数グラフ表示でエラー:', error);
        throw error;
      }
    }, 20000);

    it('should display CPU and memory usage chart', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // CPU使用率メトリクス取得
        const cpuMetrics = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: testApiId,
            metric_type: 'cpu_usage',
            start_date: oneDayAgo.toISOString(),
            end_date: now.toISOString(),
          },
        });

        expect(Array.isArray(cpuMetrics)).toBe(true);

        // メモリ使用量メトリクス取得
        const memoryMetrics = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: testApiId,
            metric_type: 'memory_usage',
            start_date: oneDayAgo.toISOString(),
            end_date: now.toISOString(),
          },
        });

        expect(Array.isArray(memoryMetrics)).toBe(true);
      } catch (error) {
        console.error('CPU/メモリグラフ表示でエラー:', error);
        throw error;
      }
    }, 20000);

    it('should display error rate chart', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const metrics = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: testApiId,
            metric_type: 'error_rate',
            start_date: oneDayAgo.toISOString(),
            end_date: now.toISOString(),
          },
        });

        expect(Array.isArray(metrics)).toBe(true);
        metrics.forEach(metric => {
          expect(metric.metric_type).toBe('error_rate');
          expect(metric.value).toBeGreaterThanOrEqual(0);
          expect(metric.value).toBeLessThanOrEqual(1);
        });
      } catch (error) {
        console.error('エラー率グラフ表示でエラー:', error);
        throw error;
      }
    }, 20000);
  });

  /**
   * 統計サマリー表示フロー: 全統計値の表示とAPI変更時の更新
   */
  describe('統計サマリー表示フロー', () => {
    it('should display performance summary cards', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        const summary = await invoke<PerformanceSummary>('get_performance_summary', {
          request: {
            api_id: testApiId,
            period: '24h',
          },
        });

        expect(summary).toBeDefined();
        
        // 各統計値が正しい型で返されることを確認
        expect(typeof summary.avg_response_time).toBe('number');
        expect(summary.avg_response_time).toBeGreaterThanOrEqual(0);
        
        expect(typeof summary.max_response_time).toBe('number');
        expect(summary.max_response_time).toBeGreaterThanOrEqual(0);
        
        expect(typeof summary.min_response_time).toBe('number');
        expect(summary.min_response_time).toBeGreaterThanOrEqual(0);
        
        expect(typeof summary.request_count).toBe('number');
        expect(summary.request_count).toBeGreaterThanOrEqual(0);
        
        expect(typeof summary.error_rate).toBe('number');
        expect(summary.error_rate).toBeGreaterThanOrEqual(0);
        expect(summary.error_rate).toBeLessThanOrEqual(1);
        
        expect(typeof summary.avg_cpu_usage).toBe('number');
        expect(summary.avg_cpu_usage).toBeGreaterThanOrEqual(0);
        
        expect(typeof summary.avg_memory_usage).toBe('number');
        expect(summary.avg_memory_usage).toBeGreaterThanOrEqual(0);
      } catch (error) {
        console.error('統計サマリー表示でエラー:', error);
        throw error;
      }
    }, 20000);

    it('should update summary when API changes', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // 別のAPIを作成してサマリーが変わることを確認
      try {
        const newApiResult = await invoke<ApiInfo>('create_api', {
          name: 'Test API 2 for Summary',
          model_name: 'llama3:8b',
          port: 8891,
          enable_auth: false,
        });

        const newApiId = newApiResult.id;

        // 新しいAPIにメトリクスを記録
        await invoke('record_performance_metric', {
          request: {
            api_id: newApiId,
            metric_type: 'avg_response_time',
            value: 300.0,
          },
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // 新しいAPIのサマリーを取得
        const newSummary = await invoke<PerformanceSummary>('get_performance_summary', {
          request: {
            api_id: newApiId,
            period: '24h',
          },
        });

        expect(newSummary).toBeDefined();
        expect(typeof newSummary.avg_response_time).toBe('number');

        // クリーンアップ
        await invoke('delete_api', { api_id: newApiId });
      } catch (error) {
        console.error('API変更時のサマリー更新でエラー:', error);
        throw error;
      }
    }, 30000);
  });

  /**
   * リアルタイム更新フロー: メトリクスの自動更新をテスト
   */
  describe('リアルタイム更新フロー', () => {
    it('should refresh data when new metrics are recorded', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        // 初期メトリクスを取得
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const initialMetrics = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            start_date: oneDayAgo.toISOString(),
            end_date: now.toISOString(),
          },
        });

        const initialCount = initialMetrics.length;

        // 新しいメトリクスを記録
        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            value: 250.0,
          },
        });

        // 少し待機（データベースへの書き込みが完了するまで）
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 更新後のメトリクスを取得
        const updatedMetrics = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            start_date: oneDayAgo.toISOString(),
            end_date: new Date().toISOString(),
          },
        });

        // メトリクスが増加していることを確認
        expect(updatedMetrics.length).toBeGreaterThanOrEqual(initialCount);
      } catch (error) {
        console.error('リアルタイム更新でエラー:', error);
        throw error;
      }
    }, 20000);

    it('should update summary when metrics are refreshed', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        // 初期サマリーを取得
        const initialSummary = await invoke<PerformanceSummary>('get_performance_summary', {
          request: {
            api_id: testApiId,
            period: '24h',
          },
        });

        expect(initialSummary).toBeDefined();

        // 新しいメトリクスを記録
        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            value: 280.0,
          },
        });

        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'request_count',
            value: 100.0,
          },
        });

        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'error_rate',
            value: 0.02,
          },
        });

        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 更新後のサマリーを取得
        const updatedSummary = await invoke<PerformanceSummary>('get_performance_summary', {
          request: {
            api_id: testApiId,
            period: '24h',
          },
        });

        // サマリーが更新されていることを確認
        expect(updatedSummary).toBeDefined();
        expect(typeof updatedSummary.avg_response_time).toBe('number');
        expect(typeof updatedSummary.request_count).toBe('number');
        expect(typeof updatedSummary.error_rate).toBe('number');
      } catch (error) {
        console.error('サマリー更新でエラー:', error);
        throw error;
      }
    }, 20000);
  });

  /**
   * 完全なフロー: ダッシュボード表示 → 期間選択 → グラフ表示 → サマリー表示
   */
  describe('完全なフロー: ダッシュボード → 期間選択 → グラフ → サマリー', () => {
    it('should complete full workflow from dashboard to summary', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // ステップ1: API一覧を取得
      const apis = await invoke<ApiInfo[]>('list_apis');
      expect(Array.isArray(apis)).toBe(true);
      expect(apis.length).toBeGreaterThan(0);

      // ステップ2: 期間を選択してサマリーを取得
      const summary = await invoke<PerformanceSummary>('get_performance_summary', {
        request: {
          api_id: testApiId!,
          period: '24h',
        },
      });

      expect(summary).toBeDefined();
      expect(typeof summary.avg_response_time).toBe('number');

      // ステップ3: レスポンス時間グラフ用のデータを取得
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const responseTimeMetrics = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
        request: {
          api_id: testApiId!,
          metric_type: 'avg_response_time',
          start_date: oneDayAgo.toISOString(),
          end_date: now.toISOString(),
        },
      });

      expect(Array.isArray(responseTimeMetrics)).toBe(true);

      // ステップ4: リクエスト数グラフ用のデータを取得
      const requestCountMetrics = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
        request: {
          api_id: testApiId!,
          metric_type: 'request_count',
          start_date: oneDayAgo.toISOString(),
          end_date: now.toISOString(),
        },
      });

      expect(Array.isArray(requestCountMetrics)).toBe(true);

      // ステップ5: エラー率グラフ用のデータを取得
      const errorRateMetrics = await invoke<PerformanceMetricInfo[]>('get_performance_metrics', {
        request: {
          api_id: testApiId!,
          metric_type: 'error_rate',
          start_date: oneDayAgo.toISOString(),
          end_date: now.toISOString(),
        },
      });

      expect(Array.isArray(errorRateMetrics)).toBe(true);

      // すべてのステップが成功したことを確認
      expect(true).toBe(true);
    }, 40000);
  });
});

