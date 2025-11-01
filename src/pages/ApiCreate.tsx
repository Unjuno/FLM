// FLM - API作成ページ
// フロントエンドエージェント (FE) 実装
// F001: API作成機能 - マルチステップウィザード

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ModelSelection } from '../components/api/ModelSelection';
import { ApiConfigForm } from '../components/api/ApiConfigForm';
import { ApiCreationProgress } from '../components/api/ApiCreationProgress';
import { ApiCreationSuccess } from '../components/api/ApiCreationSuccess';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import type { SelectedModel, ApiConfig, ApiCreationResult } from '../types/api';
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
  const [currentStep, setCurrentStep] = useState<CreationStep>(CreationStep.ModelSelection);
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null);
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    name: 'LocalAI API',
    port: 8080,
    enableAuth: true,
  });
  const [creationResult, setCreationResult] = useState<ApiCreationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ step: string; progress: number }>({
    step: '初期化中...',
    progress: 0,
  });

  // モデル選択完了時のハンドラ
  const handleModelSelected = (model: SelectedModel) => {
    setSelectedModel(model);
    setCurrentStep(CreationStep.Configuration);
    setError(null);
  };

  // 設定完了時のハンドラ
  const handleConfigSubmit = (config: ApiConfig) => {
    setApiConfig(config);
    setCurrentStep(CreationStep.Progress);
    setError(null);
    startApiCreation(config);
  };

  // API作成を開始
  const startApiCreation = async (config: ApiConfig) => {
    if (!selectedModel) {
      setError('モデルが選択されていません');
      setCurrentStep(CreationStep.ModelSelection);
      return;
    }

    try {
      setProgress({ step: 'Ollama確認中...', progress: 0 });

      // ステップ1: Ollama確認
      setProgress({ step: 'Ollama確認中...', progress: 20 });
      await new Promise(resolve => setTimeout(resolve, 300)); // UI更新のための短い待機

      // ステップ2: API設定保存中
      setProgress({ step: 'API設定を保存中...', progress: 40 });
      await new Promise(resolve => setTimeout(resolve, 300));

      // ステップ3: 認証プロキシ起動中
      setProgress({ step: '認証プロキシ起動中...', progress: 60 });
      await new Promise(resolve => setTimeout(resolve, 300));

      // バックエンドのIPCコマンドを呼び出し
      // Rust側のApiCreateConfig構造体と一致させる
      const response = await invoke<{
        id: string;
        name: string;
        endpoint: string;
        api_key: string | null;
        model_name: string;
        port: number;
        status: string;
      }>('create_api', {
        name: config.name,
        model_name: selectedModel.name,
        port: config.port,
        enable_auth: config.enableAuth,
      });

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'API作成中にエラーが発生しました';
      setError(errorMessage);
      setCurrentStep(CreationStep.Configuration);
    }
  };

  // 戻るボタンのハンドラ
  const handleBack = () => {
    switch (currentStep) {
      case CreationStep.Configuration:
        setCurrentStep(CreationStep.ModelSelection);
        break;
      case CreationStep.Progress:
        setCurrentStep(CreationStep.Configuration);
        break;
      case CreationStep.Success:
        navigate('/');
        break;
    }
    setError(null);
  };

  // 成功画面でホームに戻る
  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="api-create-page">
      <div className="api-create-container">
        <header className="api-create-header">
          <button className="back-button" onClick={handleBack}>
            ← 戻る
          </button>
          <h1>新しいAPIを作成</h1>
          <div className="step-indicator">
            <span className={
              currentStep === CreationStep.ModelSelection ? 'active' : 
              (currentStep === CreationStep.Configuration || currentStep === CreationStep.Progress || currentStep === CreationStep.Success) ? 'completed' : ''
            }>
              1. モデル選択
            </span>
            <span className={
              currentStep === CreationStep.Configuration ? 'active' : 
              (currentStep === CreationStep.Progress || currentStep === CreationStep.Success) ? 'completed' : ''
            }>
              2. 設定
            </span>
            <span className={
              currentStep === CreationStep.Progress ? 'active' : 
              currentStep === CreationStep.Success ? 'completed' : ''
            }>
              3. 作成中
            </span>
            <span className={currentStep === CreationStep.Success ? 'active' : ''}>
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
              message="推奨モデル（⭐マーク）から始めることをおすすめします。チャット用途にはllama3やmistral、コード生成にはcodellamaが適しています。"
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
              onClose={() => setError(null)}
              onRetry={currentStep === CreationStep.Progress ? undefined : () => {
                setError(null);
                if (currentStep === CreationStep.Configuration) {
                  // 設定画面に戻る
                  setCurrentStep(CreationStep.Configuration);
                } else if (currentStep === CreationStep.ModelSelection) {
                  // モデル選択画面に戻る
                  setCurrentStep(CreationStep.ModelSelection);
                }
              }}
            />
          )}

          {currentStep === CreationStep.ModelSelection && (
            <ModelSelection
              onModelSelected={handleModelSelected}
              selectedModel={selectedModel}
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

          {currentStep === CreationStep.Success && creationResult && (
            <ApiCreationSuccess
              result={creationResult}
              onGoHome={handleGoHome}
            />
          )}
        </div>
      </div>
    </div>
  );
};
