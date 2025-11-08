// SecuritySettings - セキュリティ設定コンポーネント
// IPホワイトリスト、レート制限、APIキーローテーション設定

import React, { useState, useEffect, useTransition } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { useNotifications } from '../../contexts/NotificationContext';
import './SecuritySettings.css';

/**
 * セキュリティ設定情報
 */
interface SecuritySettings {
  ip_whitelist: string[];
  rate_limit_enabled: boolean;
  rate_limit_requests: number;
  rate_limit_window_seconds: number;
  key_rotation_enabled: boolean;
  key_rotation_interval_days: number;
}

/**
 * セキュリティ設定セクション
 */
interface SecuritySettingsSectionProps {
  apiId: string;
}

export const SecuritySettingsSection: React.FC<
  SecuritySettingsSectionProps
> = ({ apiId }) => {
  const { showSuccess, showError } = useNotifications();
  const [settings, setSettings] = useState<SecuritySettings>({
    ip_whitelist: [],
    rate_limit_enabled: false,
    rate_limit_requests: 100,
    rate_limit_window_seconds: 60,
    key_rotation_enabled: false,
    key_rotation_interval_days: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState('');
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用

  useEffect(() => {
    if (apiId) {
      loadSecuritySettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  /**
   * セキュリティ設定を読み込む
   */
  const loadSecuritySettings = async () => {
    if (!apiId) return;

    try {
      setLoading(true);
      const securitySettings = await safeInvoke<SecuritySettings | null>(
        'get_security_settings',
        { api_id: apiId }
      );

      if (securitySettings) {
        setSettings(securitySettings);
      }
    } catch (err) {
      // エラーは通知コンテキストで処理しない（読み込み時は静かに失敗）
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('セキュリティ設定の読み込みに失敗しました:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * IPアドレスを追加
   */
  const handleAddIpAddress = () => {
    if (!newIpAddress.trim()) {
      showError('IPアドレスを入力してください');
      return;
    }

    // IPアドレスの簡易検証
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

    if (!ipRegex.test(newIpAddress) && !cidrRegex.test(newIpAddress)) {
      showError(
        '有効なIPアドレスまたはCIDR表記を入力してください（例: 192.168.1.1 または 192.168.1.0/24）'
      );
      return;
    }

    if (settings.ip_whitelist.includes(newIpAddress)) {
      showError('このIPアドレスは既に追加されています');
      return;
    }

    setSettings({
      ...settings,
      ip_whitelist: [...settings.ip_whitelist, newIpAddress.trim()],
    });

    setNewIpAddress('');
  };

  /**
   * IPアドレスを削除
   */
  const handleRemoveIpAddress = (ip: string) => {
    setSettings({
      ...settings,
      ip_whitelist: settings.ip_whitelist.filter(addr => addr !== ip),
    });
  };

  /**
   * IPホワイトリストを保存
   */
  const handleSaveIpWhitelist = async () => {
    if (!apiId) return;

    try {
      setSaving(true);
      await safeInvoke('set_ip_whitelist', {
        api_id: apiId,
        whitelist: settings.ip_whitelist,
      });
      showSuccess('IPホワイトリストを保存しました');
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'IPホワイトリストの保存に失敗しました'
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * レート制限設定を保存
   */
  const handleSaveRateLimit = async () => {
    if (!apiId) return;

    try {
      setSaving(true);
      await safeInvoke('update_rate_limit_config', {
        api_id: apiId,
        config: {
          enabled: settings.rate_limit_enabled,
          requests: settings.rate_limit_requests,
          window_seconds: settings.rate_limit_window_seconds,
        },
      });
      showSuccess('レート制限設定を保存しました');
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'レート制限設定の保存に失敗しました'
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * APIキーローテーション設定を保存
   */
  const handleSaveKeyRotation = async () => {
    if (!apiId) return;

    try {
      setSaving(true);
      await safeInvoke('update_key_rotation_config', {
        api_id: apiId,
        enabled: settings.key_rotation_enabled,
        interval_days: settings.key_rotation_interval_days,
      });
      showSuccess('APIキーローテーション設定を保存しました');

      // 設定を再読み込み
      await loadSecuritySettings();
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'APIキーローテーション設定の保存に失敗しました'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="security-settings-loading">
        <p>セキュリティ設定を読み込んでいます...</p>
      </div>
    );
  }

  return (
    <div className="security-settings-section">
      {/* IPホワイトリスト設定 */}
      <div className="security-settings-group">
        <h3 className="security-settings-title">IPホワイトリスト</h3>
        <p className="security-settings-description">
          許可されたIPアドレスからのみアクセスを許可します。空の場合はすべてのIPアドレスを許可します。
        </p>

        <div className="ip-whitelist-input-group">
          <input
            type="text"
            className="form-input"
            placeholder="例: 192.168.1.1 または 192.168.1.0/24"
            value={newIpAddress}
            onChange={e => setNewIpAddress(e.target.value)}
            onKeyPress={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddIpAddress();
              }
            }}
          />
          <button
            type="button"
            className="button-secondary"
            onClick={handleAddIpAddress}
            disabled={saving}
          >
            追加
          </button>
        </div>

        {settings.ip_whitelist.length > 0 && (
          <div className="ip-whitelist-list">
            <h4 className="ip-whitelist-list-title">許可されたIPアドレス:</h4>
            <ul className="ip-whitelist-items">
              {settings.ip_whitelist.map((ip, index) => (
                <li key={index} className="ip-whitelist-item">
                  <span className="ip-whitelist-address">{ip}</span>
                  <button
                    type="button"
                    className="button-danger-small"
                    onClick={() => handleRemoveIpAddress(ip)}
                    disabled={saving}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          className="button-primary"
          onClick={() => {
            startTransition(() => {
              handleSaveIpWhitelist();
            });
          }}
          disabled={saving || isPending}
        >
          {saving ? '保存中...' : 'IPホワイトリストを保存'}
        </button>
      </div>

      {/* レート制限設定 */}
      <div className="security-settings-group">
        <h3 className="security-settings-title">レート制限</h3>
        <p className="security-settings-description">
          APIへのリクエスト数を制限して、過剰なアクセスを防ぎます。
        </p>

        <div className="form-group">
          <label className="form-checkbox-label" htmlFor="rate-limit-enabled">
            <input
              id="rate-limit-enabled"
              type="checkbox"
              className="form-checkbox"
              checked={settings.rate_limit_enabled}
              onChange={e =>
                setSettings({
                  ...settings,
                  rate_limit_enabled: e.target.checked,
                })
              }
            />
            <span className="form-checkbox-text">レート制限を有効にする</span>
          </label>
        </div>

        {settings.rate_limit_enabled && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="rate-limit-requests">
                リクエスト数
              </label>
              <input
                id="rate-limit-requests"
                type="number"
                className="form-input"
                min="1"
                max="10000"
                value={settings.rate_limit_requests}
                onChange={e =>
                  setSettings({
                    ...settings,
                    rate_limit_requests: parseInt(e.target.value) || 100,
                  })
                }
                aria-label="レート制限のリクエスト数"
              />
              <small className="form-hint">
                指定した時間窓内で許可するリクエスト数
              </small>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="rate-limit-window">
                時間窓（秒）
              </label>
              <input
                id="rate-limit-window"
                type="number"
                className="form-input"
                min="1"
                max="3600"
                value={settings.rate_limit_window_seconds}
                onChange={e =>
                  setSettings({
                    ...settings,
                    rate_limit_window_seconds: parseInt(e.target.value) || 60,
                  })
                }
                aria-label="レート制限の時間窓（秒）"
              />
              <small className="form-hint">
                リクエスト数をカウントする時間範囲（秒単位）
              </small>
            </div>
          </>
        )}

        <button
          type="button"
          className="button-primary"
          onClick={() => {
            startTransition(() => {
              handleSaveRateLimit();
            });
          }}
          disabled={saving || isPending}
        >
          {saving ? '保存中...' : 'レート制限設定を保存'}
        </button>
      </div>

      {/* APIキーローテーション設定 */}
      <div className="security-settings-group">
        <h3 className="security-settings-title">APIキーローテーション</h3>
        <p className="security-settings-description">
          定期的にAPIキーを自動的にローテーションしてセキュリティを強化します。
        </p>

        <div className="form-group">
          <label className="form-checkbox-label" htmlFor="key-rotation-enabled">
            <input
              id="key-rotation-enabled"
              type="checkbox"
              className="form-checkbox"
              checked={settings.key_rotation_enabled}
              onChange={e =>
                setSettings({
                  ...settings,
                  key_rotation_enabled: e.target.checked,
                })
              }
              disabled={saving}
              aria-label="APIキーの自動ローテーションを有効にする"
            />
            <span className="form-checkbox-text">
              自動ローテーションを有効にする
            </span>
          </label>
        </div>

        {settings.key_rotation_enabled && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="key-rotation-interval">
                ローテーション間隔（日）
              </label>
              <input
                id="key-rotation-interval"
                type="number"
                className="form-input"
                min="1"
                max="365"
                value={settings.key_rotation_interval_days}
                onChange={e =>
                  setSettings({
                    ...settings,
                    key_rotation_interval_days: parseInt(e.target.value) || 30,
                  })
                }
                disabled={saving}
                aria-label="APIキーローテーション間隔（日）"
              />
              <small className="form-hint">
                指定した日数ごとにAPIキーが自動的にローテーションされます。
              </small>
            </div>
          </>
        )}

        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            startTransition(() => {
              handleSaveKeyRotation();
            });
          }}
          disabled={saving || isPending}
        >
          {saving ? '保存中...' : 'ローテーション設定を保存'}
        </button>
      </div>
    </div>
  );
};
