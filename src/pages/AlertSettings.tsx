// AlertSettings - アラート設定ページ

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { AlertThreshold } from '../components/performance/AlertThreshold';
import { AlertHistorySection } from '../components/alerts/AlertHistory';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useI18n } from '../contexts/I18nContext';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useNotifications } from '../contexts/NotificationContext';
import { ALERT_DEFAULTS, TIMEOUT } from '../constants/config';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
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
 * API情報（ローカル定義）
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
  const { t } = useI18n();
  const { showSuccess, showError } = useNotifications();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: 'アラート設定' },
  ], [t]);
  const [apiList, setApiList] = useState<ApiInfo[]>([]);
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
  const [isGlobalSettings, setIsGlobalSettings] = useState(true);
  const [settings, setSettings] = useState<AlertSettings>({
    api_id: null,
    response_time_threshold: ALERT_DEFAULTS.RESPONSE_TIME_THRESHOLD, // デフォルト: 5秒
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
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  // 確認ダイアログの状態
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: 'アラート設定' },
  ], [t]);

  // API一覧を取得
  useEffect(() => {
    loadApiList();
  }, []);

  // 設定を読み込む
  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApiId, isGlobalSettings]);

  // ESCキーで確認ダイアログを閉じる
  useEffect(() => {
    if (!confirmDialog.isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [confirmDialog.isOpen]);

  /**
   * API一覧を読み込む
   */
  const loadApiList = async () => {
    try {
      const apis = await safeInvoke<
        Array<{
          id: string;
          name: string;
        }>
      >('list_apis');
      setApiList(apis.map(api => ({ id: api.id, name: api.name })));
    } catch (err) {
      logger.error('API一覧の取得に失敗しました', err, 'AlertSettings');
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
      const result = await safeInvoke<AlertSettings>('get_alert_settings', {
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
      setError(
        extractErrorMessage(err, '設定の読み込みに失敗しました')
      );
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
        response_time_threshold: enabledStates.response_time
          ? settings.response_time_threshold
          : null,
        error_rate_threshold: enabledStates.error_rate
          ? settings.error_rate_threshold
          : null,
        cpu_usage_threshold: enabledStates.cpu_usage
          ? settings.cpu_usage_threshold
          : null,
        memory_usage_threshold: enabledStates.memory_usage
          ? settings.memory_usage_threshold
          : null,
        notifications_enabled: settings.notifications_enabled,
      };

      await safeInvoke('update_alert_settings', { settings: settingsToSave });
      setSuccessMessage('アラート設定を保存しました');
      showSuccess('アラート設定を保存しました');

      // 5秒後に成功メッセージを非表示
      setTimeout(() => setSuccessMessage(null), TIMEOUT.SUCCESS_MESSAGE);
    } catch (err) {
      const errorMessage = extractErrorMessage(err, '設定の保存に失敗しました');
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
    setConfirmDialog({
      isOpen: true,
      message: 'すべての設定をデフォルト値に戻しますか？',
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setSettings({
          api_id: isGlobalSettings ? null : selectedApiId,
          response_time_threshold: ALERT_DEFAULTS.RESPONSE_TIME_THRESHOLD,
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
        showSuccess('設定をデフォルト値に戻しました');
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
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
          <Breadcrumb items={breadcrumbItems} />
          <header className="alert-settings-header">
            <SkeletonLoader type="button" width="100px" />
            <SkeletonLoader type="title" width="200px" />
          </header>
          <div className="alert-settings-content">
            <SkeletonLoader type="form" count={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="alert-settings-page">
      <div className="alert-settings-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="alert-settings-header">
          <button
            className="alert-settings-back-button"
            onClick={() => navigate('/')}
          >
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
                    onChange={e => setSelectedApiId(e.target.value || null)}
                    className="alert-settings-api-select"
                  >
                    <option value="">選択してください</option>
                    {apiList.map(api => (
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
                threshold={
                  settings.response_time_threshold ||
                  ALERT_DEFAULTS.RESPONSE_TIME_THRESHOLD
                }
                onChange={value =>
                  setSettings({ ...settings, response_time_threshold: value })
                }
                enabled={enabledStates.response_time}
                onEnabledChange={enabled =>
                  setEnabledStates({ ...enabledStates, response_time: enabled })
                }
              />
              <AlertThreshold
                type="error_rate"
                threshold={settings.error_rate_threshold || 0.1}
                onChange={value =>
                  setSettings({ ...settings, error_rate_threshold: value })
                }
                enabled={enabledStates.error_rate}
                onEnabledChange={enabled =>
                  setEnabledStates({ ...enabledStates, error_rate: enabled })
                }
              />
              <AlertThreshold
                type="cpu_usage"
                threshold={settings.cpu_usage_threshold || 80}
                onChange={value =>
                  setSettings({ ...settings, cpu_usage_threshold: value })
                }
                enabled={enabledStates.cpu_usage}
                onEnabledChange={enabled =>
                  setEnabledStates({ ...enabledStates, cpu_usage: enabled })
                }
              />
              <AlertThreshold
                type="memory_usage"
                threshold={settings.memory_usage_threshold || 80}
                onChange={value =>
                  setSettings({ ...settings, memory_usage_threshold: value })
                }
                enabled={enabledStates.memory_usage}
                onEnabledChange={enabled =>
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
                  onChange={e =>
                    setSettings({
                      ...settings,
                      notifications_enabled: e.target.checked,
                    })
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
              onClick={() => {
                startTransition(() => {
                  handleSave();
                });
              }}
              disabled={saving || (!isGlobalSettings && !selectedApiId) || isPending}
              type="button"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* 確認ダイアログ */}
        {confirmDialog.isOpen && (
          <div
            className="confirm-dialog-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div
              className="confirm-dialog"
              role="document"
            >
              <h3 id="confirm-dialog-title">確認</h3>
              <p>{confirmDialog.message}</p>
              <div className="confirm-dialog-actions">
                <button
                  className="confirm-button cancel"
                  onClick={confirmDialog.onCancel}
                  type="button"
                >
                  キャンセル
                </button>
                <button
                  className="confirm-button confirm"
                  onClick={confirmDialog.onConfirm}
                  type="button"
                >
                  確認
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
