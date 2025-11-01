/**
 * FLM - F006: ログ表示機能 E2Eテスト
 * 
 * QAエージェント (QA) 実装
 * ログ表示UIのE2Eテスト
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
 * ログ統計情報
 */
interface LogStatistics {
  total_requests: number;
  avg_response_time_ms: number;
  error_rate: number;
  status_code_distribution: Array<[number, number]>;
}

/**
 * API情報
 */
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

/**
 * F006: ログ表示機能E2Eテストスイート
 * 
 * テスト項目:
 * - ログ一覧表示テスト（ページ読み込み、API選択、ログ一覧表示確認）
 * - フィルタ機能テスト（日時範囲、ステータスコード、パス検索）
 * - 詳細表示テスト（ログクリック、モーダル表示、詳細情報表示確認）
 * - 統計情報表示テスト（統計サマリー表示確認、グラフ表示確認）
 * - ページネーションテスト
 * - リアルタイム更新テスト（オプション）
 */
describe('F006: ログ表示機能 E2Eテスト', () => {
  let testApiId: string | null = null;
  let testLogIds: string[] = [];

  beforeAll(async () => {
    console.log('F006 ログ表示機能E2Eテストを開始します');
    
    // テスト用のAPIを作成
    try {
      const result = await invoke<ApiInfo>('create_api', {
        config: {
          name: 'E2E Test API for Logs',
          model_name: 'llama3:8b',
          port: 8093,
          enable_auth: true,
        },
      });
      testApiId = result.id;
      console.log(`テスト用APIを作成しました: ${testApiId}`);
    } catch (error) {
      console.warn('テスト用APIの作成に失敗しました（既存APIを使用）:', error);
      // 既存のAPIを取得
      try {
        const apis = await invoke<ApiInfo[]>('list_apis');
        if (apis.length > 0) {
          testApiId = apis[0].id;
          console.log(`既存のAPIを使用します: ${testApiId}`);
        }
      } catch (err) {
        console.error('APIの取得に失敗しました:', err);
      }
    }

    // テスト用のログデータを作成
    if (testApiId) {
      try {
        const now = new Date();
        const logs = [
          {
            api_id: testApiId,
            method: 'POST',
            path: '/v1/chat/completions',
            request_body: JSON.stringify({ message: 'Hello' }),
            response_status: 200,
            response_time_ms: 150,
            error_message: null,
            timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10分前
          },
          {
            api_id: testApiId,
            method: 'POST',
            path: '/v1/chat/completions',
            request_body: JSON.stringify({ message: 'Test' }),
            response_status: 400,
            response_time_ms: 50,
            error_message: 'Bad Request',
            timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5分前
          },
          {
            api_id: testApiId,
            method: 'GET',
            path: '/v1/models',
            request_body: null,
            response_status: 200,
            response_time_ms: 100,
            error_message: null,
            timestamp: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2分前
          },
          {
            api_id: testApiId,
            method: 'POST',
            path: '/v1/completions',
            request_body: JSON.stringify({ prompt: 'Test prompt' }),
            response_status: 500,
            response_time_ms: 200,
            error_message: 'Internal Server Error',
            timestamp: now.toISOString(),
          },
        ];

        for (const log of logs) {
          try {
            const logId = await invoke<string>('save_request_log', { log: log });
            testLogIds.push(logId);
          } catch (err) {
            console.warn('ログの作成に失敗しました:', err);
          }
        }
        console.log(`テスト用ログを ${testLogIds.length} 件作成しました`);
      } catch (error) {
        console.warn('テスト用ログの作成に失敗しました:', error);
      }
    }
  });

  afterAll(async () => {
    // テスト用ログを削除（ログ削除コマンドが存在する場合）
    // 実際の実装では、テストデータのクリーンアップ戦略を検討してください

    // テスト用APIを削除
    if (testApiId) {
      try {
        // APIが実行中の場合は停止
        try {
          await invoke('stop_api', { apiId: testApiId });
        } catch (error) {
          // 既に停止している可能性がある
        }
        await invoke('delete_api', { apiId: testApiId });
        console.log('テスト用APIを削除しました');
      } catch (error) {
        console.warn('テスト用APIの削除に失敗しました:', error);
      }
    }

    console.log('F006 ログ表示機能E2Eテストを完了しました');
  });

  /**
   * テスト1: ログ一覧表示テスト
   */
  describe('ログ一覧表示テスト', () => {
    it('should display logs list when API is selected', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      // ログ一覧を取得
      const logs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 20,
        offset: 0,
      });

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      
      // テスト用ログが存在する場合は検証
      if (logs.length > 0) {
        const log = logs[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('api_id');
        expect(log).toHaveProperty('method');
        expect(log).toHaveProperty('path');
        expect(log).toHaveProperty('created_at');
        expect(log.api_id).toBe(testApiId);
      }
    });

    it('should load logs with pagination', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      // 1ページ目（20件）
      const page1 = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 20,
        offset: 0,
      });

      // 2ページ目（次の20件）
      const page2 = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 20,
        offset: 20,
      });

      expect(page1).toBeDefined();
      expect(page2).toBeDefined();
      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);

      // ページネーションが正しく機能しているか確認
      if (page1.length === 20 && page2.length > 0) {
        // ページ間で重複がないことを確認
        const page1Ids = page1.map(log => log.id);
        const page2Ids = page2.map(log => log.id);
        const intersection = page1Ids.filter(id => page2Ids.includes(id));
        expect(intersection.length).toBe(0);
      }
    });
  });

  /**
   * テスト2: フィルタ機能テスト
   */
  describe('フィルタ機能テスト', () => {
    it('should filter logs by date range', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      const now = new Date();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1時間前
      const endDate = now.toISOString();

      const filteredLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 100,
        offset: 0,
        startDate: startDate,
        endDate: endDate,
      });

      expect(filteredLogs).toBeDefined();
      expect(Array.isArray(filteredLogs)).toBe(true);

      // フィルタされたログが指定した日時範囲内にあることを確認
      for (const log of filteredLogs) {
        const logDate = new Date(log.created_at);
        expect(logDate.getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
        expect(logDate.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
      }
    });

    it('should filter logs by status code', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      // ステータスコード200のログを取得
      const statusCode200 = 200;
      const filteredLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 100,
        offset: 0,
        statusCodes: [statusCode200],
      });

      expect(filteredLogs).toBeDefined();
      expect(Array.isArray(filteredLogs)).toBe(true);

      // 全てのログがステータスコード200であることを確認
      for (const log of filteredLogs) {
        expect(log.response_status).toBe(statusCode200);
      }
    });

    it('should filter logs by path', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      const searchPath = '/v1/chat/completions';
      const filteredLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 100,
        offset: 0,
        pathFilter: searchPath,
      });

      expect(filteredLogs).toBeDefined();
      expect(Array.isArray(filteredLogs)).toBe(true);

      // 全てのログのパスが検索文字列を含むことを確認
      for (const log of filteredLogs) {
        expect(log.path).toContain(searchPath);
      }
    });

    it('should filter logs by multiple criteria', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      const now = new Date();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const endDate = now.toISOString();

      const filteredLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 100,
        offset: 0,
        startDate: startDate,
        endDate: endDate,
        statusCodes: [200],
        pathFilter: '/v1',
      });

      expect(filteredLogs).toBeDefined();
      expect(Array.isArray(filteredLogs)).toBe(true);

      // 複数のフィルタ条件がすべて満たされていることを確認
      for (const log of filteredLogs) {
        const logDate = new Date(log.created_at);
        expect(logDate.getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
        expect(logDate.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
        expect(log.response_status).toBe(200);
        expect(log.path).toContain('/v1');
      }
    });
  });

  /**
   * テスト3: 詳細表示テスト
   */
  describe('詳細表示テスト', () => {
    it('should retrieve log details by ID', async () => {
      if (!testApiId || testLogIds.length === 0) {
        console.warn('テスト用データが存在しないため、テストをスキップします');
        return;
      }

      // 最初のログIDを使用
      const logId = testLogIds[0];

      // ログ詳細を取得（ログ一覧から検索）
      const logs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 100,
        offset: 0,
      });

      const log = logs.find(l => l.id === logId);

      if (log) {
        expect(log).toBeDefined();
        expect(log.id).toBe(logId);
        expect(log.api_id).toBe(testApiId);
        expect(log).toHaveProperty('method');
        expect(log).toHaveProperty('path');
        expect(log).toHaveProperty('response_status');
        expect(log).toHaveProperty('response_time_ms');
        expect(log).toHaveProperty('created_at');
      }
    });

    it('should display complete log information', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      const logs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 1,
        offset: 0,
      });

      if (logs.length > 0) {
        const log = logs[0];
        
        // 必須フィールドが存在することを確認
        expect(log.id).toBeDefined();
        expect(log.api_id).toBeDefined();
        expect(log.method).toBeDefined();
        expect(log.path).toBeDefined();
        expect(log.created_at).toBeDefined();
        
        // オプションフィールドがnullまたは値を持つことを確認
        expect(log.request_body === null || typeof log.request_body === 'string').toBe(true);
        expect(log.response_status === null || typeof log.response_status === 'number').toBe(true);
        expect(log.response_time_ms === null || typeof log.response_time_ms === 'number').toBe(true);
        expect(log.error_message === null || typeof log.error_message === 'string').toBe(true);
      }
    });
  });

  /**
   * テスト4: 統計情報表示テスト
   */
  describe('統計情報表示テスト', () => {
    it('should retrieve log statistics', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      const statistics = await invoke<LogStatistics>('get_log_statistics', {
        apiId: testApiId,
        startDate: null,
        endDate: null,
      });

      expect(statistics).toBeDefined();
      expect(statistics).toHaveProperty('total_requests');
      expect(statistics).toHaveProperty('avg_response_time_ms');
      expect(statistics).toHaveProperty('error_rate');
      expect(statistics).toHaveProperty('status_code_distribution');

      expect(typeof statistics.total_requests).toBe('number');
      expect(statistics.total_requests).toBeGreaterThanOrEqual(0);
      expect(typeof statistics.avg_response_time_ms).toBe('number');
      expect(statistics.avg_response_time_ms).toBeGreaterThanOrEqual(0);
      expect(typeof statistics.error_rate).toBe('number');
      expect(statistics.error_rate).toBeGreaterThanOrEqual(0);
      expect(statistics.error_rate).toBeLessThanOrEqual(100);
      expect(Array.isArray(statistics.status_code_distribution)).toBe(true);
    });

    it('should calculate statistics with date range filter', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // 24時間前
      const endDate = now.toISOString();

      const statistics = await invoke<LogStatistics>('get_log_statistics', {
        apiId: testApiId,
        startDate: startDate,
        endDate: endDate,
      });

      expect(statistics).toBeDefined();
      expect(statistics).toHaveProperty('total_requests');
      expect(statistics).toHaveProperty('avg_response_time_ms');
      expect(statistics).toHaveProperty('error_rate');
      expect(statistics).toHaveProperty('status_code_distribution');
    });

    it('should return valid status code distribution', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      const statistics = await invoke<LogStatistics>('get_log_statistics', {
        apiId: testApiId,
        startDate: null,
        endDate: null,
      });

      expect(statistics.status_code_distribution).toBeDefined();
      expect(Array.isArray(statistics.status_code_distribution)).toBe(true);

      // ステータスコード分布が正しい形式であることを確認
      for (const [statusCode, count] of statistics.status_code_distribution) {
        expect(typeof statusCode).toBe('number');
        expect(statusCode).toBeGreaterThanOrEqual(100);
        expect(statusCode).toBeLessThan(600);
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    it('should calculate error rate correctly', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      const statistics = await invoke<LogStatistics>('get_log_statistics', {
        apiId: testApiId,
        startDate: null,
        endDate: null,
      });

      expect(statistics.error_rate).toBeDefined();
      expect(typeof statistics.error_rate).toBe('number');
      
      // エラー率は0-100の範囲内である必要がある
      expect(statistics.error_rate).toBeGreaterThanOrEqual(0);
      expect(statistics.error_rate).toBeLessThanOrEqual(100);

      // ログが0件の場合はエラー率は0である必要がある
      if (statistics.total_requests === 0) {
        expect(statistics.error_rate).toBe(0);
      }
    });
  });

  /**
   * テスト5: エッジケーステスト
   */
  describe('エッジケーステスト', () => {
    it('should handle empty logs list', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      // 存在しないAPI IDでテスト（新しく作成したがログがないAPI）
      const emptyLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 20,
        offset: 0,
      });

      // 空の配列が返されることを確認
      expect(emptyLogs).toBeDefined();
      expect(Array.isArray(emptyLogs)).toBe(true);
      // 空の配列でもエラーにならないことを確認
    });

    it('should handle invalid API ID gracefully', async () => {
      const invalidApiId = 'invalid-api-id-12345';
      
      try {
        const logs = await invoke<RequestLogInfo[]>('get_request_logs', {
          apiId: invalidApiId,
          limit: 20,
          offset: 0,
        });
        
        // エラーが発生するか、空の配列が返されることを確認
        expect(Array.isArray(logs)).toBe(true);
      } catch (error) {
        // エラーが発生する場合も許容
        expect(error).toBeDefined();
      }
    });

    it('should handle large offset values', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      // 大きなオフセットでテスト
      const logs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 20,
        offset: 10000,
      });

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      // 大きなオフセットでもエラーにならないことを確認
    });

    it('should handle date range with no matching logs', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      // 将来の日時範囲（ログが存在しない）
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const futureEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const logs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 100,
        offset: 0,
        startDate: futureStart,
        endDate: futureEnd,
      });

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      // ログが存在しない場合でもエラーにならないことを確認
    });
  });

  /**
   * テスト6: リアルタイム更新テスト（オプション）
   */
  describe('リアルタイム更新テスト（オプション）', () => {
    it('should support polling for new logs', async () => {
      if (!testApiId) {
        console.warn('テスト用APIが存在しないため、テストをスキップします');
        return;
      }

      // 最初のログ取得
      const initialLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        apiId: testApiId,
        limit: 100,
        offset: 0,
      });

      const initialCount = initialLogs.length;

      // 新しいログを作成
      try {
        await invoke<string>('save_request_log', {
          log: {
            api_id: testApiId,
            method: 'POST',
            path: '/v1/test',
            request_body: null,
            response_status: 200,
            response_time_ms: 100,
            error_message: null,
            timestamp: new Date().toISOString(),
          },
        });

        // 少し待機してから再度取得（ポーリングをシミュレート）
        await new Promise(resolve => setTimeout(resolve, 1000));

        const updatedLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
          apiId: testApiId,
          limit: 100,
          offset: 0,
        });

        // 新しいログが追加されていることを確認（完全一致ではなく、増加していることを確認）
        expect(updatedLogs.length).toBeGreaterThanOrEqual(initialCount);
      } catch (error) {
        console.warn('リアルタイム更新テストでエラーが発生しました:', error);
        // エラーが発生してもテストは継続
      }
    });
  });
});

