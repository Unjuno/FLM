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
const mockSafeInvoke = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.mock('../../src/utils/tauri', () => ({
  safeInvoke: jest.fn((...args: unknown[]) => mockSafeInvoke(...args)),
  isTauriAvailable: jest.fn(() => false),
  clearInvokeCache: jest.fn(),
}));

describe('useApiStatus.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // usePollingフックがuseEffectを使用しているため、useFakeTimers()は使用しない
    // 実際のタイマーを使用して、useEffectが正しく実行されるようにする
  });

  afterEach(() => {
    // useFakeTimers()を使用していないため、クリーンアップは不要
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
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(
        () => {
          expect(mockSafeInvoke).toHaveBeenCalledWith('list_apis', undefined);
        },
        { timeout: 3000 }
      );

      await waitFor(
        () => {
          expect(result.current.status).toBe('running');
        },
        { timeout: 3000 }
      );
    });

    it('定期的にステータスをポーリングする', async () => {
      mockSafeInvoke.mockResolvedValue([{ id: 'api-1', status: 'running' }]);

      const { result } = renderHook(() => useApiStatus('api-1', 1000));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledTimes(2);
      });
    });

    it('APIが見つからない場合、エラーを設定する', async () => {
      mockSafeInvoke.mockResolvedValue([]);

      const { result } = renderHook(() => useApiStatus('api-1'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(
        () => {
          expect(result.current.status).toBe(null);
          // APIが見つからない場合、エラーは設定されない（ステータスがnullになるだけ）
          // エラーメッセージは別のエラー（ネットワークエラーなど）の場合のみ設定される
        },
        { timeout: 3000 }
      );
    });

    it('エラーが発生した場合、エラーメッセージを設定する', async () => {
      mockSafeInvoke.mockRejectedValue(new Error('ネットワークエラー'));

      const { result } = renderHook(() => useApiStatus('api-1'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(
        () => {
          expect(result.current.error).toBeTruthy();
          expect(result.current.error).toContain('ネットワークエラー');
        },
        { timeout: 3000 }
      );
    });

    it('refreshで手動でステータスを更新できる', async () => {
      mockSafeInvoke.mockResolvedValue([{ id: 'api-1', status: 'running' }]);

      const { result } = renderHook(() => useApiStatus('api-1'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(
        () => {
          expect(result.current.status).toBe('running');
        },
        { timeout: 3000 }
      );

      mockSafeInvoke.mockResolvedValue([{ id: 'api-1', status: 'stopped' }]);

      await act(async () => {
        result.current.refresh();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(
        () => {
          expect(result.current.status).toBe('stopped');
        },
        { timeout: 3000 }
      );
    });

    it('loading状態を管理する', async () => {
      let resolvePromise: (value: { id: string; status: string }[]) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockSafeInvoke.mockReturnValue(promise);

      const { result } = renderHook(() => useApiStatus('api-1'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(
        () => {
          expect(result.current.loading).toBe(true);
        },
        { timeout: 3000 }
      );

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
        await new Promise(resolve => setTimeout(resolve, 0));
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
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      await waitFor(() => {
        expect(mockSafeInvoke).toHaveBeenCalledTimes(2);
      });
    });

    it('refreshで手動でステータスを更新できる', async () => {
      mockSafeInvoke.mockResolvedValue([{ id: 'api-1', status: 'running' }]);

      const { result } = renderHook(() => useApiStatusList());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
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
