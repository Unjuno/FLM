// ApiConfigBasicSettings - 基本設定セクション

import React from 'react';
import { Tooltip } from '../common/Tooltip';
import type { ApiConfig } from '../../types/api';
import './ApiConfigForm.css';

/**
 * 基本設定セクションのプロパティ
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
  engineDetectionResult?: { installed: boolean; running: boolean; message?: string } | null;
  checkingEngine?: boolean;
}

/**
 * 基本設定セクション
 * API名、ポート、認証設定、エンジンタイプの設定
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
  engineDetectionResult,
  checkingEngine = false,
}) => {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ name: e.target.value });
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const port = parseInt(e.target.value, 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      onConfigChange({ port });
    }
  };

  const handleEnableAuthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ enableAuth: e.target.checked });
  };

  const handleEngineTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({ engineType: e.target.value || undefined });
  };

  return (
    <div className="form-group">
      <h3 className="form-section-title">基本設定</h3>

      {/* API名 */}
      <div className="form-field">
        <label htmlFor="api-name" className="form-label">
          API名
          <Tooltip content="このAPI設定の識別名を入力してください">
            <span className="tooltip-trigger">?</span>
          </Tooltip>
        </label>
        <div className="input-with-button">
          <input
            id="api-name"
            type="text"
            value={config.name}
            onChange={handleNameChange}
            className={`form-input ${errors.name ? 'error' : ''}`}
            placeholder="例: My API"
            disabled={nameSuggesting}
          />
          {onSuggestName && (
            <button
              type="button"
              onClick={() => onSuggestName()}
              disabled={nameSuggesting}
              className="button-secondary"
            >
              {nameSuggesting ? '生成中...' : '自動生成'}
            </button>
          )}
        </div>
        {nameGenerated && (
          <p className="form-hint">名前が生成されました</p>
        )}
        {errors.name && <p className="form-error">{errors.name}</p>}
      </div>

      {/* ポート */}
      <div className="form-field">
        <label htmlFor="api-port" className="form-label">
          ポート番号
          <Tooltip content="APIサーバーが使用するポート番号を指定してください（1-65535）">
            <span className="tooltip-trigger">?</span>
          </Tooltip>
        </label>
        <div className="input-with-button">
          <input
            id="api-port"
            type="number"
            value={config.port}
            onChange={handlePortChange}
            className={`form-input ${errors.port ? 'error' : ''}`}
            placeholder="例: 8080"
            min="1"
            max="65535"
            disabled={portDetecting}
          />
          {onDetectPort && (
            <button
              type="button"
              onClick={onDetectPort}
              disabled={portDetecting}
              className="button-secondary"
            >
              {portDetecting ? '検出中...' : '自動検出'}
            </button>
          )}
        </div>
        {portDetected && (
          <p className="form-hint">ポートが検出されました</p>
        )}
        {errors.port && <p className="form-error">{errors.port}</p>}
      </div>

      {/* 認証設定 */}
      <div className="form-field">
        <label className="form-label checkbox-label">
          <input
            type="checkbox"
            checked={config.enableAuth}
            onChange={handleEnableAuthChange}
            className="form-checkbox"
          />
          <span>認証を有効にする</span>
          <Tooltip content="APIキーによる認証を有効にします">
            <span className="tooltip-trigger">?</span>
          </Tooltip>
        </label>
        {errors.enableAuth && (
          <p className="form-error">{errors.enableAuth}</p>
        )}
      </div>

      {/* エンジンタイプ */}
      <div className="form-field">
        <label htmlFor="engine-type" className="form-label">
          エンジンタイプ
          <Tooltip content="使用するLLMエンジンを選択してください">
            <span className="tooltip-trigger">?</span>
          </Tooltip>
        </label>
        <select
          id="engine-type"
          value={config.engineType || ''}
          onChange={handleEngineTypeChange}
          className={`form-select ${errors.engineType ? 'error' : ''}`}
          disabled={checkingEngine || loadingEngines}
        >
          <option value="">自動検出</option>
          {availableEngines.map((engine) => (
            <option key={engine} value={engine}>
              {engine}
            </option>
          ))}
        </select>
        {checkingEngine && (
          <p className="form-hint">エンジンを検出中...</p>
        )}
        {engineDetectionResult && (
          <p className="form-hint">
            {engineDetectionResult.installed
              ? 'エンジンがインストールされています'
              : 'エンジンがインストールされていません'}
            {engineDetectionResult.running && ' (実行中)'}
            {engineDetectionResult.message && ` - ${engineDetectionResult.message}`}
          </p>
        )}
        {errors.engineType && (
          <p className="form-error">{errors.engineType}</p>
        )}
      </div>
    </div>
  );
};

