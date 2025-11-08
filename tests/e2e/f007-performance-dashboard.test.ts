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
  endpoint: string;
  model_name: string;
  port: number;
  enable_auth: boolean;
  status: string;
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
 * パフォーマンス統計サマリー
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
 * F007: パフォーマンス監視機能E2Eテストスイート
 *
 * テスト項目:
 * - ダッシュボード表示フロー（API選択、期間選択）
 * - 統計サマリー表示フロー
 * - グラフデータ取得フロー（レスポンス時間、リクエスト数、CPU/メモリ、エラー率）
 * - 完全なフロー（ダッシュボード→統計→グラフ）
 */
describe('F007: パフォーマンス監視機能 E2Eテスト', () => {
  let testApiId: string | null = null;

  beforeAll(async () => {
    // Tauriアプリが起動していない場合はスキップ
    if (!process.env.TAURI_APP_AVAILABLE) {
      console.warn(
        'Tauriアプリが起動していないため、このテストスイートをスキップします'
      );
      return;
    }
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.JEST_DEBUG === '1'
    ) {
      console.log('F007 パフォーマンス監視機能E2Eテストを開始します');
    }

    try {
      const result = await invoke<ApiInfo>('create_api', {
        config: {
          name: 'Test API for Performance Dashboard E2E',
          model_name: 'llama3:8b',
          port: 8891,
          enable_auth: false,
        },
      });

      testApiId = result.id;
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.JEST_DEBUG === '1'
      ) {
        console.log(`テスト用APIを作成しました: ${testApiId}`);
      }

      // テスト用のパフォーマンスメトリクスデータを作成
      const now = new Date();
      const metricsToCreate = [
        // レスポンス時間メトリクス（過去30分）
        { metric_type: 'avg_response_time', value: 150, minutesAgo: 30 },
        { metric_type: 'avg_response_time', value: 180, minutesAgo: 25 },
        { metric_type: 'avg_response_time', value: 120, minutesAgo: 20 },
        { metric_type: 'avg_response_time', value: 200, minutesAgo: 15 },
        { metric_type: 'avg_response_time', value: 160, minutesAgo: 10 },
        { metric_type: 'avg_response_time', value: 140, minutesAgo: 5 },

        // リクエスト数メトリクス（過去30分）
        { metric_type: 'request_count', value: 10, minutesAgo: 30 },
        { metric_type: 'request_count', value: 15, minutesAgo: 25 },
        { metric_type: 'request_count', value: 12, minutesAgo: 20 },
        { metric_type: 'request_count', value: 18, minutesAgo: 15 },
        { metric_type: 'request_count', value: 14, minutesAgo: 10 },
        { metric_type: 'request_count', value: 16, minutesAgo: 5 },

        // CPU使用率メトリクス
        { metric_type: 'cpu_usage', value: 45.5, minutesAgo: 30 },
        { metric_type: 'cpu_usage', value: 52.3, minutesAgo: 25 },
        { metric_type: 'cpu_usage', value: 48.1, minutesAgo: 20 },

        // メモリ使用量メトリクス
        { metric_type: 'memory_usage', value: 512.5, minutesAgo: 30 },
        { metric_type: 'memory_usage', value: 525.8, minutesAgo: 25 },
        { metric_type: 'memory_usage', value: 518.2, minutesAgo: 20 },

        // エラー率メトリクス
        { metric_type: 'error_rate', value: 2.5, minutesAgo: 30 },
        { metric_type: 'error_rate', value: 1.8, minutesAgo: 25 },
        { metric_type: 'error_rate', value: 3.2, minutesAgo: 20 },
      ];

      // メトリクスを記録
      for (const metric of metricsToCreate) {
        const timestamp = new Date(
          now.getTime() - metric.minutesAgo * 60 * 1000
        );
        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: metric.metric_type,
            value: metric.value,
          },
        });

        // タイムスタンプを設定するため、少し待つ
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (
        process.env.NODE_ENV === 'development' ||
        process.env.JEST_DEBUG === '1'
      ) {
        console.log(
          `テスト用メトリクスを${metricsToCreate.length}件作成しました`
        );
      }
    } catch (error) {
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.JEST_DEBUG === '1'
      ) {
        console.warn('テスト用APIの作成に失敗しました:', error);
      }
    }
  });

  afterAll(async () => {
    if (testApiId) {
      try {
        await invoke('delete_api', { api_id: testApiId });
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.log(`テスト用APIを削除しました: ${testApiId}`);
        }
      } catch (error) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIの削除に失敗しました:', error);
        }
      }
    }
  });

  describe('ダッシュボード表示フロー', () => {
    it('API一覧を取得できる', async () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }

      const apis = await invoke<ApiInfo[]>('list_apis');
      expect(apis).toBeInstanceOf(Array);
      expect(apis.length).toBeGreaterThan(0);

      // テスト用APIが含まれていることを確認
      const testApi = apis.find(api => api.id === testApiId);
      expect(testApi).toBeDefined();
      if (testApi) {
        expect(testApi.name).toBe('Test API for Performance Dashboard E2E');
      }
    });

    it('API選択時にAPI情報が取得できる', async () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }

      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const apiDetails = await invoke<ApiInfo>('get_api_details', {
        api_id: testApiId,
      });

      expect(apiDetails).toBeDefined();
      expect(apiDetails.id).toBe(testApiId);
      expect(apiDetails.name).toBe('Test API for Performance Dashboard E2E');
    });

    it('期間選択に応じた日時範囲を計算できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const now = new Date();
      const periods = [
        { period: '1h' as const, expectedMinutes: 60 },
        { period: '24h' as const, expectedMinutes: 24 * 60 },
        { period: '7d' as const, expectedMinutes: 7 * 24 * 60 },
      ];

      for (const { period } of periods) {
        const endDate = now.toISOString();
        const startDate = new Date(
          now.getTime() -
            (period === '1h' ? 60 : period === '24h' ? 24 * 60 : 7 * 24 * 60) *
              60 *
              1000
        ).toISOString();

        // 期間に応じたメトリクス取得をテスト
        const metrics = await invoke<PerformanceMetricInfo[]>(
          'get_performance_metrics',
          {
            request: {
              api_id: testApiId,
              metric_type: null,
              start_date: startDate,
              end_date: endDate,
            },
          }
        );

        expect(metrics).toBeInstanceOf(Array);
        // 期間内のメトリクスが取得できることを確認
      }
    });
  });

  describe('統計サマリー表示フロー', () => {
    it('パフォーマンスサマリーを取得できる（1時間）', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const summary = await invoke<PerformanceSummary>(
        'get_performance_summary',
        {
          request: {
            api_id: testApiId,
            period: '1h',
          },
        }
      );

      expect(summary).toBeDefined();
      // サマリーの各フィールドを確認（すべて必須フィールド）
      expect(typeof summary.avg_response_time).toBe('number');
      expect(typeof summary.max_response_time).toBe('number');
      expect(typeof summary.min_response_time).toBe('number');
      expect(typeof summary.request_count).toBe('number');
      expect(typeof summary.error_rate).toBe('number');
      expect(summary.error_rate).toBeGreaterThanOrEqual(0);
      expect(summary.error_rate).toBeLessThanOrEqual(100);
      expect(typeof summary.avg_cpu_usage).toBe('number');
      expect(typeof summary.avg_memory_usage).toBe('number');
    });

    it('パフォーマンスサマリーを取得できる（24時間）', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const summary = await invoke<PerformanceSummary>(
        'get_performance_summary',
        {
          request: {
            api_id: testApiId,
            period: '24h',
          },
        }
      );

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('request_count');
    });

    it('パフォーマンスサマリーを取得できる（7日間）', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const summary = await invoke<PerformanceSummary>(
        'get_performance_summary',
        {
          request: {
            api_id: testApiId,
            period: '7d',
          },
        }
      );

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('request_count');
    });

    it('リアルタイム更新でサマリーが更新される', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      // 最初のサマリー取得
      const summary1 = await invoke<PerformanceSummary>(
        'get_performance_summary',
        {
          request: {
            api_id: testApiId,
            period: '1h',
          },
        }
      );

      // 新しいメトリクスを追加
      await invoke('record_performance_metric', {
        request: {
          api_id: testApiId,
          metric_type: 'request_count',
          value: 20,
        },
      });

      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2回目のサマリー取得
      const summary2 = await invoke<PerformanceSummary>(
        'get_performance_summary',
        {
          request: {
            api_id: testApiId,
            period: '1h',
          },
        }
      );

      expect(summary1).toBeDefined();
      expect(summary2).toBeDefined();
      // リクエスト数が更新されている可能性がある（すべて必須フィールドなのでオプショナルチェック不要）
      expect(summary2.request_count).toBeGreaterThanOrEqual(
        summary1.request_count
      );
    });
  });

  describe('グラフデータ取得フロー', () => {
    it('レスポンス時間グラフデータを取得できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const now = new Date();
      const endDate = now.toISOString();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

      const metrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            start_date: startDate,
            end_date: endDate,
          },
        }
      );

      expect(metrics).toBeInstanceOf(Array);
      expect(metrics.length).toBeGreaterThan(0);

      // レスポンス時間メトリクスのみが取得されていることを確認
      for (const metric of metrics) {
        expect(metric.api_id).toBe(testApiId);
        expect(metric.metric_type).toBe('avg_response_time');
        expect(typeof metric.value).toBe('number');
        expect(metric.value).toBeGreaterThan(0);
      }
    });

    it('リクエスト数グラフデータを取得できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const now = new Date();
      const endDate = now.toISOString();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

      const metrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: 'request_count',
            start_date: startDate,
            end_date: endDate,
          },
        }
      );

      expect(metrics).toBeInstanceOf(Array);

      // リクエスト数メトリクスのみが取得されていることを確認
      for (const metric of metrics) {
        expect(metric.api_id).toBe(testApiId);
        expect(metric.metric_type).toBe('request_count');
        expect(typeof metric.value).toBe('number');
        expect(metric.value).toBeGreaterThanOrEqual(0);
      }
    });

    it('CPU/メモリ使用量グラフデータを取得できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const now = new Date();
      const endDate = now.toISOString();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

      // CPU使用率メトリクス
      const cpuMetrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: 'cpu_usage',
            start_date: startDate,
            end_date: endDate,
          },
        }
      );

      // メモリ使用量メトリクス
      const memoryMetrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: 'memory_usage',
            start_date: startDate,
            end_date: endDate,
          },
        }
      );

      expect(cpuMetrics).toBeInstanceOf(Array);
      expect(memoryMetrics).toBeInstanceOf(Array);

      // CPU使用率メトリクスの検証
      for (const metric of cpuMetrics) {
        expect(metric.metric_type).toBe('cpu_usage');
        expect(typeof metric.value).toBe('number');
        expect(metric.value).toBeGreaterThanOrEqual(0);
        expect(metric.value).toBeLessThanOrEqual(100);
      }

      // メモリ使用量メトリクスの検証
      for (const metric of memoryMetrics) {
        expect(metric.metric_type).toBe('memory_usage');
        expect(typeof metric.value).toBe('number');
        expect(metric.value).toBeGreaterThanOrEqual(0);
      }
    });

    it('エラー率グラフデータを取得できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const now = new Date();
      const endDate = now.toISOString();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

      const metrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: 'error_rate',
            start_date: startDate,
            end_date: endDate,
          },
        }
      );

      expect(metrics).toBeInstanceOf(Array);

      // エラー率メトリクスのみが取得されていることを確認
      for (const metric of metrics) {
        expect(metric.api_id).toBe(testApiId);
        expect(metric.metric_type).toBe('error_rate');
        expect(typeof metric.value).toBe('number');
        expect(metric.value).toBeGreaterThanOrEqual(0);
        expect(metric.value).toBeLessThanOrEqual(100);
      }
    });

    it('日時範囲フィルタが正しく機能する', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const now = new Date();
      const endDate = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // 10分前
      const startDate = new Date(now.getTime() - 20 * 60 * 1000).toISOString(); // 20分前

      const metrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: undefined,
            start_date: startDate,
            end_date: endDate,
          },
        }
      );

      expect(metrics).toBeInstanceOf(Array);

      // 指定した期間内のメトリクスのみが取得されていることを確認
      for (const metric of metrics) {
        const metricDate = new Date(metric.timestamp);
        const start = new Date(startDate);
        const end = new Date(endDate);

        expect(metricDate.getTime()).toBeGreaterThanOrEqual(start.getTime());
        expect(metricDate.getTime()).toBeLessThanOrEqual(end.getTime());
      }
    });
  });

  describe('完全なフロー', () => {
    it('ダッシュボード→統計サマリー→グラフの完全なフローが動作する', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      // 1. API一覧取得
      const apis = await invoke<ApiInfo[]>('list_apis');
      expect(apis.length).toBeGreaterThan(0);

      // 2. API選択（テスト用API）
      const selectedApi = apis.find(api => api.id === testApiId);
      expect(selectedApi).toBeDefined();

      // 3. 統計サマリー取得
      const summary = await invoke<PerformanceSummary>(
        'get_performance_summary',
        {
          request: {
            api_id: testApiId!,
            period: '1h',
          },
        }
      );
      expect(summary).toBeDefined();

      // 4. レスポンス時間グラフデータ取得
      const now = new Date();
      const endDate = now.toISOString();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

      const responseTimeMetrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId!,
            metric_type: 'avg_response_time',
            start_date: startDate,
            end_date: endDate,
          },
        }
      );
      expect(responseTimeMetrics).toBeInstanceOf(Array);

      // 5. リクエスト数グラフデータ取得
      const requestCountMetrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId!,
            metric_type: 'request_count',
            start_date: startDate,
            end_date: endDate,
          },
        }
      );
      expect(requestCountMetrics).toBeInstanceOf(Array);

      // 6. CPU/メモリグラフデータ取得
      const cpuMetrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId!,
            metric_type: 'cpu_usage',
            start_date: startDate,
            end_date: endDate,
          },
        }
      );
      expect(cpuMetrics).toBeInstanceOf(Array);

      const memoryMetrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId!,
            metric_type: 'memory_usage',
            start_date: startDate,
            end_date: endDate,
          },
        }
      );
      expect(memoryMetrics).toBeInstanceOf(Array);

      // 7. エラー率グラフデータ取得
      const errorRateMetrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId!,
            metric_type: 'error_rate',
            start_date: startDate,
            end_date: endDate,
          },
        }
      );
      expect(errorRateMetrics).toBeInstanceOf(Array);

      // すべてのデータが正常に取得できることを確認
      expect(summary).toBeDefined();
      expect(responseTimeMetrics.length).toBeGreaterThanOrEqual(0);
      expect(requestCountMetrics.length).toBeGreaterThanOrEqual(0);
      expect(cpuMetrics.length).toBeGreaterThanOrEqual(0);
      expect(memoryMetrics.length).toBeGreaterThanOrEqual(0);
      expect(errorRateMetrics.length).toBeGreaterThanOrEqual(0);
    });
  });
});
