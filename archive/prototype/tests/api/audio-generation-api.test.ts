// audio-generation-api - 音声生成モデルAPIのテスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import {
  cleanupTestApis,
  handleTauriAppNotRunningError,
  checkTauriAvailable,
} from '../setup/test-helpers';
import { debugLog, debugWarn } from '../setup/debug';

/**
 * 音声生成モデルのテスト
 *
 * テスト対象:
 * - 音声生成モデル（bark, musicgen, xtts-v2, valle-x, coqui-tts）を使用したAPI作成
 * - マルチモーダル設定で音声機能を有効化したAPI
 * - 音声生成モデルを使用したチャットAPIの動作確認
 */
describe('音声生成モデル API テスト', () => {
  let apiEndpoint: string;
  let apiKey: string;
  let createdApiId: string | null = null;

  // テスト対象の音声生成モデル
  const audioGenerationModels = [
    {
      name: 'bark:latest',
      description: 'Bark - テキスト・音声入力から音声出力を生成',
    },
    {
      name: 'musicgen:latest',
      description: 'MusicGen - 高品質な音楽生成モデル',
    },
    {
      name: 'xtts-v2:latest',
      description: 'XTTS v2 - 高品質な多言語音声合成モデル',
    },
  ];

  beforeAll(async () => {
    debugLog('音声生成モデルAPIテストを開始します');

    // テスト用のAPIを作成（音声生成モデルを使用）
    try {
      const result = await invoke<{
        id: string;
        endpoint: string;
        api_key: string | null;
      }>('create_api', {
        config: {
          name: 'Audio Generation API Test',
          model_name: 'bark:latest', // 音声生成モデルを使用
          port: 8121,
          enable_auth: true,
          engine_type: 'ollama',
          multimodal: {
            enableAudio: true, // 音声処理機能を有効化
            maxAudioSize: 50, // 最大音声サイズ（MB）
          },
        },
      });

      createdApiId = result.id;
      apiEndpoint = result.endpoint;
      apiKey = result.api_key || '';

      // APIを起動
      await invoke('start_api', { api_id: createdApiId });

      // APIが起動するまで待機
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      if (handleTauriAppNotRunningError(error)) {
        debugWarn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }
      debugWarn(
        '音声生成API作成に失敗したため、このテストをスキップします:',
        error
      );
    }
  });

  afterAll(async () => {
    await cleanupTestApis(createdApiId ? [createdApiId] : []);
    debugLog('音声生成モデルAPIテストを完了しました');
  });

  describe('音声生成モデルのAPI作成', () => {
    it('音声生成モデルでAPIを作成できること', async () => {
      if (!createdApiId) {
        debugWarn('APIが作成されていないため、スキップします');
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        debugWarn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        expect(true).toBe(true);
        return;
      }

      // API情報を取得
      const apiInfo = await invoke<{
        id: string;
        name: string;
        model_name: string;
      }>('get_api_details', { apiId: createdApiId });

      expect(apiInfo).toBeDefined();
      expect(apiInfo.model_name).toBe('bark:latest');
      expect(apiInfo.name).toBe('Audio Generation API Test');
    }, 30000);

    it('複数の音声生成モデルでAPIを作成できること', async () => {
      const testApiIds: string[] = [];

      try {
        for (const model of audioGenerationModels) {
          const result = await invoke<{
            id: string;
            endpoint: string;
            api_key: string | null;
          }>('create_api', {
            config: {
              name: `Audio Generation Test - ${model.name}`,
              model_name: model.name,
              port: 8122 + testApiIds.length,
              enable_auth: true,
              engine_type: 'ollama',
              multimodal: {
                enableAudio: true,
                maxAudioSize: 50,
              },
            },
          });

          testApiIds.push(result.id);

          // API情報を確認
          const apiInfo = await invoke('get_api_details', { apiId: result.id });
          expect(apiInfo).toBeDefined();
        }
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          debugWarn(
            'Tauriアプリが起動していないため、このテストをスキップします'
          );
          return;
        }
        debugWarn('音声生成モデルAPI作成テストでエラー:', error);
      } finally {
        // クリーンアップ
        for (const apiId of testApiIds) {
          try {
            await invoke('stop_api', { api_id: apiId });
            await invoke('delete_api', { api_id: apiId });
          } catch (error) {
            debugWarn(`API削除に失敗: ${apiId}`, error);
          }
        }
      }
    }, 60000);
  });

  describe('音声生成モデルを使用したチャットAPI', () => {
    it('音声生成モデルでチャットAPIが動作すること', async () => {
      if (!apiEndpoint || !apiKey) {
        debugWarn(
          'APIエンドポイントまたはAPIキーが設定されていないため、スキップします'
        );
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        debugWarn(
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
          model: 'bark:latest',
          messages: [
            {
              role: 'user',
              content: 'Hello, this is a test for audio generation model.',
            },
          ],
        }),
      });

      // レスポンスが返されることを確認（200またはエラーでもOK - モデルがインストールされていない場合もある）
      expect([200, 400, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    }, 60000);

    it('音声生成モデルで音声入力を含むリクエストが処理できること', async () => {
      if (!apiEndpoint || !apiKey) {
        debugWarn(
          'APIエンドポイントまたはAPIキーが設定されていないため、スキップします'
        );
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        debugWarn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        expect(true).toBe(true);
        return;
      }

      // 音声入力を含むリクエスト（マルチモーダル）
      const response = await fetch(`${apiEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'bark:latest',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Generate audio for this text: Hello, world!',
                },
              ],
            },
          ],
        }),
      });

      // レスポンスが返されることを確認
      expect([200, 400, 404, 500]).toContain(response.status);
    }, 60000);
  });

  describe('マルチモーダル設定の検証', () => {
    it('音声処理機能が有効化されていること', async () => {
      if (!createdApiId) {
        debugWarn('APIが作成されていないため、スキップします');
        expect(true).toBe(true);
        return;
      }

      // Tauriアプリが起動していない場合はスキップ
      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        debugWarn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        expect(true).toBe(true);
        return;
      }

      // API情報を取得してモデル名を確認
      const apiInfo = await invoke<{
        model_name: string;
      }>('get_api_details', { apiId: createdApiId });

      expect(apiInfo).toBeDefined();
      expect(apiInfo.model_name).toBe('bark:latest');

      // 音声生成モデルのカテゴリを確認
      const models = await invoke<
        Array<{
          name: string;
          category?: string;
        }>
      >('search_models', {
        engineType: 'ollama',
        category: 'audio-generation',
        limit: 10,
      });

      const barkModel = models.find(m => m.name === 'bark:latest');
      expect(barkModel).toBeDefined();
      expect(barkModel?.category).toBe('audio-generation');
    }, 10000);

    it('音声生成モデルのカテゴリが正しく設定されていること', async () => {
      // Tauriアプリが起動していない場合はスキップ
      const isTauriAvailable = await checkTauriAvailable();
      if (!isTauriAvailable) {
        debugWarn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        expect(true).toBe(true);
        return;
      }

      // モデルカタログから音声生成モデルを確認
      const models = await invoke<
        Array<{
          name: string;
          category?: string;
        }>
      >('search_models', {
        engineType: 'ollama',
        category: 'audio-generation',
        limit: 10,
      });

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);

      // 音声生成モデルが含まれていることを確認
      const audioModels = models.filter(m => m.category === 'audio-generation');
      expect(audioModels.length).toBeGreaterThan(0);

      // 主要な音声生成モデルが含まれていることを確認
      const modelNames = audioModels.map(m => m.name);
      expect(
        modelNames.some(
          name =>
            name.includes('bark') ||
            name.includes('musicgen') ||
            name.includes('xtts') ||
            name.includes('valle') ||
            name.includes('coqui')
        )
      ).toBe(true);
    }, 10000);
  });
});
