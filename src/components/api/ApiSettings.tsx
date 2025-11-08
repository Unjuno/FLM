// ApiSettings - API設定コンポーネント

import React, { useState } from 'react';
import type { SelectedModel, ApiConfig } from '../../types/api';
import { useApiConfigValidation } from '../../hooks/useApiConfigValidation';
import { PORT_RANGE, API_NAME } from '../../constants/config';
import './ApiSettings.css';

interface ApiSettingsProps {
  model: SelectedModel;
  initialConfig: ApiConfig;
  onSubmit: (config: ApiConfig) => void;
  onBack: () => void;
  onCancel: () => void;
}

/**
 * API設定コンポーネント
 * API名、ポート番号、認証設定を入力します
 */
export const ApiSettings: React.FC<ApiSettingsProps> = ({
  model,
  initialConfig,
  onSubmit,
  onBack,
  onCancel,
}) => {
  const [config, setConfig] = useState<ApiConfig>(initialConfig);
  const validation = useApiConfigValidation(config);

  // 送信処理
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validation.isValid) {
      onSubmit(config);
    }
  };

  return (
    <div className="api-settings">
      <div className="api-settings-header">
        <h2>API設定</h2>
        <p className="api-settings-description">
          選択したモデル: <strong>{model.name}</strong>
        </p>
      </div>

      <form className="api-settings-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="api-name" className="form-label">
            API名 <span className="required">*</span>
          </label>
          <input
            id="api-name"
            type="text"
            className={`form-input ${validation.errors.name ? 'error' : ''}`}
            value={config.name}
            onChange={e => setConfig({ ...config, name: e.target.value })}
            placeholder="LocalAI API"
            maxLength={API_NAME.MAX_LENGTH}
            required
          />
          {validation.errors.name && (
            <span className="form-error">{validation.errors.name}</span>
          )}
          <p className="form-help">
            このAPIを識別するための名前です。後で変更できます。
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="api-port" className="form-label">
            ポート番号 <span className="required">*</span>
          </label>
          <input
            id="api-port"
            type="number"
            className={`form-input ${validation.errors.port ? 'error' : ''}`}
            value={config.port}
            onChange={e =>
              setConfig({
                ...config,
                port: parseInt(e.target.value) || PORT_RANGE.DEFAULT,
              })
            }
            min={PORT_RANGE.MIN}
            max={PORT_RANGE.MAX}
            required
          />
          {validation.errors.port && (
            <span className="form-error">{validation.errors.port}</span>
          )}
          <p className="form-help">
            APIがリッスンするポート番号です。他のアプリケーションで使用されていないポートを選択してください。
          </p>
        </div>

        <div className="form-group">
          <label className="form-checkbox-label">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={config.enableAuth}
              onChange={e =>
                setConfig({ ...config, enableAuth: e.target.checked })
              }
            />
            <span className="form-checkbox-text">認証を有効にする</span>
          </label>
          <p className="form-help">
            認証を有効にすると、APIキーが必要になります。セキュリティのため推奨されます。
          </p>
        </div>

        <div className="api-settings-actions">
          <button type="button" className="button secondary" onClick={onBack}>
            戻る
          </button>
          <button type="button" className="button secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button type="submit" className="button primary">
            作成
          </button>
        </div>
      </form>
    </div>
  );
};
