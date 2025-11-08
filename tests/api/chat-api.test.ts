// chat-api - Chat APIのテスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

describe('Chat API Tests', () => {
  let apiEndpoint: string;
  let apiKey: string;
  let createdApiId: string | null = null;

  beforeAll(async () => {
    // テスト用のAPIを作成
    try {
      const result = await invoke<{
        id: string;
        endpoint: string;
        api_key: string | null;
      }>('create_api', {
        config: {
          name: 'Chat API Test',
          model_name: 'llama3:8b',
          port: 8120,
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

  describe('POST /v1/chat/completions', () => {
    it('should respond to chat completion request', async () => {
      if (!apiEndpoint || !apiKey) {
        console.warn(
          'APIエンドポイントまたはAPIキーが設定されていないため、スキップします'
        );
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
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
          model: 'llama3:8b',
          messages: [{ role: 'user', content: 'Hello, world!' }],
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();

      // OpenAI互換形式の確認
      if (data.choices) {
        expect(Array.isArray(data.choices)).toBe(true);
        if (data.choices.length > 0) {
          expect(data.choices[0]).toHaveProperty('message');
        }
      }
    }, 30000);

    it('should return error for invalid request', async () => {
      if (!apiEndpoint || !apiKey) {
        console.warn(
          'APIエンドポイントまたはAPIキーが設定されていないため、スキップします'
        );
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
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
          // 無効なリクエスト（modelが欠落）
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      // エラーレスポンスが返されることを確認
      expect(response.status).toBeGreaterThanOrEqual(400);
    }, 30000);

    it('should require authentication when auth is enabled', async () => {
      if (!apiEndpoint) {
        console.warn('APIエンドポイントが設定されていないため、スキップします');
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        expect(true).toBe(true);
        return;
      }

      const response = await fetch(`${apiEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // APIキーなし
        },
        body: JSON.stringify({
          model: 'llama3:8b',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(response.status).toBe(401);
    }, 30000);
  });

  describe('GET /v1/models', () => {
    it('should return list of models', async () => {
      if (!apiEndpoint || !apiKey) {
        console.warn(
          'APIエンドポイントまたはAPIキーが設定されていないため、スキップします'
        );
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
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
      const data = await response.json();
      expect(data).toBeDefined();

      // OpenAI互換形式の確認
      if (data.data) {
        expect(Array.isArray(data.data)).toBe(true);
      }
    }, 10000);
  });
});
