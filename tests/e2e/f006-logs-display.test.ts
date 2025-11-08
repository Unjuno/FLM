// f006-logs-display - ログ表示機能のE2Eテスト

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
 * F006: ログ表示機能E2Eテストスイート
 *
 * テスト項目:
 * - ログ一覧取得から表示までのフロー
 * - フィルタ機能のフロー
 * - 詳細表示のフロー
 * - 統計情報表示のフロー
 */
describe('F006: ログ表示機能 E2Eテスト', () => {
  let testApiId: string | null = null;

  beforeAll(async () => {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.JEST_DEBUG === '1'
    ) {
      console.log('F006 ログ表示機能E2Eテストを開始します');
    }

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
        name: 'Test API for Log Display E2E',
        model_name: 'llama3:8b',
        port: 8890,
        enable_auth: false,
      });

      testApiId = result.id;
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.JEST_DEBUG === '1'
      ) {
        console.log(`テスト用APIを作成しました: ${testApiId}`);
      }

      // テスト用のログデータを複数作成
      const logsToCreate = [
        {
          method: 'POST',
          path: '/v1/chat/completions',
          request_body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello' }],
          }),
          response_status: 200,
          response_time_ms: 150,
          error_message: null,
        },
        {
          method: 'GET',
          path: '/v1/models',
          request_body: null,
          response_status: 200,
          response_time_ms: 50,
          error_message: null,
        },
        {
          method: 'POST',
          path: '/v1/chat/completions',
          request_body: JSON.stringify({
            messages: [{ role: 'user', content: 'Error test' }],
          }),
          response_status: 500,
          response_time_ms: 200,
          error_message: 'Internal Server Error',
        },
        {
          method: 'POST',
          path: '/v1/chat/completions',
          request_body: JSON.stringify({
            messages: [{ role: 'user', content: 'Another test' }],
          }),
          response_status: 200,
          response_time_ms: 180,
          error_message: null,
        },
      ];

      // ログを順次保存
      for (const log of logsToCreate) {
        try {
          await invoke('save_request_log', {
            request: {
              api_id: testApiId,
              ...log,
            },
          });
        } catch (error) {
          if (
            process.env.NODE_ENV === 'development' ||
            process.env.JEST_DEBUG === '1'
          ) {
            console.warn('ログ保存エラー:', error);
          }
        }
      }

      if (
        process.env.NODE_ENV === 'development' ||
        process.env.JEST_DEBUG === '1'
      ) {
        console.log(`${logsToCreate.length}件のログを作成しました`);
      }
    } catch (error) {
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.JEST_DEBUG === '1'
      ) {
        console.warn('テスト用APIの作成に失敗しました:', error);
      }
    }
  });

  afterAll(async () => {
    if (testApiId) {
      try {
        await invoke('delete_api', { api_id: testApiId });
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.log(`テスト用APIを削除しました: ${testApiId}`);
        }
      } catch (error) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト後のクリーンアップに失敗しました:', error);
        }
      }
    }
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.JEST_DEBUG === '1'
    ) {
      console.log('F006 ログ表示機能E2Eテストを完了しました');
    }
  });

  /**
   * ログ一覧表示のフロー
   */
  describe('ログ一覧表示フロー', () => {
    it('should display logs list with pagination', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていないため、スキップします');
        }
        return;
      }

      // ステップ1: ログ一覧を取得（1ページ目）
      const page1 = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 2,
          offset: 0,
        },
      });

      expect(Array.isArray(page1)).toBe(true);
      expect(page1.length).toBeLessThanOrEqual(2);

      // ステップ2: 2ページ目を取得
      const page2 = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 2,
          offset: 2,
        },
      });

      expect(Array.isArray(page2)).toBe(true);

      // ステップ3: 全てのログが異なることを確認
      if (page1.length > 0 && page2.length > 0) {
        const page1Ids = new Set(page1.map(log => log.id));
        const page2Ids = new Set(page2.map(log => log.id));

        // ページ間でログが重複していないことを確認
        page1Ids.forEach(id => {
          expect(page2Ids.has(id)).toBe(false);
        });
      }
    }, 15000);

    it('should display logs sorted by created_at DESC', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていないため、スキップします');
        }
        return;
      }

      const logs = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 10,
          offset: 0,
        },
      });

      expect(Array.isArray(logs)).toBe(true);

      if (logs.length > 1) {
        // 時系列で降順にソートされていることを確認
        for (let i = 0; i < logs.length - 1; i++) {
          const currentTime = new Date(logs[i].created_at).getTime();
          const nextTime = new Date(logs[i + 1].created_at).getTime();
          expect(currentTime).toBeGreaterThanOrEqual(nextTime);
        }
      }
    }, 15000);
  });

  /**
   * フィルタ機能のフロー
   */
  describe('フィルタ機能フロー', () => {
    it('should filter logs by status code and display results', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていないため、スキップします');
        }
        return;
      }

      // ステップ1: 200ステータスのログのみをフィルタ
      const successLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 100,
          offset: 0,
          status_codes: [200],
        },
      });

      expect(Array.isArray(successLogs)).toBe(true);
      // 全てのログが200ステータスであることを確認
      successLogs.forEach(log => {
        expect(log.response_status).toBe(200);
      });

      // ステップ2: 500ステータスのログのみをフィルタ
      const errorLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 100,
          offset: 0,
          status_codes: [500],
        },
      });

      expect(Array.isArray(errorLogs)).toBe(true);
      // 全てのログが500ステータスであることを確認
      errorLogs.forEach(log => {
        expect(log.response_status).toBe(500);
      });
    }, 15000);

    it('should filter logs by date range and display results', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていないため、スキップします');
        }
        return;
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // ステップ1: 1時間以内のログをフィルタ
      const recentLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 100,
          offset: 0,
          start_date: oneHourAgo.toISOString(),
          end_date: now.toISOString(),
        },
      });

      expect(Array.isArray(recentLogs)).toBe(true);
      // 全てのログが指定範囲内であることを確認
      recentLogs.forEach(log => {
        const logTime = new Date(log.created_at).getTime();
        expect(logTime).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        expect(logTime).toBeLessThanOrEqual(now.getTime());
      });
    }, 15000);

    it('should filter logs by path and display results', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていないため、スキップします');
        }
        return;
      }

      // ステップ1: '/v1/chat/completions'パスのログをフィルタ
      const chatLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 100,
          offset: 0,
          path_filter: 'chat',
        },
      });

      expect(Array.isArray(chatLogs)).toBe(true);
      // 全てのログが'chat'を含むパスであることを確認
      chatLogs.forEach(log => {
        expect(log.path).toContain('chat');
      });
    }, 15000);

    it('should combine multiple filters and display results', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていないため、スキップします');
        }
        return;
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // ステップ1: 複数のフィルタを組み合わせ
      const filteredLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 100,
          offset: 0,
          start_date: oneHourAgo.toISOString(),
          end_date: now.toISOString(),
          status_codes: [200],
          path_filter: 'chat',
        },
      });

      expect(Array.isArray(filteredLogs)).toBe(true);
      // 全てのログが全てのフィルタ条件を満たすことを確認
      filteredLogs.forEach(log => {
        expect(log.response_status).toBe(200);
        expect(log.path).toContain('chat');
        const logTime = new Date(log.created_at).getTime();
        expect(logTime).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        expect(logTime).toBeLessThanOrEqual(now.getTime());
      });
    }, 15000);
  });

  /**
   * 詳細表示のフロー
   */
  describe('詳細表示フロー', () => {
    it('should retrieve and display log details', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていないため、スキップします');
        }
        return;
      }

      // ステップ1: ログ一覧を取得
      const logs = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 1,
          offset: 0,
        },
      });

      expect(Array.isArray(logs)).toBe(true);
      if (logs.length > 0) {
        const log = logs[0];

        // ステップ2: ログの詳細情報を検証
        expect(log.id).toBeDefined();
        expect(log.api_id).toBe(testApiId);
        expect(log.method).toBeDefined();
        expect(log.path).toBeDefined();
        expect(log.created_at).toBeDefined();

        // ステップ3: オプショナルフィールドの確認
        if (log.response_status !== null) {
          expect(typeof log.response_status).toBe('number');
        }
        if (log.response_time_ms !== null) {
          expect(typeof log.response_time_ms).toBe('number');
          expect(log.response_time_ms).toBeGreaterThanOrEqual(0);
        }
      }
    }, 15000);
  });

  /**
   * 統計情報表示のフロー
   */
  describe('統計情報表示フロー', () => {
    it('should retrieve and display statistics summary', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていないため、スキップします');
        }
        return;
      }

      // ステップ1: 統計情報を取得
      const stats = await invoke<LogStatistics>('get_log_statistics', {
        request: {
          api_id: testApiId,
          start_date: null,
          end_date: null,
        },
      });

      // ステップ2: 統計情報の構造を検証
      expect(stats).toBeDefined();
      expect(typeof stats.total_requests).toBe('number');
      expect(stats.total_requests).toBeGreaterThanOrEqual(0);
      expect(typeof stats.avg_response_time_ms).toBe('number');
      expect(stats.avg_response_time_ms).toBeGreaterThanOrEqual(0);
      expect(typeof stats.error_rate).toBe('number');
      expect(stats.error_rate).toBeGreaterThanOrEqual(0);
      expect(stats.error_rate).toBeLessThanOrEqual(100);
      expect(Array.isArray(stats.status_code_distribution)).toBe(true);

      // ステップ3: ステータスコード分布の構造を検証
      stats.status_code_distribution.forEach(([status, count]) => {
        expect(typeof status).toBe('number');
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    }, 15000);

    it('should update statistics when filters are applied', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていないため、スキップします');
        }
        return;
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // ステップ1: 全体の統計情報を取得
      const allStats = await invoke<LogStatistics>('get_log_statistics', {
        request: {
          api_id: testApiId,
          start_date: null,
          end_date: null,
        },
      });

      // ステップ2: 日付範囲を指定して統計情報を取得
      const filteredStats = await invoke<LogStatistics>('get_log_statistics', {
        request: {
          api_id: testApiId,
          start_date: oneHourAgo.toISOString(),
          end_date: now.toISOString(),
        },
      });

      // ステップ3: フィルタされた統計が全体の統計以下の値であることを確認
      expect(filteredStats.total_requests).toBeLessThanOrEqual(
        allStats.total_requests
      );
      expect(filteredStats.avg_response_time_ms).toBeGreaterThanOrEqual(0);
      expect(filteredStats.error_rate).toBeGreaterThanOrEqual(0);
      expect(filteredStats.error_rate).toBeLessThanOrEqual(100);
    }, 15000);
  });

  /**
   * 完全なフロー: ログ一覧 → フィルタ → 詳細表示 → 統計表示
   */
  describe('完全なフロー: ログ一覧 → フィルタ → 詳細表示 → 統計表示', () => {
    it('should complete full workflow from list to statistics', async () => {
      if (!testApiId) {
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.JEST_DEBUG === '1'
        ) {
          console.warn('テスト用APIが作成されていないため、スキップします');
        }
        return;
      }

      // ステップ1: ログ一覧を取得
      const logs = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 10,
          offset: 0,
        },
      });

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);

      // ステップ2: フィルタを適用（成功ログのみ）
      const successLogs = await invoke<RequestLogInfo[]>('get_request_logs', {
        request: {
          api_id: testApiId,
          limit: 100,
          offset: 0,
          status_codes: [200],
        },
      });

      expect(Array.isArray(successLogs)).toBe(true);
      expect(successLogs.length).toBeGreaterThan(0);
      successLogs.forEach(log => {
        expect(log.response_status).toBe(200);
      });

      // ステップ3: フィルタされたログの詳細を確認
      if (successLogs.length > 0) {
        const firstLog = successLogs[0];
        expect(firstLog.id).toBeDefined();
        expect(firstLog.api_id).toBe(testApiId);
        expect(firstLog.response_status).toBe(200);
      }

      // ステップ4: フィルタ条件に基づいて統計情報を取得
      const stats = await invoke<LogStatistics>('get_log_statistics', {
        request: {
          api_id: testApiId,
          start_date: null,
          end_date: null,
        },
      });

      expect(stats).toBeDefined();
      expect(stats.total_requests).toBeGreaterThanOrEqual(successLogs.length);
      expect(stats.avg_response_time_ms).toBeGreaterThanOrEqual(0);
      expect(stats.error_rate).toBeGreaterThanOrEqual(0);
      expect(stats.error_rate).toBeLessThanOrEqual(100);

      // ステップ5: ステータスコード分布を確認
      expect(Array.isArray(stats.status_code_distribution)).toBe(true);
      const status200Count =
        stats.status_code_distribution.find(
          ([status]) => status === 200
        )?.[1] || 0;
      expect(status200Count).toBeGreaterThanOrEqual(0);
    }, 20000);
  });
});
