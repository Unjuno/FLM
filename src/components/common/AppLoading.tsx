// AppLoading - アプリケーション起動時の読み込みUI

import React, { useState, useEffect } from 'react';
import './AppLoading.css';

/**
 * アプリケーション起動時の読み込みUIコンポーネント
 * データベース初期化などの処理中に表示されます
 */
export const AppLoading: React.FC = () => {
  const [message, setMessage] = useState('アプリケーションを起動しています...');
  const [step, setStep] = useState(0);

  // 初期化ステップのメッセージ
  const steps = [
    'アプリケーションを起動しています...',
    'データベースを初期化しています...',
    '設定を読み込んでいます...',
    '準備中...',
  ];

  // メッセージを順番に表示（ユーザーに進行状況を伝える）
  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => {
        const nextStep = (prev + 1) % steps.length;
        setMessage(steps[nextStep]);
        return nextStep;
      });
    }, 2000); // 2秒ごとにメッセージを変更

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-loading">
      <div className="app-loading-panel" role="status" aria-live="polite">
        <header className="app-loading-header">
          <img 
            src="/logo.png" 
            alt="FLM" 
            className="app-loading-logo" 
            width="64" 
            height="64"
            aria-hidden="true"
          />
          <h1 className="app-loading-title">FLM</h1>
          <p className="app-loading-subtitle">Local LLM API Manager</p>
        </header>

        <div className="app-loading-status">
          <div className="app-loading-spinner" aria-hidden="true">
            <span className="app-loading-spinner-circle"></span>
          </div>
          <p className="app-loading-message">{message}</p>
        </div>

        <div className="app-loading-progress" aria-hidden="true">
          <div className="app-loading-progress-track">
            <div className="app-loading-progress-fill"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
