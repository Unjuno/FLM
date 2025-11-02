// FLM - アプリケーション設定ページ
// フロントエンドエージェント (FE) 実装
// FE-011-01: アプリケーション設定ページ実装

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import './Settings.css';

/**
 * アプリケーション設定
 */
interface AppSettings {
  theme: string | null;
  language: string | null;
  auto_refresh_interval: number | null;
  log_retention_days: number | null;
  notifications_enabled: boolean | null;
}

/**
 * アプリケーション設定ページ
 * アプリケーション全体の設定を管理します
 */
export const Settings: React.FC = () => {
  const { theme, actualTheme, setTheme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  // actualTheme, setTheme, toggleThemeは使用されています（178行目、76行目、195行目で使用）
  const [settings, setSettings] = useState<AppSettings>({
    theme: null,
    language: null,
    auto_refresh_interval: null,
    log_retention_days: null,
    notifications_enabled: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 設定を読み込む
  useEffect(() => {
    loadSettings();
  }, []);

  // テーマが変更されたときに設定を更新
  useEffect(() => {
    if (settings.theme !== theme) {
      setSettings((prev) => ({ ...prev, theme }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await invoke<AppSettings>('get_app_settings');
      setSettings(result);
      // 言語設定をI18nコンテキストに反映
      if (result.language === 'en' || result.language === 'ja') {
        setLocale(result.language);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

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
      
      await invoke('update_app_settings', { settings });
      setSuccessMessage(t('settings.messages.saveSuccess'));
      
      // 5秒後に成功メッセージを非表示
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.messages.saveError'));
    } finally {
      setSaving(false);
    }
  };

  // テーマ変更ハンドラー
  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
    try {
      await setTheme(newTheme);
      setSettings((prev) => ({ ...prev, theme: newTheme }));
      setSuccessMessage(t('settings.messages.themeChangeSuccess'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.messages.themeChangeError'));
    }
  };

  // 設定をリセット（デフォルト値に戻す）
  const handleReset = async () => {
    if (!confirm(t('settings.actions.resetConfirm'))) {
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      const defaultSettings: AppSettings = {
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: 30,
        log_retention_days: 30,
        notifications_enabled: true,
      };
      
      await invoke('update_app_settings', { settings: defaultSettings });
      setSettings(defaultSettings);
      setSuccessMessage(t('settings.messages.resetSuccess'));
      
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.messages.resetError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-container">
          <div className="settings-loading">{t('settings.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <header className="settings-header">
          <h1>{t('settings.title')}</h1>
          <p className="settings-subtitle" role="doc-subtitle">
            {t('settings.subtitle')}
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

        <div className="settings-content">
          {/* テーマ設定 */}
          <section className="settings-section" aria-labelledby="appearance-heading">
            <h2 id="appearance-heading" className="settings-section-title">{t('settings.appearance.title')}</h2>
            <div className="settings-group">
              <label htmlFor="theme">
                {t('settings.appearance.theme')}
                <span className="settings-hint">
                  {t('settings.appearance.themeHint', { currentTheme: actualTheme === 'dark' ? t('settings.appearance.themeDark') : t('settings.appearance.themeLight') })}
                </span>
              </label>
              <select
                id="theme"
                value={settings.theme || theme}
                onChange={(e) => handleThemeChange(e.target.value as 'light' | 'dark' | 'auto')}
                className="settings-select"
                aria-label={t('settings.appearance.theme')}
              >
                <option value="auto">{t('settings.appearance.themeAuto')}</option>
                <option value="light">{t('settings.appearance.themeLight')}</option>
                <option value="dark">{t('settings.appearance.themeDark')}</option>
              </select>
              <div className="settings-theme-preview">
                <button
                  type="button"
                  className="settings-theme-toggle"
                  onClick={toggleTheme}
                  aria-label={t('settings.appearance.theme')}
                  title={t('settings.appearance.theme')}
                >
                  <span aria-hidden="true">{actualTheme === 'dark' ? '☀️' : '🌙'}</span> {t('settings.appearance.quickToggle')}
                </button>
              </div>
            </div>
          </section>

          {/* 言語設定 */}
          <section className="settings-section" aria-labelledby="language-heading">
            <h2 id="language-heading" className="settings-section-title">{t('settings.language.title')}</h2>
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
                onChange={async (e) => {
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
              </select>
            </div>
          </section>

          {/* 自動更新設定 */}
          <section className="settings-section" aria-labelledby="auto-refresh-heading">
            <h2 id="auto-refresh-heading" className="settings-section-title">{t('settings.autoRefresh.title')}</h2>
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
                min="5"
                max="300"
                step="5"
                value={settings.auto_refresh_interval || 30}
                onChange={(e) => setSettings({ ...settings, auto_refresh_interval: parseInt(e.target.value) || 30 })}
                className="settings-input"
                aria-label="自動更新間隔（秒）。最小5秒、最大300秒。"
              />
            </div>
          </section>

          {/* ログ保持期間設定 */}
          <section className="settings-section" aria-labelledby="log-management-heading">
            <h2 id="log-management-heading" className="settings-section-title">{t('settings.logManagement.title')}</h2>
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
                min="1"
                max="365"
                value={settings.log_retention_days || 30}
                onChange={(e) => setSettings({ ...settings, log_retention_days: parseInt(e.target.value) || 30 })}
                className="settings-input"
                aria-label="ログ保持期間（日数）。最小1日、最大365日。"
              />
            </div>
          </section>

          {/* 通知設定 */}
          <section className="settings-section" aria-labelledby="notifications-heading">
            <h2 id="notifications-heading" className="settings-section-title">{t('settings.notifications.title')}</h2>
            <div className="settings-group">
              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.notifications_enabled ?? true}
                  onChange={(e) => setSettings({ ...settings, notifications_enabled: e.target.checked })}
                  aria-label={t('settings.notifications.label')}
                />
                <span>{t('settings.notifications.label')}</span>
              </label>
              <span className="settings-hint">
                {t('settings.notifications.hint')}
              </span>
            </div>
          </section>

          {/* データベース管理 */}
          <section className="settings-section" aria-labelledby="database-heading">
            <h2 id="database-heading" className="settings-section-title">{t('settings.database.title')}</h2>
            <div className="settings-group">
              <p className="settings-info">
                {t('settings.database.info')}
              </p>
            </div>
          </section>
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
              aria-label={saving ? t('settings.actions.saving') : t('settings.actions.save')}
              type="button"
            >
              {saving ? t('settings.actions.saving') : t('settings.actions.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

