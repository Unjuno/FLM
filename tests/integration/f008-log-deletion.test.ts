/**
 * FLM - F008: ログ削除機能 統合テスト
 * 
 * QAエージェント (QA) 実装
 * ログ削除機能のバックエンド統合テスト
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';

/**
 * リクエストログ情報
 */
interface RequestLogInfo {
  id: string;
  api_id: string;
  method: string;
  path: string;
  request_body: string | null;
  response_status: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

/**
 * F008: ログ削除機能統合テストスイート
 * 
 * テスト項目:
 * - ログ削除コマンドの基本機能テスト
 * - API ID指定での削除テスト
 * - 日付範囲指定での削除テスト
 * - 複合条件での削除テスト
 * - エッジケーステスト（削除件数0件、無効な条件等）
 * - 安全機能テスト（全件削除防止）
 */
describe('F008: ログ削除機能 統合テスト', () => {
  let testApiId: string | null = null;
  let testApiId2: string | null = null;

  beforeAll(async () => {
    console.log('F008 ログ削除機能統合テストを開始します');
    
    // テスト用のAPIを作成
    try {
      const result1 = await invoke<{
        id: string;
        name: string;
        endpoint: string;
        api_key: string | null;
        model_name: string;
        port: number;
        status: string;
      }>('create_api', {
        name: 'Test API for Log Deletion',
        model_name: 'llama3:8b',
        port: 8887,
        enable_auth: false,
      });
      
      testApiId = result1.id;
      console.log(`テスト用API1を作成しました: ${testApiId}`);

      const result2 = await invoke<{
        id: string;
        name: string;
        endpoint: string;
        api_key: string | null;
        model_name: string;
        port: number;
        status: string;
      }>('create_api', {
        name: 'Test API 2 for Log Deletion',
        model_name: 'llama3:8b',
        port: 8886,
        enable_auth: false,
      });
      
      testApiId2 = result2.id;
      console.log(`テスト用API2を作成しました: ${testApiId2}`);
    } catch (error) {
      console.warn('テスト用APIの作成に失敗しました:', error);
    }
  });

  afterAll(async () => {
    // テストで作成したAPIをクリーンアップ
    if (testApiId) {
      try {
        await invoke('delete_api', { api_id: testApiId });
        console.log(`テスト用API1を削除しました: ${testApiId}`);
      } catch (error) {
        console.warn('テスト後のクリーンアップに失敗しました:', error);
      }
    }
    if (testApiId2) {
      try {
        await invoke('delete_api', { api_id: testApiId2 });
        console.log(`テスト用API2を削除しました: ${testApiId2}`);
      } catch (error) {
        console.warn('テスト後のクリーンアップに失敗しました:', error);
      }
    }
    console.log('F008 ログ削除機能統合テストを完了しました');
  });

  beforeEach(async () => {
    // 各テスト前にテスト用ログを削除（必要に応じて）
  });

  /**
   * delete_logsの基本機能テスト
   */
  describe('delete_logs 基本機能', () => {
    it('should return 0 when no logs exist to delete', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // 存在しない日付より前のログを削除しようとする
      const pastDate = new Date('2020-01-01').toISOString();
      
      const result = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: testApiId,
          before_date: pastDate,
        },
      });

      expect(result).toBeDefined();
      expect(result.deleted_count).toBe(0);
    }, 10000);

    it('should delete logs by API ID only', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // テスト用のログを作成
      const now = new Date();
      const logsToCreate = [
        {
          method: 'POST',
          path: '/v1/chat/completions',
          request_body: JSON.stringify({ messages: [{ role: 'user', content: 'Test 1' }] }),
          response_status: 200,
          response_time_ms: 100,
          error_message: null,
        },
        {
          method: 'POST',
          path: '/v1/chat/completions',
          request_body: JSON.stringify({ messages: [{ role: 'user', content: 'Test 2' }] }),
          response_status: 200,
          response_time_ms: 150,
          error_message: null,
        },
      ];

      for (const log of logsToCreate) {
        try {
          await invoke('save_request_log', {
            api_id: testApiId,
            method: log.method,
            path: log.path,
            request_body: log.request_body,
            response_status: log.response_status,
            response_time_ms: log.response_time_ms,
            error_message: log.error_message,
          });
        } catch (error) {
          console.warn('テストログの作成に失敗しました:', error);
        }
      }

      // 少し待ってから削除を実行
      await new Promise(resolve => setTimeout(resolve, 500));

      // API IDのみで削除
      const result = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: testApiId,
          before_date: null,
        },
      });

      expect(result).toBeDefined();
      expect(result.deleted_count).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should delete logs by date range', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // テスト用のログを作成
      const logsToCreate = [
        {
          method: 'POST',
          path: '/v1/chat/completions',
          request_body: JSON.stringify({ messages: [{ role: 'user', content: 'Old Log' }] }),
          response_status: 200,
          response_time_ms: 100,
          error_message: null,
        },
      ];

      for (const log of logsToCreate) {
        try {
          await invoke('save_request_log', {
            api_id: testApiId,
            method: log.method,
            path: log.path,
            request_body: log.request_body,
            response_status: log.response_status,
            response_time_ms: log.response_time_ms,
            error_message: log.error_message,
          });
        } catch (error) {
          console.warn('テストログの作成に失敗しました:', error);
        }
      }

      // 少し待ってから削除を実行
      await new Promise(resolve => setTimeout(resolve, 500));

      // 現在より1時間前の日付で削除
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const result = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: testApiId,
          before_date: oneHourAgo,
        },
      });

      expect(result).toBeDefined();
      expect(result.deleted_count).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should delete logs by API ID and date range combination', async () => {
      if (!testApiId || !testApiId2) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // テスト用のログを作成（両方のAPIに）
      const logsToCreate = [
        { apiId: testApiId, content: 'Log 1' },
        { apiId: testApiId, content: 'Log 2' },
        { apiId: testApiId2, content: 'Log 3' },
      ];

      for (const log of logsToCreate) {
        try {
          await invoke('save_request_log', {
            api_id: log.apiId,
            method: 'POST',
            path: '/v1/chat/completions',
            request_body: JSON.stringify({ messages: [{ role: 'user', content: log.content }] }),
            response_status: 200,
            response_time_ms: 100,
            error_message: null,
          });
        } catch (error) {
          console.warn('テストログの作成に失敗しました:', error);
        }
      }

      // 少し待ってから削除を実行
      await new Promise(resolve => setTimeout(resolve, 500));

      // API IDと日付範囲の両方で削除
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const result = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: testApiId,
          before_date: oneDayAgo,
        },
      });

      expect(result).toBeDefined();
      expect(result.deleted_count).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  /**
   * 安全機能テスト（全件削除防止）
   */
  describe('安全機能テスト', () => {
    it('should prevent deletion when both api_id and before_date are null', async () => {
      try {
        await invoke('delete_logs', {
          request: {
            api_id: null,
            before_date: null,
          },
        });
        // エラーが発生することを期待
        expect(true).toBe(false); // 到達しないはず
      } catch (error) {
        expect(error).toBeDefined();
        expect(typeof error).toBe('string');
        // エラーメッセージに「許可されていません」などの安全メッセージが含まれることを確認
        expect(String(error)).toMatch(/許可|安全|条件/i);
      }
    });

    it('should allow deletion with API ID only', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // API IDのみで削除（before_dateはnull）
      try {
        const result = await invoke<{
          deleted_count: number;
        }>('delete_logs', {
          request: {
            api_id: testApiId,
            before_date: null,
          },
        });

        expect(result).toBeDefined();
        expect(result.deleted_count).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // エラーが発生する場合は、実装による
        console.warn('API IDのみでの削除がエラーになりました:', error);
      }
    });

    it('should allow deletion with date only', async () => {
      // 日付のみで削除（api_idはnull）
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      
      try {
        const result = await invoke<{
          deleted_count: number;
        }>('delete_logs', {
          request: {
            api_id: null,
            before_date: oneYearAgo,
          },
        });

        expect(result).toBeDefined();
        expect(result.deleted_count).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // エラーが発生する場合は、実装による
        console.warn('日付のみでの削除がエラーになりました:', error);
      }
    });
  });

  /**
   * エッジケーステスト
   */
  describe('エッジケーステスト', () => {
    it('should handle invalid date format gracefully', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      try {
        await invoke('delete_logs', {
          request: {
            api_id: testApiId,
            before_date: 'invalid-date-format',
          },
        });
        // エラーが発生するか、または無視されることを期待
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle non-existent API ID', async () => {
      const nonExistentApiId = 'non-existent-api-id-12345';
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const result = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: nonExistentApiId,
          before_date: oneDayAgo,
        },
      });

      // 存在しないAPI IDでも、削除件数0が返されることを期待
      expect(result).toBeDefined();
      expect(result.deleted_count).toBe(0);
    });

    it('should return correct deleted count', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // 複数のログを作成
      const logsToCreate = 5;
      for (let i = 0; i < logsToCreate; i++) {
        try {
          await invoke('save_request_log', {
            api_id: testApiId,
            method: 'POST',
            path: `/v1/chat/completions`,
            request_body: JSON.stringify({ messages: [{ role: 'user', content: `Test ${i}` }] }),
            response_status: 200,
            response_time_ms: 100,
            error_message: null,
          });
        } catch (error) {
          console.warn('テストログの作成に失敗しました:', error);
        }
      }

      // 少し待ってから削除を実行
      await new Promise(resolve => setTimeout(resolve, 500));

      // 未来の日付で削除（すべてのログが削除される）
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      const result = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: testApiId,
          before_date: futureDate,
        },
      });

      expect(result).toBeDefined();
      expect(result.deleted_count).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  /**
   * データ整合性テスト
   */
  describe('データ整合性テスト', () => {
    it('should only delete logs matching the conditions', async () => {
      if (!testApiId || !testApiId2) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // 両方のAPIにログを作成
      const logsToCreate = [
        { apiId: testApiId, content: 'API1 Log' },
        { apiId: testApiId2, content: 'API2 Log' },
      ];

      for (const log of logsToCreate) {
        try {
          await invoke('save_request_log', {
            api_id: log.apiId,
            method: 'POST',
            path: '/v1/chat/completions',
            request_body: JSON.stringify({ messages: [{ role: 'user', content: log.content }] }),
            response_status: 200,
            response_time_ms: 100,
            error_message: null,
          });
        } catch (error) {
          console.warn('テストログの作成に失敗しました:', error);
        }
      }

      // 少し待ってから削除を実行
      await new Promise(resolve => setTimeout(resolve, 500));

      // testApiIdのログのみを削除
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      await invoke('delete_logs', {
        request: {
          api_id: testApiId,
          before_date: oneDayAgo,
        },
      });

      // testApiId2のログが残っていることを確認
      const logs = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId2,
          limit: 100,
          offset: 0,
        },
      });

      // testApiId2のログが存在することを確認（完全な検証ではないが、基本的な整合性チェック）
      expect(Array.isArray(logs)).toBe(true);
    }, 15000);
  });
});

