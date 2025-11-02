// FLM - アラート設定ページ
// フロントエンドエージェント (FE) 実装
// FE-012-02: アラート・閾値設定機能実装

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { AlertThreshold } from '../components/performance/AlertThreshold';
import { AlertHistorySection } from '../components/alerts/AlertHistory';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useNotifications } from '../contexts/NotificationContext';
import './AlertSettings.css';

/**
 * アラート設定
 */
interface AlertSettings {
  api_id: string | null;
  response_time_threshold: number | null;
  error_rate_threshold: number | null;
  cpu_usage_threshold: number | null;
  memory_usage_threshold: number | null;
  notifications_enabled: boolean | null;
}

/**
 * API情報
 */
interface ApiInfo {
  id: string;
  name: string;
}

/**
 * アラート設定ページ
 * パフォーマンスアラートの閾値を設定します
 */
export const AlertSettings: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const [apiList, setApiList] = useState<ApiInfo[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
  const [isGlobalSettings, setIsGlobalSettings] = useState(true);
  const [settings, setSettings] = useState<AlertSettings>({
    api_id: null,
    response_time_threshold: 5000, // デフォルト: 5秒
    error_rate_threshold: 0.1, // デフォルト: 10%
    cpu_usage_threshold: 80, // デフォルト: 80%
    memory_usage_threshold: 80, // デフォルト: 80%
    notifications_enabled: true,
  });
  const [enabledStates, setEnabledStates] = useState({
    response_time: true,
    error_rate: true,
    cpu_usage: true,
    memory_usage: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // API一覧を取得
  useEffect(() => {
    loadApiList();
  }, []);

  // 設定を読み込む
  useEffect(() => {
    loadSettings();
  }, [selectedApiId, isGlobalSettings]);

  /**
   * API一覧を読み込む
   */
  const loadApiList = async () => {
    try {
      const apis = await invoke<Array<{
        id: string;
        name: string;
      }>>('list_apis');
      setApiList(apis.map(api => ({ id: api.id, name: api.name })));
    } catch (err) {
      console.error('API一覧の取得に失敗しました:', err);
    }
  };

  /**
   * 設定を読み込む
   */
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiId = isGlobalSettings ? null : selectedApiId;
      const result = await invoke<AlertSettings>('get_alert_settings', {
        api_id: apiId,
      });

      setSettings(result);
      
      // 閾値が設定されている場合は有効、nullの場合は無効
      setEnabledStates({
        response_time: result.response_time_threshold !== null,
        error_rate: result.error_rate_threshold !== null,
        cpu_usage: result.cpu_usage_threshold !== null,
        memory_usage: result.memory_usage_threshold !== null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 設定を保存する
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const settingsToSave: AlertSettings = {
        api_id: isGlobalSettings ? null : selectedApiId,
        response_time_threshold: enabledStates.response_time ? settings.response_time_threshold : null,
        error_rate_threshold: enabledStates.error_rate ? settings.error_rate_threshold : null,
        cpu_usage_threshold: enabledStates.cpu_usage ? settings.cpu_usage_threshold : null,
        memory_usage_threshold: enabledStates.memory_usage ? settings.memory_usage_threshold : null,
        notifications_enabled: settings.notifications_enabled,
      };

      await invoke('update_alert_settings', { settings: settingsToSave });
      setSuccessMessage('アラート設定を保存しました');
      showSuccess('アラート設定を保存しました');
      
      // 5秒後に成功メッセージを非表示
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '設定の保存に失敗しました';
      setError(errorMessage);
      showError('設定の保存に失敗しました', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 設定をリセット（デフォルト値に戻す）
   */
  const handleReset = () => {
    if (!confirm('すべての設定をデフォルト値に戻しますか？')) {
      return;
    }

    setSettings({
      api_id: isGlobalSettings ? null : selectedApiId,
      response_time_threshold: 5000,
      error_rate_threshold: 0.1,
      cpu_usage_threshold: 80,
      memory_usage_threshold: 80,
      notifications_enabled: true,
    });
    setEnabledStates({
      response_time: true,
      error_rate: true,
      cpu_usage: true,
      memory_usage: true,
    });
  };

  /**
   * 設定タイプ（グローバル/API固有）を切り替え
   */
  const handleSettingTypeChange = (isGlobal: boolean) => {
    setIsGlobalSettings(isGlobal);
    if (!isGlobal && apiList.length > 0 && !selectedApiId) {
      setSelectedApiId(apiList[0].id);
    }
  };

  if (loading) {
    return (
      <div className="alert-settings-page">
        <div className="alert-settings-container">
          <div className="alert-settings-loading">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="alert-settings-page">
      <div className="alert-settings-container">
        <header className="alert-settings-header">
          <button className="alert-settings-back-button" onClick={() => navigate('/')}>
            ← ホームに戻る
          </button>
          <h1 className="alert-settings-title">アラート設定</h1>
          <p className="alert-settings-subtitle">
            パフォーマンスメトリクスの閾値を設定して、異常を検知します
          </p>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="general"
            onClose={() => setError(null)}
          />
        )}

        {successMessage && (
          <InfoBanner
            type="success"
            message={successMessage}
            dismissible
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        <div className="alert-settings-content">
          {/* 設定タイプ選択 */}
          <section className="alert-settings-section">
            <h2 className="alert-settings-section-title">設定タイプ</h2>
            <div className="alert-settings-type-selector">
              <label className="alert-settings-type-option">
                <input
                  type="radio"
                  name="setting-type"
                  checked={isGlobalSettings}
                  onChange={() => handleSettingTypeChange(true)}
                />
                <span>グローバル設定（すべてのAPIに適用）</span>
              </label>
              <label className="alert-settings-type-option">
                <input
                  type="radio"
                  name="setting-type"
                  checked={!isGlobalSettings}
                  onChange={() => handleSettingTypeChange(false)}
                />
                <span>API固有設定</span>
              </label>
            </div>

            {!isGlobalSettings && (
              <div className="alert-settings-api-selector">
                <label htmlFor="api-select">
                  対象API:
                  <select
                    id="api-select"
                    value={selectedApiId || ''}
                    onChange={(e) => setSelectedApiId(e.target.value || null)}
                    className="alert-settings-api-select"
                  >
                    <option value="">選択してください</option>
                    {apiList.map((api) => (
                      <option key={api.id} value={api.id}>
                        {api.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </section>

          {/* アラート閾値設定 */}
          <section className="alert-settings-section">
            <h2 className="alert-settings-section-title">アラート閾値</h2>
            <div className="alert-settings-thresholds">
              <AlertThreshold
                type="response_time"
                threshold={settings.response_time_threshold || 5000}
                onChange={(value) => setSettings({ ...settings, response_time_threshold: value })}
                enabled={enabledStates.response_time}
                onEnabledChange={(enabled) =>
                  setEnabledStates({ ...enabledStates, response_time: enabled })
                }
              />
              <AlertThreshold
                type="error_rate"
                threshold={settings.error_rate_threshold || 0.1}
                onChange={(value) => setSettings({ ...settings, error_rate_threshold: value })}
                enabled={enabledStates.error_rate}
                onEnabledChange={(enabled) =>
                  setEnabledStates({ ...enabledStates, error_rate: enabled })
                }
              />
              <AlertThreshold
                type="cpu_usage"
                threshold={settings.cpu_usage_threshold || 80}
                onChange={(value) => setSettings({ ...settings, cpu_usage_threshold: value })}
                enabled={enabledStates.cpu_usage}
                onEnabledChange={(enabled) =>
                  setEnabledStates({ ...enabledStates, cpu_usage: enabled })
                }
              />
              <AlertThreshold
                type="memory_usage"
                threshold={settings.memory_usage_threshold || 80}
                onChange={(value) => setSettings({ ...settings, memory_usage_threshold: value })}
                enabled={enabledStates.memory_usage}
                onEnabledChange={(enabled) =>
                  setEnabledStates({ ...enabledStates, memory_usage: enabled })
                }
              />
            </div>
          </section>

          {/* 通知設定 */}
          <section className="alert-settings-section">
            <h2 className="alert-settings-section-title">通知設定</h2>
            <div className="alert-settings-notification">
              <label className="alert-settings-notification-label">
                <input
                  type="checkbox"
                  checked={settings.notifications_enabled ?? true}
                  onChange={(e) =>
                    setSettings({ ...settings, notifications_enabled: e.target.checked })
                  }
                />
                <span>アラート通知を有効にする</span>
              </label>
              <p className="alert-settings-notification-hint">
                閾値を超過した場合に通知を表示します
              </p>
            </div>
          </section>

          {/* アラート履歴 */}
          <section className="alert-settings-section">
            <AlertHistorySection
              apiId={selectedApiId}
              isGlobalSettings={isGlobalSettings}
            />
          </section>
        </div>

        <div className="alert-settings-actions">
          <button
            className="alert-settings-button secondary"
            onClick={handleReset}
            disabled={saving}
            type="button"
          >
            デフォルトに戻す
          </button>
          <div className="alert-settings-actions-right">
            <button
              className="alert-settings-button secondary"
              onClick={() => navigate('/')}
              disabled={saving}
              type="button"
            >
              キャンセル
            </button>
            <button
              className="alert-settings-button primary"
              onClick={handleSave}
              disabled={saving || (!isGlobalSettings && !selectedApiId)}
              type="button"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
