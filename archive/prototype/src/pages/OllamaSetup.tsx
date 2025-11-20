// Ollama自動インストール機能のメインページ
// F009 UI部分の統合コンポーネント

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { OllamaDetection } from '../components/common/OllamaDetection';
import { OllamaDownload } from '../components/common/OllamaDownload';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useI18n } from '../contexts/I18nContext';
import { useOllamaDetection } from '../hooks/useOllama';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import './OllamaSetup.css';

/**
 * Ollama自動インストールページ
 *
 * このページでは以下を行います：
 * 1. Ollamaの検出（自動）
 * 2. 見つからない場合、ダウンロード画面を自動表示
 * 3. エラー時のリトライ
 * 4. 成功時の通知表示
 */
export const OllamaSetup: React.FC = () => {
  const { t } = useI18n();
  const {
    status,
    isDetecting,
    error: detectionError,
    detect,
    autoSteps,
    autoStatus,
    autoError,
    runAutoSetup,
  } = useOllamaDetection();
  const [showDownload, setShowDownload] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('ollamaSetup.title') || 'Ollamaセットアップ' },
    ],
    [t]
  );

  const isRunning = Boolean(status?.running);

  // 検出結果に基づいてダウンロード画面を表示
  useEffect(() => {
    if (!isDetecting && status) {
      if (!status.installed && !status.portable) {
        setShowDownload(false);
      } else {
        setShowDownload(false);
      }
    }
  }, [isDetecting, status]);

  const handleDownloadComplete = useCallback(() => {
    setShowDownload(false);
    // 検出を再実行して最新の状態を取得
    detect();
  }, [detect]);

  const handleDownloadError = useCallback((errorMessage: string) => {
    setDownloadError(errorMessage);
  }, []);

  const handleRetry = useCallback(() => {
    setDownloadError(null);
    runAutoSetup().catch(err => {
      logger.error(
        '[OllamaSetup] 自動セットアップ再実行エラー',
        err instanceof Error ? err : new Error(extractErrorMessage(err)),
        'OllamaSetup'
      );
    });
  }, [runAutoSetup]);

  const handleManualDownload = useCallback(() => {
    setShowDownload(true);
    setDownloadError(null);
  }, []);

  return (
    <div className="ollama-setup-page">
      <div className="setup-container">
        <Breadcrumb items={breadcrumbItems} />
        <h1>{t('ollamaSetup.title') || 'Ollamaセットアップ'}</h1>
        <p className="setup-description">
          {t('ollamaSetup.description') ||
            'FLMを使用するには、Ollamaが必要です。Ollamaを検出しています...'}
        </p>

        {/* 検出画面 */}
        {!showDownload && !isRunning && (
          <div className="setup-content">
            <OllamaDetection
              status={status}
              isDetecting={isDetecting}
              error={detectionError}
              autoSteps={autoSteps}
              autoStatus={autoStatus}
              autoError={autoError}
              onRetryAuto={runAutoSetup}
            />
            {/* 検出エラーが発生した場合、または手動ダウンロードボタンを表示 */}
            {(detectionError ||
              (!isDetecting &&
                status &&
                !status.installed &&
                !status.portable) ||
              autoStatus === 'error') && (
              <div className="setup-actions">
                <button
                  className="action-button secondary"
                  onClick={handleManualDownload}
                >
                  {t('ollamaSetup.manualDownload') || '手動でダウンロード'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ダウンロード画面 */}
        {showDownload && !isRunning && (
          <div className="setup-content">
            <OllamaDownload
              onComplete={handleDownloadComplete}
              onError={handleDownloadError}
            />
          </div>
        )}

        {/* 完了画面 */}
        {isRunning && (
          <div className="setup-content">
            <div className="setup-success">
              <span className="success-icon">✅</span>
              <h2>セットアップ完了</h2>
              <p>
                Ollamaのセットアップが完了しました。アプリケーションを使用できます。
              </p>
              <button
                className="action-button primary"
                onClick={() => (window.location.href = '/')}
              >
                ホームに戻る
              </button>
            </div>
          </div>
        )}

        {/* ダウンロードエラー表示 */}
        {downloadError && (
          <div className="setup-error">
            <p className="error-text">{downloadError}</p>
            <button className="action-button primary" onClick={handleRetry}>
              再試行
            </button>
          </div>
        )}

        {/* 検出エラー表示 */}
        {detectionError && !downloadError && (
          <div className="setup-error">
            <p className="error-text">
              Ollamaの検出中にエラーが発生しました: {detectionError}
            </p>
            <button className="action-button primary" onClick={handleRetry}>
              再試行
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
