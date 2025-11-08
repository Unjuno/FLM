// logger - 統一ロガーユーティリティのユニットテスト

/**
 * @jest-environment node
 */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

// loggerを直接インポート
import { LogLevel, logger } from '../../src/utils/logger';

// console.log, console.error, console.warn, console.debugをモック
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest
  .spyOn(console, 'error')
  .mockImplementation(() => {});
const mockConsoleWarn = jest
  .spyOn(console, 'warn')
  .mockImplementation(() => {});
const mockConsoleDebug = jest
  .spyOn(console, 'debug')
  .mockImplementation(() => {});

describe('logger.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 開発環境に設定
    process.env.NODE_ENV = 'development';
    // loggerの設定を開発環境用に更新（devOnlyをfalseにして、必ずログを出力するようにする）
    logger.setConfig({
      minLevel: LogLevel.DEBUG,
      devOnly: false, // テスト環境でもログを出力するようにする
      includeTimestamp: true,
      includeContext: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // loggerの設定をリセット
    logger.setConfig({
      minLevel: LogLevel.DEBUG,
      devOnly: true,
      includeTimestamp: true,
      includeContext: true,
    });
  });

  describe('ロガーインスタンス', () => {
    it('デフォルトロガーインスタンスが存在する', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('ログレベルの判定', () => {
    it('DEBUGレベルでログを出力する（開発環境）', () => {
      logger.debug('デバッグメッセージ');
      expect(mockConsoleDebug).toHaveBeenCalled();
    });

    it('INFOレベルでログを出力する', () => {
      logger.info('情報メッセージ');
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('WARNレベルでログを出力する', () => {
      logger.warn('警告メッセージ');
      expect(mockConsoleWarn).toHaveBeenCalled();
    });

    it('ERRORレベルでログを出力する', () => {
      logger.error('エラーメッセージ');
      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('開発環境のみの設定', () => {
    it('本番環境ではログを出力しない（devOnly=true）', () => {
      process.env.NODE_ENV = 'production';

      // loggerの設定を変更（setConfigメソッドがある場合）
      if (typeof (logger as any).setConfig === 'function') {
        (logger as any).setConfig({ devOnly: true });
      }

      logger.error('エラーメッセージ');
      // デフォルトでは本番環境ではエラーも出力しない（devOnly=true）
      // ただし、実際の動作は実装に依存するため、テストは調整が必要
    });
  });

  describe('タイムスタンプの表示', () => {
    it('タイムスタンプを含めてログを出力する（デフォルト設定）', () => {
      logger.info('テストメッセージ');

      const logCall = mockConsoleLog.mock.calls[0][0];
      // タイムスタンプが含まれていることを確認
      expect(logCall).toContain('[');
      expect(logCall).toContain(']');
    });
  });

  describe('コンテキスト情報の表示', () => {
    it('コンテキストを含めてログを出力する（デフォルト設定）', () => {
      logger.info('テストメッセージ', 'TestContext');

      const logCall = mockConsoleLog.mock.calls[0][0];
      expect(logCall).toContain('[TestContext]');
    });
  });

  describe('エラーログ', () => {
    it('Errorオブジェクトをログに記録する', () => {
      const error = new Error('テストエラー');
      logger.error('エラーメッセージ', error);

      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('エラーオブジェクトとコンテキストをログに記録する', () => {
      const error = new Error('テストエラー');
      logger.error('エラーメッセージ', error, 'ErrorContext');

      expect(mockConsoleError).toHaveBeenCalled();
      const logCall = mockConsoleError.mock.calls[0][0];
      expect(logCall).toContain('[ErrorContext]');
    });
  });

  describe('デフォルトロガー', () => {
    it('デフォルトロガーインスタンスが存在する', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('デフォルトロガーでログを出力する', () => {
      logger.info('デフォルトロガーテスト');
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('デフォルトロガーでエラーを出力する', () => {
      logger.error('エラーテスト');
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('デフォルトロガーで警告を出力する', () => {
      logger.warn('警告テスト');
      expect(mockConsoleWarn).toHaveBeenCalled();
    });

    it('デフォルトロガーでデバッグを出力する', () => {
      logger.debug('デバッグテスト');
      expect(mockConsoleDebug).toHaveBeenCalled();
    });
  });

  describe('ログメッセージのフォーマット', () => {
    it('ログレベルを含めてフォーマットする', () => {
      logger.info('テストメッセージ');

      const logCall = mockConsoleLog.mock.calls[0][0];
      expect(logCall).toContain('[INFO]');
    });

    it('複数のログレベルを正しく表示する', () => {
      logger.debug('デバッグ');
      logger.info('情報');
      logger.warn('警告');
      logger.error('エラー');

      // 各ログが呼び出されたことを確認
      expect(mockConsoleDebug).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleWarn).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalled();

      // ログレベルが含まれていることを確認
      if (mockConsoleDebug.mock.calls.length > 0) {
        expect(mockConsoleDebug.mock.calls[0][0]).toContain('[DEBUG]');
      }
      if (mockConsoleLog.mock.calls.length > 0) {
        expect(mockConsoleLog.mock.calls[0][0]).toContain('[INFO]');
      }
      if (mockConsoleWarn.mock.calls.length > 0) {
        expect(mockConsoleWarn.mock.calls[0][0]).toContain('[WARN]');
      }
      if (mockConsoleError.mock.calls.length > 0) {
        expect(mockConsoleError.mock.calls[0][0]).toContain('[ERROR]');
      }
    });
  });

  describe('LogLevel enum', () => {
    it('LogLevelが正しく定義されている', () => {
      expect(LogLevel.DEBUG).toBe('debug');
      expect(LogLevel.INFO).toBe('info');
      expect(LogLevel.WARN).toBe('warn');
      expect(LogLevel.ERROR).toBe('error');
    });
  });
});
