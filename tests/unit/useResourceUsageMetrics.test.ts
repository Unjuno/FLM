// useResourceUsageMetrics - CPU/メモリ使用率取得用フックのユニットテスト

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
import { useResourceUsageMetrics } from '../../src/hooks/useResourceUsageMetrics';

// safeInvokeをモック
const mockSafeInvoke = jest.fn();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: (...args: unknown[]) => mockSafeInvoke(...args),
}));

describe('useResourceUsageMetrics.ts', () => {
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
        useResourceUsageMetrics({
          apiId: 'test-api',
        })
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('CPUとメモリのデータを取得してマージする', async () => {
      const mockCpuData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'cpu_usage',
          value: 50,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      const mockMemoryData = [
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'memory_usage',
          value: 60,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke
        .mockResolvedValueOnce(mockCpuData)
        .mockResolvedValueOnce(mockMemoryData);

      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: 'test-api',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data.length).toBe(1);
      expect(result.current.data[0].cpu).toBe(50);
      expect(result.current.data[0].memory).toBe(60);
    });

    it('apiIdが空の場合、isEmptyがtrue', async () => {
      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: '',
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
      const mockCpuData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'cpu_usage',
          value: 50,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      const mockMemoryData = [
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'memory_usage',
          value: 60,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke
        .mockResolvedValueOnce(mockCpuData)
        .mockResolvedValueOnce(mockMemoryData)
        .mockResolvedValueOnce(mockCpuData)
        .mockResolvedValueOnce(mockMemoryData);

      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: 'test-api',
          autoRefresh: true,
          refreshInterval: 1000,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSafeInvoke).toHaveBeenCalledTimes(2); // 初回: CPU + メモリ

      // 時間を進める
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledTimes(4); // 更新: CPU + メモリ
      });
    });

    it('autoRefreshがfalseの場合、自動更新しない', async () => {
      const mockCpuData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'cpu_usage',
          value: 50,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      const mockMemoryData = [
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'memory_usage',
          value: 60,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke
        .mockResolvedValueOnce(mockCpuData)
        .mockResolvedValueOnce(mockMemoryData);

      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: 'test-api',
          autoRefresh: false,
          refreshInterval: 1000,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSafeInvoke).toHaveBeenCalledTimes(2);

      // 時間を進める
      jest.advanceTimersByTime(1000);

      // 自動更新されない
      expect(mockSafeInvoke).toHaveBeenCalledTimes(2);
    });
  });

  describe('データのマージ', () => {
    it('同じタイムスタンプのCPUとメモリデータをマージする', async () => {
      const mockCpuData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'cpu_usage',
          value: 0.5, // 50%
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      const mockMemoryData = [
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'memory_usage',
          value: 0.6, // 60%
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke
        .mockResolvedValueOnce(mockCpuData)
        .mockResolvedValueOnce(mockMemoryData);

      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: 'test-api',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data.length).toBe(1);
      expect(result.current.data[0].cpu).toBe(50);
      expect(result.current.data[0].memory).toBe(60);
    });

    it('異なるタイムスタンプのデータを別エントリとして扱う', async () => {
      const mockCpuData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'cpu_usage',
          value: 50,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      const mockMemoryData = [
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'memory_usage',
          value: 60,
          timestamp: '2024-01-01T00:01:00Z', // 異なるタイムスタンプ
        },
      ];

      mockSafeInvoke
        .mockResolvedValueOnce(mockCpuData)
        .mockResolvedValueOnce(mockMemoryData);

      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: 'test-api',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data.length).toBe(2);
      expect(result.current.data[0].cpu).toBe(50);
      expect(result.current.data[0].memory).toBe(0);
      expect(result.current.data[1].cpu).toBe(0);
      expect(result.current.data[1].memory).toBe(60);
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーが発生した場合、errorステートを設定する', async () => {
      mockSafeInvoke.mockRejectedValue(new Error('データの取得に失敗しました'));

      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: 'test-api',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('データの取得に失敗しました');
      expect(result.current.data).toEqual([]);
    });

    it('無効なデータをフィルタリングする', async () => {
      const mockCpuData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'cpu_usage',
          value: 50,
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'cpu_usage',
          value: NaN,
          timestamp: '2024-01-01T00:01:00Z',
        },
        {
          id: 3,
          api_id: 'test-api',
          metric_type: 'cpu_usage',
          value: 60,
          timestamp: null, // 無効なタイムスタンプ
        },
      ];

      const mockMemoryData: any[] = [];

      mockSafeInvoke
        .mockResolvedValueOnce(mockCpuData)
        .mockResolvedValueOnce(mockMemoryData);

      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: 'test-api',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 有効なデータのみが含まれる
      expect(result.current.data.length).toBe(1);
      expect(result.current.data[0].cpu).toBe(50);
    });
  });

  describe('日付範囲のフィルタリング', () => {
    it('startDateとendDateを指定してデータを取得する', async () => {
      const mockCpuData: any[] = [];
      const mockMemoryData: any[] = [];

      mockSafeInvoke
        .mockResolvedValueOnce(mockCpuData)
        .mockResolvedValueOnce(mockMemoryData);

      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: 'test-api',
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
          metric_type: 'cpu_usage',
          start_date: '2024-01-01',
          end_date: '2024-01-02',
        },
      });

      expect(mockSafeInvoke).toHaveBeenCalledWith('get_performance_metrics', {
        request: {
          api_id: 'test-api',
          metric_type: 'memory_usage',
          start_date: '2024-01-01',
          end_date: '2024-01-02',
        },
      });
    });
  });

  describe('データのソート', () => {
    it('データを時間順にソートする', async () => {
      const mockCpuData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'cpu_usage',
          value: 50,
          timestamp: '2024-01-01T00:01:00Z',
        },
      ];

      const mockMemoryData = [
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'memory_usage',
          value: 60,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke
        .mockResolvedValueOnce(mockCpuData)
        .mockResolvedValueOnce(mockMemoryData);

      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: 'test-api',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 時間順にソートされている
      expect(result.current.data[0].time).toBeLessThan(
        result.current.data[1].time
      );
    });
  });

  describe('loadData関数', () => {
    it('loadData関数を手動で呼び出せる', async () => {
      const mockCpuData = [
        {
          id: 1,
          api_id: 'test-api',
          metric_type: 'cpu_usage',
          value: 50,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      const mockMemoryData = [
        {
          id: 2,
          api_id: 'test-api',
          metric_type: 'memory_usage',
          value: 60,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];

      mockSafeInvoke
        .mockResolvedValueOnce(mockCpuData)
        .mockResolvedValueOnce(mockMemoryData)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const { result } = renderHook(() =>
        useResourceUsageMetrics({
          apiId: 'test-api',
          autoRefresh: false,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 手動で再読み込み
      result.current.loadData();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSafeInvoke).toHaveBeenCalledTimes(4); // 初回 + 再読み込み (CPU + メモリ)
    });
  });
});
