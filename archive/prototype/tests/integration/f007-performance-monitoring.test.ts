// f007-performance-monitoring - パフォーマンス監視機能の統合テスト

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
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
 * F007: パフォーマンス監視機能統合テストスイート
 *
 * テスト項目:
 * - メトリクス記録機能のテスト
 * - メトリクス取得機能のテスト（各種フィルタ）
 * - 統計サマリー取得のテスト
 * - エッジケーステスト
 */
describe('F007: パフォーマンス監視機能 統合テスト', () => {
  let testApiId: string | null = null;

  beforeAll(async () => {
    debugLog('F007 パフォーマンス監視機能統合テストを開始します');

    try {
      testApiId = await createTestApi({
        name: 'Test API for Performance Monitoring',
        model_name: 'llama3:8b',
        port: 8889,
        enable_auth: false,
      });
      debugLog(`テスト用APIを作成しました: ${testApiId}`);
    } catch (error) {
      if (handleTauriAppNotRunningError(error)) {
        // テストは続行（testApiIdがnullのまま）
      } else {
        debugWarn('テスト用APIの作成に失敗しました:', error);
      }
    }
  });

  afterAll(async () => {
    if (testApiId) {
      await cleanupTestApis([testApiId]);
      debugLog(`テスト用APIを削除しました: ${testApiId}`);
    }
    debugLog('F007 パフォーマンス監視機能統合テストを完了しました');
  });

  beforeEach(async () => {
    // 各テスト前に既存のメトリクスをクリーンアップ（必要に応じて）
    // 実際の実装では、テストデータの分離戦略を検討してください
  });

  describe('record_performance_metric - メトリクス記録テスト', () => {
    it('正常系: レスポンス時間メトリクスを記録できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      try {
        const result = await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
            value: 150.5,
          },
        });

        expect(result).toBeUndefined(); // 正常時は戻り値なし
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          expect(errorMessage).toContain(
            'Tauriアプリケーションが起動していません'
          );
        } else {
          throw error;
        }
      }
    });

    it('正常系: リクエスト数メトリクスを記録できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      try {
        const result = await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'request_count',
            value: 100,
          },
        });

        expect(result).toBeUndefined();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          expect(errorMessage).toContain(
            'Tauriアプリケーションが起動していません'
          );
        } else {
          throw error;
        }
      }
    });

    it('正常系: エラー率メトリクスを記録できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      try {
        const result = await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'error_rate',
            value: 0.05, // 5%
          },
        });

        expect(result).toBeUndefined();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          expect(errorMessage).toContain(
            'Tauriアプリケーションが起動していません'
          );
        } else {
          throw error;
        }
      }
    });

    it('正常系: CPU使用率メトリクスを記録できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      try {
        const result = await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'cpu_usage',
            value: 75.5,
          },
        });

        expect(result).toBeUndefined();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          expect(errorMessage).toContain(
            'Tauriアプリケーションが起動していません'
          );
        } else {
          throw error;
        }
      }
    });

    it('正常系: メモリ使用量メトリクスを記録できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      try {
        const result = await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'memory_usage',
            value: 512.5, // MB
          },
        });

        expect(result).toBeUndefined();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          expect(errorMessage).toContain(
            'Tauriアプリケーションが起動していません'
          );
        } else {
          throw error;
        }
      }
    });

    it('バリデーション: 不正なmetric_typeでエラーになる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      try {
        await expect(
          invoke('record_performance_metric', {
            request: {
              api_id: testApiId,
              metric_type: 'invalid_type',
              value: 100,
            },
          })
        ).rejects.toThrow();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          expect(errorMessage).toContain(
            'Tauriアプリケーションが起動していません'
          );
        } else {
          throw error;
        }
      }
    });

    it('バリデーション: 無効なAPI IDでエラーになる', async () => {
      try {
        await expect(
          invoke('record_performance_metric', {
            request: {
              api_id: 'invalid-api-id',
              metric_type: 'avg_response_time',
              value: 100,
            },
          })
        ).rejects.toThrow();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          expect(errorMessage).toContain(
            'Tauriアプリケーションが起動していません'
          );
        } else {
          throw error;
        }
      }
    });
  });

  describe('get_performance_metrics - メトリクス取得テスト', () => {
    beforeAll(async () => {
      // テストデータを準備
      if (testApiId) {
        // 複数のメトリクスを記録
        // const now = new Date();
        // const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 将来使用予定

        // レスポンス時間メトリクスを複数記録
        for (let i = 0; i < 5; i++) {
          await invoke('record_performance_metric', {
            request: {
              api_id: testApiId,
              metric_type: 'avg_response_time',
              value: 100 + i * 10,
            },
          });
        }

        // リクエスト数メトリクスを記録
        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'request_count',
            value: 50,
          },
        });

        // CPU使用率メトリクスを記録
        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'cpu_usage',
            value: 60.5,
          },
        });
      }
    });

    it('正常系: API ID指定でメトリクスを取得できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      try {
        const result = await invoke<PerformanceMetricInfo[]>(
          'get_performance_metrics',
          {
            request: {
              api_id: testApiId,
            },
          }
        );

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);

        // すべてのメトリクスが指定したAPI IDに属していることを確認
        result.forEach(metric => {
          expect(metric.api_id).toBe(testApiId);
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          expect(errorMessage).toContain(
            'Tauriアプリケーションが起動していません'
          );
        } else {
          throw error;
        }
      }
    });

    it('正常系: metric_type指定でフィルタできる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const result = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
          },
        }
      );

      expect(Array.isArray(result)).toBe(true);
      result.forEach(metric => {
        expect(metric.metric_type).toBe('avg_response_time');
        expect(metric.api_id).toBe(testApiId);
      });
    });

    it('正常系: 日時範囲指定でフィルタできる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const endDate = new Date().toISOString();
      const startDate = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString(); // 24時間前

      const result = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            start_date: startDate,
            end_date: endDate,
          },
        }
      );

      expect(Array.isArray(result)).toBe(true);

      // すべてのメトリクスが指定した日時範囲内にあることを確認
      result.forEach(metric => {
        const timestamp = new Date(metric.timestamp);
        expect(timestamp >= new Date(startDate)).toBe(true);
        expect(timestamp <= new Date(endDate)).toBe(true);
      });
    });

    it('正常系: 複合フィルタ（metric_type + 日時範囲）で取得できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const endDate = new Date().toISOString();
      const startDate = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const result = await invoke<PerformanceMetricInfo[]>(
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

      expect(Array.isArray(result)).toBe(true);
      result.forEach(metric => {
        expect(metric.metric_type).toBe('avg_response_time');
        expect(metric.api_id).toBe(testApiId);

        const timestamp = new Date(metric.timestamp);
        expect(timestamp >= new Date(startDate)).toBe(true);
        expect(timestamp <= new Date(endDate)).toBe(true);
      });
    });

    it('エッジケース: メトリクスが0件の場合は空配列を返す', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      // 存在しないAPI IDで取得
      const result = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: 'non-existent-api-id-12345',
          },
        }
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('エッジケース: 無効なAPI IDでエラーになる', async () => {
      await expect(
        invoke('get_performance_metrics', {
          request: {
            api_id: '',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('get_performance_summary - 統計サマリー取得テスト', () => {
    beforeAll(async () => {
      // 統計サマリーテスト用のデータを準備
      if (testApiId) {
        // 複数のメトリクスを記録
        // レスポンス時間: 100, 200, 300, 400, 500
        for (let i = 0; i < 5; i++) {
          await invoke('record_performance_metric', {
            request: {
              api_id: testApiId,
              metric_type: 'avg_response_time',
              value: 100 + i * 100,
            },
          });
        }

        // リクエスト数: 合計1000
        for (let i = 0; i < 10; i++) {
          await invoke('record_performance_metric', {
            request: {
              api_id: testApiId,
              metric_type: 'request_count',
              value: 100,
            },
          });
        }

        // エラー率: 0.05 (5%)
        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'error_rate',
            value: 0.05,
          },
        });

        // CPU使用率: 70%
        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'cpu_usage',
            value: 70.0,
          },
        });

        // メモリ使用量: 512MB
        await invoke('record_performance_metric', {
          request: {
            api_id: testApiId,
            metric_type: 'memory_usage',
            value: 512.0,
          },
        });
      }
    });

    it('正常系: 1時間の統計サマリーを取得できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const result = await invoke<PerformanceSummary>(
        'get_performance_summary',
        {
          request: {
            api_id: testApiId,
            period: '1h',
          },
        }
      );

      expect(result).toBeDefined();
      expect(typeof result.avg_response_time).toBe('number');
      expect(typeof result.max_response_time).toBe('number');
      expect(typeof result.min_response_time).toBe('number');
      expect(typeof result.request_count).toBe('number');
      expect(typeof result.error_rate).toBe('number');
      expect(typeof result.avg_cpu_usage).toBe('number');
      expect(typeof result.avg_memory_usage).toBe('number');

      // 統計値の妥当性を確認
      expect(result.max_response_time).toBeGreaterThanOrEqual(
        result.min_response_time
      );
      expect(result.avg_response_time).toBeGreaterThanOrEqual(
        result.min_response_time
      );
      expect(result.avg_response_time).toBeLessThanOrEqual(
        result.max_response_time
      );
      expect(result.request_count).toBeGreaterThanOrEqual(0);
      expect(result.error_rate).toBeGreaterThanOrEqual(0);
      expect(result.avg_cpu_usage).toBeGreaterThanOrEqual(0);
      expect(result.avg_memory_usage).toBeGreaterThanOrEqual(0);
    });

    it('正常系: 24時間の統計サマリーを取得できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const result = await invoke<PerformanceSummary>(
        'get_performance_summary',
        {
          request: {
            api_id: testApiId,
            period: '24h',
          },
        }
      );

      expect(result).toBeDefined();
      expect(typeof result.avg_response_time).toBe('number');
      expect(typeof result.request_count).toBe('number');
    });

    it('正常系: 7日間の統計サマリーを取得できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      const result = await invoke<PerformanceSummary>(
        'get_performance_summary',
        {
          request: {
            api_id: testApiId,
            period: '7d',
          },
        }
      );

      expect(result).toBeDefined();
      expect(typeof result.avg_response_time).toBe('number');
      expect(typeof result.request_count).toBe('number');
    });

    it('バリデーション: 無効な期間でエラーになる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      await expect(
        invoke('get_performance_summary', {
          request: {
            api_id: testApiId,
            period: 'invalid_period',
          },
        })
      ).rejects.toThrow();
    });

    it('エッジケース: メトリクスが0件の場合は0値を返す', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      // 存在しないAPI IDでサマリーを取得
      const result = await invoke<PerformanceSummary>(
        'get_performance_summary',
        {
          request: {
            api_id: 'non-existent-api-id-67890',
            period: '24h',
          },
        }
      );

      expect(result).toBeDefined();
      // データがない場合は0またはデフォルト値が返される想定
      expect(result.request_count).toBe(0);
    });
  });

  describe('大量データテスト', () => {
    it('大量のメトリクスを記録・取得できる', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          debugWarn('テスト用APIが作成されていません。スキップします。');
        }
        return;
      }

      // 100件のメトリクスを記録
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          invoke('record_performance_metric', {
            request: {
              api_id: testApiId,
              metric_type: 'avg_response_time',
              value: 100 + (i % 50) * 2,
            },
          }) as Promise<void>
        );
      }

      await Promise.all(promises);

      // メトリクスを取得
      const result = await invoke<PerformanceMetricInfo[]>(
        'get_performance_metrics',
        {
          request: {
            api_id: testApiId,
            metric_type: 'avg_response_time',
          },
        }
      );

      // 記録したメトリクスが取得できることを確認（完全一致は保証しないが、複数取得できることを確認）
      expect(result.length).toBeGreaterThanOrEqual(100);
    }, 30000); // タイムアウトを30秒に設定
  });
});
