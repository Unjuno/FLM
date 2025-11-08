// usePerformanceMetrics - パフォーマンスメトリクス取得用フックのユニットテスト

/**
 * @jest-environment jsdom
 */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { usePerformanceMetrics } from '../../src/hooks/usePerformanceMetrics';

// safeInvokeをモック
const mockSafeInvoke = jest.fn();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: (...args: unknown[]) => mockSafeInvoke(...args),
}));

describe('usePerformanceMetrics.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  describe('基本的な機能', () => {
    it('初期状態でloadingがtrue', () => {
      mockSafeInvoke.mockImplementation(() => new Promise(() => {})); // 永続的なPromise

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
        })
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('データを取得してloadingがfalseになる', async () => {
      const mockData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 100,
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 200,
          timestamp: '2024-01-01T00:01:00Z',
        },
      ];

      mockSafeInvoke.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data.length).toBe(2);
      expect(result.current.data[0].value).toBe(100);
      expect(result.current.data[1].value).toBe(200);
    });

    it('apiIdが空の場合、isEmptyがtrue', async () => {
      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: '',
          metricType: 'response_time',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isEmpty).toBe(true);
      expect(result.current.data).toEqual([]);
    });
  });

  describe('自動更新', () => {
    it('autoRefreshがtrueの場合、定期的にデータを取得する', async () => {
      const mockData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 100,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
          autoRefresh: true,
          refreshInterval: 1000,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSafeInvoke).toHaveBeenCalledTimes(1);

      // 時間を進める
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledTimes(2);
      });
    });

    it('autoRefreshがfalseの場合、自動更新しない', async () => {
      const mockData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 100,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
          autoRefresh: false,
          refreshInterval: 1000,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSafeInvoke).toHaveBeenCalledTimes(1);

      // 時間を進める
      jest.advanceTimersByTime(1000);

      // 自動更新されない
      expect(mockSafeInvoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('値のフォーマット', () => {
    it('valueFormatterを使用して値をフォーマットする', async () => {
      const mockData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 0.5,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke.mockResolvedValue(mockData);

      const valueFormatter = (value: number) => value * 100; // パーセンテージ変換

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
          valueFormatter,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data[0].value).toBe(50); // 0.5 * 100
    });

    it('valueFormatterが指定されない場合、デフォルトで整数に丸める', async () => {
      const mockData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 100.7,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data[0].value).toBe(101); // Math.round(100.7)
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーが発生した場合、errorステートを設定する', async () => {
      mockSafeInvoke.mockRejectedValue(new Error('データの取得に失敗しました'));

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('データの取得に失敗しました');
      expect(result.current.data).toEqual([]);
    });

    it('無効なデータをフィルタリングする', async () => {
      const mockData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 100,
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: NaN,
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          id: 3,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 200,
          timestamp: null, // 無効なタイムスタンプ
        },
      ];

      mockSafeInvoke.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 有効なデータのみが含まれる
      expect(result.current.data.length).toBe(1);
      expect(result.current.data[0].value).toBe(100);
    });
  });

  describe('日付範囲のフィルタリング', () => {
    it('startDateとendDateを指定してデータを取得する', async () => {
      const mockData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 100,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSafeInvoke).toHaveBeenCalledWith('get_performance_metrics', {
        request: {
          api_id: 'test-api',
          metric_type: 'response_time',
          start_date: '2024-01-01',
          end_date: '2024-01-02',
        },
      });
    });
  });

  describe('データのソート', () => {
    it('データを時間順にソートする', async () => {
      const mockData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 200,
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 100,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 時間順にソートされている
      expect(result.current.data[0].value).toBe(100);
      expect(result.current.data[1].value).toBe(200);
    });
  });

  describe('loadData関数', () => {
    it('loadData関数を手動で呼び出せる', async () => {
      const mockData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'response_time',
          value: 100,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke.mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        usePerformanceMetrics({
          apiId: 'test-api',
          metricType: 'response_time',
          autoRefresh: false,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // データをクリア
      mockSafeInvoke.mockResolvedValue([]);

      // 手動で再読み込み
      result.current.loadData();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSafeInvoke).toHaveBeenCalledTimes(2);
    });
  });
});
