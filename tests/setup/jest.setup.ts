// jest.setup - Jestセットアップファイル

// Tauri APIが使用するwindowオブジェクトを提供
// node環境でもwindowが利用可能になるように設定
// 注意: モジュール読み込み前に実行されるようにsetupFilesを使用する必要がある場合がある

// TextEncoder/TextDecoderのポリフィル（react-router-domなどで必要）
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// グローバルスコープでwindowを初期化
if (typeof global !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalWindow = global as any;
  if (!globalWindow.window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalWindow.window = {} as any;
  }
  // windowをglobalに直接設定（Tauriのinvoke関数がwindowを直接参照する場合に対応）
  if (!(global as any).window) {
    (global as any).window = globalWindow.window;
  }
  if (!globalWindow.window.__TAURI__) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalWindow.window.__TAURI__ = {} as any;
  }
  // Tauri 2.xでは__TAURI_INTERNALS__が必要（モジュール読み込み前に設定）
  if (!globalWindow.window.__TAURI_INTERNALS__) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalWindow.window.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: unknown, options?: unknown) => {
        // 統合テストでは実際のTauriアプリが必要なため、エラーをスロー
        // 実際のテスト実行時はTauriアプリが起動していることを前提とする
        throw new Error(
          `Tauriアプリケーションが起動していません。統合テストを実行するには、先にTauriアプリを起動してください。コマンド: ${cmd}`
        );
      },
    };
  }
}

// jsdom環境でも確実に設定
// 注意: tauri-mock.tsで既にモックが設定されている可能性があるため、
// 既存のモックがある場合は上書きしない
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windowObj = window as any;
  if (!windowObj.__TAURI__) {
    windowObj.__TAURI__ = {} as any;
  }
  // Tauri 2.xでは__TAURI_INTERNALS__が必要
  // 既存のモック（tauri-mock.tsで設定されたもの）がある場合は上書きしない
  if (!windowObj.__TAURI_INTERNALS__) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    windowObj.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: unknown, options?: unknown) => {
        // 実際のTauriアプリが起動している場合は、そのinvoke関数を使用
        if (windowObj.__TAURI__?.invoke) {
          return await windowObj.__TAURI__.invoke(cmd, args, options);
        }
        throw new Error(
          `Tauriアプリケーションが起動していません。統合テストを実行するには、先にTauriアプリを起動してください。コマンド: ${cmd}`
        );
      },
    };
  }
}
// beforeAllで再度設定（モジュール読み込み後の安全性確保）
beforeAll(() => {
  // windowと__TAURI_INTERNALS__を確実に設定
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const windowObj = window as any;
    if (!windowObj.__TAURI__) {
      windowObj.__TAURI__ = {} as any;
    }
    if (!windowObj.__TAURI_INTERNALS__) {
      windowObj.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args?: unknown, options?: unknown) => {
          // 実際のTauriアプリが起動している場合は、そのinvoke関数を使用
          if (windowObj.__TAURI__?.invoke) {
            return await windowObj.__TAURI__.invoke(cmd, args, options);
          }
          throw new Error(
            `Tauriアプリケーションが起動していません。統合テストを実行するには、先にTauriアプリを起動してください。コマンド: ${cmd}`
          );
        },
      };
    }
  }
  
  // globalThis.windowも設定（すべての環境で利用可能）
  if (typeof globalThis !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalWindow = globalThis as any;
    if (!globalWindow.window && typeof window !== 'undefined') {
      globalWindow.window = window;
    } else if (!globalWindow.window) {
      globalWindow.window = {} as any;
    }
    if (!globalWindow.window.__TAURI_INTERNALS__) {
      globalWindow.window.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args?: unknown, options?: unknown) => {
          throw new Error(
            `Tauriアプリケーションが起動していません。統合テストを実行するには、先にTauriアプリを起動してください。コマンド: ${cmd}`
          );
        },
      };
    }
  }
  
  if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
    console.log('テスト環境を初期化しています...');
  }
});

afterAll(() => {
  // テスト終了時にモックストレージをクリア（次のテストスイートのため）
  clearMockApiStorage();
  if (process.env.NODE_ENV === 'development' || process.env.JEST_DEBUG === '1') {
    console.log('テスト環境をクリーンアップしています...');
  }
});

// タイムアウト設定（デフォルト: 5秒）
jest.setTimeout(10000);

// ResizeObserverのモック（rechartsなどで使用される）
// jsdom環境ではResizeObserverが存在しないため、モックを提供
// モジュールレベルで設定して、すべてのテストで確実に利用可能にする
class MockResizeObserver {
  constructor(callback?: ResizeObserverCallback) {
    // コールバックを保持（必要に応じて）
  }
  observe(target: Element, options?: ResizeObserverOptions) {
    // モック実装：何もしない
  }
  unobserve(target: Element) {
    // モック実装：何もしない
  }
  disconnect() {
    // モック実装：何もしない
  }
}

// モジュールレベルで設定（すべてのテストファイルで利用可能）
if (typeof globalThis !== 'undefined') {
  (globalThis as any).ResizeObserver = MockResizeObserver;
}
if (typeof window !== 'undefined') {
  (window as any).ResizeObserver = MockResizeObserver;
}

// beforeAllでも設定（二重の安全策）
beforeAll(() => {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).ResizeObserver = MockResizeObserver;
  }
  if (typeof window !== 'undefined') {
    (window as any).ResizeObserver = MockResizeObserver;
  }
});

// jest-axeの設定
import '@testing-library/jest-dom';
import { clearMockApiStorage } from './tauri-mock';

// fetch APIのモック（jsdom環境ではデフォルトで提供されていない）
if (typeof globalThis.fetch === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    // モックレスポンスを返す
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
      json: async () => ({ error: { message: 'Unauthorized' } }),
      text: async () => JSON.stringify({ error: { message: 'Unauthorized' } }),
    } as Response;
    
    return Promise.resolve(mockResponse);
  };
}

// beforeAllでも設定（確実に利用可能にする）
beforeAll(() => {
  if (typeof globalThis.fetch === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: async () => ({ error: { message: 'Unauthorized' } }),
        text: async () => JSON.stringify({ error: { message: 'Unauthorized' } }),
      } as Response;
      
      return Promise.resolve(mockResponse);
    };
  }
  
  if (typeof window !== 'undefined' && typeof (window as any).fetch === 'undefined') {
    (window as any).fetch = globalThis.fetch;
  }
});

