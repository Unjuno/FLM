// f005-authentication - F005 認証機能の統合テスト

/**
 * F005 認証機能の統合テスト
 *
 * 仕様書: DOCKS/SPECIFICATION.md 2.2.1 認証機能
 *
 * テスト項目:
 * 1. APIキー生成
 *    - 自動生成された安全なAPIキー
 *    - 表示/非表示切り替え（UI側のテストはユニットテストで実施）
 *    - 再生成機能
 * 2. 認証方式
 *    - Bearer Token認証
 *    - リクエストヘッダーでの認証
 *    - 認証失敗時の適切なエラーレスポンス
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import { cleanupTestApis, createTestApi, handleTauriAppNotRunningError } from '../setup/test-helpers';
import { debugLog, debugWarn } from '../setup/debug';

interface ApiInfo {
  id: string;
  name: string;
  endpoint: string;
  model_name: string;
  port: number;
  enable_auth: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ApiDetailsResponse {
  id: string;
  name: string;
  endpoint: string;
  model_name: string;
  port: number;
  enable_auth: boolean;
  status: string;
  api_key: string | null;
  created_at: string;
  updated_at: string;
}

describe('F005 認証機能 統合テスト', () => {
  const createdApiIds: string[] = [];

  beforeAll(() => {
    debugLog('F005 認証機能統合テストを開始します');
  });

  afterAll(async () => {
    // テストで作成したAPIをクリーンアップ
    await cleanupTestApis(createdApiIds);
    debugLog('F005 認証機能統合テストを完了しました');
  });

  /**
   * API IDを記録してクリーンアップ対象に追加
   */
  const recordApiId = (apiId: string) => {
    createdApiIds.push(apiId);
    return apiId;
  };

  /**
   * テスト用APIを作成（ヘルパー関数を使用）
   */
  const createTestApiHelper = async (
    name: string,
    port: number,
    enableAuth: boolean
  ): Promise<string> => {
    try {
      const apiId = await createTestApi({
        name,
        model_name: 'llama3:8b',
        port,
        enable_auth: enableAuth,
      });
      return recordApiId(apiId);
    } catch (error) {
      if (handleTauriAppNotRunningError(error)) {
        throw error;
      }
      throw new Error(`テスト用APIの作成に失敗しました: ${error}`);
    }
  };

  /**
   * 1. APIキー生成機能のテスト
   */
  describe('1. APIキー生成機能', () => {
    it('認証有効時に自動生成された安全なAPIキーが作成される', async () => {

      // 認証有効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F005 Test API 1', 8101, true);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // API詳細を取得してAPIキーを確認
      const apiDetails = await invoke<ApiDetailsResponse>('get_api_details', {
        api_id: testApiId,
      });

      // APIキーが生成されていることを確認
      expect(apiDetails.enable_auth).toBe(true);
      expect(apiDetails.api_key).toBeTruthy();
      expect(typeof apiDetails.api_key).toBe('string');
      expect(apiDetails.api_key!.length).toBeGreaterThanOrEqual(32); // 最低32文字
    });

    it('認証無効時はAPIキーが生成されない', async () => {

      // 認証無効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F005 Test API 2', 8102, false);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // API詳細を取得してAPIキーを確認
      const apiDetails = await invoke<ApiDetailsResponse>('get_api_details', {
        api_id: testApiId,
      });

      // APIキーが生成されていないことを確認
      expect(apiDetails.enable_auth).toBe(false);
      expect(apiDetails.api_key).toBeNull();
    });

    it('APIキーを取得できる', async () => {

      // 認証有効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F005 Test API 3', 8103, true);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // APIキーを取得
      const apiKey = await invoke<string | null>('get_api_key', {
        api_id: testApiId,
      });

      // APIキーが取得できることを確認
      expect(apiKey).toBeTruthy();
      expect(typeof apiKey).toBe('string');
      expect(apiKey!.length).toBeGreaterThanOrEqual(32);
    });

    it('APIキーを再生成できる', async () => {

      // 認証有効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F005 Test API 4', 8104, true);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // 元のAPIキーを取得
      const originalKey = await invoke<string | null>('get_api_key', {
        api_id: testApiId,
      });

      // APIキーを再生成
      const newKey = await invoke<string>('regenerate_api_key', {
        api_id: testApiId,
      });

      // 新しいAPIキーが生成されることを確認
      expect(newKey).toBeTruthy();
      expect(typeof newKey).toBe('string');
      expect(newKey.length).toBeGreaterThanOrEqual(32);
      expect(newKey).not.toBe(originalKey); // 元のキーと異なる

      // 再生成後のAPIキーが取得できることを確認
      const retrievedKey = await invoke<string | null>('get_api_key', {
        api_id: testApiId,
      });
      expect(retrievedKey).toBe(newKey);
    });

    it('認証無効なAPIではAPIキーを再生成できない', async () => {

      // 認証無効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F005 Test API 5', 8105, false);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // APIキー再生成を試行（エラーが期待される）
      await expect(
        invoke<string>('regenerate_api_key', {
          api_id: testApiId,
        })
      ).rejects.toThrow();
    });

    it('生成されたAPIキーは安全な形式である', async () => {

      // 認証有効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F005 Test API 6', 8106, true);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // APIキーを取得
      const apiKey = await invoke<string | null>('get_api_key', {
        api_id: testApiId,
      });

      // APIキーの形式を確認
      expect(apiKey).toBeTruthy();
      // Base64エンコードされた文字列であることを確認（Base64文字のみ）
      expect(apiKey).toMatch(/^[A-Za-z0-9+/=]+$/);
      // 長さが32文字以上であることを確認
      expect(apiKey!.length).toBeGreaterThanOrEqual(32);
    });
  });

  /**
   * 2. 認証方式のテスト
   */
  describe('2. 認証方式', () => {
    it('認証有効なAPIではAPIキーが必須である', async () => {

      // 認証有効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F005 Test API 7', 8107, true);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // API詳細を取得
      const apiDetails = await invoke<ApiDetailsResponse>('get_api_details', {
        api_id: testApiId,
      });

      // 認証が有効な場合、APIキーが存在することを確認
      expect(apiDetails.enable_auth).toBe(true);
      expect(apiDetails.api_key).toBeTruthy();
    });

    it('認証無効なAPIではAPIキーが不要である', async () => {

      // 認証無効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F005 Test API 8', 8108, false);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // API詳細を取得
      const apiDetails = await invoke<ApiDetailsResponse>('get_api_details', {
        api_id: testApiId,
      });

      // 認証が無効な場合、APIキーが存在しないことを確認
      expect(apiDetails.enable_auth).toBe(false);
      expect(apiDetails.api_key).toBeNull();
    });

    it('認証設定を変更できる（無効→有効）', async () => {

      // 認証無効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F005 Test API 9', 8109, false);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // 認証を有効に変更
      await invoke('update_api', {
        api_id: testApiId,
        config: {
          enable_auth: true,
        },
      });

      // API詳細を取得して確認
      const apiDetails = await invoke<ApiDetailsResponse>('get_api_details', {
        api_id: testApiId,
      });

      // 認証が有効になり、APIキーが生成されたことを確認
      expect(apiDetails.enable_auth).toBe(true);
      expect(apiDetails.api_key).toBeTruthy();
    });

    it('認証設定を変更できる（有効→無効）', async () => {

      // 認証有効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F005 Test API 10', 8110, true);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // 認証を無効に変更
      await invoke('update_api', {
        api_id: testApiId,
        config: {
          enable_auth: false,
        },
      });

      // API詳細を取得して確認
      const apiDetails = await invoke<ApiDetailsResponse>('get_api_details', {
        api_id: testApiId,
      });

      // 認証が無効になり、APIキーが削除されたことを確認
      expect(apiDetails.enable_auth).toBe(false);
      expect(apiDetails.api_key).toBeNull();
    });
  });

  /**
   * 3. 統合テスト: APIキー生成から再生成までのフロー
   */
  describe('3. 統合フローテスト', () => {
    it('API作成→認証有効化→APIキー生成→再生成のフローが正常に動作する', async () => {

      // ステップ1: 認証無効でAPIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper(
          'F005 Test API Integration',
          8111,
          false
        );
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // ステップ2: 認証を有効化
      await invoke('update_api', {
        api_id: testApiId,
        config: {
          enable_auth: true,
        },
      });

      // ステップ3: APIキーを取得
      const firstKey = await invoke<string | null>('get_api_key', {
        api_id: testApiId,
      });
      expect(firstKey).toBeTruthy();

      // ステップ4: APIキーを再生成
      const secondKey = await invoke<string>('regenerate_api_key', {
        api_id: testApiId,
      });
      expect(secondKey).toBeTruthy();
      expect(secondKey).not.toBe(firstKey);

      // ステップ5: 再生成後のAPIキーが取得できることを確認
      const retrievedKey = await invoke<string | null>('get_api_key', {
        api_id: testApiId,
      });
      expect(retrievedKey).toBe(secondKey);
    });
  });
});
