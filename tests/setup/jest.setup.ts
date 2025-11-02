/**
 * FLM - Jestセットアップファイル
 * 
 * フェーズ1: QAエージェント (QA) 実装
 * テスト実行前の初期化処理
 */

// Tauri APIが使用するwindowオブジェクトを提供
// Node環境とjsdom環境の両方に対応
if (typeof global !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalWindow = global as any;
  if (!globalWindow.window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalWindow.window = {} as any;
  }
  // Tauri APIが動作するために必要な最小限の構造を提供
  if (!globalWindow.window.__TAURI__) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalWindow.window.__TAURI__ = {} as any;
  }
}

// jsdom環境ではwindowが既に存在するため、それを使用
if (typeof window !== 'undefined' && !window.__TAURI__) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__TAURI__ = {} as any;
}

// グローバルなテスト設定
beforeAll(() => {
  // テスト実行前の初期化処理
  console.log('テスト環境を初期化しています...');
});

afterAll(() => {
  // テスト実行後のクリーンアップ処理
  console.log('テスト環境をクリーンアップしています...');
});

// タイムアウト設定（デフォルト: 5秒）
jest.setTimeout(10000);

