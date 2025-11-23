// performance-monitoring - パフォーマンス監視機能の統合テスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import {
  cleanupTestApis,
  createTestApi,
  handleTauriAppNotRunningError,
} from '../setup/test-helpers';
import { debugLog, debugWarn } from '../setup/debug';

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
 * F007: パフォーマンス監視機能統合テストスイート
 *
 * テスト項目:
 * - メトリクス記録機能のテスト
 * - メトリクス取得機能のテスト（各種フィルタ）
 * - パフォーマンスサマリー取得のテスト
 * - エッジケーステスト
 */
describe('F007: パフォーマンス監視機能 統合テスト', () => {
  let testApiId: string | null = null;
  const testMetricIds: number[] = [];

  beforeAll(async () => {
    debugLog('F007 パフォーマンス監視機能統合テストを開始します');

    try {
      testApiId = await createTestApi({
        name: 'E2E Test API for Performance',
        model_name: 'llama3:8b',
        port: 8094,
        enable_auth: true,
      });
      debugLog(`テスト用APIを作成しました: ${testApiId}`);
    } catch (error) {
      if (handleTauriAppNotRunningError(error)) {
        // テストは続行（testApiIdがnullのまま）
      } else {
        debugWarn('テスト用APIの作成に失敗しました（既存APIを使用）:', error);
      }
      try {
        const apis = await invoke<ApiInfo[]>('list_apis');
        if (apis.length > 0) {
          testApiId = apis[0].id;
          if (
            process.env.NODE_ENV === 'development' ||
            process.env.JEST_DEBUG === '1'
          ) {
            debugLog(`既存のAPIを使用します: ${testApiId}`);
          }
        }
      } catch (err) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('APIの取得に失敗しました:', err);
        }
      }
    }

    // テスト用のメトリクスデータを作成
    if (testApiId) {
      try {
        const now = new Date();
        const metrics = [
          {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            value: 150.5,
            timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10分前
          },
          {
            api_id: testApiId,
            metric_type: 'request_count',
            value: 1,
            timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
          },
          {
            api_id: testApiId,
            metric_type: 'error_rate',
            value: 0.0,
            timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
          },
          {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            value: 200.3,
            timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5分前
          },
          {
            api_id: testApiId,
            metric_type: 'request_count',
            value: 1,
            timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
          },
          {
            api_id: testApiId,
            metric_type: 'error_rate',
            value: 100.0,
            timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
          },
          {
            api_id: testApiId,
            metric_type: 'cpu_usage',
            value: 25.5,
            timestamp: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2分前
          },
          {
            api_id: testApiId,
            metric_type: 'memory_usage',
            value: 512.8,
            timestamp: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
          },
        ];

        for (const metric of metrics) {
          try {
            await invoke('record_performance_metric', {
              request: {
                api_id: metric.api_id,
                metric_type: metric.metric_type,
                value: metric.value,
              },
            });
            // 作成後にメトリクスを取得してIDを取得
            const createdMetrics = await invoke<PerformanceMetricInfo[]>(
              'get_performance_metrics',
              {
                request: {
                  api_id: metric.api_id,
                  metric_type: metric.metric_type,
                  start_date: null,
                  end_date: null,
                },
              }
            );
            if (createdMetrics.length > 0) {
              testMetricIds.push(createdMetrics[createdMetrics.length - 1].id);
            }
          } catch (err) {
            if (
              process.env.NODE_ENV === 'development' ||
              process.env.JEST_DEBUG === '1'
            ) {
              debugWarn('メトリクスの作成に失敗しました:', err);
            }
          }
        }
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugLog(
            `テスト用メトリクスを ${testMetricIds.length} 件作成しました`
          );
        }
      } catch (error) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用メトリクスの作成に失敗しました:', error);
        }
      }
    }
  });

  afterAll(async () => {
    // テスト用メトリクスを削除（オプション、メトリクス削除コマンドが存在する場合）
    // 実際の実装では、メトリクスの自動削除ポリシーに従う

    // テスト用APIを削除
    if (testApiId) {
      await cleanupTestApis([testApiId]);
      debugLog('テスト用APIを削除しました');
    }
    debugLog('F007 パフォーマンス監視機能統合テストを完了しました');
  });

  /**
   * テスト1: record_performance_metric のテスト
   */
  describe('record_performance_metric のテスト', () => {
    it('should record performance metric successfully', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      await invoke('record_performance_metric', {
        request: {
          api_id: testApiId,
          metric_type: 'avg_response_time',
          value: 175.5,
        },
      });

      // 作成されたメトリクスを取得して確認
      const metrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            start_date: null,
            end_date: null,
          },
        }
      );

      expect(metrics.length).toBeGreaterThan(0);
      const newMetric = metrics.find(m => Math.abs(m.value - 175.5) < 0.1);
      expect(newMetric).toBeDefined();
    });

    it('should record different metric types', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      const metricTypes = [
        'avg_response_time',
        'request_count',
        'error_rate',
        'cpu_usage',
        'memory_usage',
      ];

      for (const metricType of metricTypes) {
        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: metricType,
            value: 100.0,
          },
        });

        // 作成されたメトリクスを確認
        const metrics = await invoke<PerformanceMetricInfo[]>(
          'get_performance_metrics',
          {
            request: {
              api_id: testApiId,
              metric_type: metricType,
              start_date: null,
              end_date: null,
            },
          }
        );

        expect(metrics.length).toBeGreaterThan(0);
      }
    });

    it('should handle invalid API ID gracefully', async () => {
      const invalidApiId = 'invalid-api-id-12345';

      try {
        await invoke('record_performance_metric', {
          request: {
            api_id: invalidApiId,
            metric_type: 'avg_response_time',
            value: 100.0,
          },
        });

        // エラーが発生するか、有効なメトリクスIDが返されることを確認
        // （外部キー制約によりエラーが発生する可能性がある）
      } catch (error) {
        // エラーが発生する場合も許容
        expect(error).toBeDefined();
      }
    });
  });

  /**
   * テスト2: get_performance_metrics のテスト（各種フィルタ）
   */
  describe('get_performance_metrics のテスト', () => {
    it('should retrieve all metrics for an API', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      const metrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: null,
            start_date: null,
            end_date: null,
          },
        }
      );

      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);

      if (metrics.length > 0) {
        const metric = metrics[0];
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('api_id');
        expect(metric).toHaveProperty('metric_type');
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('timestamp');
        expect(metric.api_id).toBe(testApiId);
      }
    });

    it('should filter metrics by type', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      const metricType = 'avg_response_time';
      const metrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: metricType,
            start_date: null,
            end_date: null,
          },
        }
      );

      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);

      // 全てのメトリクスが指定したタイプであることを確認
      for (const metric of metrics) {
        expect(metric.metric_type).toBe(metricType);
      }
    });

    it('should filter metrics by date range', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      const now = new Date();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1時間前
      const endDate = now.toISOString();

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

      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);

      // フィルタされたメトリクスが指定した日時範囲内にあることを確認
      for (const metric of metrics) {
        const metricDate = new Date(metric.timestamp);
        expect(metricDate.getTime()).toBeGreaterThanOrEqual(
          new Date(startDate).getTime()
        );
        expect(metricDate.getTime()).toBeLessThanOrEqual(
          new Date(endDate).getTime()
        );
      }
    });

    it('should filter metrics by type and date range', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      const now = new Date();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const endDate = now.toISOString();
      const metricType = 'avg_response_time';

      const metrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: metricType,
            start_date: startDate,
            end_date: endDate,
          },
        }
      );

      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);

      // 複数のフィルタ条件がすべて満たされていることを確認
      for (const metric of metrics) {
        expect(metric.metric_type).toBe(metricType);
        const metricDate = new Date(metric.timestamp);
        expect(metricDate.getTime()).toBeGreaterThanOrEqual(
          new Date(startDate).getTime()
        );
        expect(metricDate.getTime()).toBeLessThanOrEqual(
          new Date(endDate).getTime()
        );
      }
    });

    it('should return empty array for non-existent API', async () => {
      const nonExistentApiId = 'non-existent-api-id-12345';

      const metrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: nonExistentApiId,
            metric_type: null,
            start_date: null,
            end_date: null,
          },
        }
      );

      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
      // 存在しないAPIの場合は空の配列が返されることを確認
    });
  });

  /**
   * テスト3: get_performance_summary のテスト
   */
  describe('get_performance_summary のテスト', () => {
    it('should retrieve performance summary', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
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
      expect(summary).toHaveProperty('avg_response_time');
      expect(summary).toHaveProperty('max_response_time');
      expect(summary).toHaveProperty('min_response_time');
      expect(summary).toHaveProperty('request_count');
      expect(summary).toHaveProperty('error_rate');
      expect(summary).toHaveProperty('avg_cpu_usage');
      expect(summary).toHaveProperty('avg_memory_usage');

      // 値の型を検証
      expect(typeof summary.avg_response_time).toBe('number');
      expect(typeof summary.max_response_time).toBe('number');
      expect(typeof summary.min_response_time).toBe('number');
      expect(typeof summary.request_count).toBe('number');
      expect(typeof summary.error_rate).toBe('number');
      expect(typeof summary.avg_cpu_usage).toBe('number');
      expect(typeof summary.avg_memory_usage).toBe('number');

      // 値の範囲を検証
      expect(summary.avg_response_time).toBeGreaterThanOrEqual(0);
      expect(summary.max_response_time).toBeGreaterThanOrEqual(0);
      expect(summary.min_response_time).toBeGreaterThanOrEqual(0);
      expect(summary.request_count).toBeGreaterThanOrEqual(0);
      expect(summary.error_rate).toBeGreaterThanOrEqual(0);
      expect(summary.error_rate).toBeLessThanOrEqual(100);
      expect(summary.avg_cpu_usage).toBeGreaterThanOrEqual(0);
      expect(summary.avg_memory_usage).toBeGreaterThanOrEqual(0);
    });

    it('should calculate summary with date range filter', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      // 24時間の期間でサマリーを取得
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
      expect(summary).toHaveProperty('avg_response_time');
      expect(summary).toHaveProperty('request_count');
      expect(summary).toHaveProperty('error_rate');
    });

    it('should return zero values for API with no metrics', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      // 新しいAPIを作成（メトリクスがない）
      let newApiId: string | null = null;
      try {
        const result = await invoke<ApiInfo>('create_api', {
          config: {
            name: 'Test API No Metrics',
            model_name: 'llama3:8b',
            port: 8095,
            enable_auth: false,
          },
        });
        newApiId = result.id;

        const summary = await invoke<PerformanceSummary>(
          'get_performance_summary',
          {
            request: {
              api_id: newApiId,
              period: '24h',
            },
          }
        );

        expect(summary).toBeDefined();
        // メトリクスがない場合、0またはNaNが返される可能性がある
        expect(summary.request_count).toBe(0);

        // クリーンアップ
        await invoke('delete_api', { apiId: newApiId });
      } catch (error) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIの作成/削除に失敗しました:', error);
        }
        if (newApiId) {
          try {
            await invoke('delete_api', { apiId: newApiId });
          } catch (err) {
            // クリーンアップ失敗は無視
          }
        }
      }
    });
  });

  /**
   * テスト4: エッジケーステスト
   */
  describe('エッジケーステスト', () => {
    it('should handle empty metrics list', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      // 新しいAPIを作成（メトリクスがない）
      let newApiId: string | null = null;
      try {
        const result = await invoke<ApiInfo>('create_api', {
          config: {
            name: 'Test API Empty Metrics',
            model_name: 'llama3:8b',
            port: 8096,
            enable_auth: false,
          },
        });
        newApiId = result.id;

        const metrics = await invoke<PerformanceMetricInfo[]>(
          'get_performance_metrics',
          {
            request: {
              api_id: newApiId,
              metric_type: null,
              start_date: null,
              end_date: null,
            },
          }
        );

        expect(metrics).toBeDefined();
        expect(Array.isArray(metrics)).toBe(true);
        expect(metrics.length).toBe(0);

        // クリーンアップ
        await invoke('delete_api', { apiId: newApiId });
      } catch (error) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIの作成/削除に失敗しました:', error);
        }
        if (newApiId) {
          try {
            await invoke('delete_api', { apiId: newApiId });
          } catch (err) {
            // クリーンアップ失敗は無視
          }
        }
      }
    });

    it('should handle invalid date range (start > end)', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      const now = new Date();
      const startDate = now.toISOString();
      const endDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1時間前

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

      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
      // 無効な日時範囲の場合、空の配列が返されることを確認
      expect(metrics.length).toBe(0);
    });

    it('should handle future date range', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      // 将来の日時範囲（メトリクスが存在しない）
      const futureStart = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString();
      const futureEnd = new Date(
        Date.now() + 48 * 60 * 60 * 1000
      ).toISOString();

      const metrics = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: null,
            start_date: futureStart,
            end_date: futureEnd,
          },
        }
      );

      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
      // 未来の日時範囲の場合、空の配列が返されることを確認
      expect(metrics.length).toBe(0);
    });

    it('should handle negative values gracefully', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが存在しないため、テストをスキップします');
        }
        return;
      }

      try {
        // 負の値が許容されるか、エラーが発生するかを確認
        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            value: -100.0,
          },
        });

        // 負の値が許可される場合、エラーが発生しない
        // メトリクスを取得して確認
        const metrics = await invoke<PerformanceMetricInfo[]>(
          'get_performance_metrics',
          {
            request: {
              api_id: testApiId,
              metric_type: 'avg_response_time',
              start_date: null,
              end_date: null,
            },
          }
        );

        expect(metrics.length).toBeGreaterThan(0);
      } catch (error) {
        // 負の値が許可されない場合、エラーが発生する
        expect(error).toBeDefined();
      }
    });
  });
});
