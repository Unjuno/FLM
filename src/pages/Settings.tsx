// Settings - アプリケーション設定ページ

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { listen } from '@tauri-apps/api/event';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { AUTO_REFRESH, TIMEOUT, LOG_RETENTION } from '../constants/config';
import { CloudSyncSettings } from '../components/settings/CloudSyncSettings';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import type { DownloadProgress } from '../types/ollama';
import './Settings.css';

/**
 * プログレスバーコンポーネント（インラインスタイルなし）
 */
const ProgressBar: React.FC<{ progress: number; message?: string }> = ({ progress, message }) => {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.setProperty('--progress-width', `${progress}%`);
    }
  }, [progress]);

  return (
    <div className="settings-update-progress" ref={progressRef}>
      <div className="settings-progress-bar">
        <div className="settings-progress-fill" />
      </div>
      <span className="settings-progress-text">
        {message || `${Math.round(progress)}%`}
      </span>
    </div>
  );
};

/**
 * エンジン更新プログレスバーコンポーネント（インラインスタイルなし）
 */
const EngineProgressBar: React.FC<{ progress: number; message?: string }> = ({ progress, message }) => {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.setProperty('--progress-width', `${progress}%`);
    }
  }, [progress]);

  return (
    <div className="settings-engine-update-progress" ref={progressRef}>
      <div className="settings-progress-bar">
        <div className="settings-progress-fill" />
      </div>
      <div className="settings-progress-text">
        {message || `${Math.round(progress)}%`}
      </div>
    </div>
  );
};

/**
 * アプリケーション設定
 */
interface AppSettings {
  theme: string | null;
  language: string | null;
  auto_refresh_interval: number | null;
  log_retention_days: number | null;
  audit_log_retention_days: number | null;
  notifications_enabled: boolean | null;
  stop_apis_on_exit: boolean | null;
  diagnostics_enabled: boolean | null;
  performance_metrics_enabled: boolean | null;
  include_ip_address_in_audit_log: boolean | null;
  device_id_enabled: boolean | null;
}

/**
 * アプリケーション設定ページ
 * アプリケーション全体の設定を管理します
 */
export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { theme, actualTheme, setTheme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  // actualTheme, setTheme, toggleThemeは使用されています（178行目、76行目、195行目で使用）
  const [settings, setSettings] = useState<AppSettings>({
    theme: null,
    language: null,
    auto_refresh_interval: null,
    log_retention_days: null,
    audit_log_retention_days: null,
    notifications_enabled: null,
    stop_apis_on_exit: null,
    diagnostics_enabled: null,
    performance_metrics_enabled: null,
    include_ip_address_in_audit_log: null,
    device_id_enabled: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmVariant?: 'primary' | 'danger';
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    confirmVariant: 'primary',
  });

  // 設定を読み込む
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await safeInvoke<AppSettings>('get_app_settings');
      setSettings(result);
      // 言語設定をI18nコンテキストに反映
      if (result.language === 'en' || result.language === 'ja') {
        setLocale(result.language);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('settings.messages.loadError')
      );
    } finally {
      setLoading(false);
    }
  }, [setLocale, t]);

  // 設定を読み込む（マウント時）
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // テーマが変更されたときに設定を更新
  useEffect(() => {
    if (settings.theme !== theme) {
      setSettings(prev => ({ ...prev, theme }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // 設定を保存する
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // テーマ設定を同期
      if (settings.theme) {
        await setTheme(settings.theme as 'light' | 'dark' | 'auto');
      }

      await safeInvoke('update_app_settings', { settings });
      setSuccessMessage(t('settings.messages.saveSuccess'));

      // 5秒後に成功メッセージを非表示
      setTimeout(() => setSuccessMessage(null), TIMEOUT.SUCCESS_MESSAGE);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('settings.messages.saveError')
      );
    } finally {
      setSaving(false);
    }
  };

  // テーマ変更ハンドラー
  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
    try {
      await setTheme(newTheme);
      setSettings(prev => ({ ...prev, theme: newTheme }));
      setSuccessMessage(t('settings.messages.themeChangeSuccess'));
      setTimeout(() => setSuccessMessage(null), TIMEOUT.ERROR_MESSAGE);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('settings.messages.themeChangeError')
      );
    }
  };

  // 設定をリセット（デフォルト値に戻す）
  const handleReset = async () => {
    setConfirmDialog({
      isOpen: true,
      message: t('settings.actions.resetConfirm'),
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));

        try {
          setSaving(true);
          setError(null);

          const defaultSettings: AppSettings = {
            theme: 'auto',
            language: 'ja',
            auto_refresh_interval: AUTO_REFRESH.DEFAULT_INTERVAL,
            log_retention_days: LOG_RETENTION.DEFAULT_DAYS,
            audit_log_retention_days: 90, // デフォルト: 90日
            notifications_enabled: true,
            stop_apis_on_exit: true,
            diagnostics_enabled: true, // デフォルト: 有効
            performance_metrics_enabled: true, // デフォルト: 有効
            include_ip_address_in_audit_log: true, // デフォルト: 有効
            device_id_enabled: true, // デフォルト: 有効（リモート同期機能で使用）
          };

          await safeInvoke('update_app_settings', { settings: defaultSettings });
          setSettings(defaultSettings);
          setSuccessMessage(t('settings.messages.resetSuccess'));

          setTimeout(() => setSuccessMessage(null), TIMEOUT.SUCCESS_MESSAGE);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : t('settings.messages.resetError')
          );
        } finally {
          setSaving(false);
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // パンくずリストの項目（早期リターンの前にフックを呼び出す）
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('settings.title') || '設定' },
  ], [t]);

  if (loading) {
    return (
      <div className="page-background settings-page">
        <div className="page-container settings-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header settings-header">
            <SkeletonLoader type="button" width="100px" />
            <SkeletonLoader type="title" width="200px" />
            <SkeletonLoader type="text" width="300px" />
          </header>
          <div className="settings-content-wrapper">
            <div className="settings-content">
              <SkeletonLoader type="form" count={5} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-background settings-page">
      <div className="page-container settings-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="page-header settings-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← ホームに戻る
          </button>
          <h1>{t('settings.title')}</h1>
          <p className="settings-subtitle" role="doc-subtitle">
            {t('settings.subtitle')}
          </p>
        </header>

        <div className="settings-content-wrapper">
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

          <div className="settings-content">
            {/* テーマ設定 */}
            <section
              className="settings-section"
              aria-labelledby="appearance-heading"
            >
              <h2 id="appearance-heading" className="settings-section-title">
                {t('settings.appearance.title')}
              </h2>
              <div className="settings-group">
                <label htmlFor="theme">
                  {t('settings.appearance.theme')}
                  <span className="settings-hint">
                    {t('settings.appearance.themeHint', {
                      currentTheme:
                        actualTheme === 'dark'
                          ? t('settings.appearance.themeDark')
                          : t('settings.appearance.themeLight'),
                    })}
                  </span>
                </label>
                <select
                  id="theme"
                  value={settings.theme || theme}
                  onChange={e =>
                    handleThemeChange(
                      e.target.value as 'light' | 'dark' | 'auto'
                    )
                  }
                  className="settings-select"
                  aria-label={t('settings.appearance.theme')}
                >
                  <option value="auto">
                    {t('settings.appearance.themeAuto')}
                  </option>
                  <option value="light">
                    {t('settings.appearance.themeLight')}
                  </option>
                  <option value="dark">
                    {t('settings.appearance.themeDark')}
                  </option>
                </select>
                <div className="settings-theme-preview">
                  <button
                    type="button"
                    className="settings-theme-toggle"
                    onClick={toggleTheme}
                    aria-label={t('settings.appearance.theme')}
                    title={t('settings.appearance.theme')}
                  >
                    {t('settings.appearance.quickToggle')}
                  </button>
                </div>
              </div>
            </section>

            {/* 言語設定 */}
            <section
              className="settings-section"
              aria-labelledby="language-heading"
            >
              <h2 id="language-heading" className="settings-section-title">
                {t('settings.language.title')}
              </h2>
              <div className="settings-group">
                <label htmlFor="language">
                  {t('settings.language.label')}
                  <span className="settings-hint">
                    {t('settings.language.hint')}
                  </span>
                </label>
                <select
                  id="language"
                  value={settings.language || locale || 'ja'}
                  onChange={async e => {
                    const newLanguage = e.target.value as 'ja' | 'en';
                    setSettings({ ...settings, language: newLanguage });
                    // I18nコンテキストも即座に更新
                    await setLocale(newLanguage);
                  }}
                  className="settings-select"
                  aria-label={t('settings.language.label')}
                >
                  <option value="ja">{t('settings.language.japanese')}</option>
                  <option value="en">{t('settings.language.english')}</option>
                  <option value="zh">{t('settings.language.chinese')}</option>
                  <option value="ko">{t('settings.language.korean')}</option>
                  <option value="es">{t('settings.language.spanish')}</option>
                  <option value="fr">{t('settings.language.french')}</option>
                  <option value="de">{t('settings.language.german')}</option>
                </select>
              </div>
            </section>

            {/* 自動更新設定 */}
            <section
              className="settings-section"
              aria-labelledby="auto-refresh-heading"
            >
              <h2 id="auto-refresh-heading" className="settings-section-title">
                {t('settings.autoRefresh.title')}
              </h2>
              <div className="settings-group">
                <label htmlFor="auto-refresh-interval">
                  {t('settings.autoRefresh.label')}
                  <span className="settings-hint">
                    {t('settings.autoRefresh.hint')}
                  </span>
                </label>
                <input
                  id="auto-refresh-interval"
                  type="number"
                  min={AUTO_REFRESH.MIN_INTERVAL}
                  max={AUTO_REFRESH.MAX_INTERVAL}
                  step="5"
                  value={
                    settings.auto_refresh_interval ||
                    AUTO_REFRESH.DEFAULT_INTERVAL
                  }
                  onChange={e =>
                    setSettings({
                      ...settings,
                      auto_refresh_interval:
                        parseInt(e.target.value) ||
                        AUTO_REFRESH.DEFAULT_INTERVAL,
                    })
                  }
                  className="settings-input"
                  aria-label={`自動更新間隔（秒）。最小${AUTO_REFRESH.MIN_INTERVAL}秒、最大${AUTO_REFRESH.MAX_INTERVAL}秒。`}
                />
              </div>
            </section>

            {/* ログ保持期間設定 */}
            <section
              className="settings-section"
              aria-labelledby="log-management-heading"
            >
              <h2
                id="log-management-heading"
                className="settings-section-title"
              >
                {t('settings.logManagement.title')}
              </h2>
              <div className="settings-group">
                <label htmlFor="log-retention-days">
                  {t('settings.logManagement.label')}
                  <span className="settings-hint">
                    {t('settings.logManagement.hint')}
                  </span>
                </label>
                <input
                  id="log-retention-days"
                  type="number"
                  min={LOG_RETENTION.MIN_DAYS}
                  max={LOG_RETENTION.MAX_DAYS}
                  value={
                    settings.log_retention_days || LOG_RETENTION.DEFAULT_DAYS
                  }
                  onChange={e =>
                    setSettings({
                      ...settings,
                      log_retention_days:
                        parseInt(e.target.value) || LOG_RETENTION.DEFAULT_DAYS,
                    })
                  }
                  className="settings-input"
                  aria-label={`ログ保持期間（日数）。最小${LOG_RETENTION.MIN_DAYS}日、最大${LOG_RETENTION.MAX_DAYS}日。`}
                />
              </div>
              <div className="settings-group">
                <label htmlFor="audit-log-retention-days">
                  監査ログ保持期間（日数）
                  <span className="settings-hint">
                    監査ログを保持する日数を設定します（最小1日、最大365日、デフォルト: 90日）
                  </span>
                </label>
                <input
                  id="audit-log-retention-days"
                  type="number"
                  min={LOG_RETENTION.MIN_DAYS}
                  max={LOG_RETENTION.MAX_DAYS}
                  value={
                    settings.audit_log_retention_days ?? 90
                  }
                  onChange={e =>
                    setSettings({
                      ...settings,
                      audit_log_retention_days:
                        parseInt(e.target.value) || 90,
                    })
                  }
                  className="settings-input"
                  aria-label={`監査ログ保持期間（日数）。最小${LOG_RETENTION.MIN_DAYS}日、最大${LOG_RETENTION.MAX_DAYS}日。`}
                />
              </div>
            </section>

            {/* プライバシー設定 */}
            <section
              className="settings-section"
              aria-labelledby="privacy-heading"
            >
              <h2
                id="privacy-heading"
                className="settings-section-title"
              >
                プライバシー設定
              </h2>
              <div className="settings-group">
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.diagnostics_enabled ?? true}
                    onChange={e =>
                      setSettings({
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
                      setSettings({
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
                      setSettings({
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
                      setSettings({
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

            {/* 通知設定 */}
            <section
              className="settings-section"
              aria-labelledby="notifications-heading"
            >
              <h2 id="notifications-heading" className="settings-section-title">
                {t('settings.notifications.title')}
              </h2>
              <div className="settings-group">
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.notifications_enabled ?? true}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        notifications_enabled: e.target.checked,
                      })
                    }
                    aria-label={t('settings.notifications.label')}
                  />
                  <span>{t('settings.notifications.label')}</span>
                </label>
                <span className="settings-hint">
                  {t('settings.notifications.hint')}
                </span>
              </div>
            </section>

            {/* アプリ終了時の動作設定 */}
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
                      setSettings({
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

            {/* エンジンアップデート */}
            <EngineUpdateSection />

            {/* アプリケーションアップデート */}
            <AppUpdateSection />

            {/* データベース管理 */}
            <section
              className="settings-section"
              aria-labelledby="database-heading"
            >
              <h2 id="database-heading" className="settings-section-title">
                {t('settings.database.title')}
              </h2>
              <div className="settings-group">
                <p className="settings-info">{t('settings.database.info')}</p>
              </div>
            </section>

            {/* クラウド同期設定 */}
            <CloudSyncSettings />
          </div>

          <div className="settings-actions">
            <button
              className="settings-button secondary"
              onClick={handleReset}
              disabled={saving}
              aria-label={t('settings.actions.reset')}
              type="button"
            >
              {t('settings.actions.reset')}
            </button>
            <div className="settings-actions-right">
              <button
                className="settings-button secondary"
                onClick={loadSettings}
                disabled={saving}
                aria-label={t('settings.actions.cancel')}
                type="button"
              >
                {t('settings.actions.cancel')}
              </button>
              <button
                className="settings-button primary"
                onClick={handleSave}
                disabled={saving}
                aria-label={
                  saving
                    ? t('settings.actions.saving')
                    : t('settings.actions.save')
                }
                type="button"
              >
                {saving
                  ? t('settings.actions.saving')
                  : t('settings.actions.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {confirmDialog.isOpen && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
          confirmVariant={confirmDialog.confirmVariant || 'primary'}
        />
      )}
    </div>
  );
};

/**
 * Ollamaアップデートチェック結果
 */
interface OllamaUpdateCheck {
  update_available: boolean;
  current_version: string | null;
  latest_version: string;
}

/**
 * ダウンロード進捗情報（エンジン用）
 */
interface EngineDownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
  message?: string;
}

/**
 * エンジンアップデートチェック結果
 */
interface EngineUpdateCheck {
  update_available: boolean;
  current_version: string | null;
  latest_version: string;
}

/**
 * アプリケーションアップデートセクション
 */
const AppUpdateSection: React.FC = () => {
  const { t } = useI18n();
  const {
    checking,
    installing,
    updateAvailable,
    currentVersion,
    latestVersion,
    releaseNotes,
    progress,
    error,
    checkUpdate,
    installUpdate,
  } = useAppUpdate();

  return (
    <section
      className="settings-section"
      aria-labelledby="app-update-heading"
    >
      <h2 id="app-update-heading" className="settings-section-title">
        {t('settings.appUpdate.title') || 'アプリケーションアップデート'}
      </h2>
      <div className="settings-group">
        <div className="settings-update-info">
          <p className="settings-update-description">
            {t('settings.appUpdate.description') ||
              'アプリケーションの最新バージョンを確認し、セキュリティパッチを適用できます。'}
          </p>
          <div className="settings-version-info">
            <span className="settings-version-label">
              {t('settings.appUpdate.currentVersion') || '現在のバージョン'}:
            </span>
            <span className="settings-version-value">{currentVersion}</span>
            {latestVersion && (
              <>
                <span className="settings-version-label">
                  {t('settings.appUpdate.latestVersion') || '最新バージョン'}:
                </span>
                <span className="settings-version-value">{latestVersion}</span>
              </>
            )}
          </div>
          {error && (
            <ErrorMessage
              message={error}
              type="api"
              onClose={() => {}}
            />
          )}
          {progress && (
            <ProgressBar 
              progress={progress.progress}
              message={progress.message ?? undefined}
            />
          )}
          {releaseNotes && updateAvailable && (
            <div className="settings-release-notes">
              <h3>{t('settings.appUpdate.releaseNotes') || 'リリースノート'}</h3>
              <div className="settings-release-notes-content">
                {releaseNotes}
              </div>
            </div>
          )}
        </div>
        <div className="settings-update-actions">
          <button
            type="button"
            className="settings-button secondary"
            onClick={checkUpdate}
            disabled={checking || installing}
          >
            {checking
              ? t('settings.appUpdate.checking') || '確認中...'
              : t('settings.appUpdate.check') || 'アップデート確認'}
          </button>
          {updateAvailable && (
            <button
              type="button"
              className="settings-button primary"
              onClick={installUpdate}
              disabled={checking || installing}
            >
              {installing
                ? t('settings.appUpdate.installing') || 'インストール中...'
                : t('settings.appUpdate.install') || 'アップデートをインストール'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

/**
 * エンジンアップデートセクション
 */
const EngineUpdateSection: React.FC = () => {
  const { t } = useI18n();
  const [engines] = useState(['ollama', 'lm_studio', 'vllm', 'llama_cpp']);
  const [engineNames] = useState<Record<string, string>>({
    ollama: 'Ollama',
    lm_studio: 'LM Studio',
    vllm: 'vLLM',
    llama_cpp: 'llama.cpp',
  });
  const [checking, setChecking] = useState<{ [key: string]: boolean }>({});
  const [updating, setUpdating] = useState<{ [key: string]: boolean }>({});
  const [installing, setInstalling] = useState<{ [key: string]: boolean }>({});
  const [updateInfo, setUpdateInfo] = useState<{
    [key: string]: EngineUpdateCheck | null;
  }>({});
  // エンジン検出結果の型定義
  interface EngineDetectionResult {
    engine_type: string;
    installed: boolean;
    running: boolean;
    version?: string;
    path?: string;
    message?: string;
  }

  const [detectionResults, setDetectionResults] = useState<{
    [key: string]: EngineDetectionResult | null;
  }>({});
  const [error, setError] = useState<{ [key: string]: string | null }>({});
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const [successMessage, setSuccessMessage] = useState<{
    [key: string]: string | null;
  }>({});
  const [progress, setProgress] = useState<{
    [key: string]: EngineDownloadProgress | null;
  }>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmVariant?: 'primary' | 'danger';
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // エンジン検出
  const detectEngine = useCallback(async (engineType: string) => {
    try {
      const result = await safeInvoke<EngineDetectionResult>('detect_engine', { engineType });
      setDetectionResults(prev => ({ ...prev, [engineType]: result }));
    } catch (err) {
      setError(prev => ({
        ...prev,
        [engineType]:
          err instanceof Error ? err.message : 'エンジン検出に失敗しました',
      }));
    }
  }, []);

  // アップデートチェック
  const checkUpdate = useCallback(async (engineType: string) => {
    try {
      setChecking(prev => ({ ...prev, [engineType]: true }));
      setError(prev => ({ ...prev, [engineType]: null }));

      let result: EngineUpdateCheck;
      if (engineType === 'ollama') {
        const ollamaResult = await safeInvoke<OllamaUpdateCheck>(
          'check_ollama_update'
        );
        result = {
          update_available: ollamaResult.update_available,
          current_version: ollamaResult.current_version,
          latest_version: ollamaResult.latest_version,
        };
      } else {
        result = await safeInvoke<EngineUpdateCheck>('check_engine_update', {
          engineType,
        });
      }

      setUpdateInfo(prev => ({ ...prev, [engineType]: result }));
    } catch (err) {
      setError(prev => ({
        ...prev,
        [engineType]:
          err instanceof Error
            ? err.message
            : 'アップデートチェックに失敗しました',
      }));
    } finally {
      setChecking(prev => ({ ...prev, [engineType]: false }));
    }
  }, []);

  // インストール実行
  const handleInstall = useCallback(
    async (engineType: string) => {
      setConfirmDialog({
        isOpen: true,
        message: `${engineNames[engineType]}をインストールしますか？`,
        confirmVariant: 'primary',
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));

          try {
            setInstalling(prev => ({ ...prev, [engineType]: true }));
            setError(prev => ({ ...prev, [engineType]: null }));
            setProgress(prev => ({ ...prev, [engineType]: null }));

            // 進捗イベントをリッスン
            const unlisten = await listen<DownloadProgress>('engine_install_progress', event => {
              if (event.payload && typeof event.payload.progress === 'number') {
                setProgress(prev => ({
                  ...prev,
                  [engineType]: {
                    downloaded: event.payload.downloaded_bytes || 0,
                    total: event.payload.total_bytes || 0,
                    percentage: event.payload.progress || 0,
                  },
                }));
              }
            });

            // インストール実行
            await safeInvoke('install_engine', { engine_type: engineType });

            // イベントリスナーを解除
            unlisten();

            setSuccessMessage(prev => ({
              ...prev,
              [engineType]: `${engineNames[engineType]}のインストールが完了しました`,
            }));
            setTimeout(
              () => setSuccessMessage(prev => ({ ...prev, [engineType]: null })),
              TIMEOUT.SUCCESS_MESSAGE
            );
            setProgress(prev => ({ ...prev, [engineType]: null }));

            // インストール後に再度検出
            await detectEngine(engineType);
          } catch (err) {
            setError(prev => ({
              ...prev,
              [engineType]:
                err instanceof Error ? err.message : 'インストールに失敗しました',
            }));
          } finally {
            setInstalling(prev => ({ ...prev, [engineType]: false }));
            setProgress(prev => ({ ...prev, [engineType]: null }));
          }
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        },
      });
    },
    [engineNames, detectEngine, setConfirmDialog]
  );

  // アップデート実行
  const handleUpdate = useCallback(
    async (engineType: string) => {
      setConfirmDialog({
        isOpen: true,
        message: `${engineNames[engineType]}を最新版に更新しますか？更新中は${engineNames[engineType]}が一時的に停止します。`,
        confirmVariant: 'primary',
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));

          try {
            setUpdating(prev => ({ ...prev, [engineType]: true }));
            setError(prev => ({ ...prev, [engineType]: null }));
            setProgress(prev => ({ ...prev, [engineType]: null }));

            // 進捗イベントをリッスン
            const eventName =
              engineType === 'ollama'
                ? 'ollama_update_progress'
                : 'engine_update_progress';
            const unlisten = await listen<DownloadProgress>(eventName, event => {
              if (event.payload && typeof event.payload.progress === 'number') {
                setProgress(prev => ({
                  ...prev,
                  [engineType]: {
                    downloaded: event.payload.downloaded_bytes || 0,
                    total: event.payload.total_bytes || 0,
                    percentage: event.payload.progress || 0,
                  },
                }));
              }
            });

            // アップデート実行
            if (engineType === 'ollama') {
              await safeInvoke('update_ollama');
            } else {
              await safeInvoke('update_engine', { engineType });
            }

            // イベントリスナーを解除
            unlisten();

            setSuccessMessage(prev => ({
              ...prev,
              [engineType]: `${engineNames[engineType]}を最新版に更新しました`,
            }));
            setTimeout(
              () => setSuccessMessage(prev => ({ ...prev, [engineType]: null })),
              TIMEOUT.SUCCESS_MESSAGE
            );
            setUpdateInfo(prev => ({ ...prev, [engineType]: null }));
            setProgress(prev => ({ ...prev, [engineType]: null }));

            // 更新後に再度チェック
            await checkUpdate(engineType);
          } catch (err) {
            setError(prev => ({
              ...prev,
              [engineType]:
                err instanceof Error ? err.message : 'アップデートに失敗しました',
            }));
          } finally {
            setUpdating(prev => ({ ...prev, [engineType]: false }));
            setProgress(prev => ({ ...prev, [engineType]: null }));
          }
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        },
      });
    },
    [engineNames, checkUpdate, setConfirmDialog]
  );

  // 初回マウント時に全エンジンを検出・チェック
  useEffect(() => {
    engines.forEach(engineType => {
      detectEngine(engineType);
      if (engineType === 'ollama') {
        checkUpdate(engineType);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回マウント時のみ実行

  return (
    <section
      className="settings-section"
      aria-labelledby="engine-update-heading"
    >
      <h2 id="engine-update-heading" className="settings-section-title">
        {t('settings.engineUpdate.title') || 'エンジン管理'}
      </h2>
      <div className="settings-group">
        {engines.map(engineType => {
          const detection = detectionResults[engineType];
          const update = updateInfo[engineType];
          const isInstalled = detection?.installed || false;
          const isRunning = detection?.running || false;
          const isChecking = checking[engineType] || false;
          const isUpdating = updating[engineType] || false;
          const isInstalling = installing[engineType] || false;
          const engineError = error[engineType];
          const engineSuccess = successMessage[engineType];
          const engineProgress = progress[engineType];

          return (
            <div key={engineType} className="settings-engine-update">
              <div className="settings-engine-update-header">
                <div>
                  <h3>{engineNames[engineType]}</h3>
                  <div className="settings-engine-status">
                    {isInstalled ? (
                      <>
                        <span className="status-badge success">
                          インストール済み
                        </span>
                        {isRunning ? (
                          <span className="status-badge success">実行中</span>
                        ) : (
                          <span className="status-badge warning">停止中</span>
                        )}
                        {detection?.version && (
                          <span className="settings-engine-version">
                            バージョン: {detection.version}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="status-badge error">未インストール</span>
                    )}
                  </div>
                  {update && (
                    <div className="settings-engine-version-info">
                      {update.current_version && (
                        <span className="settings-engine-version">
                          {t('settings.engineUpdate.currentVersion') ||
                            '現在のバージョン'}
                          : {update.current_version}
                        </span>
                      )}
                      <span className="settings-engine-version">
                        {t('settings.engineUpdate.latestVersion') ||
                          '最新バージョン'}
                        : {update.latest_version}
                      </span>
                    </div>
                  )}
                </div>
                <div className="settings-engine-actions">
                  {!isInstalled ? (
                    <button
                      type="button"
                      className="settings-button primary"
                      onClick={() => {
                        startTransition(() => {
                          handleInstall(engineType);
                        });
                      }}
                      disabled={isInstalling || isPending}
                    >
                      {isInstalling ? 'インストール中...' : 'インストール'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="settings-button secondary"
                        onClick={() => {
                          startTransition(() => {
                            checkUpdate(engineType);
                          });
                        }}
                        disabled={isChecking || isUpdating || isPending}
                      >
                        {isChecking ? '確認中...' : 'アップデート確認'}
                      </button>
                      {update && update.update_available && (
                        <button
                          type="button"
                          className="settings-button primary"
                          onClick={() => {
                            startTransition(() => {
                              handleUpdate(engineType);
                            });
                          }}
                          disabled={isUpdating || isPending}
                        >
                          {isUpdating ? '更新中...' : '更新'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {engineError && (
                <ErrorMessage
                  message={engineError}
                  type="general"
                  onClose={() =>
                    setError(prev => ({ ...prev, [engineType]: null }))
                  }
                />
              )}

              {engineSuccess && (
                <InfoBanner
                  type="success"
                  message={engineSuccess}
                  dismissible
                  onDismiss={() =>
                    setSuccessMessage(prev => ({ ...prev, [engineType]: null }))
                  }
                />
              )}

              {engineProgress && (
                <EngineProgressBar 
                  progress={engineProgress.percentage}
                  message={engineProgress.message || `${engineProgress.downloaded.toLocaleString()} / ${engineProgress.total.toLocaleString()} bytes (${engineProgress.percentage.toFixed(1)}%)`}
                />
              )}

              {update && !update.update_available && isInstalled && (
                <InfoBanner
                  type="success"
                  message={`${engineNames[engineType]}は最新版です`}
                />
              )}

              {detection?.message && !isInstalled && (
                <InfoBanner type="warning" message={detection.message} />
              )}
            </div>
          );
        })}
      </div>
      {confirmDialog.isOpen && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
          confirmVariant={confirmDialog.confirmVariant || 'primary'}
        />
      )}
    </section>
  );
};
