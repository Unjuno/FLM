// ApiConfigForm - API設定フォームコンポーネント

import React from 'react';
import type { SelectedModel, ApiConfig } from '../../types/api';
import { MEMORY_SETTINGS, MULTIMODAL_SETTINGS } from '../../constants/config';
import { useApiConfigForm } from '../../hooks/useApiConfigForm';
import { useFormSubmit } from '../../hooks/useFormSubmit';
import { ApiConfigBasicSettings } from './ApiConfigBasicSettings';
import { ApiConfigModelParameters } from './ApiConfigModelParameters';
import { ApiConfigMemorySettings } from './ApiConfigMemorySettings';
import { ApiConfigMultimodalSettings } from './ApiConfigMultimodalSettings';
import './ApiConfigForm.css';

/**
 * API設定フォームコンポーネント
 */
interface ApiConfigFormProps {
  model: SelectedModel;
  defaultConfig: ApiConfig;
  onSubmit: (config: ApiConfig) => void;
  onBack: () => void;
}

const ApiConfigFormComponent: React.FC<ApiConfigFormProps> = ({
  model,
  defaultConfig,
  onSubmit,
  onBack,
}) => {
  const {
    config,
    setConfig,
    errors,
    availableEngines,
    loadingEngines,
    showAdvancedParams,
    setShowAdvancedParams,
    showMemorySettings,
    setShowMemorySettings,
    showMultimodalSettings,
    setShowMultimodalSettings,
    nameSuggesting,
    nameGenerated,
    portDetecting,
    portDetected,
    engineDetectionResult,
    checkingEngine,
    detectAvailablePort,
    suggestApiName,
    updateModelParameter,
    updateMemorySetting,
    updateMultimodalSetting,
    validate,
  } = useApiConfigForm(model, defaultConfig);

  const { handleSubmit: handleFormSubmit } = useFormSubmit({
    validate: () => validate(),
    onSubmit: (data: ApiConfig) => {
      onSubmit(data);
    },
    autosaveKey: `api_config_autosave_${model.name || 'new'}`,
    componentName: 'ApiConfigForm',
  });

  const handleSubmit = (e: React.FormEvent) => {
    handleFormSubmit(e, config);
  };

  return (
    <div className="api-config-form">
      <div className="config-header">
        <h2>API設定</h2>
        <p className="config-description">
          選択したモデル: <strong>{model.name}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="config-form">
        {/* 基本設定セクション */}
        <ApiConfigBasicSettings
          config={config}
          errors={errors}
          onConfigChange={(updates: Partial<ApiConfig>) => setConfig({ ...config, ...updates })}
          availableEngines={availableEngines}
          loadingEngines={loadingEngines}
          nameSuggesting={nameSuggesting}
          nameGenerated={nameGenerated}
          onSuggestName={suggestApiName}
          portDetecting={portDetecting}
          portDetected={portDetected}
          onDetectPort={detectAvailablePort}
          engineDetectionResult={engineDetectionResult}
          checkingEngine={checkingEngine}
        />

        {/* モデル生成パラメータセクション */}
        <ApiConfigModelParameters
          modelParameters={config.modelParameters || {}}
          errors={errors}
          onParameterChange={updateModelParameter}
          showAdvancedParams={showAdvancedParams}
          onToggleAdvancedParams={() => setShowAdvancedParams(!showAdvancedParams)}
        />

        {/* メモリ・リソース設定セクション */}
        <ApiConfigMemorySettings
          memorySettings={config.modelParameters?.memory}
          errors={errors}
          onMemorySettingChange={updateMemorySetting}
          showMemorySettings={showMemorySettings}
          onToggleMemorySettings={() => setShowMemorySettings(!showMemorySettings)}
          onReset={() => {
                    setConfig({
                      ...config,
                      modelParameters: {
                        ...config.modelParameters,
                        memory: {
                          batch_size: MEMORY_SETTINGS.BATCH_SIZE.DEFAULT,
                          use_mmap: true,
                          use_mlock: false,
                          low_mem: false,
                        },
                      },
                    });
                  }}
        />

        {/* マルチモーダル機能設定セクション */}
        <ApiConfigMultimodalSettings
          multimodal={config.multimodal}
          model={model}
          errors={errors}
          onMultimodalSettingChange={updateMultimodalSetting}
          showMultimodalSettings={showMultimodalSettings}
          onToggleMultimodalSettings={() =>
                    setShowMultimodalSettings(!showMultimodalSettings)
                  }
          onReset={() => {
                        setConfig({
                          ...config,
                          multimodal: {
                            enableVision: model.capabilities?.vision || false,
                            enableAudio: model.capabilities?.audio || false,
                            enableVideo: model.capabilities?.video || false,
                maxImageSize: MULTIMODAL_SETTINGS.MAX_IMAGE_SIZE.DEFAULT,
                maxAudioSize: MULTIMODAL_SETTINGS.MAX_AUDIO_SIZE.DEFAULT,
                maxVideoSize: MULTIMODAL_SETTINGS.MAX_VIDEO_SIZE.DEFAULT,
                            supportedImageFormats: [
                              'jpg',
                              'jpeg',
                              'png',
                              'gif',
                              'webp',
                            ],
                            supportedAudioFormats: ['mp3', 'wav', 'ogg', 'm4a'],
                            supportedVideoFormats: ['mp4', 'webm', 'mov'],
                          },
                        });
                      }}
        />

        <div className="form-actions">
          <button type="button" onClick={onBack} className="button-secondary">
            戻る
          </button>
          <button type="submit" className="button-primary">
            作成
          </button>
        </div>
      </form>
    </div>
  );
};

// メモ化して不要な再レンダリングを防ぐ
export const ApiConfigForm = React.memo(ApiConfigFormComponent, (prevProps, nextProps) => {
  // プロップスが実際に変更された場合のみ再レンダリング
  return (
    prevProps.model.name === nextProps.model.name &&
    prevProps.defaultConfig.name === nextProps.defaultConfig.name &&
    prevProps.defaultConfig.port === nextProps.defaultConfig.port &&
    prevProps.defaultConfig.engineType === nextProps.defaultConfig.engineType &&
    prevProps.onSubmit === nextProps.onSubmit &&
    prevProps.onBack === nextProps.onBack
  );
});
