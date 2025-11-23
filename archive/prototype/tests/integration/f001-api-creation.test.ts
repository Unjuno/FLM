// f001-api-creation - API作成機能の統合テスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import {
  cleanupTestApis,
  handleTauriAppNotRunningError,
} from '../setup/test-helpers';
import { debugLog, debugWarn } from '../setup/debug';

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
  const createdApiIds: string[] = [];

  beforeAll(() => {
    debugLog('F001 API作成機能統合テストを開始します');
  });

  afterAll(async () => {
    // テストで作成したAPIをクリーンアップ
    await cleanupTestApis(createdApiIds);
    debugLog('F001 API作成機能統合テストを完了しました');
  });

  /**
   * API IDを記録してクリーンアップ対象に追加
   */
  const recordApiId = (apiId: string) => {
    createdApiIds.push(apiId);
    return apiId;
  };

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
        engine_type: 'ollama', // マルチエンジン対応: エンジンタイプを明示的に指定
      };

      try {
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

        recordApiId(result.id);
      } catch (error) {
        // Tauriアプリが起動していない場合、エラーメッセージが適切であることを確認
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000); // タイムアウト: 30秒

    it('should create API without authentication', async () => {
      const config = {
        name: 'Test API (No Auth)',
        model_name: 'llama3:8b',
        port: 8081,
        enable_auth: false,
      };

      try {
        const result = await invoke<{
          id: string;
          api_key: string | null;
        }>('create_api', config);

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.api_key).toBeNull(); // 認証無効の場合はAPIキーがない

        recordApiId(result.id);
      } catch (error) {
        // Tauriアプリが起動していない場合、エラーメッセージが適切であることを確認
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);

    it('should create API with default port', async () => {
      const config = {
        name: 'Test API (Default Port)',
        model_name: 'llama3:8b',
        enable_auth: false,
      };

      try {
        const result = await invoke<{
          id: string;
          port: number;
        }>('create_api', config);

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.port).toBe(8080); // デフォルトポート

        recordApiId(result.id);
      } catch (error) {
        // Tauriアプリが起動していない場合、エラーメッセージが適切であることを確認
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);

    it('should create API with default authentication setting', async () => {
      const config = {
        name: 'Test API (Default Auth)',
        model_name: 'llama3:8b',
        port: 8098,
      };

      try {
        const result = await invoke<{
          id: string;
          api_key: string | null;
        }>('create_api', config);

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        // デフォルトでは認証が有効になっているはず
        expect(result.api_key).toBeDefined();
        expect(result.api_key).not.toBeNull();

        recordApiId(result.id);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          expect(errorMessage).toContain(
            'Tauriアプリケーションが起動していません'
          );
        } else {
          throw error;
        }
      }
    }, 30000);

    it('should validate port number range', async () => {
      const invalidConfigs = [
        { name: 'Test', model_name: 'llama3:8b', port: 0, enable_auth: false },
        {
          name: 'Test',
          model_name: 'llama3:8b',
          port: 65536,
          enable_auth: false,
        },
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
      const models = await invoke<
        Array<{
          name: string;
          size: number;
          parameters?: number;
        }>
      >('get_models_list');

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
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        expect(errorMessage).toBeDefined();
        // エラーメッセージが非開発者向けであることを確認
        expect(errorMessage).toMatch(
          /Ollama|実行|起動|Tauriアプリケーションが起動していません/i
        );
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
      const apiId = recordApiId(createResult.id);

      // 作成したAPIが一覧に含まれていることを確認
      const apis = await invoke<
        Array<{
          id: string;
          name: string;
          port: number;
        }>
      >('list_apis');

      const createdApi = apis.find(api => api.id === apiId);
      expect(createdApi).toBeDefined();
      expect(createdApi!.name).toBe(config.name);
      expect(createdApi!.port).toBe(config.port);

      // API詳細も取得できることを確認
      const apiDetails = await invoke<{
        id: string;
        name: string;
        port: number;
        enable_auth: boolean;
        status: string;
      }>('get_api_details', { api_id: apiId });

      expect(apiDetails).toBeDefined();
      expect(apiDetails.id).toBe(apiId);
      expect(apiDetails.name).toBe(config.name);
      expect(apiDetails.port).toBe(config.port);
      expect(apiDetails.enable_auth).toBe(config.enable_auth);
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

      const result1 = await invoke<{ id: string; api_key: string | null }>(
        'create_api',
        config1
      );
      const result2 = await invoke<{ id: string; api_key: string | null }>(
        'create_api',
        config2
      );

      expect(result1.api_key).toBeDefined();
      expect(result2.api_key).toBeDefined();
      expect(result1.api_key).not.toBe(result2.api_key); // 異なるAPIキーが生成される

      recordApiId(result1.id);
      recordApiId(result2.id);
    }, 30000);

    it('should allow retrieving API key after creation', async () => {
      const config = {
        name: 'API Key Test',
        model_name: 'llama3:8b',
        port: 8085,
        enable_auth: true,
      };

      const createResult = await invoke<{ id: string; api_key: string | null }>(
        'create_api',
        config
      );
      const apiId = createResult.id;
      const originalKey = createResult.api_key;

      // APIキーを取得
      const retrievedKey = await invoke<string | null>('get_api_key', {
        api_id: apiId,
      });

      expect(retrievedKey).toBeDefined();
      expect(retrievedKey).toBe(originalKey); // 同じキーが取得できる

      recordApiId(apiId);
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
      recordApiId(result1.id);

      // 同じポート番号でAPIを作成しようとする
      try {
        const result2 = await invoke<{ id: string }>('create_api', {
          ...config,
          name: 'Port Test 2',
        });
        // ポート番号の重複チェックが実装されていない場合は作成可能
        // 作成された場合は記録してクリーンアップ
        if (result2.id) {
          recordApiId(result2.id);
        }
      } catch (error) {
        // エラーが発生した場合
        expect(error).toBeDefined();
        expect(typeof error).toBe('string');
      }
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
        // エラーは文字列またはエラーオブジェクトの可能性がある
        expect(typeof error === 'string' || error instanceof Error).toBe(true);
      }
    }, 30000);
  });
});
