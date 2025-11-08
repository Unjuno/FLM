// useApiStatus - APIステータス管理フックのユニットテスト

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
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApiStatus, useApiStatusList } from '../../src/hooks/useApiStatus';

// safeInvokeをモック
const mockSafeInvoke = jest.fn();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: (...args: unknown[]) => mockSafeInvoke(...args),
}));

describe('useApiStatus.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('useApiStatus', () => {
    it('API IDがない場合、ステータスをnullにする', () => {
      const { result } = renderHook(() => useApiStatus(null));

      expect(result.current.status).toBe(null);
      expect(mockSafeInvoke).not.toHaveBeenCalled();
    });

    it('APIステータスを取得する', async () => {
      mockSafeInvoke.mockResolvedValue([{ id: 'api-1', status: 'running' }]);

      const { result } = renderHook(() => useApiStatus('api-1'));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledWith('list_apis');
      });

      await waitFor(() => {
        expect(result.current.status).toBe('running');
      });
    });

    it('定期的にステータスをポーリングする', async () => {
      mockSafeInvoke.mockResolvedValue([{ id: 'api-1', status: 'running' }]);

      const { result } = renderHook(() => useApiStatus('api-1', 1000));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledTimes(2);
      });
    });

    it('APIが見つからない場合、エラーを設定する', async () => {
      mockSafeInvoke.mockResolvedValue([]);

      const { result } = renderHook(() => useApiStatus('api-1'));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(result.current.status).toBe(null);
        expect(result.current.error).toBe('APIが見つかりませんでした');
      });
    });

    it('エラーが発生した場合、エラーメッセージを設定する', async () => {
      mockSafeInvoke.mockRejectedValue(new Error('ネットワークエラー'));

      const { result } = renderHook(() => useApiStatus('api-1'));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('ネットワークエラー');
      });
    });

    it('refreshで手動でステータスを更新できる', async () => {
      mockSafeInvoke.mockResolvedValue([{ id: 'api-1', status: 'running' }]);

      const { result } = renderHook(() => useApiStatus('api-1'));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(result.current.status).toBe('running');
      });

      mockSafeInvoke.mockResolvedValue([{ id: 'api-1', status: 'stopped' }]);

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.status).toBe('stopped');
      });
    });

    it('loading状態を管理する', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockSafeInvoke.mockReturnValue(promise);

      const { result } = renderHook(() => useApiStatus('api-1'));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await act(async () => {
        resolvePromise!([{ id: 'api-1', status: 'running' }]);
        await promise;
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('useApiStatusList', () => {
    it('複数のAPIステータスを取得する', async () => {
      mockSafeInvoke.mockResolvedValue([
        { id: 'api-1', status: 'running' },
        { id: 'api-2', status: 'stopped' },
      ]);

      const { result } = renderHook(() => useApiStatusList(1000));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(result.current.statuses).toEqual({
          'api-1': 'running',
          'api-2': 'stopped',
        });
      });
    });

    it('定期的にステータスをポーリングする', async () => {
      mockSafeInvoke.mockResolvedValue([{ id: 'api-1', status: 'running' }]);

      renderHook(() => useApiStatusList(1000));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledTimes(2);
      });
    });

    it('refreshで手動でステータスを更新できる', async () => {
      mockSafeInvoke.mockResolvedValue([{ id: 'api-1', status: 'running' }]);

      const { result } = renderHook(() => useApiStatusList());

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(result.current.statuses['api-1']).toBe('running');
      });

      mockSafeInvoke.mockResolvedValue([
        { id: 'api-1', status: 'stopped' },
        { id: 'api-2', status: 'running' },
      ]);

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.statuses['api-1']).toBe('stopped');
        expect(result.current.statuses['api-2']).toBe('running');
      });
    });
  });
});
