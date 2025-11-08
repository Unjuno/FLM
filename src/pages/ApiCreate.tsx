// ApiCreate - API作成ページ

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { safeInvoke } from '../utils/tauri';
import { ModelSelection, ENGINE_NAMES } from '../components/api/ModelSelection';
import { ApiConfigForm } from '../components/api/ApiConfigForm';
import { ApiCreationProgress } from '../components/api/ApiCreationProgress';
import { ApiCreationSuccess } from '../components/api/ApiCreationSuccess';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useOllamaDetection, useOllamaProcess } from '../hooks/useOllama';
import { useI18n } from '../contexts/I18nContext';
import { TIMEOUT } from '../constants/config';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import type {
  SelectedModel,
  ApiConfig,
  ApiCreationResult,
  ApiCreateRequest,
  ApiCreateResponse,
} from '../types/api';
import { listen } from '@tauri-apps/api/event';
import type { DownloadProgress } from '../types/ollama';
import './ApiCreate.css';

/**
 * API作成ウィザードのステップ
 */
enum CreationStep {
  ModelSelection = 'model',
  Configuration = 'config',
  Progress = 'progress',
  Success = 'success',
}

/**
 * API作成ページ
 * ステップバイステップでAPIを作成します
 */
export const ApiCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState<CreationStep>(
    CreationStep.ModelSelection
  );
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(
    null
  );
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    name: 'LocalAI API',
    port: 8080,
    enableAuth: true,
    engineType: 'ollama',
  });
  const [creationResult, setCreationResult] =
    useState<ApiCreationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [originalError, setOriginalError] = useState<unknown>(null);
  const [progress, setProgress] = useState<{ step: string; progress: number }>({
    step: t('apiCreate.initializing'),
    progress: 0,
  });
  const [quickCreate, setQuickCreate] = useState(false);
  const [pendingApiCreation, setPendingApiCreation] =
    useState<ApiConfig | null>(null);

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.apiList') || 'API一覧', path: '/api/list' },
    { label: t('apiCreate.title') || '新しいAPIを作成' },
  ], [t]);

  // location.stateの処理済み状態を追跡（重複実行を防ぐ）
  const processedStateRef = useRef<string | null>(null);
  const { status, detect } = useOllamaDetection();
  const { start } = useOllamaProcess();
  const isMountedRef = useRef(true);
  const isAutoStartingRef = useRef(false);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      isAutoStartingRef.current = false;
    };
  }, []);

  // API作成画面に遷移した時に自動的にOllamaを検出
  useEffect(() => {
    const detectOllama = async () => {
      try {
        await detect();
      } catch (err) {
        logger.warn(
          'Ollama検出に失敗しました',
          extractErrorMessage(err),
          'ApiCreate'
        );
      }
    };

    detectOllama();
  }, [detect]);

  // statusが更新されたら、Ollamaが起動していない場合は自動起動
  useEffect(() => {
    const ensureOllamaRunning = async () => {
      if (!status) {
        isAutoStartingRef.current = false;
        return;
      }

      if (status.running) {
        isAutoStartingRef.current = false;
        return;
      }

      if (!status.installed && !status.portable) {
        isAutoStartingRef.current = false;
        return;
      }

      if (isAutoStartingRef.current) {
        return;
      }

      isAutoStartingRef.current = true;

      if (isMountedRef.current) {
        setProgress({ step: 'Ollamaを起動中...', progress: 10 });
      }

      try {
        await start();
        await detect();
        logger.info('Ollamaを自動起動しました', 'ApiCreate');
      } catch (startErr) {
        logger.warn(
          'Ollamaの自動起動に失敗しました',
          startErr instanceof Error ? startErr.message : String(startErr),
          'ApiCreate'
        );
      } finally {
        isAutoStartingRef.current = false;
      }
    };

    ensureOllamaRunning();
  }, [status, start, detect]);

  // API作成を開始（useCallbackでメモ化してuseEffectで使用可能にする）
  const startApiCreation = useCallback(
    async (config: ApiConfig) => {
      if (!selectedModel) {
        setError('モデルが選択されていません');
        setOriginalError(new Error('モデルが選択されていません'));
        setCurrentStep(CreationStep.ModelSelection);
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
              String(err),
              'ApiCreate'
            );
          }
        }

        // ステップ1: エンジン確認
        setProgress({ step: `${engineName}確認中...`, progress: 20 });
        await new Promise(resolve =>
          setTimeout(resolve, TIMEOUT.UI_UPDATE_DELAY)
        ); // UI更新のための短い待機

        // ステップ2: API設定保存中
        setProgress({ step: 'API設定を保存中...', progress: 40 });
        await new Promise(resolve =>
          setTimeout(resolve, TIMEOUT.UI_UPDATE_DELAY)
        );

        // ステップ3: 認証プロキシ起動中
        setProgress({ step: '認証プロキシ起動中...', progress: 60 });
        await new Promise(resolve =>
          setTimeout(resolve, TIMEOUT.UI_UPDATE_DELAY)
        );

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
            logger.error('engine_configの構築に失敗', err, 'ApiCreate');
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
        const response = await safeInvoke<ApiCreateResponse>(
          'create_api',
          { config: apiCreatePayload }
        );

        // レスポンスをApiCreationResultに変換
        const result: ApiCreationResult = {
          id: response.id,
          name: response.name,
          endpoint: response.endpoint,
          apiKey: response.api_key || undefined,
          port: response.port,
        };

        setProgress({ step: '完了', progress: 100 });
        await new Promise(resolve => setTimeout(resolve, 300));

        setCreationResult(result);
        setCurrentStep(CreationStep.Success);

        // 進捗イベントリスナーをクリーンアップ
        if (unlistenProgress) {
          try {
            unlistenProgress();
          } catch (cleanupErr) {
            logger.warn(
              '進捗イベントリスナーのクリーンアップエラー',
              String(cleanupErr),
              'ApiCreate'
            );
          }
        }
      } catch (err) {
        // エラーの詳細情報を取得（共通ヘルパー関数を使用）
        const errorMessage = extractErrorMessage(err, 'API作成中にエラーが発生しました');
        logger.error('API作成エラー', err instanceof Error ? err : new Error(extractErrorMessage(err)), 'ApiCreate');

        setError(errorMessage);
        setOriginalError(err);
        setCurrentStep(CreationStep.Configuration);
        setQuickCreate(false); // クイック作成モードを解除
      }
    },
    [selectedModel]
  );

  // クイック作成モードとモデル選択の処理
  useEffect(() => {
    interface LocationState {
      quickCreate?: boolean;
      recommendedModel?: string;
      selectedModelName?: string;
      selectedModel?: SelectedModel;
      engineType?: string;
    }
    const state = location.state as LocationState | null | undefined;

    // stateが存在しない場合は何もしない
    if (!state) {
      processedStateRef.current = null;
      return;
    }

    // stateを文字列化して処理済みかチェック（重複実行を防ぐ）
    const stateKey = JSON.stringify(state);
    if (processedStateRef.current === stateKey) {
      return; // 既に処理済み
    }
    processedStateRef.current = stateKey;

    // クイック作成モードの場合
    if (state.quickCreate && state.recommendedModel) {
      setQuickCreate(true);
      // 推奨モデルを使用して直接API作成を開始
      const modelName = state.recommendedModel;
      const selectedModelData: SelectedModel = {
        name: modelName,
      };
      setSelectedModel(selectedModelData);

      // デフォルト設定でAPIを作成
      const defaultConfig: ApiConfig = {
        name: `API ${new Date().toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
        port: 8080,
        enableAuth: true,
        engineType: 'ollama',
      };
      setApiConfig(defaultConfig);
      setCurrentStep(CreationStep.Progress);
      // selectedModelが設定されるまで待機するため、pendingApiCreationに保存
      // setSelectedModelの後にpendingApiCreationを設定することで、確実に順序を保つ
      setPendingApiCreation(defaultConfig);
      return;
    }

    // システムチェックからモデルが選択された場合
    if (state.selectedModelName) {
      const modelName = state.selectedModelName;
      const selectedModelData: SelectedModel = {
        name: modelName,
      };
      setSelectedModel(selectedModelData);
      setCurrentStep(CreationStep.Configuration);
      return;
    }

    // モデル管理ページから戻ってきた場合
    if (state.selectedModel) {
      const model = state.selectedModel as SelectedModel;
      setSelectedModel(model);
      setCurrentStep(CreationStep.Configuration);
      setError(null);
      setOriginalError(null);

      // エンジンタイプも設定されていれば反映
      if (state.engineType) {
        setApiConfig(prev => ({ ...prev, engineType: state.engineType }));
      }
      return;
    }

    // エンジンタイプのみが設定されている場合（戻るボタンで戻ってきた場合）
    if (state.engineType) {
      setApiConfig(prev => ({ ...prev, engineType: state.engineType }));
    }
  }, [location.state]);

  // location.pathnameが変更されたとき、処理済み状態をリセット
  useEffect(() => {
    processedStateRef.current = null;
  }, [location.pathname]);

  // selectedModelが設定され、pendingApiCreationがある場合にAPI作成を開始
  useEffect(() => {
    // selectedModelとpendingApiCreationの両方が設定されていることを確認
    if (pendingApiCreation && selectedModel && selectedModel.name) {
      const config = pendingApiCreation;
      // pendingApiCreationを先にクリアして、二重実行を防ぐ
      setPendingApiCreation(null);

      // startApiCreationを非同期で実行
      // エラーが発生した場合は、エラー状態を設定して設定画面に戻る
      startApiCreation(config).catch(err => {
        logger.error('API作成の開始に失敗', err, 'ApiCreate');
        const errorMessage = extractErrorMessage(err, 'API作成の開始に失敗しました');
        setError(errorMessage);
        setOriginalError(err);
        setCurrentStep(CreationStep.Configuration);
        setQuickCreate(false); // クイック作成モードを解除
      });
    }
  }, [selectedModel, pendingApiCreation, startApiCreation]);

  // モデル選択完了時のハンドラ
  const handleModelSelected = (model: SelectedModel) => {
    setSelectedModel(model);
    setCurrentStep(CreationStep.Configuration);
    setError(null);
    setOriginalError(null);
  };

  // 設定完了時のハンドラ
  const handleConfigSubmit = (config: ApiConfig) => {
    setApiConfig(config);
    setCurrentStep(CreationStep.Progress);
    setError(null);
    setOriginalError(null);
    startApiCreation(config);
  };

  // 戻るボタンのハンドラ（常にホームに戻る）
  // ホーム中心のナビゲーションに合わせて、どのステップからでもホームに戻れるようにする
  const handleBack = () => {
    navigate('/');
    setError(null);
    setOriginalError(null);
  };

  // 成功画面でホームに戻る
  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <AppLayout>
      <div className="api-create-page">
        <div className="page-container api-create-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header api-create-header">
            <button className="back-button" onClick={handleBack}>
              ← 戻る
            </button>
            <h1>新しいAPIを作成</h1>
            <div className="step-indicator">
              <span
                className={
                  currentStep === CreationStep.ModelSelection
                    ? 'active'
                    : currentStep === CreationStep.Configuration ||
                        currentStep === CreationStep.Progress ||
                        currentStep === CreationStep.Success
                      ? 'completed'
                      : ''
                }
              >
                1. モデル選択
              </span>
              <span
                className={
                  currentStep === CreationStep.Configuration
                    ? 'active'
                    : currentStep === CreationStep.Progress ||
                        currentStep === CreationStep.Success
                      ? 'completed'
                      : ''
                }
              >
                2. 設定
              </span>
              <span
                className={
                  currentStep === CreationStep.Progress
                    ? 'active'
                    : currentStep === CreationStep.Success
                      ? 'completed'
                      : ''
                }
              >
                3. 作成中
              </span>
              <span
                className={currentStep === CreationStep.Success ? 'active' : ''}
              >
                4. 完了
              </span>
            </div>
          </header>

          <div className="api-create-content">
            {/* 初回ユーザー向けガイダンス */}
            {currentStep === CreationStep.ModelSelection && (
              <InfoBanner
                type="tip"
                title="初めての方へ"
                message="推奨モデルから始めることをおすすめします。チャット用途にはllama3やmistral、コード生成にはcodellamaが適しています。"
                dismissible
              />
            )}

            {currentStep === CreationStep.Configuration && (
              <InfoBanner
                type="info"
                title="設定について"
                message="ポート番号は他のアプリケーションと重複しない番号を選択してください。認証を有効にすると、APIキーが必要になります。"
                dismissible
              />
            )}

            {/* エラーメッセージ（改善版） */}
            {error && (
              <ErrorMessage
                message={error}
                type="api"
                originalError={originalError}
                onClose={() => {
                  setError(null);
                  setOriginalError(null);
                }}
                onRetry={() => {
                  setError(null);
                  setOriginalError(null);
                  if (currentStep === CreationStep.Progress) {
                    // 進行中の場合は作成を再試行
                    if (selectedModel && apiConfig) {
                      startApiCreation(apiConfig);
                    }
                  } else if (currentStep === CreationStep.Configuration) {
                    // 設定画面の場合はそのまま再表示
                    setCurrentStep(CreationStep.Configuration);
                  } else if (currentStep === CreationStep.ModelSelection) {
                    // モデル選択画面の場合はモデル一覧を再読み込み
                    setCurrentStep(CreationStep.ModelSelection);
                  }
                }}
              />
            )}

            {currentStep === CreationStep.ModelSelection && (
              <ModelSelection
                onModelSelected={handleModelSelected}
                selectedModel={selectedModel}
                engineType={apiConfig.engineType || 'ollama'}
                onEngineChange={engineType => {
                  setApiConfig({ ...apiConfig, engineType });
                }}
              />
            )}

            {currentStep === CreationStep.Configuration && selectedModel && (
              <ApiConfigForm
                model={selectedModel}
                defaultConfig={apiConfig}
                onSubmit={handleConfigSubmit}
                onBack={handleBack}
              />
            )}

            {currentStep === CreationStep.Progress && (
              <ApiCreationProgress progress={progress} />
            )}

            {/* クイック作成モードの場合は説明を表示 */}
            {quickCreate && currentStep === CreationStep.Progress && (
              <div className="quick-create-info">
                <p>
                  クイック作成モードでAPIを作成中です。システムに最適な設定を使用しています。
                </p>
              </div>
            )}

            {currentStep === CreationStep.Success && creationResult && (
              <ApiCreationSuccess
                result={creationResult}
                onGoHome={handleGoHome}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
