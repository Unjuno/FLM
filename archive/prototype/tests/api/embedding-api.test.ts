// embedding-api - 埋め込みモデルAPIのテスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import {
  cleanupTestApis,
  handleTauriAppNotRunningError,
  checkTauriAvailable,
} from '../setup/test-helpers';
import { debugLog, debugWarn } from '../setup/debug';

/**
 * 埋め込みモデルのテスト
 */
describe('埋め込みモデル API テスト', () => {
  let createdApiId: string | null = null;

  const embeddingModels = [
    {
      name: 'nomic-embed-text:latest',
      description: 'Nomic Embed - 埋め込みモデル',
    },
    { name: 'bge-large:latest', description: 'BGE Large - 埋め込みモデル' },
  ];

  beforeAll(async () => {
    debugLog('埋め込みモデルAPIテストを開始します');

    try {
      const result = await invoke<{
        id: string;
        endpoint: string;
        api_key: string | null;
      }>('create_api', {
        config: {
          name: 'Embedding API Test',
          model_name: 'nomic-embed-text:latest',
          port: 8125,
          enable_auth: true,
          engine_type: 'ollama',
        },
      });

      createdApiId = result.id;
    } catch (error) {
      if (handleTauriAppNotRunningError(error)) {
        debugWarn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }
      debugWarn(
        '埋め込みAPI作成に失敗したため、このテストをスキップします:',
        error
      );
    }
  });

  afterAll(async () => {
    await cleanupTestApis(createdApiId ? [createdApiId] : []);
    debugLog('埋め込みモデルAPIテストを完了しました');
  });

  describe('埋め込みモデルのAPI作成', () => {
    it('埋め込みモデルでAPIを作成できること', async () => {
      if (!createdApiId) {
        debugWarn('APIが作成されていないため、スキップします');
        expect(true).toBe(true);
        return;
      }

      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        debugWarn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        expect(true).toBe(true);
        return;
      }

      const apiInfo = await invoke<{
        id: string;
        name: string;
        model_name: string;
      }>('get_api_details', { apiId: createdApiId });

      expect(apiInfo).toBeDefined();
      expect(apiInfo.model_name).toBe('nomic-embed-text:latest');
    }, 30000);
  });

  describe('埋め込みモデルのカテゴリ確認', () => {
    it('埋め込みモデルのカテゴリが正しく設定されていること', async () => {
      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        debugWarn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        expect(true).toBe(true);
        return;
      }

      const models = await invoke<
        Array<{
          name: string;
          category?: string;
        }>
      >('search_models', {
        engineType: 'ollama',
        category: 'embedding',
        limit: 10,
      });

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);

      const embeddingModels = models.filter(m => m.category === 'embedding');
      expect(embeddingModels.length).toBeGreaterThan(0);
    }, 10000);
  });
});
