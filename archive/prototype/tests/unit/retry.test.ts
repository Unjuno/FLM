// retry - リトライユーティリティのユニットテスト

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { retry, isRetryableError, RetryConfig } from '../../src/utils/retry';

describe('retry.ts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('retry関数', () => {
    it('成功する関数は1回で実行される', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('最初の試行で失敗し、2回目で成功する', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('失敗'))
        .mockResolvedValueOnce('success');

      const promise = retry(fn, { maxRetries: 2 });

      // タイマーを進める（1回目のリトライ待機）
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('最大リトライ回数まで失敗した場合、最後のエラーをスローする', async () => {
      const error1 = new Error('エラー1');
      const error2 = new Error('エラー2');
      const error3 = new Error('エラー3');

      const fn = jest
        .fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockRejectedValueOnce(error3);

      const promise = retry(fn, { maxRetries: 3 });

      // タイマーを進める（すべてのリトライ待機: 1秒 + 2秒 = 3秒）
      await jest.advanceTimersByTimeAsync(3000);

      try {
        await promise;
        expect(true).toBe(false); // ここに到達してはいけない
      } catch (error) {
        expect(error).toBe(error3);
        expect((error as Error).message).toBe('エラー3');
      }
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('デフォルトで最大3回リトライする', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('失敗'))
        .mockRejectedValueOnce(new Error('失敗'))
        .mockRejectedValueOnce(new Error('失敗'));

      const promise = retry(fn);

      // タイマーを進める（すべてのリトライ待機: 1秒 + 2秒 = 3秒）
      await jest.advanceTimersByTimeAsync(3000);

      await expect(promise).rejects.toThrow('失敗');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('カスタムリトライ回数を設定できる', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('失敗'))
        .mockRejectedValueOnce(new Error('失敗'))
        .mockRejectedValueOnce(new Error('失敗'))
        .mockRejectedValueOnce(new Error('失敗'))
        .mockRejectedValueOnce(new Error('失敗'));

      const promise = retry(fn, { maxRetries: 5 });

      // タイマーを進める（1秒 + 2秒 + 3秒 + 4秒 = 10秒）
      await jest.advanceTimersByTimeAsync(10000);

      await expect(promise).rejects.toThrow('失敗');
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('exponentialBackoffがtrueの場合、リトライ間隔が段階的に延長される', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('失敗1'))
        .mockRejectedValueOnce(new Error('失敗2'))
        .mockResolvedValueOnce('success');

      const promise = retry(fn, {
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true,
      });

      // 1回目のリトライ待機（1秒）
      await jest.advanceTimersByTimeAsync(1000);
      // 2回目のリトライ待機（2秒）
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('exponentialBackoffがfalseの場合、リトライ間隔が一定', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('失敗1'))
        .mockRejectedValueOnce(new Error('失敗2'))
        .mockResolvedValueOnce('success');

      const promise = retry(fn, {
        maxRetries: 3,
        retryDelay: 500,
        exponentialBackoff: false,
      });

      // 1回目のリトライ待機（500ms）
      await jest.advanceTimersByTimeAsync(500);
      // 2回目のリトライ待機（500ms）
      await jest.advanceTimersByTimeAsync(500);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('shouldRetry関数でリトライ可能かどうかを判定できる', async () => {
      const nonRetryableError = new Error('永続的なエラー');
      const retryableError = new Error('一時的なエラー');

      const shouldRetry = (error: unknown) => {
        if (error instanceof Error) {
          return error.message.includes('一時的');
        }
        return false;
      };

      const fn1 = jest.fn().mockRejectedValue(nonRetryableError);
      const promise1 = retry(fn1, { shouldRetry });

      await expect(promise1).rejects.toThrow('永続的なエラー');
      expect(fn1).toHaveBeenCalledTimes(1); // リトライされない

      const fn2 = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce('success');

      const promise2 = retry(fn2, { shouldRetry, maxRetries: 2 });
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise2;
      expect(result).toBe('success');
      expect(fn2).toHaveBeenCalledTimes(2); // リトライされる
    });

    it('onRetryコールバックが呼ばれる', async () => {
      const onRetry = jest.fn();
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('失敗1'))
        .mockRejectedValueOnce(new Error('失敗2'))
        .mockResolvedValueOnce('success');

      const promise = retry(fn, {
        maxRetries: 3,
        onRetry,
      });

      // 1回目のリトライ待機（1秒）
      await jest.advanceTimersByTimeAsync(1000);
      // 2回目のリトライ待機（2秒）
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, 3);
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, 3);
    });

    it('カスタムリトライ間隔を設定できる', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('失敗'))
        .mockResolvedValueOnce('success');

      const promise = retry(fn, {
        maxRetries: 2,
        retryDelay: 2000,
        exponentialBackoff: false,
      });

      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('isRetryableError関数', () => {
    it('ネットワークエラーをリトライ可能と判定する', () => {
      expect(isRetryableError(new Error('network error'))).toBe(true);
      expect(isRetryableError(new Error('Network Error'))).toBe(true);
      expect(isRetryableError(new Error('Connection failed'))).toBe(true);
    });

    it('タイムアウトエラーをリトライ可能と判定する', () => {
      expect(isRetryableError(new Error('timeout'))).toBe(true);
      expect(isRetryableError(new Error('タイムアウト'))).toBe(true);
    });

    it('一時的なサービスエラーをリトライ可能と判定する', () => {
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
      expect(isRetryableError(new Error('一時的なエラー'))).toBe(true);
    });

    it('接続エラーをリトライ可能と判定する', () => {
      expect(isRetryableError(new Error('接続エラー'))).toBe(true);
      expect(isRetryableError(new Error('connection refused'))).toBe(true);
    });

    it('リトライ不可能なエラーを正しく判定する', () => {
      expect(isRetryableError(new Error('認証エラー'))).toBe(false);
      expect(isRetryableError(new Error('404 Not Found'))).toBe(false);
      expect(isRetryableError(new Error('バリデーションエラー'))).toBe(false);
    });

    it('Error以外のオブジェクトはリトライ不可能と判定する', () => {
      expect(isRetryableError('文字列エラー')).toBe(false);
      expect(isRetryableError(123)).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });
});
