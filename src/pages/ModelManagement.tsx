// ModelManagement - モデル管理ページ

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ModelSearch } from '../components/models/ModelSearch';
import { InstalledModelsList } from '../components/models/InstalledModelsList';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { SelectedModel } from '../types/api';
import './ModelManagement.css';

/**
 * モデル管理ページ
 * モデル検索・ダウンロード・インストール済みモデルの管理を行います
 */
export const ModelManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'search' | 'installed'>('search');
  
  // 遷移元の情報を取得（API作成画面から来た場合）
  const returnTo = location.state?.returnTo;
  const selectedEngine = location.state?.selectedEngine;

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // モデル選択時のハンドラ
  const handleModelSelected = (model: { name: string; size?: number; description?: string; parameters?: number }) => {
    // パラメータ数のフォーマット（B単位に変換）
    let description = model.description;
    if (!description && model.parameters) {
      const paramsB = model.parameters / 1000000000;
      if (paramsB >= 1) {
        description = `${paramsB.toFixed(1)}B パラメータ`;
      } else {
        const paramsM = model.parameters / 1000000;
        description = `${paramsM.toFixed(0)}M パラメータ`;
      }
    }

    // ModelInfoからSelectedModelに変換
    const selectedModel: SelectedModel = {
      name: model.name,
      size: model.size,
      description,
    };

    if (returnTo === 'api/create') {
      // API作成画面に戻り、選択したモデルを渡す
      navigate('/api/create', { 
        state: { 
          selectedModel,
          engineType: selectedEngine || 'ollama'
        } 
      });
    } else {
      // 通常の遷移
      navigate('/api/create', { state: { selectedModel } });
    }
  };

  return (
    <div className="model-management-page">
      <div className="model-management-container">
        <header className="model-management-header">
          <div className="header-top">
            <button 
              className="back-button" 
              onClick={() => {
                if (returnTo === 'api/create') {
                  navigate('/api/create', { state: { engineType: selectedEngine } });
                } else {
                  navigate('/');
                }
              }}
            >
              ← {returnTo === 'api/create' ? 'API作成に戻る' : 'ホームに戻る'}
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
            <ModelSearch onModelSelected={handleModelSelected} />
          )}

          {activeTab === 'installed' && (
            <InstalledModelsList onModelSelected={handleModelSelected} />
          )}
        </div>
      </div>
    </div>
  );
};
