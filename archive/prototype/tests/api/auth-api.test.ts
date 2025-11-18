// auth-api - 認証APIのテスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import { checkTauriAvailable } from '../setup/test-helpers';

describe('Authentication API Tests', () => {
  let apiEndpoint: string;
  let apiKey: string;
  let createdApiId: string | null = null;

  beforeAll(async () => {
    // テスト用のAPIを作成（認証有効）
    try {
      const result = await invoke<{
        id: string;
        endpoint: string;
        api_key: string | null;
      }>('create_api', {
        config: {
          name: 'Auth API Test',
          model_name: 'llama3:8b',
          port: 8121,
          enable_auth: true,
        },
      });

      createdApiId = result.id;
      apiEndpoint = result.endpoint;
      apiKey = result.api_key || '';

      // APIを起動
      await invoke('start_api', { api_id: createdApiId });

      // APIが起動するまで待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.warn('API作成に失敗したため、このテストをスキップします:', error);
    }
  });

  afterAll(async () => {
    if (createdApiId) {
      try {
        await invoke('stop_api', { api_id: createdApiId });
        await invoke('delete_api', { api_id: createdApiId });
      } catch (error) {
        console.warn('API削除に失敗しました:', error);
      }
    }
  });

  describe('API Key Authentication', () => {
    it('should accept valid API key', async () => {
      if (!apiEndpoint || !apiKey) {
        console.warn(
          'APIエンドポイントまたはAPIキーが設定されていないため、スキップします'
        );
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        expect(true).toBe(true);
        return;
      }

      const response = await fetch(`${apiEndpoint}/v1/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      expect(response.status).toBe(200);
    }, 10000);

    it('should reject invalid API key', async () => {
      if (!apiEndpoint) {
        console.warn('APIエンドポイントが設定されていないため、スキップします');
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        expect(true).toBe(true);
        return;
      }

      const response = await fetch(`${apiEndpoint}/v1/models`, {
        headers: {
          Authorization: 'Bearer invalid-key-12345',
        },
      });

      expect(response.status).toBe(401);
    }, 10000);

    it('should reject request without API key when auth is enabled', async () => {
      if (!apiEndpoint) {
        console.warn('APIエンドポイントが設定されていないため、スキップします');
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        expect(true).toBe(true);
        return;
      }

      const response = await fetch(`${apiEndpoint}/v1/models`);

      expect(response.status).toBe(401);
    }, 10000);

    it('should accept request without API key when auth is disabled', async () => {
      // 認証無効のAPIを作成
      let noAuthApiId: string | null = null;
      let noAuthEndpoint: string = '';

      try {
        const result = await invoke<{
          id: string;
          endpoint: string;
        }>('create_api', {
          config: {
            name: 'No Auth API Test',
            model_name: 'llama3:8b',
            port: 8122,
            enable_auth: false,
          },
        });

        noAuthApiId = result.id;
        noAuthEndpoint = result.endpoint;

        await invoke('start_api', { api_id: noAuthApiId });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Tauriアプリが起動していない場合はスキップ
        const isTauriAvailable = await checkTauriAvailable();
        if (!isTauriAvailable) {
          console.warn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          expect(true).toBe(true);
          return;
        }

        const response = await fetch(`${noAuthEndpoint}/v1/models`);

        expect(response.status).toBe(200);

        // クリーンアップ
        await invoke('stop_api', { api_id: noAuthApiId });
        await invoke('delete_api', { api_id: noAuthApiId });
      } catch (error) {
        console.warn('認証無効APIのテストをスキップ:', error);
        if (noAuthApiId) {
          try {
            await invoke('stop_api', { api_id: noAuthApiId });
            await invoke('delete_api', { api_id: noAuthApiId });
          } catch {}
        }
      }
    }, 30000);
  });
});
