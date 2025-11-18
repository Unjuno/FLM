// ApiConfigBasicSettings - API基本設定セクション

import React from 'react';
import type { ApiConfig } from '../../types/api';
import { PORT_RANGE, API_NAME } from '../../constants/config';
import './ApiConfigForm.css';

/**
 * API基本設定セクションのプロパティ
 */
export interface ApiConfigBasicSettingsProps {
  config: ApiConfig;
  errors: { [key: string]: string };
  onConfigChange: (updates: Partial<ApiConfig>) => void;
  availableEngines?: string[];
  loadingEngines?: boolean;
  nameSuggesting?: boolean;
  nameGenerated?: boolean;
  onSuggestName?: () => void;
  portDetecting?: boolean;
  portDetected?: boolean;
  onDetectPort?: () => void;
  engineDetectionResult?: unknown;
  checkingEngine?: boolean;
}

/**
 * API基本設定セクション
 * API名、ポート番号、認証設定、エンジンタイプの設定
 */
export const ApiConfigBasicSettings: React.FC<ApiConfigBasicSettingsProps> = ({
  config,
  errors,
  onConfigChange,
  availableEngines = [],
  loadingEngines = false,
  nameSuggesting = false,
  nameGenerated,
  onSuggestName,
  portDetecting = false,
  portDetected,
  onDetectPort,
  checkingEngine = false,
}) => {
  return (
    <div className="form-section">
      <h3 className="form-section-title">基本設定</h3>

      {/* API名 */}
      <div className="form-group">
        <label htmlFor="api-name" className="form-label">
          API名 <span className="required">*</span>
        </label>
        <div className="form-input-group">
          <input
            id="api-name"
            type="text"
            className={`form-input ${errors.name ? 'error' : ''}`}
            value={config.name}
            onChange={e => onConfigChange({ name: e.target.value })}
            placeholder="LocalAI API"
            maxLength={API_NAME.MAX_LENGTH}
            required
            {...(errors.name && { 'aria-invalid': 'true' })}
            aria-describedby={errors.name ? 'api-name-error' : undefined}
          />
          {onSuggestName && (
            <button
              type="button"
              className="button-secondary button-small"
              onClick={onSuggestName}
              disabled={nameSuggesting}
              aria-label="API名を自動生成"
            >
              {nameSuggesting ? '生成中...' : '自動生成'}
            </button>
          )}
        </div>
        {errors.name && (
          <span id="api-name-error" className="form-error" role="alert">
            {errors.name}
          </span>
        )}
        {nameGenerated && config.name && (
          <p className="form-help form-success">
            生成されたAPI名: <strong>{config.name}</strong>
          </p>
        )}
        <p className="form-help">
          このAPIを識別するための名前です。後で変更できます。
        </p>
      </div>

      {/* ポート番号 */}
      <div className="form-group">
        <label htmlFor="api-port" className="form-label">
          ポート番号 <span className="required">*</span>
        </label>
        <div className="form-input-group">
          <input
            id="api-port"
            type="number"
            className={`form-input ${errors.port ? 'error' : ''}`}
            value={config.port || PORT_RANGE.DEFAULT}
            onChange={e =>
              onConfigChange({
                port: parseInt(e.target.value) || PORT_RANGE.DEFAULT,
              })
            }
            min={PORT_RANGE.MIN}
            max={PORT_RANGE.MAX}
            required
            {...(errors.port && { 'aria-invalid': 'true' })}
            aria-describedby={errors.port ? 'api-port-error' : undefined}
          />
          {onDetectPort && (
            <button
              type="button"
              className="button-secondary button-small"
              onClick={onDetectPort}
              disabled={portDetecting}
              aria-label="利用可能なポートを自動検出"
            >
              {portDetecting ? '検出中...' : '自動検出'}
            </button>
          )}
        </div>
        {errors.port && (
          <span id="api-port-error" className="form-error" role="alert">
            {errors.port}
          </span>
        )}
        {portDetected && config.port && (
          <p className="form-help form-success">
            検出されたポート: <strong>{config.port}</strong>
          </p>
        )}
        <p className="form-help">
          APIがリッスンするポート番号です。他のアプリケーションで使用されていないポートを選択してください。
        </p>
      </div>

      {/* エンジンタイプ */}
      {availableEngines.length > 0 && (
        <div className="form-group">
          <label htmlFor="api-engine-type" className="form-label">
            エンジンタイプ
          </label>
          <select
            id="api-engine-type"
            className={`form-select ${errors.engineType ? 'error' : ''}`}
            value={config.engineType || 'ollama'}
            onChange={e => onConfigChange({ engineType: e.target.value })}
            disabled={loadingEngines || checkingEngine}
            {...(errors.engineType && { 'aria-invalid': 'true' })}
            aria-describedby={errors.engineType ? 'api-engine-type-error' : undefined}
          >
            {availableEngines.map(engine => (
              <option key={engine} value={engine}>
                {engine === 'ollama'
                  ? 'Ollama'
                  : engine === 'lm_studio'
                    ? 'LM Studio'
                    : engine === 'vllm'
                      ? 'vLLM'
                      : engine === 'llama_cpp'
                        ? 'llama.cpp'
                        : engine}
              </option>
            ))}
          </select>
          {errors.engineType && (
            <span id="api-engine-type-error" className="form-error" role="alert">
              {errors.engineType}
            </span>
          )}
          <p className="form-help">
            使用するLLMエンジンを選択します。デフォルトはOllamaです。
          </p>
        </div>
      )}

      {/* 認証設定 */}
      <div className="form-group">
        <label className="form-checkbox-label">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={config.enableAuth}
            onChange={e => onConfigChange({ enableAuth: e.target.checked })}
            aria-label="認証を有効にする"
          />
          <span className="form-checkbox-text">認証を有効にする</span>
        </label>
        <p className="form-help">
          認証を有効にすると、APIキーが必要になります。セキュリティのため推奨されます。
        </p>
      </div>
    </div>
  );
};

