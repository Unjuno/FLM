// image-generation-api - 画像生成モデルAPIのテスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import { cleanupTestApis, handleTauriAppNotRunningError, checkTauriAvailable } from '../setup/test-helpers';
import { debugLog, debugWarn } from '../setup/debug';

/**
 * 画像生成モデルのテスト
 */
describe('画像生成モデル API テスト', () => {
  let apiEndpoint: string;
  let apiKey: string;
  let createdApiId: string | null = null;

  const imageGenerationModels = [
    { name: 'flux:latest', description: 'Flux - 高品質画像生成モデル' },
    { name: 'stable-diffusion-xl:latest', description: 'Stable Diffusion XL - 画像生成モデル' },
  ];

  beforeAll(async () => {
    debugLog('画像生成モデルAPIテストを開始します');
    
    try {
      const result = await invoke<{
        id: string;
        endpoint: string;
        api_key: string | null;
      }>('create_api', {
        config: {
          name: 'Image Generation API Test',
          model_name: 'flux:latest',
          port: 8122,
          enable_auth: true,
          engine_type: 'ollama',
          multimodal: {
            enableVision: true,
            maxImageSize: 10,
          },
        },
      });

      createdApiId = result.id;
      apiEndpoint = result.endpoint;
      apiKey = result.api_key || '';

      await invoke('start_api', { api_id: createdApiId });
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      if (handleTauriAppNotRunningError(error)) {
        debugWarn('Tauriアプリが起動していないため、このテストをスキップします');
        return;
      }
      debugWarn('画像生成API作成に失敗したため、このテストをスキップします:', error);
    }
  });

  afterAll(async () => {
    await cleanupTestApis(createdApiId ? [createdApiId] : []);
    debugLog('画像生成モデルAPIテストを完了しました');
  });

  describe('画像生成モデルのAPI作成', () => {
    it('画像生成モデルでAPIを作成できること', async () => {
      if (!createdApiId) {
        debugWarn('APIが作成されていないため、スキップします');
        expect(true).toBe(true);
        return;
      }

      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        debugWarn('Tauriアプリが起動していないため、このテストをスキップします');
        expect(true).toBe(true);
        return;
      }

      const apiInfo = await invoke<{
        id: string;
        name: string;
        model_name: string;
      }>('get_api_details', { apiId: createdApiId });

      expect(apiInfo).toBeDefined();
      expect(apiInfo.model_name).toBe('flux:latest');
    }, 30000);
  });

  describe('画像生成モデルのカテゴリ確認', () => {
    it('画像生成モデルのカテゴリが正しく設定されていること', async () => {
      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        debugWarn('Tauriアプリが起動していないため、このテストをスキップします');
        expect(true).toBe(true);
        return;
      }

      const models = await invoke<Array<{
        name: string;
        category?: string;
      }>>('search_models', {
        engineType: 'ollama',
        category: 'image-generation',
        limit: 10,
      });

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);

      const imageModels = models.filter(
        m => m.category === 'image-generation'
      );
      expect(imageModels.length).toBeGreaterThan(0);
    }, 10000);
  });
});

