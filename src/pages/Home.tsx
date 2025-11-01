// FLM - Home Page
// フロントエンドエージェント (FE) 実装
// F001: API作成機能 - ホーム画面

import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

/**
 * ホーム画面
 * メインのナビゲーションハブとして機能します
 */
export const Home: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateApi = () => {
    navigate('/api/create');
  };

  const handleViewApis = () => {
    navigate('/api/list');
  };

  const handleManageModels = () => {
    navigate('/models');
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <header className="home-header">
          <h1>FLM - Local LLM API Manager</h1>
          <p className="home-subtitle">
            ローカルLLMのAPIを簡単に作成・管理できるツール
          </p>
        </header>

        <div className="home-actions">
          <button
            className="home-action-button primary"
            onClick={handleCreateApi}
          >
            <span className="button-icon">✨</span>
            <span className="button-text">
              <strong>新しいAPIを作成</strong>
              <small>OllamaモデルからAPIを作成します</small>
            </span>
          </button>

          <button
            className="home-action-button"
            onClick={handleViewApis}
          >
            <span className="button-icon">📋</span>
            <span className="button-text">
              <strong>API一覧</strong>
              <small>作成済みのAPIを表示・管理します</small>
            </span>
          </button>

          <button
            className="home-action-button"
            onClick={handleManageModels}
          >
            <span className="button-icon">🤖</span>
            <span className="button-text">
              <strong>モデル管理</strong>
              <small>Ollamaモデルの検索・ダウンロード</small>
            </span>
          </button>

          <button
            className="home-action-button"
            onClick={() => navigate('/api/keys')}
          >
            <span className="button-icon">🔑</span>
            <span className="button-text">
              <strong>APIキー管理</strong>
              <small>APIキーの一覧表示・管理</small>
            </span>
          </button>
        </div>

        <div className="home-info">
          <h2>使い方</h2>
          <ol className="home-steps">
            <li>「新しいAPIを作成」をクリック</li>
            <li>使用するモデルを選択</li>
            <li>設定を入力（API名、ポート番号など）</li>
            <li>API作成完了後、エンドポイントURLとAPIキーを取得</li>
            <li>取得した情報を使ってAPIを利用</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

