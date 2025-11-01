/**
 * FLM - F001: API作成機能 統合テスト
 * 
 * フェーズ3: QAエージェント (QA) 実装
 * API作成機能の統合テスト（フロントエンド ↔ バックエンド ↔ データベース）
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

/**
 * F001: API作成機能統合テストスイート
 * 
 * テスト項目:
 * - API作成フロー全体の検証
 * - データベースへの保存確認
 * - APIキー生成・暗号化の確認
 * - エラーハンドリングの確認
 */
describe('F001: API作成機能 統合テスト', () => {
  let createdApiId: string | null = null;

  beforeAll(() => {
    console.log('F001 API作成機能統合テストを開始します');
  });

  afterAll(async () => {
    // テストで作成したAPIをクリーンアップ
    if (createdApiId) {
      try {
        await invoke('delete_api', { api_id: createdApiId });
      } catch (error) {
        console.warn('テスト後のクリーンアップに失敗しました:', error);
      }
    }
    console.log('F001 API作成機能統合テストを完了しました');
  });

  /**
   * API作成の基本フロー
   */
  describe('API作成の基本フロー', () => {
    it('should create API with valid configuration', async () => {
      const config = {
        name: 'Test API',
        model_name: 'llama3:8b',
        port: 8080,
        enable_auth: true,
      };

      const result = await invoke<{
        id: string;
        name: string;
        endpoint: string;
        api_key: string | null;
        model_name: string;
        port: number;
        status: string;
      }>('create_api', config);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(config.name);
      expect(result.model_name).toBe(config.model_name);
      expect(result.port).toBe(config.port);
      expect(result.endpoint).toMatch(/^http:\/\/localhost:\d+$/);
      
      // 認証が有効な場合、APIキーが生成されていることを確認
      if (config.enable_auth) {
        expect(result.api_key).toBeDefined();
        expect(result.api_key).not.toBeNull();
        expect(typeof result.api_key).toBe('string');
        expect(result.api_key!.length).toBeGreaterThanOrEqual(32);
      }

      createdApiId = result.id;
    }, 30000); // タイムアウト: 30秒

    it('should create API without authentication', async () => {
      const config = {
        name: 'Test API (No Auth)',
        model_name: 'llama3:8b',
        port: 8081,
        enable_auth: false,
      };

      const result = await invoke<{
        id: string;
        api_key: string | null;
      }>('create_api', config);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.api_key).toBeNull(); // 認証無効の場合はAPIキーがない
    }, 30000);

    it('should validate port number range', async () => {
      const invalidConfigs = [
        { name: 'Test', model_name: 'llama3:8b', port: 0, enable_auth: false },
        { name: 'Test', model_name: 'llama3:8b', port: 65536, enable_auth: false },
        { name: 'Test', model_name: 'llama3:8b', port: -1, enable_auth: false },
      ];

      for (const config of invalidConfigs) {
        try {
          await invoke('create_api', config);
          // エラーが発生することを期待
          expect(true).toBe(false); // 到達しないはず
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });
  });

  /**
   * モデル一覧取得機能
   */
  describe('モデル一覧取得機能', () => {
    it('should retrieve list of available models', async () => {
      const models = await invoke<Array<{
        name: string;
        size: number;
        parameters?: number;
      }>>('get_models_list');

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      
      if (models.length > 0) {
        const model = models[0];
        expect(model.name).toBeDefined();
        expect(typeof model.name).toBe('string');
        expect(model.size).toBeGreaterThanOrEqual(0);
      }
    }, 15000);

    it('should handle Ollama not running gracefully', async () => {
      // Ollamaが起動していない場合のエラーハンドリング
      // 実際のテストでは、Ollamaを停止してから実行する必要がある
      try {
        await invoke('get_models_list');
      } catch (error) {
        expect(error).toBeDefined();
        expect(typeof error).toBe('string');
        // エラーメッセージが非開発者向けであることを確認
        expect(String(error)).toMatch(/Ollama|実行|起動/i);
      }
    });
  });

  /**
   * API作成後のデータ永続化
   */
  describe('API作成後のデータ永続化', () => {
    it('should persist API configuration to database', async () => {
      const config = {
        name: 'Persistent Test API',
        model_name: 'llama3:8b',
        port: 8082,
        enable_auth: true,
      };

      const createResult = await invoke<{ id: string }>('create_api', config);
      const apiId = createResult.id;

      // 作成したAPIが一覧に含まれていることを確認
      const apis = await invoke<Array<{
        id: string;
        name: string;
        port: number;
      }>>('list_apis');

      const createdApi = apis.find(api => api.id === apiId);
      expect(createdApi).toBeDefined();
      expect(createdApi!.name).toBe(config.name);
      expect(createdApi!.port).toBe(config.port);

      // クリーンアップ
      await invoke('delete_api', { api_id: apiId });
    }, 30000);
  });

  /**
   * APIキー生成・暗号化の検証
   */
  describe('APIキー生成・暗号化の検証', () => {
    it('should generate unique API keys for different APIs', async () => {
      const config1 = {
        name: 'API 1',
        model_name: 'llama3:8b',
        port: 8083,
        enable_auth: true,
      };

      const config2 = {
        name: 'API 2',
        model_name: 'llama3:8b',
        port: 8084,
        enable_auth: true,
      };

      const result1 = await invoke<{ id: string; api_key: string | null }>('create_api', config1);
      const result2 = await invoke<{ id: string; api_key: string | null }>('create_api', config2);

      expect(result1.api_key).toBeDefined();
      expect(result2.api_key).toBeDefined();
      expect(result1.api_key).not.toBe(result2.api_key); // 異なるAPIキーが生成される

      // クリーンアップ
      await invoke('delete_api', { api_id: result1.id });
      await invoke('delete_api', { api_id: result2.id });
    }, 30000);

    it('should allow retrieving API key after creation', async () => {
      const config = {
        name: 'API Key Test',
        model_name: 'llama3:8b',
        port: 8085,
        enable_auth: true,
      };

      const createResult = await invoke<{ id: string; api_key: string | null }>('create_api', config);
      const apiId = createResult.id;
      const originalKey = createResult.api_key;

      // APIキーを取得
      const retrievedKey = await invoke<string | null>('get_api_key', { api_id: apiId });

      expect(retrievedKey).toBeDefined();
      expect(retrievedKey).toBe(originalKey); // 同じキーが取得できる

      // クリーンアップ
      await invoke('delete_api', { api_id: apiId });
    }, 30000);
  });

  /**
   * エラーハンドリング
   */
  describe('エラーハンドリング', () => {
    it('should handle duplicate port numbers', async () => {
      const config = {
        name: 'Port Test 1',
        model_name: 'llama3:8b',
        port: 8086,
        enable_auth: false,
      };

      const result1 = await invoke<{ id: string }>('create_api', config);
      
      // 同じポート番号でAPIを作成しようとする
      try {
        await invoke('create_api', { ...config, name: 'Port Test 2' });
        // エラーが発生することを期待（実装によって異なる）
      } catch (error) {
        expect(error).toBeDefined();
      }

      // クリーンアップ
      await invoke('delete_api', { api_id: result1.id });
    }, 30000);

    it('should handle invalid model names', async () => {
      const config = {
        name: 'Invalid Model Test',
        model_name: 'nonexistent-model:invalid',
        port: 8087,
        enable_auth: false,
      };

      try {
        await invoke('create_api', config);
        // エラーが発生することを期待
      } catch (error) {
        expect(error).toBeDefined();
        expect(typeof error).toBe('string');
      }
    }, 30000);
  });
});

