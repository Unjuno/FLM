// SPDX-License-Identifier: MIT
// ApiCreate - API作成ページ

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { safeInvoke } from '../utils/tauri';
import { ModelSelection } from '../components/api/ModelSelection';
import { ApiConfigForm } from '../components/api/ApiConfigForm';
import { ApiCreationProgress } from '../components/api/ApiCreationProgress';
import { ApiCreationSuccess } from '../components/api/ApiCreationSuccess';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useOllamaDetection, useOllamaProcess } from '../hooks/useOllama';
import { useApiCreation } from '../hooks/useApiCreation';
import { useI18n } from '../contexts/I18nContext';
import { useIsMounted } from '../hooks/useIsMounted';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import type { SelectedModel, ApiConfig } from '../types/api';
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
  const {
    progress,
    error,
    originalError,
    creationResult,
    startApiCreation: startApiCreationHook,
    clearError,
    resetProgress,
  } = useApiCreation(selectedModel, t('apiCreate.initializing'));
  const [quickCreate, setQuickCreate] = useState(false);
  const [pendingApiCreation, setPendingApiCreation] =
    useState<ApiConfig | null>(null);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.apiList') || 'API一覧', path: '/api/list' },
    { label: t('apiCreate.title') || '新しいAPIを作成' },
  ], [t]);

  // location.stateの重複処理を防ぐためのフラグ
  const processedStateRef = useRef<string | null>(null);
  const { status, detect } = useOllamaDetection();
  const { start } = useOllamaProcess();
  const isMounted = useIsMounted();
  const isAutoStartingRef = useRef(false);

  useGlobalKeyboardShortcuts();

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

  // Ollamaの自動起動: 無限ループを防ぐため、前回のstatusを保持して変更時のみ処理
  const prevStatusRef = useRef<typeof status | null>(null);
  const statusRunningRef = useRef<boolean | null>(null);
  
  useEffect(() => {
    const statusChanged = 
      !prevStatusRef.current ||
      prevStatusRef.current.running !== status?.running ||
      prevStatusRef.current.installed !== status?.installed ||
      prevStatusRef.current.portable !== status?.portable;
    
    const runningChanged = statusRunningRef.current !== status?.running;
    
    if (!statusChanged || !runningChanged) {
      // 状態を更新（次回の比較用）
      if (status) {
        statusRunningRef.current = status.running;
      }
      return;
    }
    
    prevStatusRef.current = status;
    if (status) {
      statusRunningRef.current = status.running;
    }

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

      if (isMounted()) {
        resetProgress('Ollamaを起動中...');
      }

      try {
        await start();
        // detect()を呼び出すとstatusが更新され、無限ループになる可能性があるため、
        // 自動起動後はdetect()を呼び出さない（次のstatus更新で自然に検出される）
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
    // statusのrunningプロパティのみを依存配列に含める（高頻度レンダリングを防ぐ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.running, status?.installed, status?.portable, start, resetProgress, isMounted]);

  // API作成を開始（カスタムフックを使用）
  const startApiCreation = useCallback(
    async (config: ApiConfig) => {
      if (!selectedModel) {
        setCurrentStep(CreationStep.ModelSelection);
        return;
      }

      setCurrentStep(CreationStep.Progress);
      await startApiCreationHook(config);
    },
    [selectedModel, startApiCreationHook]
  );

  // エンジン変更ハンドラをメモ化（高頻度レンダリングを防ぐ）
  const handleEngineChange = useCallback((engineType: string) => {
    setApiConfig(prev => ({ ...prev, engineType }));
  }, []);

  // creationResultが設定されたら成功画面に遷移
  useEffect(() => {
    if (creationResult) {
      setCurrentStep(CreationStep.Success);
    }
  }, [creationResult]);

  // エラーが発生した場合は設定画面に戻る
  useEffect(() => {
    if (error && currentStep === CreationStep.Progress) {
      setCurrentStep(CreationStep.Configuration);
      setQuickCreate(false); // クイック作成モードを解除
    }
  }, [error, currentStep]);

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

      // 使用可能なAPI名とポート番号を自動検出（非同期関数として定義）
      (async () => {
        try {
          // API名のベース名を生成（モデル名を含める）
          const now = new Date();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const hour = String(now.getHours()).padStart(2, '0');
          const minute = String(now.getMinutes()).padStart(2, '0');
          const baseApiName = `${modelName} API ${month}${day}_${hour}${minute}`;
          
          // 使用可能なAPI名を検出
          const nameResult = await safeInvoke<{
            suggested_name: string;
            alternatives: string[];
            is_available: boolean;
          }>('suggest_api_name', { base_name: baseApiName });
          
          // 使用可能なポート番号を検出
          const portResult = await safeInvoke<{
            recommended_port: number;
            is_available: boolean;
            alternative_ports: number[];
          }>('find_available_port', { start_port: 8080 });
          
          logger.info(
            `推奨設定で作成: API名="${nameResult.suggested_name}", ポート=${portResult.recommended_port}`,
            'ApiCreate'
          );
          
          const defaultConfig: ApiConfig = {
            name: nameResult.suggested_name,
            port: portResult.recommended_port,
            enableAuth: true,
            engineType: 'ollama',
          };
          setApiConfig(defaultConfig);
          setCurrentStep(CreationStep.Progress);
          // selectedModelが設定されるまで待機するため、pendingApiCreationに保存
          // setSelectedModelの後にpendingApiCreationを設定することで、確実に順序を保つ
          setPendingApiCreation(defaultConfig);
        } catch (err) {
          logger.error('推奨設定でのAPI名・ポート検出に失敗', err, 'ApiCreate');
          // エラーが発生した場合は、フォールバックとしてデフォルト値を使用
          const now = new Date();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const hour = String(now.getHours()).padStart(2, '0');
          const minute = String(now.getMinutes()).padStart(2, '0');
          const apiName = `API ${month}${day}_${hour}${minute}`;
          
          const defaultConfig: ApiConfig = {
            name: apiName,
            port: 8080,
            enableAuth: true,
            engineType: 'ollama',
          };
          setApiConfig(defaultConfig);
          setCurrentStep(CreationStep.Progress);
          setPendingApiCreation(defaultConfig);
        }
      })();
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
      // clearErrorはuseCallbackでメモ化されているため、依存配列に含める必要はない
      clearError();

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
    // clearErrorはuseCallbackでメモ化されているため、依存配列に含める必要はない
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setCurrentStep(CreationStep.Configuration);
        setQuickCreate(false); // クイック作成モードを解除
      });
    }
  }, [selectedModel, pendingApiCreation, startApiCreation]);

  // モデル選択完了時のハンドラ
  const handleModelSelected = (model: SelectedModel) => {
    setSelectedModel(model);
    setCurrentStep(CreationStep.Configuration);
    clearError();
  };

  // 設定完了時のハンドラ
  const handleConfigSubmit = (config: ApiConfig) => {
    setApiConfig(config);
    startApiCreation(config);
  };

  // 戻るボタンのハンドラ（常にホームに戻る）
  // ホーム中心のナビゲーションに合わせて、どのステップからでもホームに戻れるようにする
  const handleBack = () => {
    navigate('/');
    clearError();
  };

  // 成功画面でホームに戻る
  // APIを起動するハンドラー
  const handleStartApi = useCallback(async () => {
    if (!creationResult) return;
    
    try {
      await safeInvoke('start_api', { apiId: creationResult.id });
      // 成功メッセージを表示（オプション）
      logger.info('APIを起動しました', '', 'ApiCreate');
    } catch (err) {
      logger.error('APIの起動に失敗しました', err, 'ApiCreate');
      throw err;
    }
  }, [creationResult]);

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
            <h1>{t('apiCreate.title') || '新しいAPIを作成'}</h1>
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
                onClose={clearError}
                onRetry={() => {
                  clearError();
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
                onEngineChange={handleEngineChange}
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
                onStartApi={handleStartApi}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
