// Settings - アプリケーション設定ページ

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../hooks/useSettings';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { CloudSyncSettings } from '../components/settings/CloudSyncSettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';
import { LanguageSettings } from '../components/settings/LanguageSettings';
import { AutoRefreshSettings } from '../components/settings/AutoRefreshSettings';
import { LogManagementSettings } from '../components/settings/LogManagementSettings';
import { ApiTimeoutSettings } from '../components/settings/ApiTimeoutSettings';
import { PrivacySettings } from '../components/settings/PrivacySettings';
import { NotificationSettings } from '../components/settings/NotificationSettings';
import { ExitBehaviorSettings } from '../components/settings/ExitBehaviorSettings';
import { FeatureDisplaySettings } from '../components/settings/FeatureDisplaySettings';
import { DatabaseSettings } from '../components/settings/DatabaseSettings';
import { AppUpdateSection } from '../components/settings/AppUpdateSection';
import { EngineUpdateSection } from '../components/settings/EngineUpdateSection';
import './Settings.css';

/**
 * アプリケーション設定ページ
 * アプリケーション全体の設定を管理します
 */
export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { toggleTheme } = useTheme();
  const {
    settings,
    loading,
    saving,
    error,
    successMessage,
    loadSettings,
    saveSettings,
    resetSettings,
    updateSettings,
    handleThemeChange,
    handleLanguageChange,
    clearError,
    clearSuccessMessage,
  } = useSettings();

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

  // 設定を読み込む（マウント時）
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 設定をリセット（デフォルト値に戻す）
  const handleReset = () => {
    setConfirmDialog({
      isOpen: true,
      message: t('settings.actions.resetConfirm'),
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        await resetSettings();
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('settings.title') || '設定' },
    ],
    [t]
  );

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
            <ErrorMessage message={error} type="general" onClose={clearError} />
          )}

          {successMessage && (
            <InfoBanner
              type="success"
              message={successMessage}
              dismissible
              onDismiss={clearSuccessMessage}
            />
          )}

          <div className="settings-content">
            <AppearanceSettings
              settings={settings}
              onThemeChange={handleThemeChange}
              onToggleTheme={toggleTheme}
            />

            <LanguageSettings
              settings={settings}
              onLanguageChange={handleLanguageChange}
            />

            <AutoRefreshSettings
              settings={settings}
              onSettingsChange={updateSettings}
            />

            <LogManagementSettings
              settings={settings}
              onSettingsChange={updateSettings}
            />

            <ApiTimeoutSettings
              settings={settings}
              onSettingsChange={updateSettings}
            />

            <PrivacySettings
              settings={settings}
              onSettingsChange={updateSettings}
            />

            <NotificationSettings
              settings={settings}
              onSettingsChange={updateSettings}
            />

            <ExitBehaviorSettings
              settings={settings}
              onSettingsChange={updateSettings}
            />

            <FeatureDisplaySettings
              settings={settings}
              onSettingsChange={updateSettings}
            />

            <EngineUpdateSection />

            <AppUpdateSection />

            <DatabaseSettings />

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
                onClick={saveSettings}
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
