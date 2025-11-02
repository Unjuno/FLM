// FLM - モデル管理ページ
// フロントエンドエージェント (FE) 実装
// F004: モデル管理機能 - メインページ

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModelSearch } from '../components/models/ModelSearch';
import { InstalledModelsList } from '../components/models/InstalledModelsList';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './ModelManagement.css';

/**
 * モデル管理ページ
 * モデル検索・ダウンロード・インストール済みモデルの管理を行います
 */
export const ModelManagement: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'search' | 'installed'>('search');

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  return (
    <div className="model-management-page">
      <div className="model-management-container">
        <header className="model-management-header">
          <div className="header-top">
            <button className="back-button" onClick={() => navigate('/')}>
              ← ホームに戻る
            </button>
            <h1>モデル管理</h1>
          </div>
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              🔍 モデル検索・ダウンロード
            </button>
            <button
              className={`tab-button ${activeTab === 'installed' ? 'active' : ''}`}
              onClick={() => setActiveTab('installed')}
            >
              📦 インストール済み
            </button>
          </div>
        </header>

        <div className="model-management-content">
          {activeTab === 'search' && (
            <ModelSearch onModelSelected={(model) => {
              // 選択したモデルでAPI作成画面に遷移
              navigate('/api/create', { state: { selectedModel: model } });
            }} />
          )}

          {activeTab === 'installed' && (
            <InstalledModelsList onModelSelected={(model) => {
              // 選択したモデルでAPI作成画面に遷移
              navigate('/api/create', { state: { selectedModel: model } });
            }} />
          )}
        </div>
      </div>
    </div>
  );
};
