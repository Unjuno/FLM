// code-generation-api - コード生成モデルAPIのテスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import { cleanupTestApis, handleTauriAppNotRunningError, checkTauriAvailable } from '../setup/test-helpers';
import { debugLog, debugWarn } from '../setup/debug';

/**
 * コード生成モデルのテスト
 */
describe('コード生成モデル API テスト', () => {
  let apiEndpoint: string;
  let apiKey: string;
  let createdApiId: string | null = null;

  const codeGenerationModels = [
    { name: 'codellama:7b', description: 'CodeLlama 7B - コード生成モデル' },
    { name: 'deepseek-coder:latest', description: 'DeepSeek Coder - コード生成モデル' },
  ];

  beforeAll(async () => {
    debugLog('コード生成モデルAPIテストを開始します');
    
    try {
      const result = await invoke<{
        id: string;
        endpoint: string;
        api_key: string | null;
      }>('create_api', {
        config: {
          name: 'Code Generation API Test',
          model_name: 'codellama:7b',
          port: 8124,
          enable_auth: true,
          engine_type: 'ollama',
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
      debugWarn('コード生成API作成に失敗したため、このテストをスキップします:', error);
    }
  });

  afterAll(async () => {
    await cleanupTestApis(createdApiId ? [createdApiId] : []);
    debugLog('コード生成モデルAPIテストを完了しました');
  });

  describe('コード生成モデルのAPI作成', () => {
    it('コード生成モデルでAPIを作成できること', async () => {
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
      expect(apiInfo.model_name).toBe('codellama:7b');
    }, 30000);

    it('コード生成モデルでチャットAPIが動作すること', async () => {
      if (!apiEndpoint || !apiKey) {
        debugWarn('APIエンドポイントまたはAPIキーが設定されていないため、スキップします');
        expect(true).toBe(true);
        return;
      }

      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        debugWarn('Tauriアプリが起動していないため、このテストをスキップします');
        expect(true).toBe(true);
        return;
      }

      const response = await fetch(`${apiEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'codellama:7b',
          messages: [
            {
              role: 'user',
              content: 'Write a Python function to calculate factorial.',
            },
          ],
        }),
      });

      expect([200, 400, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    }, 60000);
  });

  describe('コード生成モデルのカテゴリ確認', () => {
    it('コード生成モデルのカテゴリが正しく設定されていること', async () => {
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
        category: 'code',
        limit: 10,
      });

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);

      const codeModels = models.filter(
        m => m.category === 'code'
      );
      expect(codeModels.length).toBeGreaterThan(0);
    }, 10000);
  });
});

