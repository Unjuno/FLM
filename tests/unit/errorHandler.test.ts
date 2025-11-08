// errorHandler - エラーハンドリングユーティリティのユニットテスト

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  parseError,
  logError,
  errorToString,
  ErrorCategory,
  ErrorInfo,
} from '../../src/utils/errorHandler';
import { logger } from '../../src/utils/logger';

// loggerをモック
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('errorHandler.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseError', () => {
    it('Errorオブジェクトを正しく解析する', () => {
      const error = new Error('Test error');
      const result = parseError(error);

      expect(result).toHaveProperty('originalError', error);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('category', ErrorCategory.GENERAL);
      expect(result).toHaveProperty('retryable', false);
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('suggestion');
      expect(result.technicalDetails).toBe(error.stack);
    });

    it('Ollamaエラーを正しく分類する', () => {
      const error = new Error('Ollama not found');
      const result = parseError(error);

      expect(result.category).toBe(ErrorCategory.OLLAMA);
      expect(result.message).toContain('Ollama');
    });

    it('APIエラーを正しく分類する', () => {
      const error = new Error('Port already in use');
      const result = parseError(error);

      expect(result.category).toBe(ErrorCategory.API);
      expect(result.message).toContain('ポート');
    });

    it('モデルエラーを正しく分類する', () => {
      const error = new Error('Model not found');
      const result = parseError(error);

      expect(result.category).toBe(ErrorCategory.MODEL);
      expect(result.message).toContain('モデル');
    });

    it('データベースエラーを正しく分類する', () => {
      const error = new Error('Database locked');
      const result = parseError(error);

      expect(result.category).toBe(ErrorCategory.DATABASE);
      expect(result.message).toContain('データベース');
    });

    it('ネットワークエラーを正しく分類し、リトライ可能としてマークする', () => {
      const error = new Error('Network connection failed');
      const result = parseError(error);

      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.retryable).toBe(true);
      expect(result.message).toContain('ネットワーク');
    });

    it('権限エラーを正しく分類する', () => {
      const error = new Error('Permission denied');
      const result = parseError(error);

      expect(result.category).toBe(ErrorCategory.PERMISSION);
      expect(result.message).toContain('権限');
    });

    it('文字列エラーを正しく解析する', () => {
      const error = 'String error';
      const result = parseError(error);

      expect(result).toHaveProperty('originalError', error);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('category', ErrorCategory.GENERAL);
    });

    it('不明な型のエラーを正しく解析する', () => {
      const error = { code: 500, message: 'Unknown error' };
      const result = parseError(error);

      expect(result).toHaveProperty('originalError', error);
      expect(result.message).toBe('予期しないエラーが発生しました');
      expect(result.technicalDetails).toBe(String(error));
    });

    it('カテゴリが指定されている場合、そのカテゴリを使用する', () => {
      const error = new Error('Test error');
      const result = parseError(error, ErrorCategory.API);

      expect(result.category).toBe(ErrorCategory.API);
    });

    it('リトライ可能なエラーを正しく判定する', () => {
      const error = new Error('Connection timeout');
      const result = parseError(error);

      expect(result.retryable).toBe(true);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('Ollama not foundエラーに対して適切なメッセージを返す', () => {
      const error = new Error('Ollama not found');
      const result = parseError(error);

      expect(result.message).toContain('Ollamaが見つかりませんでした');
    });

    it('ポート使用中エラーに対して適切なメッセージを返す', () => {
      const error = new Error('Port already in use');
      const result = parseError(error);

      expect(result.message).toContain('ポート番号は既に使用されています');
    });

    it('無効なポート番号エラーに対して適切なメッセージを返す', () => {
      const error = new Error('Invalid port');
      const result = parseError(error, ErrorCategory.API);

      expect(result.message).toContain('ポート番号は');
    });
  });

  describe('isRetryableError', () => {
    it('ネットワークエラーをリトライ可能として判定する', () => {
      const error = new Error('Network error');
      const result = parseError(error);

      expect(result.retryable).toBe(true);
    });

    it('タイムアウトエラーをリトライ可能として判定する', () => {
      const error = new Error('Connection timeout');
      const result = parseError(error);

      expect(result.retryable).toBe(true);
    });

    it('一般的なエラーをリトライ不可能として判定する', () => {
      const error = new Error('General error');
      const result = parseError(error);

      expect(result.retryable).toBe(false);
    });
  });

  describe('getSuggestion', () => {
    it('各カテゴリに対して適切な推奨対処法を返す', () => {
      const categories = [
        ErrorCategory.OLLAMA,
        ErrorCategory.API,
        ErrorCategory.MODEL,
        ErrorCategory.DATABASE,
        ErrorCategory.NETWORK,
        ErrorCategory.PERMISSION,
        ErrorCategory.VALIDATION,
        ErrorCategory.GENERAL,
      ];

      categories.forEach(category => {
        const error = new Error('Test error');
        const result = parseError(error, category);

        expect(result.suggestion).toBeDefined();
        expect(typeof result.suggestion).toBe('string');
        expect(result.suggestion!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('logError', () => {
    it('エラーをログに記録する', () => {
      const errorInfo: ErrorInfo = {
        originalError: new Error('Test error'),
        message: 'Test error message',
        category: ErrorCategory.GENERAL,
        retryable: false,
        timestamp: new Date().toISOString(),
        suggestion: 'Test suggestion',
      };

      logError(errorInfo, 'TestContext');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Test error message'),
        expect.any(Error),
        'TestContext'
      );
    });

    it('開発環境でデバッグ情報を記録する', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const errorInfo: ErrorInfo = {
        originalError: new Error('Test error'),
        message: 'Test error message',
        category: ErrorCategory.GENERAL,
        retryable: false,
        timestamp: new Date().toISOString(),
        suggestion: 'Test suggestion',
        technicalDetails: 'Stack trace',
      };

      logError(errorInfo);

      expect(logger.debug).toHaveBeenCalledWith(
        'Error details:',
        expect.objectContaining({
          category: ErrorCategory.GENERAL,
          retryable: false,
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('errorToString', () => {
    it('Errorオブジェクトを文字列に変換する', () => {
      const error = new Error('Test error');
      const result = errorToString(error);

      expect(result).toBe('Test error');
    });

    it('文字列エラーをそのまま返す', () => {
      const error = 'String error';
      const result = errorToString(error);

      expect(result).toBe('String error');
    });

    it('不明な型のエラーに対してデフォルトメッセージを返す', () => {
      const error = { code: 500 };
      const result = errorToString(error);

      expect(result).toBe('予期しないエラーが発生しました');
    });
  });
});
