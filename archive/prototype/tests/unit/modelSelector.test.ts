// modelSelector - モデル選択ユーティリティのユニットテスト

/**
 * @jest-environment jsdom
 */

// envをモック
jest.mock('../../src/utils/env', () => ({
  isDev: jest.fn(() => false),
  isTest: jest.fn(() => true),
  isProd: jest.fn(() => false),
}));

// loggerをモック
jest.mock('../../src/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// webModelConfigをモック
const mockLoadWebModelConfig = jest.fn();
jest.mock('../../src/utils/webModelConfig', () => ({
  loadWebModelConfig: jest.fn(() => mockLoadWebModelConfig()),
  validateConfig: jest.fn(),
}));

// Tauri IPCをモック
const mockInvoke = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn((...args: unknown[]) => mockInvoke(...args)),
}));

// tauriユーティリティをモック
const mockIsTauriAvailable = jest.fn(() => true);
jest.mock('../../src/utils/tauri', () => ({
  isTauriAvailable: jest.fn(() => mockIsTauriAvailable()),
  safeInvoke: jest.fn(),
  clearInvokeCache: jest.fn(),
}));

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  selectBestModel,
  getSystemResources,
} from '../../src/utils/modelSelector';
import type { WebServiceRequirements } from '../../src/types/webService';

describe('modelSelector.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauriAvailable.mockReturnValue(true);
    mockInvoke.mockResolvedValue({
      total_memory: 16 * 1024 * 1024 * 1024,
      available_memory: 8 * 1024 * 1024 * 1024,
      cpu_cores: 4,
      cpu_usage: 50,
      total_disk: 500 * 1024 * 1024 * 1024,
      available_disk: 250 * 1024 * 1024 * 1024,
      resource_level: 'medium',
    });
  });

  describe('selectBestModel関数', () => {
    it('モデルが設定されていない場合、nullを返す', async () => {
      mockLoadWebModelConfig.mockResolvedValue({
        models: [],
      });

      const requirements: WebServiceRequirements = {
        category: 'general',
        enableAuth: true,
      };

      const result = await selectBestModel(requirements);

      expect(result).toBeNull();
    });

    it('カテゴリが一致するモデルを選定する', async () => {
      mockLoadWebModelConfig.mockResolvedValue({
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            category: 'general',
            recommended: true,
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
          {
            id: 'model-2',
            name: 'モデル2',
            modelName: 'model2',
            engine: 'ollama',
            category: 'code',
            recommended: false,
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      });

      const requirements: WebServiceRequirements = {
        category: 'general',
        enableAuth: true,
      };

      const result = await selectBestModel(requirements);

      expect(result).not.toBeNull();
      expect(result?.model.id).toBe('model-1');
    });

    it('使用例が一致するモデルを選定する', async () => {
      mockLoadWebModelConfig.mockResolvedValue({
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            useCases: ['chat', 'conversation'],
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      });

      const requirements: WebServiceRequirements = {
        useCase: 'chat',
        enableAuth: true,
      };

      const result = await selectBestModel(requirements);

      expect(result).not.toBeNull();
      expect(result?.reason).toContain('使用例が一致');
    });

    it('メモリ要件を満たすモデルを選定する', async () => {
      mockLoadWebModelConfig.mockResolvedValue({
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            requirements: {
              minMemory: 4,
              recommendedMemory: 8,
            },
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      });

      const requirements: WebServiceRequirements = {
        availableMemory: 16,
        enableAuth: true,
      };

      const result = await selectBestModel(requirements);

      expect(result).not.toBeNull();
      expect(result?.reason).toContain('メモリ要件');
    });

    it('メモリ不足のモデルは減点する', async () => {
      mockLoadWebModelConfig.mockResolvedValue({
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            requirements: {
              minMemory: 16,
            },
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
          {
            id: 'model-2',
            name: 'モデル2',
            modelName: 'model2',
            engine: 'ollama',
            requirements: {
              minMemory: 4,
            },
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      });

      const requirements: WebServiceRequirements = {
        availableMemory: 8,
        enableAuth: true,
      };

      const result = await selectBestModel(requirements);

      expect(result).not.toBeNull();
      // メモリ要件を満たすモデル2が選ばれる
      expect(result?.model.id).toBe('model-2');
    });

    it('推奨モデルに追加点を与える', async () => {
      mockLoadWebModelConfig.mockResolvedValue({
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            recommended: true,
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
          {
            id: 'model-2',
            name: 'モデル2',
            modelName: 'model2',
            engine: 'ollama',
            recommended: false,
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      });

      const requirements: WebServiceRequirements = {
        enableAuth: true,
      };

      const result = await selectBestModel(requirements);

      expect(result).not.toBeNull();
      expect(result?.model.id).toBe('model-1');
    });

    it('スコアが最も高いモデルを選定する', async () => {
      mockLoadWebModelConfig.mockResolvedValue({
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            category: 'general',
            recommended: true,
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
          {
            id: 'model-2',
            name: 'モデル2',
            modelName: 'model2',
            engine: 'ollama',
            category: 'general',
            recommended: true,
            useCases: ['chat'],
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      });

      const requirements: WebServiceRequirements = {
        category: 'general',
        useCase: 'chat',
        enableAuth: true,
      };

      const result = await selectBestModel(requirements);

      expect(result).not.toBeNull();
      // useCaseが一致するモデル2が選ばれる（スコアが高い）
      expect(result?.model.id).toBe('model-2');
    });
  });

  describe('getSystemResources関数', () => {
    it('システムリソースを取得する', async () => {
      mockInvoke.mockResolvedValue({
        total_memory: 16 * 1024 * 1024 * 1024,
        available_memory: 8 * 1024 * 1024 * 1024,
        cpu_cores: 4,
        cpu_usage: 50,
        total_disk: 500 * 1024 * 1024 * 1024,
        available_disk: 250 * 1024 * 1024 * 1024,
        resource_level: 'medium',
      });

      const result = await getSystemResources();

      expect(result).toEqual({
        availableMemory: 8,
        hasGpu: false,
      });
    });

    it('Tauri環境が初期化されていない場合、エラーをスローする', async () => {
      // 動的インポートの問題を回避するため、モジュールをリロード
      jest.resetModules();
      mockIsTauriAvailable.mockReturnValue(false);

      // エラーメッセージの部分一致で確認（動的インポートのため完全一致は難しい）
      await expect(getSystemResources()).rejects.toThrow(
        /Tauri環境が初期化されていません/
      );

      // テスト後にモックをリセット
      mockIsTauriAvailable.mockReturnValue(true);
      jest.resetModules();
    });

    it('エラーが発生した場合、デフォルト値を返す', async () => {
      mockInvoke.mockRejectedValue(new Error('リソース取得エラー'));

      const result = await getSystemResources();

      expect(result).toEqual({
        availableMemory: 8,
        hasGpu: false,
      });
    });

    it('利用可能メモリが0以下の場合、1GBを設定する', async () => {
      mockInvoke.mockResolvedValue({
        available_memory: 0,
      });

      const result = await getSystemResources();

      expect(result.availableMemory).toBeGreaterThanOrEqual(1);
    });
  });
});
