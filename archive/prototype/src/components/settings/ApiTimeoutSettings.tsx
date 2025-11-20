/**
 * APIタイムアウト設定セクション
 */

import React from 'react';
import type { AppSettings } from '../../types/settings';

/**
 * APIタイムアウト設定のプロパティ
 */
interface ApiTimeoutSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * APIタイムアウト設定セクション
 */
export const ApiTimeoutSettings: React.FC<ApiTimeoutSettingsProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <section className="settings-section" aria-labelledby="api-timeout-heading">
      <h2 id="api-timeout-heading" className="settings-section-title">
        APIタイムアウト設定
      </h2>
      <div className="settings-group">
        <label htmlFor="default-api-timeout-secs">
          デフォルトAPIタイムアウト（秒）
          <span className="settings-hint">
            APIリクエストのデフォルトタイムアウト時間を設定します。各APIで個別にタイムアウトを設定していない場合に使用されます（最小1秒、最大600秒、デフォルト:
            30秒）
          </span>
        </label>
        <input
          id="default-api-timeout-secs"
          type="number"
          min={1}
          max={600}
          value={settings.default_api_timeout_secs ?? 30}
          onChange={e => {
            const parsed = parseInt(e.target.value, 10);
            onSettingsChange({
              ...settings,
              default_api_timeout_secs: isNaN(parsed) ? 30 : parsed,
            });
          }}
          className="settings-input"
          aria-label={`デフォルトAPIタイムアウト（秒）。最小1秒、最大600秒。`}
        />
      </div>
    </section>
  );
};
