// tauri - Tauri環境の検出と安全なinvoke関数を提供

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { parseError, logError, ErrorCategory } from './errorHandler';
import { logger } from './logger';

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
    // エラーを解析してログに記録
    const errorInfo = parseError(error, ErrorCategory.API);
    logError(errorInfo, `safeInvoke:${cmd}`);
    
    // ユーザーフレンドリーなエラーをスロー
    throw new Error(errorInfo.message);
  }
}

/**
 * Tauri環境をチェックし、利用できない場合は警告を表示
 * 開発環境でのみ警告を出力します
 * @param featureName 機能名（エラーメッセージ用、デフォルト: 'この機能'）
 */
export function checkTauriEnvironment(featureName: string = 'この機能'): void {
  if (!isTauriAvailable()) {
    // 開発環境の判定: テスト環境とVite環境の両方で動作するようにprocess.envを使用
    // 注: Vite環境ではimport.meta.env.DEVが利用可能だが、Jest環境ではパースエラーになるため
    // process.env.NODE_ENVを使用（Viteは自動的にprocess.envを設定する）
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
    
    if (typeof window !== 'undefined' && isDev) {
      logger.warn(
        `${featureName}を使用するには、Tauriアプリケーションとして起動する必要があります。`,
        'tauri'
      );
    }
  }
}

