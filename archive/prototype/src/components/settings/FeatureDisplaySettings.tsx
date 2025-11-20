/**
 * 機能表示設定セクション
 */

import React from 'react';
import type { AppSettings } from '../../types/settings';

/**
 * 機能表示設定のプロパティ
 */
interface FeatureDisplaySettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * 機能表示設定セクション
 */
export const FeatureDisplaySettings: React.FC<FeatureDisplaySettingsProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <section className="settings-section" aria-labelledby="features-heading">
      <h2 id="features-heading" className="settings-section-title">
        機能表示設定
      </h2>
      <div className="settings-group">
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={settings.show_incomplete_features ?? false}
            onChange={e =>
              onSettingsChange({
                ...settings,
                show_incomplete_features: e.target.checked,
              })
            }
            className="settings-checkbox"
            aria-label="不完全な機能（開発中）を表示する"
          />
          <span>不完全な機能（開発中）を表示する</span>
        </label>
        <span className="settings-hint">
          このオプションを有効にすると、開発中の機能（モデル共有、プラグイン実行など）が表示されます。
          大衆向けのため、デフォルトでは非表示になっています。開発者やテスト目的で有効化できます。
        </span>
      </div>
    </section>
  );
};
