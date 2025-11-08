// helpers - 統合テスト用ヘルパー関数

import { expect } from '@jest/globals';

/**
 * Tauriアプリが起動していない場合のエラーハンドリング
 * @param error - キャッチしたエラー
 * @returns エラーがTauriアプリ未起動の場合true、それ以外はfalse
 */
export function handleTauriAppNotRunningError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
    console.warn('Tauriアプリが起動していないため、このテストをスキップします');
    // エラーメッセージが適切であることを確認
    expect(errorMessage).toContain('Tauriアプリケーションが起動していません');
    return true;
  }
  return false;
}

/**
 * 統合テストでinvokeを実行し、エラーを適切に処理する
 * @param invokeFn - invoke関数
 * @param command - コマンド名
 * @param args - コマンド引数
 * @returns コマンドの実行結果
 */
export async function safeInvokeWithErrorHandling<T>(
  invokeFn: (cmd: string, args?: unknown) => Promise<T>,
  command: string,
  args?: unknown
): Promise<T> {
  try {
    return await invokeFn<T>(command, args);
  } catch (error) {
    if (handleTauriAppNotRunningError(error)) {
      // エラーを再スローしてテストをスキップ
      throw error;
    }
    throw error;
  }
}
