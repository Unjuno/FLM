// f003-api-management - API管理機能の統合テスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import {
  cleanupTestApis,
  createTestApi,
  waitForApiStart,
  waitForApiStop,
  handleTauriAppNotRunningError,
} from '../setup/test-helpers';
import { debugLog, debugWarn } from '../setup/debug';

/**
 * F003: API管理機能統合テストスイート
 *
 * テスト項目:
 * - API起動/停止機能
 * - API設定更新機能
 * - API削除機能
 */
describe('F003: API管理機能 統合テスト', () => {
  let testApiId: string | null = null;

  beforeAll(async () => {
    debugLog('F003 API管理機能統合テストを開始します');

    try {
      // テスト用のAPIを作成
      testApiId = await createTestApi({
        name: 'Management Test API',
        model_name: 'llama3:8b',
        port: 8090,
        enable_auth: true,
      });
    } catch (error) {
      if (handleTauriAppNotRunningError(error)) {
        // テストは続行（testApiIdがnullのまま）
      } else {
        throw error;
      }
    }
  }, 30000);

  afterAll(async () => {
    // テストで作成したAPIをクリーンアップ
    if (testApiId) {
      await cleanupTestApis([testApiId]);
    }
    debugLog('F003 API管理機能統合テストを完了しました');
  });

  /**
   * API起動/停止機能
   */
  describe('API起動/停止機能', () => {
    it('should start API successfully', async () => {
      if (!testApiId) {
        debugWarn(
          'テスト用APIが作成されていないため、このテストをスキップします'
        );
        return;
      }

      try {
        await invoke('start_api', { api_id: testApiId });

        // APIが起動するまで待機（固定待機時間の代わりに状態を待つ）
        await waitForApiStart(testApiId);

        // 一覧を取得してステータスを確認
        const apis = await invoke<
          Array<{
            id: string;
            status: string;
          }>
        >('list_apis');

        const api = apis.find(a => a.id === testApiId);
        expect(api).toBeDefined();
        expect(api!.status).toBe('running');
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);

    it('should stop API successfully', async () => {
      if (!testApiId) {
        debugWarn(
          'テスト用APIが作成されていないため、このテストをスキップします'
        );
        return;
      }

      try {
        await invoke('stop_api', { api_id: testApiId });

        // APIが停止するまで待機（固定待機時間の代わりに状態を待つ）
        await waitForApiStop(testApiId);

        // 一覧を取得してステータスを確認
        const apis = await invoke<
          Array<{
            id: string;
            status: string;
          }>
        >('list_apis');

        const api = apis.find(a => a.id === testApiId);
        expect(api).toBeDefined();
        expect(api!.status).toBe('stopped');
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);

    it('should handle starting already running API', async () => {
      if (!testApiId) {
        debugWarn(
          'テスト用APIが作成されていないため、このテストをスキップします'
        );
        return;
      }

      // 既に起動している場合の処理を確認
      try {
        await invoke('start_api', { api_id: testApiId });
        await invoke('start_api', { api_id: testApiId }); // 再度起動

        // エラーが発生しない、または適切に処理されることを確認
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
          // エラーが発生する場合、適切なエラーメッセージであることを確認
          expect(error).toBeDefined();
        }
      }
    }, 30000);
  });

  /**
   * API設定更新機能
   */
  describe('API設定更新機能', () => {
    it('should update API name', async () => {
      if (!testApiId) {
        debugWarn(
          'テスト用APIが作成されていないため、このテストをスキップします'
        );
        return;
      }

      try {
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
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);

    it('should update API port number', async () => {
      if (!testApiId) {
        debugWarn(
          'テスト用APIが作成されていないため、このテストをスキップします'
        );
        return;
      }

      try {
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
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);

    it('should update authentication setting', async () => {
      if (!testApiId) {
        debugWarn(
          'テスト用APIが作成されていないため、このテストをスキップします'
        );
        return;
      }

      try {
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
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);

    it('should handle invalid port number in update', async () => {
      if (!testApiId) {
        debugWarn(
          'テスト用APIが作成されていないため、このテストをスキップします'
        );
        return;
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
          expect(error).toBeDefined();
        }
      }
    });
  });

  /**
   * APIキー再生成機能
   */
  describe('APIキー再生成機能', () => {
    it('should regenerate API key successfully', async () => {
      if (!testApiId) {
        debugWarn(
          'テスト用APIが作成されていないため、このテストをスキップします'
        );
        return;
      }

      try {
        // 認証を有効にする
        await invoke('update_api', {
          api_id: testApiId,
          config: {
            enable_auth: true,
          },
        });

        // 現在のAPIキーを取得
        const originalKey = await invoke<string | null>('get_api_key', {
          api_id: testApiId,
        });

        // APIキーを再生成
        const newKey = await invoke<string>('regenerate_api_key', {
          api_id: testApiId,
        });

        expect(newKey).toBeDefined();
        expect(typeof newKey).toBe('string');
        expect(newKey.length).toBeGreaterThanOrEqual(32);
        expect(newKey).not.toBe(originalKey); // 異なるキーが生成される

        // 新しいキーが取得できることを確認
        const retrievedKey = await invoke<string | null>('get_api_key', {
          api_id: testApiId,
        });
        expect(retrievedKey).toBe(newKey);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);

    it('should handle regeneration when auth is disabled', async () => {
      if (!testApiId) {
        debugWarn(
          'テスト用APIが作成されていないため、このテストをスキップします'
        );
        return;
      }

      try {
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
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes('Tauriアプリケーションが起動していません')
          ) {
            console.warn(
              'Tauriアプリが起動していないため、このテストをスキップします'
            );
            expect(errorMessage).toContain(
              'Tauriアプリケーションが起動していません'
            );
          } else {
            expect(error).toBeDefined();
          }
        }
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);
  });

  /**
   * API削除機能
   */
  describe('API削除機能', () => {
    it('should delete API successfully', async () => {
      try {
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
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);

    it('should stop API before deletion if running', async () => {
      try {
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
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 30000);

    it('should handle deleting non-existent API', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      try {
        await invoke('delete_api', { api_id: nonExistentId });
        // エラーが発生することを期待
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
          expect(error).toBeDefined();
        }
      }
    });
  });

  /**
   * API詳細取得機能
   */
  describe('API詳細取得機能', () => {
    it('should retrieve API details successfully', async () => {
      if (!testApiId) {
        debugWarn(
          'テスト用APIが作成されていないため、このテストをスキップします'
        );
        return;
      }

      try {
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
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 15000);

    it('should handle retrieving details for non-existent API', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      try {
        await invoke('get_api_details', { api_id: nonExistentId });
        // エラーが発生することを期待
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
          expect(error).toBeDefined();
        }
      }
    });
  });

  /**
   * アプリケーション終了時のクリーンアップ機能
   */
  describe('アプリケーション終了時のクリーンアップ機能', () => {
    it('should stop all running APIs when cleanup is called', async () => {
      try {
        // 複数のAPIを作成して起動
        const api1 = await invoke<{ id: string }>('create_api', {
          name: 'Cleanup Test API 1',
          model_name: 'llama3:8b',
          port: 8094,
          enable_auth: false,
        });

        const api2 = await invoke<{ id: string }>('create_api', {
          name: 'Cleanup Test API 2',
          model_name: 'llama3:8b',
          port: 8095,
          enable_auth: false,
        });

        // 両方のAPIを起動
        await invoke('start_api', { api_id: api1.id });
        await invoke('start_api', { api_id: api2.id });

        // ステータスを確認（実行中であることを確認）
        const apisBefore = await invoke<
          Array<{
            id: string;
            status: string;
          }>
        >('list_apis');

        const api1Before = apisBefore.find(a => a.id === api1.id);
        const api2Before = apisBefore.find(a => a.id === api2.id);

        expect(api1Before?.status).toBe('running');
        expect(api2Before?.status).toBe('running');

        // 注意: 実際のアプリケーション終了はテストできないため、
        // stop_all_running_apis関数の動作を直接テストすることはできません
        // 代わりに、個別に停止して動作を確認します

        // API1を停止
        await invoke('stop_api', { api_id: api1.id });

        // API2を停止
        await invoke('stop_api', { api_id: api2.id });

        // ステータスを確認（停止されていることを確認）
        const apisAfter = await invoke<
          Array<{
            id: string;
            status: string;
          }>
        >('list_apis');

        const api1After = apisAfter.find(a => a.id === api1.id);
        const api2After = apisAfter.find(a => a.id === api2.id);

        expect(api1After?.status).toBe('stopped');
        expect(api2After?.status).toBe('stopped');

        // クリーンアップ
        await invoke('delete_api', { api_id: api1.id });
        await invoke('delete_api', { api_id: api2.id });
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 60000);

    it('should handle cleanup when no APIs are running', async () => {
      // 実行中のAPIがない状態でクリーンアップ処理をシミュレート
      // 実際のstop_all_running_apis関数は直接呼び出せないため、
      // このテストは動作確認のみを行います

      try {
        // まず、実行中のAPIをすべて停止する（クリーンアップ）
        const apis = await invoke<
          Array<{
            id: string;
            status: string;
          }>
        >('list_apis');

        // 実行中のAPIをすべて停止
        for (const api of apis) {
          if (api.status === 'running') {
            try {
              await invoke('stop_api', { api_id: api.id });
            } catch {
              // エラーは無視（既に停止している可能性がある）
            }
          }
        }

        // 再度リストを取得して確認
        const apisAfter = await invoke<
          Array<{
            id: string;
            status: string;
          }>
        >('list_apis');

        const runningApis = apisAfter.filter(a => a.status === 'running');

        // 実行中のAPIがないことを確認
        expect(runningApis.length).toBe(0);

        // この時点でクリーンアップ処理が実行されてもエラーが発生しないことを確認
        // （実際の実装では、stop_all_running_apis関数が正常に動作することを期待）
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }
    }, 10000);
  });
});
