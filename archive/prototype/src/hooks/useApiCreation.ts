// useApiCreation - API作成ロジックを管理するカスタムフック

import { useState, useCallback } from 'react';
import { safeInvoke, clearInvokeCache } from '../utils/tauri';
import { ENGINE_NAMES } from '../components/api/ModelSelection';
import { TIMEOUT } from '../constants/config';
import { logger } from '../utils/logger';
import { extractErrorMessage, toError } from '../utils/errorHandler';
import { delay } from '../utils/timeout';
import type {
  SelectedModel,
  ApiConfig,
  ApiCreationResult,
  ApiCreateRequest,
  ApiCreateResponse,
} from '../types/api';
import { listen } from '@tauri-apps/api/event';
import type { DownloadProgress } from '../types/ollama';

/**
 * API作成の進捗情報
 */
export interface CreationProgress {
  step: string;
  progress: number;
}

/**
 * API作成の状態
 */
export interface ApiCreationState {
  progress: CreationProgress;
  error: string | null;
  originalError: unknown;
  creationResult: ApiCreationResult | null;
}

/**
 * API作成ロジックを管理するカスタムフック
 */
export const useApiCreation = (
  selectedModel: SelectedModel | null,
  initialProgressStep: string = '初期化中...'
) => {
  const [progress, setProgress] = useState<CreationProgress>({
    step: initialProgressStep,
    progress: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [originalError, setOriginalError] = useState<unknown>(null);
  const [creationResult, setCreationResult] =
    useState<ApiCreationResult | null>(null);

  // API作成を開始
  const startApiCreation = useCallback(
    async (config: ApiConfig) => {
      if (!selectedModel) {
        setError('モデルが選択されていません');
        setOriginalError(new Error('モデルが選択されていません'));
        return;
      }

      try {
        const engineType = config.engineType || 'ollama';
        const engineName = ENGINE_NAMES[engineType] || engineType;

        setProgress({ step: `${engineName}確認中...`, progress: 0 });

        // Ollamaの場合、インストール進捗をリッスン
        let unlistenProgress: (() => void) | null = null;
        if (engineType === 'ollama') {
          try {
            unlistenProgress = await listen<DownloadProgress>(
              'ollama_download_progress',
              event => {
                const progressData = event.payload;
                if (
                  progressData.status === 'downloading' ||
                  progressData.status === 'extracting'
                ) {
                  const progressPercent = progressData.progress || 0;
                  setProgress({
                    step:
                      progressData.status === 'extracting'
                        ? 'Ollamaをインストール中...'
                        : `Ollamaをダウンロード中... (${Math.round(progressPercent)}%)`,
                    progress: Math.min(progressPercent, 90), // 最大90%まで（残りは起動処理）
                  });
                } else if (progressData.status === 'completed') {
                  setProgress({ step: 'Ollamaを起動中...', progress: 95 });
                }
              }
            );
          } catch (err) {
            logger.warn(
              'Ollama進捗イベントのリッスンに失敗',
              extractErrorMessage(err),
              'useApiCreation'
            );
          }
        }

        // ステップ1: エンジン確認
        setProgress({ step: `${engineName}確認中...`, progress: 20 });
        await delay(TIMEOUT.UI_UPDATE_DELAY); // UI更新のための短い待機

        // ステップ2: API設定保存中
        setProgress({ step: 'API設定を保存中...', progress: 40 });
        await delay(TIMEOUT.UI_UPDATE_DELAY);

        // ステップ3: 認証プロキシ起動中
        setProgress({ step: '認証プロキシ起動中...', progress: 60 });
        await delay(TIMEOUT.UI_UPDATE_DELAY);

        // engine_configを構築（既存のengineConfigとmodelParameters、multimodalをマージ）
        let engineConfigJson: string | null = null;

        // modelParameters、multimodal、またはengineConfigがある場合はマージして構築
        if (
          (config.modelParameters &&
            Object.keys(config.modelParameters).length > 0) ||
          (config.multimodal && Object.keys(config.multimodal).length > 0) ||
          config.engineConfig
        ) {
          try {
            // 既存のengineConfigをパース（存在する場合）
            const existingConfig = config.engineConfig
              ? JSON.parse(config.engineConfig)
              : {};

            // マージ設定を構築
            const mergedConfig: Record<string, unknown> = {
              ...existingConfig,
            };

            // modelParametersを追加
            if (
              config.modelParameters &&
              Object.keys(config.modelParameters).length > 0
            ) {
              mergedConfig.model_parameters = config.modelParameters;
            }

            // multimodal設定を追加
            if (
              config.multimodal &&
              Object.keys(config.multimodal).length > 0
            ) {
              mergedConfig.multimodal = config.multimodal;
            }

            engineConfigJson = JSON.stringify(mergedConfig);
          } catch (err) {
            logger.error('engine_configの構築に失敗', err, 'useApiCreation');
            // エラーが発生した場合は、基本的な設定のみを含める
            const fallbackConfig: Record<string, unknown> = {};
            if (
              config.modelParameters &&
              Object.keys(config.modelParameters).length > 0
            ) {
              fallbackConfig.model_parameters = config.modelParameters;
            }
            if (
              config.multimodal &&
              Object.keys(config.multimodal).length > 0
            ) {
              fallbackConfig.multimodal = config.multimodal;
            }
            engineConfigJson = JSON.stringify(fallbackConfig);
          }
        }

        // バックエンドに送信するデータを構築
        const apiCreatePayload: ApiCreateRequest = {
          name: config.name,
          model_name: selectedModel.name,
          port: config.port,
          enable_auth: config.enableAuth ?? true,
          engine_type: config.engineType || 'ollama',
        };

        // engine_configが存在する場合のみ追加（nullの場合は送信しない）
        if (engineConfigJson) {
          apiCreatePayload.engine_config = engineConfigJson;
        }

        // timeout_secsが設定されている場合のみ追加
        if (config.timeout_secs !== undefined && config.timeout_secs !== null) {
          apiCreatePayload.timeout_secs = config.timeout_secs;
        }

        // デバッグ: 送信するデータをログ出力（開発環境のみ）
        logger.debug('API作成 - 送信する設定:', {
          ...apiCreatePayload,
          engine_config: engineConfigJson,
          model_parameters: config.modelParameters,
          multimodal: config.multimodal,
          engine_config_length: engineConfigJson ? engineConfigJson.length : 0,
        });

        // バックエンドのIPCコマンドを呼び出し
        // Rust側のApiCreateConfig構造体と一致させる
        // Tauriコマンドは引数名を`config`として期待している
        const response = await safeInvoke<ApiCreateResponse>('create_api', {
          config: apiCreatePayload,
        });

        // レスポンスをApiCreationResultに変換
        const result: ApiCreationResult = {
          id: response.id,
          name: response.name,
          endpoint: response.endpoint,
          apiKey: response.api_key || undefined,
          port: response.port,
        };

        clearInvokeCache('list_apis');

        setProgress({ step: '完了', progress: 100 });
        await delay(300);

        setCreationResult(result);

        // API作成後に自動的に起動を試みる
        try {
          await safeInvoke('start_api', { apiId: result.id });
          logger.info('APIを自動起動しました', '', 'useApiCreation');
        } catch (startErr) {
          // 自動起動に失敗してもエラーを表示しない（ユーザーが手動で起動できる）
          logger.warn(
            'APIの自動起動に失敗しました（手動で起動できます）',
            extractErrorMessage(startErr),
            'useApiCreation'
          );
        }

        // 進捗イベントリスナーをクリーンアップ
        if (unlistenProgress) {
          try {
            unlistenProgress();
          } catch (cleanupErr) {
            logger.warn(
              '進捗イベントリスナーのクリーンアップエラー',
              String(cleanupErr),
              'useApiCreation'
            );
          }
        }
      } catch (err) {
        // エラーの詳細情報を取得（共通ヘルパー関数を使用）
        const errorMessage = extractErrorMessage(
          err,
          'API作成中にエラーが発生しました'
        );
        logger.error('API作成エラー', toError(err), 'useApiCreation');

        setError(errorMessage);
        setOriginalError(err);
      }
    },
    [selectedModel]
  );

  // エラーをクリア
  const clearError = useCallback(() => {
    setError(null);
    setOriginalError(null);
  }, []);

  // 進捗をリセット
  const resetProgress = useCallback((step: string = '初期化中...') => {
    setProgress({ step, progress: 0 });
  }, []);

  return {
    progress,
    error,
    originalError,
    creationResult,
    startApiCreation,
    clearError,
    resetProgress,
  };
};
