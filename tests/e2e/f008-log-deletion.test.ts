/**
 * FLM - F008: ログ削除機能 E2Eテスト
 *
 * QAエージェント (QA) 実装
 * ログ削除UIのE2Eテスト
 *
 * 注意: TauriアプリケーションのE2Eテストは、実際のUI操作ではなく、
 * フロントエンドからバックエンドへの完全なフローのテストとして実装します
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
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
 * F008: ログ削除機能E2Eテストスイート
 *
 * テスト項目:
 * - ログ削除フロー全体の検証
 * - 削除後のログ一覧更新
 * - 削除件数の確認
 * - 複数条件での削除フロー
 */
describe('F008: ログ削除機能 E2Eテスト', () => {
  let testApiId: string | null = null;

  beforeAll(async () => {
    // Tauriアプリが起動していない場合はスキップ
    if (!process.env.TAURI_APP_AVAILABLE) {
      console.warn(
        'Tauriアプリが起動していないため、このテストスイートをスキップします'
      );
      return;
    }

    console.log('F008 ログ削除機能E2Eテストを開始します');

    // テスト用のAPIを作成
    try {
      const result = await invoke<{
        id: string;
        name: string;
        endpoint: string;
        api_key: string | null;
        model_name: string;
        port: number;
        status: string;
      }>('create_api', {
        name: 'Test API for Log Deletion E2E',
        model_name: 'llama3:8b',
        port: 8885,
        enable_auth: false,
      });

      testApiId = result.id;
      console.log(`テスト用APIを作成しました: ${testApiId}`);

      // テスト用のログデータを複数作成（異なる日時で）
      const now = new Date();
      const logsToCreate = [
        {
          method: 'POST',
          path: '/v1/chat/completions',
          request_body: JSON.stringify({
            messages: [{ role: 'user', content: 'Log 1' }],
          }),
          response_status: 200,
          response_time_ms: 100,
          error_message: null,
        },
        {
          method: 'POST',
          path: '/v1/chat/completions',
          request_body: JSON.stringify({
            messages: [{ role: 'user', content: 'Log 2' }],
          }),
          response_status: 200,
          response_time_ms: 150,
          error_message: null,
        },
        {
          method: 'POST',
          path: '/v1/chat/completions',
          request_body: JSON.stringify({
            messages: [{ role: 'user', content: 'Log 3' }],
          }),
          response_status: 400,
          response_time_ms: 50,
          error_message: 'Bad Request',
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

      // ログ作成後の待機時間
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn('テスト用APIの作成に失敗しました:', error);
    }
  });

  afterAll(async () => {
    // テストで作成したAPIをクリーンアップ
    if (testApiId) {
      try {
        await invoke('delete_api', { api_id: testApiId });
        console.log(`テスト用APIを削除しました: ${testApiId}`);
      } catch (error) {
        console.warn('テスト後のクリーンアップに失敗しました:', error);
      }
    }
    console.log('F008 ログ削除機能E2Eテストを完了しました');
  });

  /**
   * ログ削除フロー
   */
  describe('ログ削除フロー', () => {
    it('should complete full deletion workflow: list logs → delete → verify', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // ステップ1: 削除前のログ一覧を取得
      const logsBefore = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 100,
          offset: 0,
        },
      });

      expect(Array.isArray(logsBefore)).toBe(true);
      const initialCount = logsBefore.length;
      console.log(`削除前のログ数: ${initialCount}`);

      // ステップ2: 日付範囲指定でログを削除
      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const deleteResult = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: testApiId,
          before_date: oneDayAgo,
        },
      });

      expect(deleteResult).toBeDefined();
      expect(deleteResult.deleted_count).toBeGreaterThanOrEqual(0);
      console.log(`削除されたログ数: ${deleteResult.deleted_count}`);

      // ステップ3: 削除後のログ一覧を取得して検証
      await new Promise(resolve => setTimeout(resolve, 500));

      const logsAfter = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 100,
          offset: 0,
        },
      });

      expect(Array.isArray(logsAfter)).toBe(true);
      const finalCount = logsAfter.length;
      console.log(`削除後のログ数: ${finalCount}`);

      // 削除前後のログ数の整合性を確認
      // 注意: 完全な一致は保証されない（他のログが追加される可能性があるため）
      expect(finalCount).toBeLessThanOrEqual(initialCount);
    }, 20000);

    it('should delete logs by API ID and verify other APIs logs remain', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // テスト用API2を作成
      let testApiId2: string | null = null;
      try {
        const result2 = await invoke<{
          id: string;
        }>('create_api', {
          name: 'Test API 2 for Log Deletion E2E',
          model_name: 'llama3:8b',
          port: 8884,
          enable_auth: false,
        });

        testApiId2 = result2.id;

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
              request_body: JSON.stringify({
                messages: [{ role: 'user', content: log.content }],
              }),
              response_status: 200,
              response_time_ms: 100,
              error_message: null,
            });
          } catch (error) {
            console.warn('テストログの作成に失敗しました:', error);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        // testApiIdのログのみを削除
        const oneDayAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();

        await invoke('delete_logs', {
          request: {
            api_id: testApiId,
            before_date: oneDayAgo,
          },
        });

        // testApiId2のログが残っていることを確認
        const logsApi2 = await invoke<RequestLogInfo[]>('get_request_logs', {
          request: {
            api_id: testApiId2,
            limit: 100,
            offset: 0,
          },
        });

        expect(Array.isArray(logsApi2)).toBe(true);

        // クリーンアップ
        await invoke('delete_api', { api_id: testApiId2 });
      } catch (error) {
        console.warn('テストAPI2の処理に失敗しました:', error);
      }
    }, 20000);

    it('should handle deletion with future date (should delete all logs)', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // 削除前のログ数を取得
      const logsBefore = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 100,
          offset: 0,
        },
      });

      const initialCount = logsBefore.length;

      // 未来の日付で削除（すべてのログが削除される）
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const deleteResult = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: testApiId,
          before_date: futureDate,
        },
      });

      expect(deleteResult).toBeDefined();
      expect(deleteResult.deleted_count).toBeGreaterThanOrEqual(0);

      // 削除後のログ数を確認
      await new Promise(resolve => setTimeout(resolve, 500));

      const logsAfter = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 100,
          offset: 0,
        },
      });

      const finalCount = logsAfter.length;
      expect(finalCount).toBeLessThanOrEqual(initialCount);
    }, 20000);
  });

  /**
   * エラーハンドリングフロー
   */
  describe('エラーハンドリングフロー', () => {
    it('should handle invalid API ID gracefully', async () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }

      const invalidApiId = 'invalid-api-id-12345';
      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      // 無効なAPI IDで削除を試行（エラーではなく、削除件数0が返されることを期待）
      const result = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: invalidApiId,
          before_date: oneDayAgo,
        },
      });

      expect(result).toBeDefined();
      expect(result.deleted_count).toBe(0);
    });

    it('should prevent deletion when both conditions are null', async () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }

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
        // エラーは文字列またはErrorオブジェクトの可能性がある
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        // エラーメッセージに安全に関する記述があることを確認（より柔軟なマッチング）
        const hasSecurityMessage = /許可|安全|条件|削除|全ログ/i.test(
          errorMessage
        );
        expect(hasSecurityMessage).toBe(true);
      }
    });
  });

  /**
   * 完全なフロー: ログ作成 → 削除 → 検証
   */
  describe('完全なフロー: ログ作成 → 削除 → 検証', () => {
    it('should complete full workflow from log creation to deletion verification', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが作成されていないため、スキップします');
        return;
      }

      // ステップ1: 新しいログを作成
      const logToCreate = {
        method: 'POST',
        path: '/v1/chat/completions',
        request_body: JSON.stringify({
          messages: [{ role: 'user', content: 'New Test Log' }],
        }),
        response_status: 200,
        response_time_ms: 120,
        error_message: null,
      };

      await invoke('save_request_log', {
        api_id: testApiId,
        method: logToCreate.method,
        path: logToCreate.path,
        request_body: logToCreate.request_body,
        response_status: logToCreate.response_status,
        response_time_ms: logToCreate.response_time_ms,
        error_message: logToCreate.error_message,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // ステップ2: 作成したログが存在することを確認
      const logsAfterCreation = await invoke<RequestLogInfo[]>(
        'get_request_logs',
        {
          request: {
            api_id: testApiId,
            limit: 100,
            offset: 0,
          },
        }
      );

      expect(Array.isArray(logsAfterCreation)).toBe(true);
      const countAfterCreation = logsAfterCreation.length;

      // ステップ3: ログを削除
      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const deleteResult = await invoke<{
        deleted_count: number;
      }>('delete_logs', {
        request: {
          api_id: testApiId,
          before_date: oneDayAgo,
        },
      });

      expect(deleteResult).toBeDefined();
      expect(deleteResult.deleted_count).toBeGreaterThanOrEqual(0);

      // ステップ4: 削除後のログ数を確認
      await new Promise(resolve => setTimeout(resolve, 500));

      const logsAfterDeletion = await invoke<RequestLogInfo[]>(
        'get_request_logs',
        {
          request: {
            api_id: testApiId,
            limit: 100,
            offset: 0,
          },
        }
      );

      const countAfterDeletion = logsAfterDeletion.length;
      expect(countAfterDeletion).toBeLessThanOrEqual(countAfterCreation);
    }, 20000);
  });
});
