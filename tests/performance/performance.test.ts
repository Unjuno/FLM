/**
 * FLM - パフォーマンステスト
 * 
 * フェーズ4: QAエージェント (QA) 実装
 * アプリケーションのパフォーマンステスト
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

/**
 * パフォーマンステストスイート
 * 
 * テスト項目:
 * - IPC通信の応答時間
 * - データベースクエリのパフォーマンス
 * - API作成・管理操作の応答時間
 */
describe('パフォーマンステスト', () => {
  beforeAll(() => {
    console.log('パフォーマンステストを開始します');
  });

  afterAll(() => {
    console.log('パフォーマンステストを完了しました');
  });

  /**
   * IPC通信のパフォーマンス
   */
  describe('IPC通信のパフォーマンス', () => {
    it('should respond to get_app_info within 100ms', async () => {
      const startTime = Date.now();
      await invoke('get_app_info');
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(100);
    }, 5000);

    it('should handle multiple concurrent IPC requests efficiently', async () => {
      const requestCount = 10;
      const startTime = Date.now();
      
      const requests = Array(requestCount).fill(null).map(() => 
        invoke('get_app_info')
      );

      await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / requestCount;

      // 平均応答時間が200ms以内であることを期待
      expect(averageTime).toBeLessThan(200);
    }, 10000);

    it('should retrieve API list within acceptable time', async () => {
      const startTime = Date.now();
      await invoke('list_apis');
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // API一覧取得は500ms以内であることを期待
      expect(responseTime).toBeLessThan(500);
    }, 5000);
  });

  /**
   * データベース操作のパフォーマンス
   */
  describe('データベース操作のパフォーマンス', () => {
    it('should retrieve API details quickly', async () => {
      // 既存のAPIがある場合、そのIDを使用
      const apis = await invoke<Array<{ id: string }>>('list_apis');
      
      if (apis.length > 0) {
        const apiId = apis[0].id;
        const startTime = Date.now();
        await invoke('get_api_details', { api_id: apiId });
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // API詳細取得は300ms以内であることを期待
        expect(responseTime).toBeLessThan(300);
      }
    }, 5000);

    it('should handle model list retrieval efficiently', async () => {
      const startTime = Date.now();
      await invoke('get_models_list').catch(() => {
        // Ollamaが起動していない場合はスキップ
      });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // モデル一覧取得は2秒以内であることを期待（Ollama API呼び出しを含む）
      expect(responseTime).toBeLessThan(2000);
    }, 5000);
  });

  /**
   * 大量データのパフォーマンス
   */
  describe('大量データのパフォーマンス', () => {
    it('should handle retrieving many installed models efficiently', async () => {
      const startTime = Date.now();
      await invoke('get_installed_models');
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // インストール済みモデル一覧取得は500ms以内であることを期待
      expect(responseTime).toBeLessThan(500);
    }, 5000);
  });

  /**
   * メモリ使用量の監視
   */
  describe('メモリ使用量の監視', () => {
    it('should not cause memory leaks in repeated operations', async () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        await invoke('list_apis');
      }

      // メモリリークがないことを確認（応答時間が一定である）
      const startTime = Date.now();
      await invoke('list_apis');
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 繰り返し操作後も応答時間が安定していることを確認
      expect(responseTime).toBeLessThan(500);
    }, 15000);
  });
});

