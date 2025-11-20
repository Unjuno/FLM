// test-helpers - テスト用ヘルパー関数（統一版）
// 監査レポートの推奨事項に基づき、すべてのテストで使用可能な共通ヘルパー関数を提供

import { invoke } from '@tauri-apps/api/core';
import { expect } from '@jest/globals';

/**
 * Tauriアプリの可用性チェック
 * @returns Tauriアプリが利用可能な場合true、それ以外はfalse
 */
export const checkTauriAvailable = async (): Promise<boolean> => {
  try {
    await invoke('get_app_info');
    return true;
  } catch {
    return false;
  }
};

/**
 * テストのスキップヘルパー
 * Tauriアプリが起動していない場合にテストをスキップします
 * @param testFn - 実行するテスト関数
 */
export const skipIfTauriNotAvailable = (testFn: () => void | Promise<void>) => {
  return async () => {
    const isAvailable = await checkTauriAvailable();
    if (!isAvailable) {
      console.warn(
        'Tauriアプリが起動していないため、このテストをスキップします'
      );
      return;
    }
    await testFn();
  };
};

/**
 * マルチモーダル設定インターフェース
 */
export interface MultimodalConfig {
  enableVision?: boolean;
  enableAudio?: boolean;
  enableVideo?: boolean;
  maxImageSize?: number;
  maxAudioSize?: number;
  maxVideoSize?: number;
}

/**
 * API設定インターフェース
 */
export interface ApiConfig {
  name: string;
  model_name: string;
  port: number;
  enable_auth?: boolean;
  engine_type?: string;
  multimodal?: MultimodalConfig;
}

/**
 * API作成ヘルパー
 * @param config - API設定
 * @returns 作成されたAPIのID
 */
export const createTestApi = async (config: ApiConfig): Promise<string> => {
  const result = await invoke<{ id: string }>('create_api', { config });
  return result.id;
};

/**
 * カテゴリに応じたマルチモーダル設定を取得
 * @param category - モデルカテゴリ
 * @returns マルチモーダル設定（該当する場合）
 */
export const getMultimodalConfigForCategory = (
  category: string
): MultimodalConfig | null => {
  switch (category) {
    case 'image-generation':
      return {
        enableVision: true,
        maxImageSize: 10,
      };
    case 'video-generation':
      return {
        enableVideo: true,
        maxVideoSize: 100,
      };
    case 'audio-generation':
      return {
        enableAudio: true,
        maxAudioSize: 50,
      };
    case 'vision':
    case 'multimodal':
      return {
        enableVision: true,
        enableAudio: true,
        maxImageSize: 10,
        maxAudioSize: 50,
      };
    default:
      return null;
  }
};

/**
 * カテゴリ別のテスト用APIを作成
 * @param category - モデルカテゴリ
 * @param modelName - モデル名
 * @param port - ポート番号
 * @returns 作成されたAPIのID
 */
export const createTestApiForCategory = async (
  category: string,
  modelName: string,
  port: number
): Promise<string> => {
  const multimodalConfig = getMultimodalConfigForCategory(category);

  const config: ApiConfig = {
    name: `Test API - ${category} - ${modelName}`,
    model_name: modelName,
    port,
    enable_auth: true,
    engine_type: 'ollama',
    ...(multimodalConfig && { multimodal: multimodalConfig }),
  };

  return await createTestApi(config);
};

/**
 * APIクリーンアップヘルパー
 * @param apiIds - 削除するAPIのID配列
 */
export const cleanupTestApis = async (apiIds: string[]): Promise<void> => {
  for (const apiId of apiIds) {
    try {
      await invoke('stop_api', { api_id: apiId });
    } catch {
      // エラーは無視（既に停止している可能性がある）
    }
    try {
      await invoke('delete_api', { api_id: apiId });
    } catch {
      // エラーは無視（既に削除されている可能性がある）
    }
  }
};

/**
 * API起動待機ヘルパー（固定待機時間の代わり）
 * @param apiId - APIのID
 * @param timeout - タイムアウト時間（ミリ秒、デフォルト: 10000ms）
 * @throws タイムアウト時にエラーをスロー
 */
export const waitForApiStart = async (
  apiId: string,
  timeout = 10000
): Promise<void> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const details = await invoke<{ status: string }>('get_api_details', {
        api_id: apiId,
      });
      if (details.status === 'running') {
        return;
      }
    } catch {
      // エラーは無視（APIがまだ作成されていない可能性がある）
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`API ${apiId} が ${timeout}ms 以内に起動しませんでした`);
};

/**
 * API停止待機ヘルパー
 * @param apiId - APIのID
 * @param timeout - タイムアウト時間（ミリ秒、デフォルト: 10000ms）
 * @throws タイムアウト時にエラーをスロー
 */
export const waitForApiStop = async (
  apiId: string,
  timeout = 10000
): Promise<void> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const details = await invoke<{ status: string }>('get_api_details', {
        api_id: apiId,
      });
      if (details.status === 'stopped') {
        return;
      }
    } catch {
      // エラーは無視（APIが既に削除されている可能性がある）
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`API ${apiId} が ${timeout}ms 以内に停止しませんでした`);
};

/**
 * Tauriアプリが起動していない場合のエラーハンドリング
 * （既存のhelpers.tsから統合）
 * @param error - キャッチしたエラー
 * @returns エラーがTauriアプリ未起動の場合true、それ以外はfalse
 */
export function handleTauriAppNotRunningError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes('Tauriアプリケーションが起動していません')) {
    console.error('Tauriアプリが起動していないため、テストを継続できません');
    throw new Error(
      'Tauriアプリケーションが起動していません。テストを実行する前に `npm run tauri dev` でアプリを起動してください。'
    );
  }
  return false;
}

/**
 * 統合テストでinvokeを実行し、エラーを適切に処理する
 * （既存のhelpers.tsから統合）
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
