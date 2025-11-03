/**
 * FLM - Ollama自動起動機能 ユニットテスト
 * 
 * フェーズ3: QAエージェント (QA) 実装
 * Ollama自動起動機能のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

/**
 * 自動起動ロジックのユニットテスト
 * 注意: Reactコンポーネントの完全なテストにはReact Testing Libraryが必要ですが、
 * ここではロジック部分のみをテストします
 */

/**
 * 自動起動エラー検出ロジックのテスト
 */
function isEngineNotRunningError(errorMessage: string, selectedEngine: string, engineName: string): boolean {
  const errorLower = errorMessage.toLowerCase();
  return (
    errorLower.includes(selectedEngine.toLowerCase()) ||
    errorLower.includes(engineName.toLowerCase()) ||
    errorLower.includes('接続') ||
    errorLower.includes('起動') ||
    errorLower.includes('実行されていません') ||
    errorLower.includes('実行中か確認') ||
    errorLower.includes('running') ||
    errorLower.includes('start') ||
    errorLower.includes('connection') ||
    errorLower.includes('aiエンジン')
  );
}

describe('Ollama自動起動機能 ユニットテスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * 自動起動ロジックのテスト（ModelSelectionコンポーネントのロジック）
   */
  describe('自動起動ロジック', () => {
    it('Ollamaが起動していないエラーを検出できる', () => {
      const errorMessages = [
        'Ollamaが起動していません',
        'ollama is not running',
        '接続できませんでした',
        'Ollamaが実行されていません',
        'Ollamaの実行中か確認できません',
        'connection failed',
        'start ollama',
        'aiエンジンが起動していません',
      ];

      const selectedEngine = 'ollama';
      const engineName = 'Ollama';

      errorMessages.forEach((errorMsg) => {
        const result = isEngineNotRunningError(errorMsg, selectedEngine, engineName);
        expect(result).toBe(true);
      });
    });

    it('Ollama以外のエンジンエラーは自動起動対象外', () => {
      const errorMessages = [
        'モデルが見つかりません',
        'Invalid port number',
        'Database error',
      ];

      const selectedEngine = 'ollama';
      const engineName = 'Ollama';

      errorMessages.forEach((errorMsg) => {
        const result = isEngineNotRunningError(errorMsg, selectedEngine, engineName);
        expect(result).toBe(false);
      });
    });

    it('エラー検出ロジックが様々なエラーメッセージ形式に対応できる', () => {
      const testCases = [
        { message: 'Ollamaが起動していません', expected: true },
        { message: 'Ollamaに接続できませんでした', expected: true },
        { message: 'Ollama is not running', expected: true },
        { message: 'Connection to Ollama failed', expected: true },
        { message: 'モデルが見つかりません', expected: false },
        { message: 'Invalid configuration', expected: false },
        { message: 'Port 8080 is already in use', expected: false },
      ];

      const selectedEngine = 'ollama';
      const engineName = 'Ollama';

      testCases.forEach(({ message, expected }) => {
        const result = isEngineNotRunningError(message, selectedEngine, engineName);
        expect(result).toBe(expected);
      });
    });

    it('自動起動条件の判定ロジックをテストする', () => {
      // 自動起動が実行される条件:
      // 1. selectedEngine === 'ollama'
      // 2. isEngineNotRunningError === true
      // 3. !autoStartAttemptedRef.current
      // 4. !isOllamaStarting

      const testCases = [
        {
          selectedEngine: 'ollama',
          errorMessage: 'Ollamaが起動していません',
          autoStartAttempted: false,
          isOllamaStarting: false,
          shouldAutoStart: true,
        },
        {
          selectedEngine: 'ollama',
          errorMessage: 'Ollamaが起動していません',
          autoStartAttempted: true, // 既に試行済み
          isOllamaStarting: false,
          shouldAutoStart: false,
        },
        {
          selectedEngine: 'ollama',
          errorMessage: 'Ollamaが起動していません',
          autoStartAttempted: false,
          isOllamaStarting: true, // 既に起動中
          shouldAutoStart: false,
        },
        {
          selectedEngine: 'lm_studio', // Ollama以外
          errorMessage: 'LM Studioが起動していません',
          autoStartAttempted: false,
          isOllamaStarting: false,
          shouldAutoStart: false,
        },
        {
          selectedEngine: 'ollama',
          errorMessage: 'モデルが見つかりません', // 起動エラーではない
          autoStartAttempted: false,
          isOllamaStarting: false,
          shouldAutoStart: false,
        },
      ];

      const engineName = 'Ollama';

      testCases.forEach(({ selectedEngine, errorMessage, autoStartAttempted, isOllamaStarting, shouldAutoStart }) => {
        const isEngineError = isEngineNotRunningError(errorMessage, selectedEngine, engineName);
        const actualShouldAutoStart = 
          selectedEngine === 'ollama' && 
          isEngineError && 
          !autoStartAttempted && 
          !isOllamaStarting;

        expect(actualShouldAutoStart).toBe(shouldAutoStart);
      });
    });
  });
});

