/**
 * アプリ終了時の動作設定セクション
 */

import React from 'react';
import type { AppSettings } from '../../types/settings';

/**
 * アプリ終了時の動作設定のプロパティ
 */
interface ExitBehaviorSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * アプリ終了時の動作設定セクション
 */
export const ExitBehaviorSettings: React.FC<ExitBehaviorSettingsProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <section
      className="settings-section"
      aria-labelledby="exit-behavior-heading"
    >
      <h2 id="exit-behavior-heading" className="settings-section-title">
        アプリ終了時の動作
      </h2>
      <div className="settings-group">
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={settings.stop_apis_on_exit ?? true}
            onChange={e =>
              onSettingsChange({
                ...settings,
                stop_apis_on_exit: e.target.checked,
              })
            }
            className="settings-checkbox"
            aria-label="アプリ終了時にAPIを停止する"
          />
          <span>アプリ終了時にAPIを停止する</span>
        </label>
        <span className="settings-hint">
          このオプションを有効にすると、アプリケーションを閉じる際に実行中のすべてのAPIが自動的に停止されます。
          無効にすると、アプリを閉じてもAPIは実行し続けます。
        </span>
      </div>
    </section>
  );
};
