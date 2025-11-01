// FLM - API Configuration Form Component
// フロントエンドエージェント (FE) 実装
// F001: API作成機能 - 設定画面

import React, { useState } from 'react';
import { HelpTooltip } from '../common/HelpTooltip';
import type { SelectedModel, ApiConfig } from '../../types/api';
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

export const ApiConfigForm: React.FC<ApiConfigFormProps> = ({
  model,
  defaultConfig,
  onSubmit,
  onBack,
}) => {
  const [config, setConfig] = useState<ApiConfig>(defaultConfig);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // フォームバリデーション
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!config.name.trim()) {
      newErrors.name = 'API名を入力してください';
    }

    if (config.port < 1024 || config.port > 65535) {
      newErrors.port = 'ポート番号は1024-65535の範囲で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(config);
    }
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
        <div className="form-group">
          <label htmlFor="api-name">
            API名 <span className="required">*</span>
            <HelpTooltip
              content="APIを識別するための名前です。後で変更できます。"
              position="right"
            />
          </label>
          <input
            id="api-name"
            type="text"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            placeholder="LocalAI API"
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
          <small className="form-hint">この名前でAPIを識別します</small>
        </div>

        <div className="form-group">
          <label htmlFor="api-port">
            ポート番号 <span className="required">*</span>
          </label>
          <input
            id="api-port"
            type="number"
            value={config.port}
            onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 8080 })}
            min={1024}
            max={65535}
            className={errors.port ? 'error' : ''}
          />
          {errors.port && <span className="error-message">{errors.port}</span>}
          <small className="form-hint">APIエンドポイントのポート番号（デフォルト: 8080）</small>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.enableAuth}
              onChange={(e) => setConfig({ ...config, enableAuth: e.target.checked })}
            />
            <span>認証を有効にする</span>
          </label>
          <small className="form-hint">
            認証を有効にすると、APIキーが必要になります（推奨）
          </small>
        </div>

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

