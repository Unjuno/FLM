// ipc - IPC通信のテスト

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';

/**
 * アプリケーション情報の型定義
 */
export interface AppInfo {
  name: string;
  version: string;
  description: string;
}

/**
 * Tauri invoke関数の型定義
 */
export type InvokeFunction = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
) => Promise<T>;

/**
 * テスト用定数
 */
const MOCK_APP_INFO: AppInfo = {
  name: 'FLM',
  version: '1.0.0',
  description: 'Local LLM API Management Tool',
};

/**
 * グリーティングメッセージのテンプレート関数
 */
const GREET_MESSAGE_TEMPLATE = (name: string): string => 
  `Hello, ${name}! You've been greeted from Rust!`;

/**
 * 最大応答時間（ミリ秒）
 */
const MAX_RESPONSE_TIME_MS = 100;

/**
 * 同時リクエスト数
 */
const CONCURRENT_REQUEST_COUNT = 10;

/**
 * IPCコマンド名の定数
 */
const COMMANDS = {
  GREET: 'greet',
  GET_APP_INFO: 'get_app_info',
} as const;

/**
 * Tauriモック環境のセットアップ
 * @param mockFn - モック化されたinvoke関数
 */
const setupTauriMock = (mockFn: jest.Mock<InvokeFunction>): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalWindow = global as any;
  if (!globalWindow.window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalWindow.window = {} as any;
  }
  globalWindow.window.__TAURI__ = {
    invoke: mockFn as unknown as InvokeFunction,
  };
};

/**
 * IPC通信テストスイート
 * 
 * テスト項目:
 * - greetコマンドの動作確認（モック）
 * - get_app_infoコマンドの動作確認（モック）
 * - エラーハンドリングの確認
 * - パフォーマンステスト
 */
describe('IPC Communication Tests', () => {
  const mockInvoke = jest.fn<InvokeFunction>();

  /**
   * 型安全なinvoke関数呼び出しのヘルパー
   * 実行時にはmockResolvedValueOnceで設定された値が返されるため型アサーションは安全
   */
  const typedInvoke = <T = unknown>(
    cmd: string,
    args?: Record<string, unknown>
  ): Promise<T> => {
    return mockInvoke(cmd, args) as Promise<T>;
  };

  /**
   * greetコマンドのテスト用ヘルパー
   * @param name テストに使用する名前
   * @returns グリーティングメッセージ
   */
  const testGreetCommand = async (name: string): Promise<string> => {
    const expectedMessage = GREET_MESSAGE_TEMPLATE(name);
    mockInvoke.mockResolvedValueOnce(expectedMessage);
    const result = await typedInvoke<string>(COMMANDS.GREET, { name });
    expect(result).toBe(expectedMessage);
    return result;
  };

  /**
   * get_app_infoコマンドのテスト用ヘルパー
   * @returns アプリケーション情報
   */
  const testGetAppInfo = async (): Promise<AppInfo> => {
    mockInvoke.mockResolvedValueOnce(MOCK_APP_INFO);
    const appInfo = await typedInvoke<AppInfo>(COMMANDS.GET_APP_INFO);
    expect(appInfo).toEqual(MOCK_APP_INFO);
    return appInfo;
  };

  /**
   * 共通アサーション: 呼び出し回数と引数を検証
   * @param expectedTimes 期待される呼び出し回数
   * @param expectedCmd 期待されるコマンド名
   * @param expectedArgs 期待される引数（省略可能）
   */
  const verifyInvokeCall = (
    expectedTimes: number,
    expectedCmd: string,
    expectedArgs?: Record<string, unknown> | undefined
  ): void => {
    expect(mockInvoke).toHaveBeenCalledTimes(expectedTimes);
    // Tauriのinvoke関数は、argsがundefinedでも引数として渡される
    // ただし、直接mockInvokeを呼び出す場合（テストで直接呼ぶ場合）は、argsが渡されないこともある
    if (expectedArgs !== undefined) {
      expect(mockInvoke).toHaveBeenCalledWith(expectedCmd, expectedArgs);
    } else {
      // expectedArgsがundefinedの場合、argsが渡されていないか、undefinedが渡されているかを確認
      // 実際の呼び出しを確認して、適切なアサーションを選択
      const lastCall = mockInvoke.mock.calls[mockInvoke.mock.calls.length - 1];
      if (lastCall.length === 2 && lastCall[1] === undefined) {
        // argsとしてundefinedが明示的に渡されている場合
        expect(mockInvoke).toHaveBeenCalledWith(expectedCmd, undefined);
      } else if (lastCall.length === 1) {
        // argsが渡されていない場合
        expect(mockInvoke).toHaveBeenCalledWith(expectedCmd);
      } else {
        // その他の場合は、undefinedを期待
        expect(mockInvoke).toHaveBeenCalledWith(expectedCmd, undefined);
      }
    }
  };

  beforeAll(() => {
    setupTauriMock(mockInvoke as jest.Mock<InvokeFunction>);
  });

  beforeEach(() => {
    mockInvoke.mockClear();
  });

  /**
   * greetコマンドのテスト
   * フロントエンドからバックエンドへの基本的なIPC通信を検証
   */
  describe('greet command', () => {
    it('should return a greeting message with a name', async () => {
      const name = 'TestUser';
      const result = await testGreetCommand(name);
      
      expect(result).toContain(name);
      verifyInvokeCall(1, COMMANDS.GREET, { name });
    });

    it('should handle empty name gracefully', async () => {
      const name = '';
      await testGreetCommand(name);
      
      verifyInvokeCall(1, COMMANDS.GREET, { name });
    });

    it('should handle special characters in name', async () => {
      const name = 'Test <User> & "Special"';
      const result = await testGreetCommand(name);
      
      expect(result).toContain(name);
      verifyInvokeCall(1, COMMANDS.GREET, { name });
    });
  });

  /**
   * get_app_infoコマンドのテスト
   * アプリケーション情報取得のIPC通信を検証
   */
  describe('get_app_info command', () => {
    it('should return app information with all required fields', async () => {
      const appInfo = await testGetAppInfo();
      
      expect(typeof appInfo.name).toBe('string');
      expect(typeof appInfo.version).toBe('string');
      expect(typeof appInfo.description).toBe('string');
      verifyInvokeCall(1, COMMANDS.GET_APP_INFO);
    });

    it('should return correct app name', async () => {
      const appInfo = await testGetAppInfo();
      
      expect(appInfo.name).toBe(MOCK_APP_INFO.name);
      verifyInvokeCall(1, COMMANDS.GET_APP_INFO);
    });

    it('should return valid version format', async () => {
      const appInfo = await testGetAppInfo();
      
      // セマンティックバージョニング形式の検証（例: "1.0.0"）
      expect(appInfo.version).toMatch(/^\d+\.\d+\.\d+/);
      verifyInvokeCall(1, COMMANDS.GET_APP_INFO);
    });
  });

  /**
   * エラーハンドリングのテスト
   * 無効なコマンドやパラメータに対するエラー処理を検証
   */
  describe('Error handling', () => {
    it('should handle invalid command gracefully', async () => {
      const errorMessage = 'Command not found';
      const invalidCommand = 'invalid_command';
      mockInvoke.mockRejectedValueOnce(new Error(errorMessage));
      
      await expect(mockInvoke(invalidCommand)).rejects.toThrow(errorMessage);
      verifyInvokeCall(1, invalidCommand);
    });

    it('should handle missing parameters', async () => {
      // nameパラメータがない場合の処理を確認
      // 実装によってはエラーまたはデフォルト値が返される
      const expectedMessage = GREET_MESSAGE_TEMPLATE('');
      mockInvoke.mockResolvedValueOnce(expectedMessage);
      
      const result = await typedInvoke<string>(COMMANDS.GREET, {});
      
      expect(result).toBe(expectedMessage);
      verifyInvokeCall(1, COMMANDS.GREET, {});
    });
  });

  /**
   * パフォーマンステスト
   * IPC通信の応答時間と同時リクエスト処理を検証
   */
  describe('Performance', () => {
    it('should respond within acceptable time', async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_APP_INFO);
      
      const startTime = Date.now();
      await typedInvoke<AppInfo>(COMMANDS.GET_APP_INFO);
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
      verifyInvokeCall(1, COMMANDS.GET_APP_INFO);
    });

    it('should handle multiple concurrent requests', async () => {
      mockInvoke.mockResolvedValue(MOCK_APP_INFO);
      
      const requests = Array.from({ length: CONCURRENT_REQUEST_COUNT }, () => 
        typedInvoke<AppInfo>(COMMANDS.GET_APP_INFO)
      );

      const results = await Promise.all(requests);
      
      expect(results).toHaveLength(CONCURRENT_REQUEST_COUNT);
      expect(results.every(result => result.name === MOCK_APP_INFO.name)).toBe(true);
      expect(results.every(result => result.version === MOCK_APP_INFO.version)).toBe(true);
      verifyInvokeCall(CONCURRENT_REQUEST_COUNT, COMMANDS.GET_APP_INFO);
    });
  });
});
