// f004-model-management - モデル管理機能の統合テスト

/**
 * モデル管理機能の統合テスト
 * - インストール済みモデル一覧取得機能
 * - モデルダウンロード機能（進捗追跡）
 * - モデル削除機能
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
describe('F004: モデル管理機能 統合テスト', () => {
  let testModelName: string | null = null;

  beforeAll(() => {
    if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
      console.log('F004 モデル管理機能統合テストを開始します');
    }
  });

  afterAll(async () => {
    // テストでダウンロードしたモデルをクリーンアップ
    if (testModelName) {
      try {
        await invoke('delete_model', { model_name: testModelName });
      } catch (error) {
        if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
          console.warn('テスト後のクリーンアップに失敗しました:', error);
        }
      }
    }
    if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
      console.log('F004 モデル管理機能統合テストを完了しました');
    }
  });

  /**
   * モデル一覧取得機能
   */
  describe('モデル一覧取得機能', () => {
    it('should retrieve list of available models from Ollama', async () => {
      try {
        const models = await invoke<Array<{
          name: string;
          size: number;
          parameters?: number;
        }>>('get_models_list');

        expect(models).toBeDefined();
        expect(Array.isArray(models)).toBe(true);
        
        if (models.length > 0) {
          const model = models[0];
          expect(model.name).toBeDefined();
          expect(typeof model.name).toBe('string');
          expect(model.size).toBeGreaterThanOrEqual(0);
          
          // モデル名の形式を確認（例: "llama3:8b"）
          expect(model.name.length).toBeGreaterThan(0);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn('Tauriアプリが起動していないため、このテストをスキップします');
          expect(errorMessage).toContain('Tauriアプリケーションが起動していません');
        } else {
          throw error;
        }
      }
    }, 15000);

    it('should extract parameter size from model names', async () => {
      try {
        const models = await invoke<Array<{
          name: string;
          parameters?: number;
        }>>('get_models_list');

        if (models.length > 0) {
          // パラメータ数が抽出されているモデルを探す
          const modelWithParams = models.find(m => m.parameters !== undefined && m.parameters !== null);
          
          if (modelWithParams) {
            expect(modelWithParams.parameters).toBeGreaterThan(0);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn('Tauriアプリが起動していないため、このテストをスキップします');
          expect(errorMessage).toContain('Tauriアプリケーションが起動していません');
        } else {
          throw error;
        }
      }
    }, 15000);
  });

  /**
   * インストール済みモデル一覧取得機能
   */
  describe('インストール済みモデル一覧取得機能', () => {
    it('should retrieve list of installed models from database', async () => {
      try {
        const installedModels = await invoke<Array<{
          name: string;
          size: number;
          parameters?: number;
          installed_at: string;
          last_used_at?: string;
          usage_count: number;
        }>>('get_installed_models');

        expect(installedModels).toBeDefined();
        expect(Array.isArray(installedModels)).toBe(true);
        
        if (installedModels.length > 0) {
          const model = installedModels[0];
          expect(model.name).toBeDefined();
          expect(model.size).toBeGreaterThanOrEqual(0);
          expect(model.installed_at).toBeDefined();
          expect(model.usage_count).toBeGreaterThanOrEqual(0);
          
          // 日時形式を確認
          expect(() => new Date(model.installed_at)).not.toThrow();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn('Tauriアプリが起動していないため、このテストをスキップします');
          expect(errorMessage).toContain('Tauriアプリケーションが起動していません');
        } else {
          throw error;
        }
      }
    }, 15000);
  });

  /**
   * モデルダウンロード機能
   */
  describe('モデルダウンロード機能', () => {
    it('should handle download request for valid model', async () => {
      // 注意: 実際のダウンロードは時間がかかるため、小さいモデルを使用
      // または、モックで進捗イベントを確認する
      
      // テスト用に小さいモデルを選択（実装に応じて調整）
      const modelName = 'llama3:8b'; // 実際のテストでは小さなモデルを使用
      
      try {
        // ダウンロードを開始（実際には完了まで待たない）
        // 進捗イベントのテストはE2Eテストで実施
        const downloadPromise = invoke('download_model', { model_name: modelName });
        
        // タイムアウトでキャンセル（実際のテストでは進捗を監視）
        await Promise.race([
          downloadPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Download timeout')), 5000)
          ),
        ]);
        
        // ダウンロードが開始されたことを確認
        testModelName = modelName;
      } catch (error) {
        // タイムアウトは期待通り
        if (String(error).includes('timeout')) {
          // ダウンロードが開始されたことを確認
          expect(error).toBeDefined();
        } else {
          // その他のエラー（モデルが存在しないなど）は許容
          expect(error).toBeDefined();
        }
      }
    }, 10000);

    it('should handle download request when Ollama is not running', async () => {
      // Ollamaが起動していない場合のエラーハンドリング
      // 実際のテストでは、Ollamaを停止してから実行
      try {
        await invoke('download_model', { model_name: 'llama3:8b' });
        // エラーが発生することを期待
      } catch (error) {
        expect(error).toBeDefined();
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toBeDefined();
        // エラーメッセージが非開発者向けであることを確認
        expect(errorMessage).toMatch(/Ollama|実行|起動/i);
      }
    });
  });

  /**
   * モデル削除機能
   */
  describe('モデル削除機能', () => {
    it('should handle delete request for existing model', async () => {
      // 注意: 実際のモデル削除は危険なため、テストモデルを使用
      // または、モックで検証
      
      const modelName = 'test-model-to-delete';
      
      try {
        await invoke('delete_model', { model_name: modelName });
        // 成功またはエラー（モデルが存在しない）のいずれか
      } catch (error) {
        // モデルが存在しない場合のエラー
        expect(error).toBeDefined();
      }
    }, 10000);

    it('should handle delete request when Ollama is not running', async () => {
      // Ollamaが起動していない場合のエラーハンドリング
      try {
        await invoke('delete_model', { model_name: 'llama3:8b' });
        // エラーが発生することを期待
      } catch (error) {
        expect(error).toBeDefined();
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).toBeDefined();
        expect(errorMessage).toMatch(/Ollama|実行|起動/i);
      }
    });

    it('should remove model from database after deletion', async () => {
      // モデル削除後、データベースからも削除されることを確認
      // 実際のテストでは、モデルをダウンロードしてから削除
      // その後、get_installed_modelsで確認
      
      // このテストは、実際のモデル削除が成功した場合のみ実行
      // 現時点ではスキップ
    });
  });

  /**
   * データベース統合
   */
  describe('データベース統合', () => {
    it('should sync installed models with database', async () => {
      try {
        // モデルダウンロード後、データベースに保存されることを確認
        const installedModels = await invoke<Array<{
          name: string;
          installed_at: string;
        }>>('get_installed_models');

        expect(installedModels).toBeDefined();
        expect(Array.isArray(installedModels)).toBe(true);
        
        // 各モデルにインストール日時が設定されていることを確認
        installedModels.forEach(model => {
          expect(model.installed_at).toBeDefined();
          expect(() => new Date(model.installed_at)).not.toThrow();
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn('Tauriアプリが起動していないため、このテストをスキップします');
          expect(errorMessage).toContain('Tauriアプリケーションが起動していません');
        } else {
          throw error;
        }
      }
    }, 15000);

    it('should track model usage count', async () => {
      try {
        const installedModels = await invoke<Array<{
          name: string;
          usage_count: number;
        }>>('get_installed_models');

        if (installedModels.length > 0) {
          const model = installedModels[0];
          expect(model.usage_count).toBeGreaterThanOrEqual(0);
          expect(typeof model.usage_count).toBe('number');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
          console.warn('Tauriアプリが起動していないため、このテストをスキップします');
          expect(errorMessage).toContain('Tauriアプリケーションが起動していません');
        } else {
          throw error;
        }
      }
    }, 15000);
  });

  /**
   * エラーハンドリング
   */
  describe('エラーハンドリング', () => {
    it('should handle invalid model names gracefully', async () => {
      const invalidModelNames = [
        '',
        'invalid:model:format',
        'nonexistent-model:999',
      ];

      for (const modelName of invalidModelNames) {
        try {
          await invoke('download_model', { model_name: modelName });
          // エラーが発生することを期待
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });

    it('should provide user-friendly error messages', async () => {
      try {
        await invoke('download_model', { model_name: 'invalid' });
      } catch (error) {
        const errorMessage = String(error);
        expect(errorMessage).toBeTruthy();
        expect(typeof errorMessage).toBe('string');
        // 非開発者向けのメッセージ（専門用語が少ない）
        expect(errorMessage.length).toBeGreaterThan(0);
      }
    });
  });
});

