/**
 * アプリケーションアップデートセクション
 */

import React from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { useAppUpdate } from '../../hooks/useAppUpdate';
import { ErrorMessage } from '../common/ErrorMessage';
import { ProgressBar } from './ProgressBar';

/**
 * アプリケーションアップデートセクション
 */
export const AppUpdateSection: React.FC = () => {
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
  } = useAppUpdate({ autoCheck: false, showNotification: false });

  return (
    <section className="settings-section" aria-labelledby="app-update-heading">
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
            <ErrorMessage message={error} type="api" onClose={() => {}} />
          )}
          {progress && (
            <ProgressBar
              progress={progress.progress}
              message={progress.message ?? undefined}
            />
          )}
          {releaseNotes && updateAvailable && (
            <div className="settings-release-notes">
              <h3>
                {t('settings.appUpdate.releaseNotes') || 'リリースノート'}
              </h3>
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
                : t('settings.appUpdate.install') ||
                  'アップデートをインストール'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
