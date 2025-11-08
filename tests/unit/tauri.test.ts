// tauri - Tauri環境の検出と安全なinvoke関数のユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  isTauriAvailable,
  safeInvoke,
  checkTauriEnvironment,
} from '../../src/utils/tauri';

// Tauri APIをモック
const mockInvoke = jest.fn();
jest.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// loggerをモック
jest.mock('../../src/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// errorHandlerをモック
const mockParseError = jest.fn();
const mockLogError = jest.fn();
jest.mock('../../src/utils/errorHandler', () => ({
  parseError: (...args: unknown[]) => mockParseError(...args),
  logError: (...args: unknown[]) => mockLogError(...args),
  ErrorCategory: {
    API: 'api',
  },
}));

describe('tauri.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // window.__TAURI__を確実にモック
    // @ts-ignore
    global.window = {
      __TAURI__: {
        invoke: mockInvoke,
      },
    };

    // @tauri-apps/api/coreのinvokeもモック
    mockInvoke.mockClear();
  });

  describe('isTauriAvailable関数', () => {
    it('Tauri環境が利用可能な場合、trueを返す', () => {
      // @ts-ignore
      global.window = {
        __TAURI__: {
          invoke: mockInvoke,
        },
      };
      const result = isTauriAvailable();
      expect(result).toBe(true);
    });

    it('windowが存在しない場合、falseを返す', () => {
      // @ts-ignore
      delete global.window;

      const result = isTauriAvailable();
      expect(result).toBe(false);
    });

    it('__TAURI__が存在しない場合、falseを返す', () => {
      // @ts-ignore
      global.window = {};

      const result = isTauriAvailable();
      expect(result).toBe(false);
    });

    it('invoke関数が存在しない場合、falseを返す', () => {
      // @ts-ignore
      global.window = {
        __TAURI__: {},
      };

      const result = isTauriAvailable();
      expect(result).toBe(false);
    });
  });

  describe('safeInvoke関数', () => {
    it('正常にinvokeを呼び出す', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      const result = await safeInvoke('test_command', { param: 'value' });

      expect(mockInvoke).toHaveBeenCalledWith('test_command', {
        param: 'value',
      });
      expect(result).toEqual({ success: true });
    });

    it('引数なしでinvokeを呼び出す', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      const result = await safeInvoke('test_command');

      expect(mockInvoke).toHaveBeenCalledWith('test_command', undefined);
      expect(result).toEqual({ success: true });
    });

    it('Tauri環境が利用できない場合、エラーをスローする', async () => {
      // @ts-ignore
      delete global.window;

      await expect(safeInvoke('test_command')).rejects.toThrow(
        'アプリケーションが正しく起動していません'
      );
    });

    it('エラーが発生した場合、エラーを解析してログに記録する', async () => {
      const error = new Error('テストエラー');
      mockInvoke.mockRejectedValue(error);
      mockParseError.mockReturnValue({
        message: 'ユーザーフレンドリーなエラーメッセージ',
        category: 'api',
        type: 'network',
        suggestion: 'ネットワーク接続を確認してください',
      });

      await expect(safeInvoke('test_command')).rejects.toThrow(
        'ユーザーフレンドリーなエラーメッセージ'
      );

      expect(mockParseError).toHaveBeenCalled();
      expect(mockLogError).toHaveBeenCalled();
    });

    it('型パラメータを使用して型安全にinvokeを呼び出す', async () => {
      interface TestResult {
        id: string;
        name: string;
      }

      const mockResult: TestResult = { id: '1', name: 'テスト' };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await safeInvoke<TestResult>('get_test_data');

      expect(result).toEqual(mockResult);
      expect(result.id).toBe('1');
      expect(result.name).toBe('テスト');
    });
  });

  describe('checkTauriEnvironment関数', () => {
    it('Tauri環境が利用可能な場合、警告を表示しない', () => {
      checkTauriEnvironment('テスト機能');
      // 警告が表示されないことを確認（logger.warnが呼ばれない）
      const { logger } = require('../../src/utils/logger');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('Tauri環境が利用できない場合、開発環境で警告を表示する', () => {
      // windowは存在するが、Tauri環境は利用できない状態をシミュレート
      // @ts-ignore
      global.window = {
        __TAURI__: undefined,
      };
      process.env.NODE_ENV = 'development';

      checkTauriEnvironment('テスト機能');

      const { logger } = require('../../src/utils/logger');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('Tauri環境が利用できない場合、本番環境では警告を表示しない', () => {
      // @ts-ignore
      delete global.window;
      process.env.NODE_ENV = 'production';

      checkTauriEnvironment('テスト機能');

      const { logger } = require('../../src/utils/logger');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('カスタム機能名で警告を表示する', () => {
      // windowは存在するが、Tauri環境は利用できない状態をシミュレート
      // @ts-ignore
      global.window = {
        __TAURI__: undefined,
      };
      process.env.NODE_ENV = 'development';

      checkTauriEnvironment('カスタム機能');

      const { logger } = require('../../src/utils/logger');
      expect(logger.warn).toHaveBeenCalled();
      if (logger.warn.mock.calls.length > 0 && logger.warn.mock.calls[0][0]) {
        const warnCall = logger.warn.mock.calls[0][0];
        expect(warnCall).toContain('カスタム機能');
      }
    });

    it('デフォルト機能名で警告を表示する', () => {
      // windowは存在するが、Tauri環境は利用できない状態をシミュレート
      // @ts-ignore
      global.window = {
        __TAURI__: undefined,
      };
      process.env.NODE_ENV = 'development';

      checkTauriEnvironment();

      const { logger } = require('../../src/utils/logger');
      expect(logger.warn).toHaveBeenCalled();
      if (logger.warn.mock.calls.length > 0 && logger.warn.mock.calls[0][0]) {
        const warnCall = logger.warn.mock.calls[0][0];
        expect(warnCall).toContain('この機能');
      }
    });
  });
});
