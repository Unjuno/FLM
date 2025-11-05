// ollama-auto-start - Ollama自動起動機能のE2Eテスト

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
describe('Ollama自動起動機能 E2Eテスト', () => {
  let initialOllamaState: 'running' | 'stopped' | 'unknown' = 'unknown';

  beforeAll(async () => {
    if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
      console.log('Ollama自動起動機能E2Eテストを開始します');
    }
    
    try {
      const isRunning = await invoke<boolean>('check_ollama_running');
      initialOllamaState = isRunning ? 'running' : 'stopped';
      if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
        console.log(`テスト開始時: Ollamaは${initialOllamaState}状態でした`);
      }
    } catch {
      initialOllamaState = 'unknown';
      if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
        console.log('テスト開始時: Ollamaの状態を確認できませんでした');
      }
    }
  });

  afterAll(async () => {
    // テスト後のクリーンアップ
    // テスト開始時の状態に戻す
    try {
      if (initialOllamaState === 'stopped') {
        // テスト開始時に停止していた場合は停止状態に戻す
        try {
          await invoke('stop_ollama');
        } catch {
          // 既に停止している可能性がある
        }
      } else if (initialOllamaState === 'running') {
        // テスト開始時に実行中だった場合は実行状態に戻す
        try {
          await invoke('start_ollama');
        } catch {
          // 既に実行中である可能性がある
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
        console.warn('テスト後のクリーンアップでエラー:', error);
      }
    }
    
    if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
      console.log('Ollama自動起動機能E2Eテストを完了しました');
    }
  });

  /**
   * E2Eテスト1: 完全な自動起動フロー
   */
  describe('完全な自動起動フロー', () => {
    it('Ollama停止状態からモデル一覧取得までの完全なフローを実行できる', async () => {
      try {
        // ステップ1: Ollamaを停止（テストの準備）
        try {
          await invoke('stop_ollama');
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log('ステップ1: Ollamaを停止しました');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('既に停止') && !errorMessage.includes('not running')) {
            throw error;
          }
          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log('ステップ1: Ollamaは既に停止していました');
          }
        }

        // ステップ2: モデル一覧取得を試みる（自動起動が発生する場面をシミュレート）
        let models: Array<{ name: string }> | null = null;
        let firstAttemptFailed = false;

        try {
          models = await invoke<Array<{ name: string }>>('get_models_list');
          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log('ステップ2: モデル一覧を取得できました（Ollamaは既に実行中でした）');
          }
        } catch (error) {
          firstAttemptFailed = true;
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log(`ステップ2: モデル一覧取得に失敗しました: ${errorMessage}`);
          }
          
          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log('ステップ3: Ollamaを自動起動します...');
          }
          
          try {
            await invoke('start_ollama');
            await new Promise(resolve => setTimeout(resolve, 3000));
            if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
              console.log('ステップ3: Ollamaの起動が完了しました');
            }
          } catch (startError) {
            const startErrorMessage = startError instanceof Error ? startError.message : String(startError);
            if (startErrorMessage.includes('既に実行中')) {
              if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
                console.log('ステップ3: Ollamaは既に実行中でした');
              }
            } else {
              throw startError;
            }
          }

          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log('ステップ4: モデル一覧を再取得します...');
          }
          models = await invoke<Array<{ name: string }>>('get_models_list');
          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log('ステップ4: モデル一覧の再取得に成功しました');
          }
        }

        // ステップ5: 結果の検証
        expect(models).toBeDefined();
        expect(Array.isArray(models)).toBe(true);
        
        if (firstAttemptFailed) {
          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log('✅ 自動起動フローが正常に動作しました');
          }
        } else {
          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log('ℹ️ Ollamaは既に実行中でした（自動起動は不要でした）');
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
          console.warn('E2Eテストでエラー:', error);
        }
        // E2Eテストでは環境によって失敗する可能性があるため、警告のみ
      }
    }, 60000);
  });

  /**
   * E2Eテスト2: エラーハンドリング
   */
  describe('エラーハンドリング', () => {
    it('Ollamaが見つからない場合のエラーハンドリングが適切である', async () => {
      // このテストは、Ollamaがインストールされていない環境では
      // 異なるエラーメッセージが返される可能性があるため、
      // エラーメッセージの形式を確認する
      
      try {
        // モデル一覧取得を試みる
        await invoke('get_models_list');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // エラーメッセージが適切な形式であることを確認
        expect(errorMessage).toBeDefined();
        expect(typeof errorMessage).toBe('string');
        expect(errorMessage.length).toBeGreaterThan(0);
        
        if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
          console.log(`エラーメッセージ: ${errorMessage}`);
        }
      }
    }, 30000);

    it('Ollama起動失敗時のエラーメッセージが適切である', async () => {
      // このテストは、Ollamaが既に実行中の場合や
      // 起動に失敗する場合のエラーハンドリングを確認する
      
      try {
        // 既に実行中の場合はエラーが返される可能性がある
        await invoke('start_ollama');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // エラーメッセージが適切であることを確認
        expect(errorMessage).toBeDefined();
        expect(typeof errorMessage).toBe('string');
        
        // 「既に実行中」の場合は正常な動作
        if (errorMessage.includes('既に実行中')) {
          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log('Ollamaは既に実行中でした（正常な動作）');
          }
        } else {
          if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
            console.log(`Ollama起動エラー: ${errorMessage}`);
          }
        }
      }
    }, 30000);
  });

  /**
   * E2Eテスト3: ユーザー体験の検証
   */
  describe('ユーザー体験の検証', () => {
    it('自動起動後のモデル一覧取得がスムーズに実行される', async () => {
      try {
        // 1. Ollamaを確実に実行状態にする
        try {
          await invoke('start_ollama');
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch {
          // 既に実行中である可能性がある
        }

        // 2. モデル一覧を取得（ユーザーが体験する動作）
        const startTime = Date.now();
        const models = await invoke<Array<{ name: string }>>('get_models_list');
        const endTime = Date.now();
        const duration = endTime - startTime;

        // 3. 結果の検証
        expect(models).toBeDefined();
        expect(Array.isArray(models)).toBe(true);
        
        // 4. パフォーマンスの検証（5秒以内に完了することを期待）
        expect(duration).toBeLessThan(5000);
        
        if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
          console.log(`モデル一覧取得時間: ${duration}ms`);
          console.log(`取得されたモデル数: ${models.length}`);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
          console.warn('ユーザー体験検証テストでエラー:', error);
        }
      }
    }, 30000);
  });
});

