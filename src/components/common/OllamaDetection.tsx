// Ollama検出中のローディング画面コンポーネント

import React from 'react';
import { useOllamaDetection } from '../../hooks/useOllama';
import './OllamaDetection.css';

/**
 * Ollama検出中のローディング画面
 */
export const OllamaDetection: React.FC = () => {
  const { status, isDetecting, error } = useOllamaDetection();

  if (isDetecting) {
    return (
      <div className="ollama-detection">
        <div className="detection-spinner">
          <div className="spinner"></div>
        </div>
        <p className="detection-message">Ollamaを検出しています...</p>
        <p className="detection-submessage">システムをスキャン中です。しばらくお待ちください。</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ollama-detection">
        <div className="detection-error">
          <span className="error-icon">⚠️</span>
          <p className="error-message">{error}</p>
        </div>
      </div>
    );
  }

  if (status?.installed || status?.portable || status?.running) {
    return (
      <div className="ollama-detection">
        <div className="detection-success">
          <span className="success-icon">✅</span>
          <p className="success-message">Ollamaが見つかりました</p>
          {status.version && (
            <p className="version-info">バージョン: {status.version}</p>
          )}
          {status.running && (
            <p className="running-info">実行中: はい</p>
          )}
          {status.portable_path && (
            <p className="path-info">パス: {status.portable_path}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ollama-detection">
      <div className="detection-not-found">
        <span className="not-found-icon">ℹ️</span>
        <p className="not-found-message">Ollamaが見つかりませんでした</p>
        <p className="not-found-submessage">ダウンロードしてインストールしてください</p>
      </div>
    </div>
  );
};

