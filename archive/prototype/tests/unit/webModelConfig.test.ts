// webModelConfig - Webモデル設定ユーティリティのユニットテスト

/**
 * @jest-environment jsdom
 */

// webModelConfig.tsはjest.config.cjsのmoduleNameMapperでモックされます
// モックファイル（tests/setup/webModelConfig-mock.ts）が使用されます

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  loadWebModelConfig,
  validateConfig,
  filterByCategory,
  getRecommendedModels,
  findModelById,
  findModelByName,
} from '../../src/utils/webModelConfig';
import type { WebModelConfig } from '../../src/types/webModel';

// fetchをモック（webModelConfig.tsで使用）
global.fetch = jest.fn() as jest.Mock;

describe('webModelConfig.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadWebModelConfig関数', () => {
    it('設定ファイルを読み込む', async () => {
      const mockConfig: WebModelConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            description: 'テストモデル',
            category: 'chat',
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockConfig,
      });

      const result = await loadWebModelConfig();

      expect(result).toEqual(mockConfig);
      expect(global.fetch).toHaveBeenCalledWith(
        '/assets/web-models-config.json'
      );
    });

    it('ファイルが存在しない場合、エラーをスローする', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(loadWebModelConfig()).rejects.toThrow(
        '設定ファイルの読み込みに失敗しました'
      );
    });

    it('ネットワークエラーの場合、エラーをスローする', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error('ネットワークエラー')
      );

      await expect(loadWebModelConfig()).rejects.toThrow(
        '設定ファイルの読み込みに失敗しました'
      );
    });
  });

  describe('validateConfig関数', () => {
    it('有効な設定を検証する', () => {
      const config: WebModelConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            description: 'テストモデル',
            category: 'chat',
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('無効な設定を検証する', () => {
      expect(() => validateConfig(null)).toThrow(
        '設定ファイルはオブジェクトである必要があります'
      );
      expect(() => validateConfig({})).toThrow(
        '設定ファイルにversionフィールドが必要です'
      );
    });
  });

  describe('filterByCategory関数', () => {
    it('カテゴリでフィルタリングする', () => {
      const config: WebModelConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            description: 'テストモデル1',
            category: 'chat',
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
            description: 'テストモデル2',
            category: 'code',
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      };

      const filtered = filterByCategory(config, 'chat');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('model-1');
    });
  });

  describe('getRecommendedModels関数', () => {
    it('推奨モデルのみを取得する', () => {
      const config: WebModelConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            description: 'テストモデル1',
            category: 'chat',
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
            description: 'テストモデル2',
            category: 'code',
            recommended: false,
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      };

      const recommended = getRecommendedModels(config);

      expect(recommended).toHaveLength(1);
      expect(recommended[0].id).toBe('model-1');
    });
  });

  describe('findModelById関数', () => {
    it('IDでモデルを検索する', () => {
      const config: WebModelConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            description: 'テストモデル',
            category: 'chat',
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      };

      const model = findModelById(config, 'model-1');

      expect(model).toBeDefined();
      expect(model?.id).toBe('model-1');
    });

    it('存在しないIDの場合、undefinedを返す', () => {
      const config: WebModelConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        models: [],
      };

      const model = findModelById(config, 'nonexistent');

      expect(model).toBeUndefined();
    });
  });

  describe('findModelByName関数', () => {
    it('モデル名とエンジンでモデルを検索する', () => {
      const config: WebModelConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        models: [
          {
            id: 'model-1',
            name: 'モデル1',
            modelName: 'model1',
            engine: 'ollama',
            description: 'テストモデル',
            category: 'chat',
            defaultSettings: {
              port: 8080,
              enableAuth: true,
              modelParameters: {},
            },
          },
        ],
      };

      const model = findModelByName(config, 'model1', 'ollama');

      expect(model).toBeDefined();
      expect(model?.modelName).toBe('model1');
      expect(model?.engine).toBe('ollama');
    });
  });
});
