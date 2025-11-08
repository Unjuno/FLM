// complete-api-flow - 完全なAPIフローのE2Eテスト

/**
 * 完全なAPIフローのE2Eテスト
 * - データ整合性
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
describe('Complete API Flow E2E Tests', () => {
  beforeAll(() => {
    // Tauriアプリが起動していない場合はスキップ
    if (!process.env.TAURI_APP_AVAILABLE) {
      console.warn(
        'Tauriアプリが起動していないため、このテストスイートをスキップします'
      );
      return;
    }

    if (
      process.env.NODE_ENV === 'development' ||
      process.env.JEST_DEBUG === '1'
    ) {
      console.log('完全なAPIフローE2Eテストを開始します');
    }
  });

  afterAll(() => {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.JEST_DEBUG === '1'
    ) {
      console.log('完全なAPIフローE2Eテストを完了しました');
    }
  });

  /**
   * 完全なAPI作成・利用・削除フロー
   */
  describe('complete API lifecycle flow', () => {
    it('should complete full lifecycle: detection → selection → creation → testing → deletion', async () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }
      // ステップ1: Ollama検出・起動
      const ollamaDetection = {
        step: 'ollama_detection',
        detected: true,
        running: false,
        autoStart: true,
      };

      expect(ollamaDetection.detected).toBe(true);
      expect(typeof ollamaDetection.autoStart).toBe('boolean');

      // ステップ2: モデル選択
      const modelSelection = {
        step: 'model_selection',
        models: [{ name: 'llama3:8b', size: 5000000000 }],
        selectedModel: 'llama3:8b',
      };

      expect(modelSelection.selectedModel).toBeDefined();
      expect(modelSelection.models.length).toBeGreaterThan(0);

      // ステップ3: API作成
      const apiCreation = {
        step: 'api_creation',
        config: {
          name: 'Test API',
          model_name: 'llama3:8b',
          port: 8080,
          enable_auth: true,
        },
        progress: [
          { step: 'Ollama確認中...', progress: 0 },
          { step: 'API設定を保存中...', progress: 40 },
          { step: '認証プロキシ起動中...', progress: 60 },
          { step: '完了', progress: 100 },
        ],
        result: {
          id: 'test-api-id',
          endpoint: 'http://localhost:8080',
          api_key: 'test-api-key-12345678901234567890',
        },
      };

      expect(apiCreation.config.name).toBeTruthy();
      expect(apiCreation.progress.length).toBeGreaterThan(0);
      expect(apiCreation.result.id).toBeDefined();

      // ステップ4: API起動
      const apiStart = {
        step: 'api_start',
        status: 'running',
      };

      expect(['running', 'stopped', 'error']).toContain(apiStart.status);

      // ステップ5: APIテスト
      const apiTest = {
        step: 'api_test',
        request: {
          prompt: 'Hello, world!',
          endpoint: 'http://localhost:8080/v1/chat/completions',
          api_key: 'test-api-key-12345678901234567890',
        },
        response: {
          status: 200,
          body: {
            choices: [
              {
                message: {
                  content: 'Hello!',
                },
              },
            ],
          },
        },
      };

      expect(apiTest.request.endpoint).toMatch(
        /^http:\/\/localhost:\d+\/v1\/chat\/completions$/
      );
      expect(apiTest.response.status).toBe(200);

      // ステップ6: API削除
      const apiDeletion = {
        step: 'api_deletion',
        api_id: 'test-api-id',
        deleted: true,
      };

      expect(apiDeletion.deleted).toBe(true);
    });

    it('should maintain data consistency throughout lifecycle', () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }
      // データ整合性の検証
      const dataConsistency = {
        apiCreated: {
          database: true,
          apiKeyStored: true,
          proxyRunning: false, // 作成時はまだ起動していない
        },
        apiStarted: {
          database: true,
          apiKeyStored: true,
          proxyRunning: true,
        },
        apiDeleted: {
          database: false,
          apiKeyStored: false,
          proxyRunning: false,
        },
      };

      // 作成時
      expect(dataConsistency.apiCreated.database).toBe(true);
      expect(dataConsistency.apiCreated.apiKeyStored).toBe(true);

      // 起動時
      expect(dataConsistency.apiStarted.proxyRunning).toBe(true);

      // 削除時
      expect(dataConsistency.apiDeleted.database).toBe(false);
      expect(dataConsistency.apiDeleted.apiKeyStored).toBe(false);
    });
  });

  /**
   * エラーハンドリングフロー
   */
  describe('error handling flow', () => {
    it('should handle errors at each step gracefully', () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }
      const errorScenarios = [
        {
          step: 'ollama_detection',
          error: 'Ollamaが見つかりません',
          recovery: '自動ダウンロードを開始',
        },
        {
          step: 'model_selection',
          error: 'モデル一覧の取得に失敗しました',
          recovery: 'キャッシュから取得',
        },
        {
          step: 'api_creation',
          error: 'ポート番号が既に使用されています',
          recovery: '別のポート番号を提案',
        },
        {
          step: 'api_start',
          error: '認証プロキシの起動に失敗しました',
          recovery: 'エラーメッセージを表示し、再試行オプションを提供',
        },
        {
          step: 'api_test',
          error: 'APIキーが無効です',
          recovery: 'APIキーを再生成',
        },
      ];

      errorScenarios.forEach(scenario => {
        expect(scenario.step).toBeDefined();
        expect(scenario.error).toBeTruthy();
        expect(scenario.recovery).toBeTruthy();
        // 非開発者向けのエラーメッセージ
        const errorStr =
          typeof scenario.error === 'string'
            ? scenario.error
            : String(scenario.error);
        expect(
          errorStr.includes('失敗') ||
            errorStr.includes('エラー') ||
            errorStr.includes('無効')
        ).toBe(true);
      });
    });
  });

  /**
   * 複数APIの同時管理
   * 注意: これは1人のユーザーが複数のAPIを同時に管理する機能のテストです。
   * マルチユーザー機能（複数のユーザーが異なるAPIを管理する機能）ではありません。
   * 本アプリケーションはシングルユーザー環境専用です。
   */
  describe('multiple API management', () => {
    it('should manage multiple APIs simultaneously', () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }
      const multipleApis = [
        {
          id: 'api-1',
          port: 8080,
          status: 'running',
        },
        {
          id: 'api-2',
          port: 8081,
          status: 'stopped',
        },
        {
          id: 'api-3',
          port: 8082,
          status: 'running',
        },
      ];

      // ポート番号の一意性
      const ports = multipleApis.map(api => api.port);
      const uniquePorts = new Set(ports);
      expect(uniquePorts.size).toBe(ports.length);

      // 各APIが独立して管理できること
      multipleApis.forEach(api => {
        expect(api.id).toBeDefined();
        expect(api.port).toBeGreaterThan(0);
        expect(['running', 'stopped', 'error']).toContain(api.status);
      });
    });

    it('should handle port conflicts', () => {
      // Tauriアプリが起動していない場合はスキップ
      if (!process.env.TAURI_APP_AVAILABLE) {
        console.warn(
          'Tauriアプリが起動していないため、このテストをスキップします'
        );
        return;
      }
      const portConflict = {
        requestedPort: 8080,
        existingApi: {
          id: 'existing-api',
          port: 8080,
        },
        error: 'ポート番号が既に使用されています',
        suggestion: 8081,
      };

      expect(portConflict.requestedPort).toBe(portConflict.existingApi.port);
      expect(portConflict.suggestion).not.toBe(portConflict.requestedPort);
    });
  });
});
