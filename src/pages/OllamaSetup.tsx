// Ollama自動インストール機能のメインページ
// F009 UI部分の統合コンポーネント

import React, { useState, useEffect } from 'react';
import { OllamaDetection } from '../components/common/OllamaDetection';
import { OllamaDownload } from '../components/common/OllamaDownload';
import { useOllamaDetection } from '../hooks/useOllama';
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
  const { status, isDetecting, error: detectionError, detect } = useOllamaDetection();
  const [showDownload, setShowDownload] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 検出結果に基づいてダウンロード画面を表示
  useEffect(() => {
    if (!isDetecting && status) {
      // Ollamaが見つからない場合はダウンロード画面を表示
      if (!status.installed && !status.portable) {
        setShowDownload(true);
      } else if (status.installed || status.portable) {
        // Ollamaが見つかった場合は成功状態にする
        setDownloadComplete(true);
      }
    }
  }, [isDetecting, status]);

  const handleDownloadComplete = () => {
    setDownloadComplete(true);
    setShowDownload(false);
    // 検出を再実行して最新の状態を取得
    detect();
  };

  const handleDownloadError = (errorMessage: string) => {
    setDownloadError(errorMessage);
  };

  const handleRetry = () => {
    setDownloadError(null);
    setShowDownload(false);
    // 再検出を実行
    detect();
  };

  const handleManualDownload = () => {
    setShowDownload(true);
  };

  return (
    <div className="ollama-setup-page">
      <div className="setup-container">
        <h1>Ollamaセットアップ</h1>
        <p className="setup-description">
          FLMを使用するには、Ollamaが必要です。Ollamaを検出しています...
        </p>

        {/* 検出画面 */}
        {!showDownload && !downloadComplete && (
          <div className="setup-content">
            <OllamaDetection />
            {/* 検出エラーが発生した場合、または手動ダウンロードボタンを表示 */}
            {(detectionError || (!isDetecting && status && !status.installed && !status.portable)) && (
              <div className="setup-actions">
                <button 
                  className="action-button secondary"
                  onClick={handleManualDownload}
                >
                  手動でダウンロード
                </button>
              </div>
            )}
          </div>
        )}

        {/* ダウンロード画面 */}
        {showDownload && !downloadComplete && (
          <div className="setup-content">
            <OllamaDownload
              onComplete={handleDownloadComplete}
              onError={handleDownloadError}
            />
          </div>
        )}

        {/* 完了画面 */}
        {downloadComplete && (
          <div className="setup-content">
            <div className="setup-success">
              <span className="success-icon">✅</span>
              <h2>セットアップ完了</h2>
              <p>Ollamaのセットアップが完了しました。アプリケーションを使用できます。</p>
              <button 
                className="action-button primary"
                onClick={() => window.location.href = '/'}
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
            <button 
              className="action-button primary"
              onClick={handleRetry}
            >
              再試行
            </button>
          </div>
        )}

        {/* 検出エラー表示 */}
        {detectionError && !downloadError && (
          <div className="setup-error">
            <p className="error-text">Ollamaの検出中にエラーが発生しました: {detectionError}</p>
            <button 
              className="action-button primary"
              onClick={handleRetry}
            >
              再試行
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

