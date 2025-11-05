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
          {/* パス情報は非開発者には不要なため表示しない */}
        </div>
      </div>
    );
  }

  // システムインストールが必要な場合のメッセージ
  const showSystemInstallGuide = status && !status.installed && !status.portable;

  return (
    <div className="ollama-detection">
      <div className="detection-not-found">
        <span className="not-found-icon">ℹ️</span>
        <p className="not-found-message">Ollamaが見つかりませんでした</p>
        <p className="not-found-submessage">ダウンロードしてインストールしてください</p>
        
        {showSystemInstallGuide && (
          <div className="system-install-guide">
            <div className="guide-section">
              <h4 className="guide-title">⚠️ システムにインストールする場合</h4>
              <p className="guide-warning">
                <strong>システムにインストールするには管理者権限が必要です。</strong>
              </p>
              <div className="guide-steps">
                <h5>手動インストール手順:</h5>
                <ol className="install-steps-list">
                  <li>
                    <a 
                      href="https://ollama.ai/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="install-link"
                    >
                      Ollama公式Webサイト（ollama.ai）
                    </a>
                    にアクセス
                  </li>
                  <li>ご使用のOS用のインストーラーをダウンロード</li>
                  <li>
                    <strong>管理者権限で</strong>インストーラーを実行
                    <ul className="install-substeps">
                      <li>Windows: インストーラーを右クリック → 「管理者として実行」</li>
                      <li>macOS/Linux: <code>sudo</code>コマンドで実行</li>
                    </ul>
                  </li>
                  <li>インストール完了後、FLMアプリを再起動</li>
                </ol>
              </div>
              <div className="guide-alternative">
                <p className="alternative-note">
                  💡 <strong>推奨:</strong> 管理者権限なしで使用するには、上記の「ダウンロード開始」ボタンから
                  FLMアプリディレクトリ内に自動的にインストールできます（権限不要・自動インストール）。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

