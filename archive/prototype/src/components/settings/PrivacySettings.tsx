/**
 * プライバシー設定セクション
 */

import React from 'react';
import type { AppSettings } from '../../types/settings';

/**
 * プライバシー設定のプロパティ
 */
interface PrivacySettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * プライバシー設定セクション
 */
export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <section className="settings-section" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading" className="settings-section-title">
        プライバシー設定
      </h2>
      <div className="settings-group">
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={settings.diagnostics_enabled ?? true}
            onChange={e =>
              onSettingsChange({
                ...settings,
                diagnostics_enabled: e.target.checked,
              })
            }
            aria-label="診断機能を有効にする"
          />
          <span>診断機能を有効にする</span>
        </label>
        <span className="settings-hint">
          システム情報（CPU、メモリ、ディスクなど）の収集を有効にします。プライバシー保護のため無効化できます。
        </span>
      </div>
      <div className="settings-group">
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={settings.performance_metrics_enabled ?? true}
            onChange={e =>
              onSettingsChange({
                ...settings,
                performance_metrics_enabled: e.target.checked,
              })
            }
            aria-label="パフォーマンスメトリクス収集を有効にする"
          />
          <span>パフォーマンスメトリクス収集を有効にする</span>
        </label>
        <span className="settings-hint">
          CPU使用率、メモリ使用率などのパフォーマンスメトリクスの収集を有効にします。プライバシー保護のため無効化できます。
        </span>
      </div>
      <div className="settings-group">
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={settings.include_ip_address_in_audit_log ?? true}
            onChange={e =>
              onSettingsChange({
                ...settings,
                include_ip_address_in_audit_log: e.target.checked,
              })
            }
            aria-label="監査ログにIPアドレスを含める"
          />
          <span>監査ログにIPアドレスを含める</span>
        </label>
        <span className="settings-hint">
          無効にすると、監査ログにIPアドレスが保存されません（プライバシー保護のため）
        </span>
      </div>
      <div className="settings-group">
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={settings.device_id_enabled ?? true}
            onChange={e =>
              onSettingsChange({
                ...settings,
                device_id_enabled: e.target.checked,
              })
            }
            aria-label="デバイスIDの使用を許可する"
          />
          <span>デバイスIDの使用を許可する</span>
        </label>
        <span className="settings-hint">
          デバイスIDはリモート同期機能で使用されます。無効にすると、リモート同期機能が使用できなくなります。
          デバイスIDはSHA-256でハッシュ化され、最初の8バイト（16文字）のみが使用されます。
          プライバシー保護のため無効化できます。
        </span>
      </div>
    </section>
  );
};
