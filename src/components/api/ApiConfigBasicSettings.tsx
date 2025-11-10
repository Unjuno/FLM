// ApiConfigBasicSettings - API基本設定セクション

import React from 'react';
import { Tooltip } from '../common/Tooltip';
import { ENGINE_NAMES } from './ModelSelection';
import type { ApiConfig } from '../../types/api';
import { PORT_RANGE, API_NAME } from '../../constants/config';
import { useI18n } from '../../contexts/I18nContext';
import './ApiConfigForm.css';

/**
 * API基本設定セクションのプロパティ
 */
export interface ApiConfigBasicSettingsProps {
  config: ApiConfig;
  errors: { [key: string]: string };
  onConfigChange: (config: Partial<ApiConfig>) => void;
  availableEngines: string[];
  loadingEngines: boolean;
  nameSuggesting: boolean;
  nameGenerated: boolean;
  onSuggestName: () => void;
  portDetecting: boolean;
  portDetected: boolean;
  onDetectPort: () => void;
  engineDetectionResult: {
    installed: boolean;
    running: boolean;
    message?: string;
  } | null;
  checkingEngine: boolean;
}

/**
 * API基本設定セクション
 * API名、エンジン、ポート、認証の設定
 */
export const ApiConfigBasicSettings: React.FC<ApiConfigBasicSettingsProps> = ({
  config,
  errors,
  onConfigChange,
  availableEngines,
  loadingEngines,
  nameSuggesting,
  nameGenerated,
  onSuggestName,
  portDetecting,
  portDetected,
  onDetectPort,
  engineDetectionResult,
  checkingEngine,
}) => {
  const { t } = useI18n();

  return (
    <>
      {/* API名 */}
      <div className="form-group">
        <label htmlFor="api-name">
          API名 <span className="required">*</span>
          <Tooltip
            content="APIを識別するための名前です。他のAPIと重複しない名前を入力してください。"
            position="right"
          >
            <span className="tooltip-trigger-icon">i</span>
          </Tooltip>
        </label>
        <div className="name-input-group">
          <input
            id="api-name"
            type="text"
            value={config.name}
            onChange={e =>
              onConfigChange({ name: e.target.value })
            }
            maxLength={API_NAME.MAX_LENGTH}
            className={errors.name ? 'error' : ''}
            placeholder="例: LocalAI API"
          />
          <Tooltip content="重複を回避したAPI名を自動生成します。">
            <button
              type="button"
              className={`name-suggest-button ${nameGenerated ? 'success' : ''} ${nameSuggesting ? 'loading' : ''}`}
              onClick={onSuggestName}
              disabled={nameSuggesting}
              aria-label="API名を自動生成"
            >
              {nameSuggesting ? (
                <>
                  <span className="button-spinner"></span>
                  <span>生成中...</span>
                </>
              ) : nameGenerated ? (
                <>
                  <span className="button-check">✓</span>
                  <span>生成完了</span>
                </>
              ) : (
                '自動生成'
              )}
            </button>
          </Tooltip>
        </div>
        {errors.name && <span className="error-message">{errors.name}</span>}
        {nameGenerated && !errors.name && (
          <div className="success-feedback">
            <span className="success-icon">✓</span>
            <span className="success-text">API名を生成しました</span>
          </div>
        )}
        <small className="form-hint">
          APIを識別するための名前（{API_NAME.MIN_LENGTH}-{API_NAME.MAX_LENGTH}文字）
        </small>
      </div>

      {/* エンジンタイプ */}
      <div className="form-group">
        <label htmlFor="api-engine">
          エンジンタイプ <span className="required">*</span>
          <Tooltip
            content="使用するLLMエンジンを選択します。Ollamaが推奨です。"
            position="right"
          >
            <span className="tooltip-trigger-icon">i</span>
          </Tooltip>
        </label>
        <select
          id="api-engine"
          value={config.engineType || 'ollama'}
          onChange={e => onConfigChange({ engineType: e.target.value })}
          disabled={loadingEngines}
          className={errors.engineType ? 'error' : ''}
        >
          {availableEngines.map(engine => (
            <option key={engine} value={engine}>
              {ENGINE_NAMES[engine] || engine}
            </option>
          ))}
        </select>
        {errors.engineType && (
          <span className="error-message">{errors.engineType}</span>
        )}
        {engineDetectionResult && (
          <div className="engine-status">
            {!engineDetectionResult.installed ? (
              <>
                <span className="status-icon">!</span>
                <span className="status-text">
                  {ENGINE_NAMES[config.engineType || 'ollama'] ||
                    config.engineType}{' '}
                  {t('apiConfigForm.engineNotInstalled')}
                </span>
                {engineDetectionResult.message && (
                  <div className="status-detail">
                    {engineDetectionResult.message}
                  </div>
                )}
              </>
            ) : !engineDetectionResult.running ? (
              <>
                <span className="status-icon">i</span>
                <span className="status-text">
                  {ENGINE_NAMES[config.engineType || 'ollama'] ||
                    config.engineType}{' '}
                  {t('apiConfigForm.engineNotRunning')}
                </span>
                {engineDetectionResult.message && (
                  <div className="status-detail">
                    {engineDetectionResult.message}
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="status-icon">OK</span>
                <span className="status-text">
                  {ENGINE_NAMES[config.engineType || 'ollama'] ||
                    config.engineType}
                  は正常に動作しています。
                </span>
              </>
            )}
          </div>
        )}
        {checkingEngine && (
          <div className="engine-checking">
            <span className="button-spinner"></span>
            <span>エンジンの状態を確認中...</span>
          </div>
        )}
        <small className="form-hint">
          使用するLLMエンジン（推奨: Ollama）
        </small>
      </div>

      {/* ポート番号 */}
      <div className="form-group">
        <label htmlFor="api-port">
          ポート番号 <span className="required">*</span>
          <Tooltip
            content="APIエンドポイントが使用するポート番号です。1024-65535の範囲で指定してください。他のアプリケーションが使用していないポートを選択してください。"
            position="right"
          >
            <span className="tooltip-trigger-icon">i</span>
          </Tooltip>
        </label>
        <div className="port-input-group">
          <input
            id="api-port"
            type="number"
            value={config.port}
            onChange={e => {
              const parsed = parseInt(e.target.value, 10);
              onConfigChange({
                port: isNaN(parsed) ? PORT_RANGE.DEFAULT : parsed,
              });
            }}
            min={PORT_RANGE.MIN}
            max={PORT_RANGE.MAX}
            className={errors.port ? 'error' : ''}
          />
          <Tooltip content="使用可能なポート番号を自動検出します。重複を回避したポート番号を提案します。">
            <button
              type="button"
              className={`port-detect-button ${portDetected ? 'success' : ''} ${portDetecting ? 'loading' : ''}`}
              onClick={onDetectPort}
              disabled={portDetecting}
              aria-label="ポート番号を自動検出"
            >
              {portDetecting ? (
                <>
                  <span className="button-spinner"></span>
                  <span>検出中...</span>
                </>
              ) : portDetected ? (
                <>
                  <span className="button-check">✓</span>
                  <span>検出完了</span>
                </>
              ) : (
                '自動検出'
              )}
            </button>
          </Tooltip>
        </div>
        {errors.port && <span className="error-message">{errors.port}</span>}
        {portDetected && !errors.port && (
          <div className="success-feedback">
            <span className="success-icon">✓</span>
            <span className="success-text">ポート番号 {config.port} を検出しました</span>
          </div>
        )}
        {!portDetected && !errors.port && config.port && (
          <small className="success-message">
            ポート番号 {config.port} が設定されました
          </small>
        )}
        <small className="form-hint">
          <Tooltip
            content="APIが使用する通信ポート番号です。通常は自動的に設定されますが、必要に応じて変更できます。ポート番号が使用中の場合は自動的に利用可能なポートを選択します。"
            title="ポート番号とは？"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              APIエンドポイントのポート番号（デフォルト: {PORT_RANGE.DEFAULT}）
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>❓</span>
            </span>
          </Tooltip>
          <br />
          <span className="port-help-text">
            ポート番号が使用中の場合は自動的に利用可能なポートを選択します
          </span>
        </small>
      </div>

      {/* 認証設定 */}
      <div className="form-group">
        <label className="checkbox-label">
          <Tooltip
            content="認証を有効にすると、APIキーが必要になります。外部アプリケーションから使用する場合は有効にすることをおすすめします。ローカル環境のみで使用する場合は無効でも問題ありません。"
            position="right"
          >
            <input
              type="checkbox"
              checked={config.enableAuth}
              onChange={e =>
                onConfigChange({ enableAuth: e.target.checked })
              }
            />
          </Tooltip>
          <span>認証を有効にする</span>
        </label>
        <small className="form-hint">
          認証を有効にすると、APIキーが必要になります（推奨）
        </small>
      </div>
    </>
  );
};

