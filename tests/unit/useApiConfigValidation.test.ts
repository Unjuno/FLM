// useApiConfigValidation - API設定のバリデーションフックのユニットテスト

/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import { useApiConfigValidation } from '../../src/hooks/useApiConfigValidation';
import type { ApiConfig } from '../../src/types/api';
import { PORT_RANGE, API_NAME } from '../../src/constants/config';

describe('useApiConfigValidation.ts', () => {
  describe('API名のバリデーション', () => {
    it('有効なAPI名を検証する', () => {
      const config: ApiConfig = {
        name: 'Test API',
        port: 8080,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(true);
      expect(Object.keys(result.current.errors)).toHaveLength(0);
    });

    it('空のAPI名を検証する', () => {
      const config: ApiConfig = {
        name: '',
        port: 8080,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors.name).toBe('API名を入力してください');
    });

    it('空白のみのAPI名を検証する', () => {
      const config: ApiConfig = {
        name: '   ',
        port: 8080,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors.name).toBe('API名を入力してください');
    });

    it('短すぎるAPI名を検証する', () => {
      const config: ApiConfig = {
        name: 'A',
        port: 8080,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors.name).toBe(
        `API名は${API_NAME.MIN_LENGTH}文字以上で入力してください`
      );
    });

    it('長すぎるAPI名を検証する', () => {
      const longName = 'A'.repeat(API_NAME.MAX_LENGTH + 1);
      const config: ApiConfig = {
        name: longName,
        port: 8080,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors.name).toBe(
        `API名は${API_NAME.MAX_LENGTH}文字以下で入力してください`
      );
    });

    it('最小長のAPI名を検証する', () => {
      const name = 'A'.repeat(API_NAME.MIN_LENGTH);
      const config: ApiConfig = {
        name,
        port: 8080,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(true);
      expect(result.current.errors.name).toBeUndefined();
    });

    it('最大長のAPI名を検証する', () => {
      const name = 'A'.repeat(API_NAME.MAX_LENGTH);
      const config: ApiConfig = {
        name,
        port: 8080,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(true);
      expect(result.current.errors.name).toBeUndefined();
    });
  });

  describe('ポート番号のバリデーション', () => {
    it('有効なポート番号を検証する', () => {
      const config: ApiConfig = {
        name: 'Test API',
        port: 8080,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(true);
      expect(result.current.errors.port).toBeUndefined();
    });

    it('最小ポート番号を検証する', () => {
      const config: ApiConfig = {
        name: 'Test API',
        port: PORT_RANGE.MIN,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(true);
      expect(result.current.errors.port).toBeUndefined();
    });

    it('最大ポート番号を検証する', () => {
      const config: ApiConfig = {
        name: 'Test API',
        port: PORT_RANGE.MAX,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(true);
      expect(result.current.errors.port).toBeUndefined();
    });

    it('範囲外のポート番号（最小未満）を検証する', () => {
      const config: ApiConfig = {
        name: 'Test API',
        port: PORT_RANGE.MIN - 1,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors.port).toBe(
        `ポート番号は${PORT_RANGE.MIN}-${PORT_RANGE.MAX}の範囲で入力してください`
      );
    });

    it('範囲外のポート番号（最大超過）を検証する', () => {
      const config: ApiConfig = {
        name: 'Test API',
        port: PORT_RANGE.MAX + 1,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors.port).toBe(
        `ポート番号は${PORT_RANGE.MIN}-${PORT_RANGE.MAX}の範囲で入力してください`
      );
    });
  });

  describe('複数のエラー', () => {
    it('複数のバリデーションエラーを検出する', () => {
      const config: ApiConfig = {
        name: '',
        port: PORT_RANGE.MIN - 1,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result } = renderHook(() => useApiConfigValidation(config));

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors.name).toBeDefined();
      expect(result.current.errors.port).toBeDefined();
      expect(Object.keys(result.current.errors)).toHaveLength(2);
    });
  });

  describe('設定変更時の再計算', () => {
    it('設定が変更されたときにバリデーションを再実行する', () => {
      const initialConfig: ApiConfig = {
        name: '',
        port: 8080,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      const { result, rerender } = renderHook(
        (config: ApiConfig) => useApiConfigValidation(config),
        {
          initialProps: initialConfig,
        }
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.errors.name).toBeDefined();

      const updatedConfig: ApiConfig = {
        name: 'Valid API Name',
        port: 8080,
        modelName: 'llama3:8b',
        enableAuth: true,
      };

      rerender(updatedConfig);

      expect(result.current.isValid).toBe(true);
      expect(result.current.errors.name).toBeUndefined();
    });
  });
});
