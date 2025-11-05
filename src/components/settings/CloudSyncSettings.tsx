// CloudSyncSettings - クラウド同期設定コンポーネント
// 設定のクラウド同期機能（GitHub Gist、Google Drive、Dropbox）

import React, { useState, useEffect } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { useNotifications } from '../../contexts/NotificationContext';
import './CloudSyncSettings.css';

/**
 * クラウド同期設定情報
 */
interface CloudSyncConfig {
  enabled: boolean;
  cloud_provider: string;
  access_token?: string;
  device_id: string;
  sync_interval_seconds: number;
}

/**
 * クラウド同期設定コンポーネント
 */
export const CloudSyncSettings: React.FC = () => {
  const { showSuccess, showError } = useNotifications();
  const [config, setConfig] = useState<CloudSyncConfig>({
    enabled: false,
    cloud_provider: 'github',
    device_id: '',
    sync_interval_seconds: 3600,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadConfig();
    generateDeviceIdIfNeeded();
  }, []);

  /**
   * デバイスIDを生成（未設定の場合）
   */
  const generateDeviceIdIfNeeded = async () => {
    if (!config.device_id) {
      try {
        const deviceId = await safeInvoke<string>('generate_device_id');
        setConfig((prev) => ({ ...prev, device_id: deviceId }));
      } catch (err) {
        // エラーは無視（デフォルトで生成される）
      }
    }
  };

  /**
   * 設定を読み込む
   */
  const loadConfig = async () => {
    try {
      setLoading(true);
      // 設定はローカルストレージまたはデータベースから読み込む
      // ここではデフォルト値を使用
      const deviceId = await safeInvoke<string>('generate_device_id');
      setConfig((prev) => ({ ...prev, device_id: deviceId }));
    } catch (err) {
      // エラーは無視（デフォルト値を使用）
    } finally {
      setLoading(false);
    }
  };

  /**
   * 設定を保存
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      
      if (config.enabled && !config.access_token) {
        showError('アクセストークンを入力してください');
        return;
      }

      // 設定をエクスポート
      const settingsData = await safeInvoke<string>('export_settings_for_remote');
      
      // 同期設定を保存
      await safeInvoke('sync_settings', {
        config: {
          enabled: config.enabled,
          access_token: config.access_token || null,
          device_id: config.device_id,
          cloud_provider: config.cloud_provider,
          sync_interval_seconds: config.sync_interval_seconds,
        },
        settings_data: settingsData,
      });

      showSuccess('クラウド同期設定を保存しました');
    } catch (err) {
      showError(err instanceof Error ? err.message : '設定の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 手動同期を実行
   */
  const handleSync = async () => {
    try {
      setSyncing(true);
      
      // 設定をエクスポート
      const settingsData = await safeInvoke<string>('export_settings_for_remote');
      
      // 同期実行
      await safeInvoke('sync_settings', {
        config: {
          enabled: true,
          access_token: config.access_token || null,
          device_id: config.device_id,
          cloud_provider: config.cloud_provider,
          sync_interval_seconds: config.sync_interval_seconds,
        },
        settings_data: settingsData,
      });

      showSuccess('設定を同期しました');
    } catch (err) {
      showError(err instanceof Error ? err.message : '同期に失敗しました');
    } finally {
      setSyncing(false);
    }
  };

  /**
   * 設定を取得
   */
  const handleGetSyncedSettings = async () => {
    try {
      setSyncing(true);
      
      const syncedSettings = await safeInvoke<string | null>('get_synced_settings', {
        config: {
          enabled: true,
          access_token: config.access_token || null,
          device_id: config.device_id,
          cloud_provider: config.cloud_provider,
          sync_interval_seconds: config.sync_interval_seconds,
        },
      });

      if (syncedSettings) {
        // 設定をインポート
        await safeInvoke('import_settings_from_remote', { settings_json: syncedSettings });
        showSuccess('設定を取得しました');
      } else {
        showError('同期された設定が見つかりませんでした');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : '設定の取得に失敗しました');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="cloud-sync-settings-loading">
        <p>設定を読み込んでいます...</p>
      </div>
    );
  }

  return (
    <section className="cloud-sync-settings-section" aria-labelledby="cloud-sync-heading">
      <h2 id="cloud-sync-heading" className="settings-section-title">クラウド同期設定</h2>
      <p className="settings-section-description">
        複数デバイス間で設定を同期できます。GitHub Gist、Google Drive、Dropboxに対応しています。
      </p>

      <div className="settings-group">
        <label className="settings-checkbox-label" htmlFor="cloud-sync-enabled">
          <input
            id="cloud-sync-enabled"
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          <span>クラウド同期を有効にする</span>
        </label>
      </div>

      {config.enabled && (
        <>
          <div className="settings-group">
            <label className="settings-label" htmlFor="cloud-provider">
              クラウドプロバイダー
            </label>
            <select
              id="cloud-provider"
              className="settings-select"
              value={config.cloud_provider}
              onChange={(e) => setConfig({ ...config, cloud_provider: e.target.value })}
            >
              <option value="github">GitHub Gist</option>
              <option value="gdrive">Google Drive</option>
              <option value="dropbox">Dropbox</option>
            </select>
            <span className="settings-hint">
              設定を保存するクラウドサービスを選択してください
            </span>
          </div>

          <div className="settings-group">
            <label className="settings-label" htmlFor="access-token">
              アクセストークン
            </label>
            <input
              id="access-token"
              type="password"
              className="settings-input"
              placeholder="アクセストークンを入力"
              value={config.access_token || ''}
              onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
            />
            <span className="settings-hint">
              選択したクラウドサービスのアクセストークンを入力してください
            </span>
          </div>

          <div className="settings-group">
            <label className="settings-label" htmlFor="sync-interval">
              同期間隔（秒）
            </label>
            <input
              id="sync-interval"
              type="number"
              className="settings-input"
              min="60"
              max="86400"
              value={config.sync_interval_seconds}
              onChange={(e) =>
                setConfig({
                  ...config,
                  sync_interval_seconds: parseInt(e.target.value) || 3600,
                })
              }
            />
            <span className="settings-hint">
              自動同期の間隔を設定します（60秒〜86400秒）
            </span>
          </div>

          <div className="cloud-sync-actions">
            <button
              type="button"
              className="settings-button secondary"
              onClick={handleSync}
              disabled={saving || syncing}
            >
              {syncing ? '同期中...' : '今すぐ同期'}
            </button>
            <button
              type="button"
              className="settings-button secondary"
              onClick={handleGetSyncedSettings}
              disabled={saving || syncing}
            >
              {syncing ? '取得中...' : '設定を取得'}
            </button>
          </div>
        </>
      )}

      <div className="settings-actions">
        <button
          type="button"
          className="settings-button primary"
          onClick={handleSave}
          disabled={saving || syncing}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </section>
  );
};

