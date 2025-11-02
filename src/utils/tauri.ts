// FLM - Tauriユーティリティ
// Tauri環境の検出と安全なinvoke関数を提供

import { invoke as tauriInvoke } from '@tauri-apps/api/core';

/**
 * Tauri環境が利用可能かどうかをチェック
 * @returns Tauri環境が利用可能な場合はtrue
 */
export function isTauriAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI__' in window &&
    typeof window.__TAURI__ !== 'undefined' &&
    typeof tauriInvoke === 'function'
  );
}

/**
 * 安全にTauriのinvoke関数を呼び出す
 * Tauri環境が利用できない場合はエラーをスローする
 * 
 * @param cmd IPCコマンド名
 * @param args コマンド引数
 * @returns Promise<T> コマンドの戻り値
 * @throws Error Tauri環境が利用できない場合
 */
export async function safeInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isTauriAvailable()) {
    throw new Error(
      'アプリケーションが正しく起動していません。Tauriアプリケーションを再起動してください。'
    );
  }

  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (error) {
    // エラーメッセージをユーザーフレンドリーに変換
    if (error instanceof Error) {
      const message = error.message;
      
      // よくあるエラーをユーザーフレンドリーなメッセージに変換
      if (message.includes('command') || message.includes('not found')) {
        throw new Error(
          'この機能は現在利用できません。アプリケーションを再起動してください。'
        );
      }
      
      if (message.includes('database') || message.includes('SQL')) {
        throw new Error(
          'データベースエラーが発生しました。アプリケーションを再起動してください。'
        );
      }
    }
    
    throw error;
  }
}

/**
 * Tauri環境をチェックし、利用できない場合は警告を表示
 * @param featureName 機能名（エラーメッセージ用）
 */
export function checkTauriEnvironment(featureName: string = 'この機能'): void {
  if (!isTauriAvailable()) {
    console.warn(
      `${featureName}を使用するには、Tauriアプリケーションとして起動する必要があります。`
    );
  }
}

