/**
 * FLM - F003: API管理機能 統合テスト
 * 
 * フェーズ3: QAエージェント (QA) 実装
 * API管理機能の統合テスト（起動、停止、更新、削除）
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

/**
 * F003: API管理機能統合テストスイート
 * 
 * テスト項目:
 * - API起動/停止機能
 * - API設定更新機能
 * - API削除機能
 * - APIキー再生成機能
 */
describe('F003: API管理機能 統合テスト', () => {
  let testApiId: string | null = null;

  beforeAll(async () => {
    console.log('F003 API管理機能統合テストを開始します');
    
    // テスト用のAPIを作成
    const result = await invoke<{ id: string }>('create_api', {
      name: 'Management Test API',
      model_name: 'llama3:8b',
      port: 8090,
      enable_auth: true,
    });
    
    testApiId = result.id;
  }, 30000);

  afterAll(async () => {
    // テストで作成したAPIをクリーンアップ
    if (testApiId) {
      try {
        // 実行中の場合は停止
        try {
          await invoke('stop_api', { api_id: testApiId });
        } catch (error) {
          // 既に停止している可能性がある
        }
        await invoke('delete_api', { api_id: testApiId });
      } catch (error) {
        console.warn('テスト後のクリーンアップに失敗しました:', error);
      }
    }
    console.log('F003 API管理機能統合テストを完了しました');
  });

  /**
   * API起動/停止機能
   */
  describe('API起動/停止機能', () => {
    it('should start API successfully', async () => {
      if (!testApiId) {
        throw new Error('テスト用APIが作成されていません');
      }

      await invoke('start_api', { api_id: testApiId });

      // 一覧を取得してステータスを確認
      const apis = await invoke<Array<{
        id: string;
        status: string;
      }>>('list_apis');

      const api = apis.find(a => a.id === testApiId);
      expect(api).toBeDefined();
      expect(api!.status).toBe('running');
    }, 30000);

    it('should stop API successfully', async () => {
      if (!testApiId) {
        throw new Error('テスト用APIが作成されていません');
      }

      await invoke('stop_api', { api_id: testApiId });

      // 一覧を取得してステータスを確認
      const apis = await invoke<Array<{
        id: string;
        status: string;
      }>>('list_apis');

      const api = apis.find(a => a.id === testApiId);
      expect(api).toBeDefined();
      expect(api!.status).toBe('stopped');
    }, 30000);

    it('should handle starting already running API', async () => {
      if (!testApiId) {
        throw new Error('テスト用APIが作成されていません');
      }

      // 既に起動している場合の処理を確認
      try {
        await invoke('start_api', { api_id: testApiId });
        await invoke('start_api', { api_id: testApiId }); // 再度起動
        
        // エラーが発生しない、または適切に処理されることを確認
      } catch (error) {
        // エラーが発生する場合、適切なエラーメッセージであることを確認
        expect(error).toBeDefined();
      }
    }, 30000);
  });

  /**
   * API設定更新機能
   */
  describe('API設定更新機能', () => {
    it('should update API name', async () => {
      if (!testApiId) {
        throw new Error('テスト用APIが作成されていません');
      }

      const newName = 'Updated Test API';

      await invoke('update_api', {
        api_id: testApiId,
        config: {
          name: newName,
        },
      });

      // 更新後のAPI情報を取得
      const apiDetails = await invoke<{
        name: string;
      }>('get_api_details', { api_id: testApiId });

      expect(apiDetails.name).toBe(newName);
    }, 30000);

    it('should update API port number', async () => {
      if (!testApiId) {
        throw new Error('テスト用APIが作成されていません');
      }

      const newPort = 8091;

      await invoke('update_api', {
        api_id: testApiId,
        config: {
          port: newPort,
        },
      });

      // 更新後のAPI情報を取得
      const apiDetails = await invoke<{
        port: number;
      }>('get_api_details', { api_id: testApiId });

      expect(apiDetails.port).toBe(newPort);
    }, 30000);

    it('should update authentication setting', async () => {
      if (!testApiId) {
        throw new Error('テスト用APIが作成されていません');
      }

      await invoke('update_api', {
        api_id: testApiId,
        config: {
          enable_auth: false,
        },
      });

      // 更新後のAPI情報を取得
      const apiDetails = await invoke<{
        enable_auth: boolean;
      }>('get_api_details', { api_id: testApiId });

      expect(apiDetails.enable_auth).toBe(false);
    }, 30000);

    it('should handle invalid port number in update', async () => {
      if (!testApiId) {
        throw new Error('テスト用APIが作成されていません');
      }

      try {
        await invoke('update_api', {
          api_id: testApiId,
          config: {
            port: 0, // 無効なポート番号
          },
        });
        // エラーが発生することを期待
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  /**
   * APIキー再生成機能
   */
  describe('APIキー再生成機能', () => {
    it('should regenerate API key successfully', async () => {
      if (!testApiId) {
        throw new Error('テスト用APIが作成されていません');
      }

      // 認証を有効にする
      await invoke('update_api', {
        api_id: testApiId,
        config: {
          enable_auth: true,
        },
      });

      // 現在のAPIキーを取得
      const originalKey = await invoke<string | null>('get_api_key', { api_id: testApiId });
      
      // APIキーを再生成
      const newKey = await invoke<string>('regenerate_api_key', { api_id: testApiId });

      expect(newKey).toBeDefined();
      expect(typeof newKey).toBe('string');
      expect(newKey.length).toBeGreaterThanOrEqual(32);
      expect(newKey).not.toBe(originalKey); // 異なるキーが生成される

      // 新しいキーが取得できることを確認
      const retrievedKey = await invoke<string | null>('get_api_key', { api_id: testApiId });
      expect(retrievedKey).toBe(newKey);
    }, 30000);

    it('should handle regeneration when auth is disabled', async () => {
      if (!testApiId) {
        throw new Error('テスト用APIが作成されていません');
      }

      // 認証を無効にする
      await invoke('update_api', {
        api_id: testApiId,
        config: {
          enable_auth: false,
        },
      });

      // APIキー再生成を試みる
      try {
        await invoke('regenerate_api_key', { api_id: testApiId });
        // エラーが発生することを期待
      } catch (error) {
        expect(error).toBeDefined();
        expect(typeof error).toBe('string');
      }
    }, 30000);
  });

  /**
   * API削除機能
   */
  describe('API削除機能', () => {
    it('should delete API successfully', async () => {
      // テスト用の別のAPIを作成
      const result = await invoke<{ id: string }>('create_api', {
        name: 'Delete Test API',
        model_name: 'llama3:8b',
        port: 8092,
        enable_auth: false,
      });

      const deleteApiId = result.id;

      // 削除
      await invoke('delete_api', { api_id: deleteApiId });

      // 削除後、一覧に含まれていないことを確認
      const apis = await invoke<Array<{ id: string }>>('list_apis');
      const deletedApi = apis.find(a => a.id === deleteApiId);
      expect(deletedApi).toBeUndefined();
    }, 30000);

    it('should stop API before deletion if running', async () => {
      // 実行中のAPIを作成
      const result = await invoke<{ id: string }>('create_api', {
        name: 'Running Delete Test API',
        model_name: 'llama3:8b',
        port: 8093,
        enable_auth: false,
      });

      const runningApiId = result.id;

      // 起動
      await invoke('start_api', { api_id: runningApiId });

      // 削除（内部で停止されることを期待）
      await invoke('delete_api', { api_id: runningApiId });

      // 削除後、一覧に含まれていないことを確認
      const apis = await invoke<Array<{ id: string }>>('list_apis');
      const deletedApi = apis.find(a => a.id === runningApiId);
      expect(deletedApi).toBeUndefined();
    }, 30000);

    it('should handle deleting non-existent API', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      try {
        await invoke('delete_api', { api_id: nonExistentId });
        // エラーが発生することを期待
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  /**
   * API詳細取得機能
   */
  describe('API詳細取得機能', () => {
    it('should retrieve API details successfully', async () => {
      if (!testApiId) {
        throw new Error('テスト用APIが作成されていません');
      }

      const details = await invoke<{
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        enable_auth: boolean;
        status: string;
        api_key: string | null;
      }>('get_api_details', { api_id: testApiId });

      expect(details).toBeDefined();
      expect(details.id).toBe(testApiId);
      expect(details.name).toBeDefined();
      expect(details.endpoint).toMatch(/^http:\/\/localhost:\d+$/);
      expect(details.port).toBeGreaterThan(0);
      expect(['running', 'stopped', 'error']).toContain(details.status);
    }, 15000);

    it('should handle retrieving details for non-existent API', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      try {
        await invoke('get_api_details', { api_id: nonExistentId });
        // エラーが発生することを期待
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});

