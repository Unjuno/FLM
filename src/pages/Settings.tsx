import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { SuccessMessage } from '../components/common/SuccessMessage';
import './Settings.css';

export const Settings: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentLocale, setCurrentLocale] = useState<'ja' | 'en'>(locale);

  useEffect(() => {
    setCurrentLocale(locale);
  }, [locale]);

  const handleLanguageChange = async (newLocale: 'ja' | 'en') => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await setLocale(newLocale);
      setCurrentLocale(newLocale);
      const localeName = newLocale === 'ja' ? t('settings.japanese') : t('settings.english');
      setSuccessMessage(t('messages.languageChanged', { locale: localeName }));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      setError(t('errors.generic') + ': ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await setTheme(newTheme);
      setSuccessMessage(`Theme changed to ${newTheme}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      setError('Failed to change theme: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <h1>{t('settings.title')}</h1>

      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {successMessage && (
        <SuccessMessage
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
        />
      )}

      <div className="settings-section">
        <h2>{t('settings.language')}</h2>
        <div className="settings-field">
          <label htmlFor="language-select">
            {t('settings.displayLanguage')}
          </label>
          <select
            id="language-select"
            value={currentLocale}
            onChange={(e) =>
              handleLanguageChange(e.target.value as 'ja' | 'en')
            }
            disabled={loading}
            aria-label={t('settings.displayLanguage')}
          >
            <option value="ja">{t('settings.japanese')}</option>
            <option value="en">{t('settings.english')}</option>
          </select>
          {loading && <LoadingSpinner size="small" />}
        </div>
        <p className="settings-hint">
          {t('settings.languageHint', {
            current: currentLocale === 'ja' ? t('settings.japanese') : t('settings.english'),
          })}
        </p>
      </div>

      <div className="settings-section">
        <h2>Theme</h2>
        <div className="settings-field">
          <label htmlFor="theme-select">
            Appearance
          </label>
          <select
            id="theme-select"
            value={theme}
            onChange={(e) =>
              handleThemeChange(e.target.value as 'light' | 'dark')
            }
            disabled={loading}
            aria-label="Theme selection"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          {loading && <LoadingSpinner size="small" />}
        </div>
        <p className="settings-hint">
          Current theme: {theme === 'light' ? 'Light' : 'Dark'}
        </p>
      </div>
    </div>
  );
};
