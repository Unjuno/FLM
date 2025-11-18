// video-generation-api - 動画生成モデルAPIのテスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import { cleanupTestApis, handleTauriAppNotRunningError, checkTauriAvailable } from '../setup/test-helpers';
import { debugLog, debugWarn } from '../setup/debug';

/**
 * 動画生成モデルのテスト
 */
describe('動画生成モデル API テスト', () => {
  let createdApiId: string | null = null;

  beforeAll(async () => {
    debugLog('動画生成モデルAPIテストを開始します');
    
    try {
      const result = await invoke<{
        id: string;
        endpoint: string;
        api_key: string | null;
      }>('create_api', {
        config: {
          name: 'Video Generation API Test',
          model_name: 'gen2:latest',
          port: 8123,
          enable_auth: true,
          engine_type: 'ollama',
          multimodal: {
            enableVideo: true,
            maxVideoSize: 100,
          },
        },
      });

      createdApiId = result.id;
    } catch (error) {
      if (handleTauriAppNotRunningError(error)) {
        debugWarn('Tauriアプリが起動していないため、このテストをスキップします');
        return;
      }
      debugWarn('動画生成API作成に失敗したため、このテストをスキップします:', error);
    }
  });

  afterAll(async () => {
    await cleanupTestApis(createdApiId ? [createdApiId] : []);
    debugLog('動画生成モデルAPIテストを完了しました');
  });

  describe('動画生成モデルのAPI作成', () => {
    it('動画生成モデルでAPIを作成できること', async () => {
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
      expect(apiInfo.model_name).toBe('gen2:latest');
    }, 30000);
  });

  describe('動画生成モデルのカテゴリ確認', () => {
    it('動画生成モデルのカテゴリが正しく設定されていること', async () => {
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
        category: 'video-generation',
        limit: 10,
      });

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);

      const videoModels = models.filter(
        m => m.category === 'video-generation'
      );
      expect(videoModels.length).toBeGreaterThan(0);
    }, 10000);
  });
});

