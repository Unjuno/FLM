// SPDX-License-Identifier: MIT
/**
 * 設定管理カスタムフック
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../utils/tauri';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { AUTO_REFRESH, TIMEOUT, LOG_RETENTION } from '../constants/config';
import type { AppSettings } from '../types/settings';
import { extractErrorMessage } from '../utils/errorHandler';

/**
 * 設定管理フックの戻り値
 */
interface UseSettingsReturn {
  settings: AppSettings;
  loading: boolean;
  saving: boolean;
  error: string | null;
  successMessage: string | null;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  resetSettings: () => Promise<void>;
  updateSettings: (newSettings: AppSettings) => void;
  handleThemeChange: (theme: 'light' | 'dark' | 'auto') => Promise<void>;
  handleLanguageChange: (language: string) => Promise<void>;
  clearError: () => void;
  clearSuccessMessage: () => void;
}

/**
 * 設定管理カスタムフック
 */
export const useSettings = (): UseSettingsReturn => {
  const { theme, setTheme } = useTheme();
  const { setLocale, t } = useI18n();
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
    show_incomplete_features: null,
    default_api_timeout_secs: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // 設定を保存する
  const saveSettings = useCallback(async () => {
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
      if (successMessageTimeoutRef.current) {
        clearTimeout(successMessageTimeoutRef.current);
      }
      successMessageTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
        successMessageTimeoutRef.current = null;
      }, TIMEOUT.SUCCESS_MESSAGE);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('settings.messages.saveError')
      );
    } finally {
      setSaving(false);
    }
  }, [settings, setTheme, t]);

  // 設定をリセット（デフォルト値に戻す）
  const resetSettings = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      const defaultSettings: AppSettings = {
        theme: 'auto',
        language: 'ja',
        auto_refresh_interval: AUTO_REFRESH.DEFAULT_INTERVAL,
        log_retention_days: LOG_RETENTION.DEFAULT_DAYS,
        audit_log_retention_days: 90,
        notifications_enabled: true,
        stop_apis_on_exit: true,
        diagnostics_enabled: true,
        performance_metrics_enabled: true,
        include_ip_address_in_audit_log: true,
        device_id_enabled: true,
        show_incomplete_features: false,
        default_api_timeout_secs: 30,
      };

      await safeInvoke('update_app_settings', { settings: defaultSettings });
      setSettings(defaultSettings);
      setSuccessMessage(t('settings.messages.resetSuccess'));

      if (successMessageTimeoutRef.current) {
        clearTimeout(successMessageTimeoutRef.current);
      }
      successMessageTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
        successMessageTimeoutRef.current = null;
      }, TIMEOUT.SUCCESS_MESSAGE);
    } catch (err) {
      setError(
        extractErrorMessage(err, t('settings.messages.resetError'))
      );
    } finally {
      setSaving(false);
    }
  }, [t]);

  // 設定を更新する
  const updateSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
  }, []);

  // テーマ変更ハンドラー
  const handleThemeChange = useCallback(async (newTheme: 'light' | 'dark' | 'auto') => {
    try {
      await setTheme(newTheme);
      setSettings(prev => ({ ...prev, theme: newTheme }));
      setSuccessMessage(t('settings.messages.themeChangeSuccess'));
      if (successMessageTimeoutRef.current) {
        clearTimeout(successMessageTimeoutRef.current);
      }
      successMessageTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
        successMessageTimeoutRef.current = null;
      }, TIMEOUT.ERROR_MESSAGE);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('settings.messages.themeChangeError')
      );
    }
  }, [setTheme, t]);

  // 言語変更ハンドラー
  const handleLanguageChange = useCallback(async (language: string) => {
    setSettings(prev => ({ ...prev, language }));
    // I18nコンテキストも即座に更新
    await setLocale(language as 'ja' | 'en');
  }, [setLocale]);

  // テーマが変更されたときに設定を更新
  useEffect(() => {
    if (settings.theme !== theme) {
      setSettings(prev => ({ ...prev, theme }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (successMessageTimeoutRef.current) {
        clearTimeout(successMessageTimeoutRef.current);
        successMessageTimeoutRef.current = null;
      }
    };
  }, []);

  // エラーメッセージをクリア
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 成功メッセージをクリア
  const clearSuccessMessage = useCallback(() => {
    setSuccessMessage(null);
    if (successMessageTimeoutRef.current) {
      clearTimeout(successMessageTimeoutRef.current);
      successMessageTimeoutRef.current = null;
    }
  }, []);

  return {
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
  };
};

