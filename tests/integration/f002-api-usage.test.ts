// f002-api-usage - F002 API利用機能の統合テスト

/**
 * F002 API利用機能の統合テスト
 *
 * 仕様書: DOCKS/SPECIFICATION.md 2.1.2 API利用機能
 *
 * テスト項目:
 * 1. API一覧表示
 *    - 作成済みAPIのリスト表示
 *    - API名、ステータス（実行中/停止）、エンドポイントURL表示
 *    - 起動/停止ボタン
 * 2. APIテスト
 *    - テスト用のシンプルなチャットインターフェース
 *    - プロンプト入力欄
 *    - 送信ボタン
 *    - レスポンス表示エリア
 *    - タイムスタンプ、トークン数表示（オプション）
 * 3. API情報表示
 *    - エンドポイントURL
 *    - APIキー（存在する場合、表示/非表示切り替え）
 *    - サンプルコード（curl、Python、JavaScript）
 *    - 「コピー」ボタン
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import { cleanupTestApis, createTestApi, waitForApiStart, handleTauriAppNotRunningError } from '../setup/test-helpers';
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

describe('F002 API利用機能 統合テスト', () => {
  const createdApiIds: string[] = [];

  beforeAll(() => {
    debugLog('F002 API利用機能統合テストを開始します');
  });

  afterAll(async () => {
    // テストで作成したAPIをクリーンアップ
    await cleanupTestApis(createdApiIds);
    debugLog('F002 API利用機能統合テストを完了しました');
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
  const createTestApiHelper = async (name: string, port: number): Promise<string> => {
    try {
      const apiId = await createTestApi({
        name,
        model_name: 'llama3:8b',
        port,
        enable_auth: true,
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
   * 1. API一覧表示機能のテスト
   */
  describe('1. API一覧表示機能', () => {
    it('作成済みAPIのリストを取得できる', async () => {
      // テスト用APIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F002 Test API 1', 8081);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // API一覧を取得
      const apis = await invoke<ApiInfo[]>('list_apis');

      // 結果の検証
      expect(Array.isArray(apis)).toBe(true);
      expect(apis.length).toBeGreaterThan(0);

      // 作成したAPIが一覧に含まれていることを確認
      const createdApi = apis.find(api => api.id === testApiId);
      expect(createdApi).toBeDefined();
      expect(createdApi?.name).toBe('F002 Test API 1');
      expect(createdApi?.endpoint).toBe('http://localhost:8081');
    });

    it('API名、ステータス、エンドポイントURLが正しく表示される', async () => {
      // テスト用APIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F002 Test API 2', 8082);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // API一覧を取得
      const apis = await invoke<ApiInfo[]>('list_apis');
      const testApi = apis.find(api => api.id === testApiId);

      // 必須フィールドの存在確認
      expect(testApi).toBeDefined();
      expect(testApi?.name).toBeTruthy();
      expect(testApi?.status).toBeTruthy();
      expect(testApi?.endpoint).toBeTruthy();

      // ステータスの値が有効であることを確認
      expect(['running', 'stopped', 'error']).toContain(testApi?.status);

      // エンドポイントURLの形式を確認
      expect(testApi?.endpoint).toMatch(/^http:\/\/localhost:\d+$/);
    });

    it('複数のAPIを同時に管理できる', async () => {
      // 複数のテスト用APIを作成
      let apiId1: string, apiId2: string;
      try {
        apiId1 = await createTestApiHelper('F002 Test API 3', 8083);
        apiId2 = await createTestApiHelper('F002 Test API 4', 8084);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // API一覧を取得
      const apis = await invoke<ApiInfo[]>('list_apis');

      // 両方のAPIが一覧に含まれていることを確認
      const api1 = apis.find(api => api.id === apiId1);
      const api2 = apis.find(api => api.id === apiId2);

      expect(api1).toBeDefined();
      expect(api2).toBeDefined();
      expect(api1?.name).toBe('F002 Test API 3');
      expect(api2?.name).toBe('F002 Test API 4');
    });
  });

  /**
   * 2. API情報表示機能のテスト
   */
  describe('2. API情報表示機能', () => {
    it('API詳細情報を取得できる', async () => {
      // テスト用APIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F002 Test API 5', 8085);
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

      // 結果の検証
      expect(apiDetails).toBeDefined();
      expect(apiDetails.id).toBe(testApiId);
      expect(apiDetails.name).toBe('F002 Test API 5');
      expect(apiDetails.endpoint).toBe('http://localhost:8085');
      expect(apiDetails.model_name).toBeTruthy();
      expect(apiDetails.port).toBe(8085);
    });

    it('APIキーが正しく取得できる（認証有効時）', async () => {
      // テスト用APIを作成（認証有効）
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F002 Test API 6', 8086);
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

      // APIキーが存在することを確認
      expect(apiDetails.api_key).toBeTruthy();
      expect(typeof apiDetails.api_key).toBe('string');
      expect(apiDetails.api_key!.length).toBeGreaterThanOrEqual(32); // APIキーは32文字以上
    });

    it('エンドポイントURLが正しく表示される', async () => {
      // テスト用APIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F002 Test API 7', 8087);
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

      // エンドポイントURLの形式を確認
      expect(apiDetails.endpoint).toMatch(/^http:\/\/localhost:\d+$/);
      expect(apiDetails.endpoint).toBe(`http://localhost:${apiDetails.port}`);
    });

    it('存在しないAPI IDでエラーが発生する', async () => {
      // 存在しないAPI IDで詳細取得を試行
      await expect(
        invoke<ApiDetailsResponse>('get_api_details', {
          api_id: 'non-existent-api-id',
        })
      ).rejects.toThrow();
    });
  });

  /**
   * 3. APIテスト機能のテスト
   * 注意: 実際のAPIテスト（チャットインターフェース）はE2Eテストで確認
   * ここでは、APIテストに必要な情報取得をテスト
   */
  describe('3. APIテスト機能（情報取得）', () => {
    it('APIテストに必要な情報を取得できる', async () => {
      // テスト用APIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F002 Test API 8', 8088);
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

      // APIテストに必要な情報が揃っていることを確認
      expect(apiDetails.endpoint).toBeTruthy();
      expect(apiDetails.model_name).toBeTruthy();
      expect(apiDetails.api_key).toBeTruthy(); // 認証有効時

      // エンドポイントURLの形式を確認
      expect(apiDetails.endpoint).toMatch(/^http:\/\/localhost:\d+$/);
    });

    it('APIステータスが「running」の場合、テスト可能であることを確認', async () => {
      // テスト用APIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F002 Test API 9', 8089);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // APIを起動
      await invoke('start_api', { api_id: testApiId });

      // APIが起動するまで待機（固定待機時間の代わりに状態を待つ）
      await waitForApiStart(testApiId);

      // API詳細を取得
      const apiDetails = await invoke<ApiDetailsResponse>('get_api_details', {
        api_id: testApiId,
      });

      // ステータスが「running」であることを確認
      expect(apiDetails.status).toBe('running');
    });
  });

  /**
   * 4. 統合テスト: API一覧 → API詳細 → APIテストのフロー
   */
  describe('4. 統合フローテスト', () => {
    it('API一覧から詳細を取得し、テスト情報を表示できる', async () => {
      // ステップ1: テスト用APIを作成
      let testApiId: string;
      try {
        testApiId = await createTestApiHelper('F002 Test API Integration', 8090);
      } catch (error) {
        if (handleTauriAppNotRunningError(error)) {
          return;
        }
        throw error;
      }

      // ステップ2: API一覧を取得
      const apis = await invoke<ApiInfo[]>('list_apis');
      const testApi = apis.find(api => api.id === testApiId);
      expect(testApi).toBeDefined();

      // ステップ3: API詳細を取得
      const apiDetails = await invoke<ApiDetailsResponse>('get_api_details', {
        api_id: testApiId,
      });

      // ステップ4: APIテストに必要な情報が揃っていることを確認
      expect(apiDetails.endpoint).toBeTruthy();
      expect(apiDetails.model_name).toBeTruthy();
      expect(apiDetails.api_key).toBeTruthy();

      // ステップ5: 一覧と詳細の情報が一致することを確認
      expect(testApi?.name).toBe(apiDetails.name);
      expect(testApi?.endpoint).toBe(apiDetails.endpoint);
      expect(testApi?.status).toBe(apiDetails.status);
    });
  });
});
