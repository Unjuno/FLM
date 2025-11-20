// ModelManagement - モデル管理ページ

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ModelSearch } from '../components/models/ModelSearch';
import { InstalledModelsList } from '../components/models/InstalledModelsList';
import { HuggingFaceSearch } from '../components/models/HuggingFaceSearch';
import { ModelfileEditor } from '../components/models/ModelfileEditor';
import { ModelConverter } from '../components/models/ModelConverter';
import { ModelSharing } from '../components/models/ModelSharing';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import type { SelectedModel } from '../types/api';
import './ModelManagement.css';

/**
 * モデル管理ページ
 * モデル検索・ダウンロード・インストール済みモデルの管理を行います
 * v2.0: LLMSTUDIO風の高度なモデル管理機能を追加
 */
export const ModelManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  // URLパラメータからタブを取得
  const getTabFromUrl = ():
    | 'search'
    | 'installed'
    | 'huggingface'
    | 'modelfile'
    | 'converter'
    | 'sharing' => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (
      tab &&
      [
        'search',
        'installed',
        'huggingface',
        'modelfile',
        'converter',
        'sharing',
      ].includes(tab)
    ) {
      return tab as
        | 'search'
        | 'installed'
        | 'huggingface'
        | 'modelfile'
        | 'converter'
        | 'sharing';
    }
    return 'search';
  };

  const [activeTab, setActiveTab] = useState<
    | 'search'
    | 'installed'
    | 'huggingface'
    | 'modelfile'
    | 'converter'
    | 'sharing'
  >(getTabFromUrl());

  // URLパラメータの変更を監視
  useEffect(() => {
    setActiveTab(getTabFromUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // 遷移元の情報を取得（API作成画面から来た場合）
  const returnTo = location.state?.returnTo;
  const selectedEngine = location.state?.selectedEngine;

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => {
    const items: BreadcrumbItem[] = [
      { label: t('header.home') || 'ホーム', path: '/' },
    ];
    if (returnTo === 'api/create') {
      items.push({
        label: t('modelManagement.createApi') || 'API作成',
        path: '/api/create',
      });
    }
    items.push({ label: t('modelManagement.title') || 'モデル管理' });
    return items;
  }, [t, returnTo]);

  // モデル選択時のハンドラ
  const handleModelSelected = useCallback(
    (model: {
      name: string;
      size?: number;
      description?: string;
      parameters?: number;
    }) => {
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
            engineType: selectedEngine || 'ollama',
          },
        });
      } else {
        // 通常の遷移
        navigate('/api/create', { state: { selectedModel } });
      }
    },
    [returnTo, selectedEngine, navigate]
  );

  return (
    <div className="page-background model-management-page">
      <div className="page-container model-management-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="page-header model-management-header">
          <div className="header-top">
            <button
              className="back-button"
              onClick={() => {
                if (returnTo === 'api/create') {
                  navigate('/api/create', {
                    state: { engineType: selectedEngine },
                  });
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
              onClick={() => {
                setActiveTab('search');
                navigate('/models?tab=search', { replace: true });
              }}
            >
              モデル検索・ダウンロード
            </button>
            <button
              className={`tab-button ${activeTab === 'installed' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('installed');
                navigate('/models?tab=installed', { replace: true });
              }}
            >
              インストール済み
            </button>
            <button
              className={`tab-button ${activeTab === 'huggingface' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('huggingface');
                navigate('/models?tab=huggingface', { replace: true });
              }}
            >
              Hugging Face検索
            </button>
            <button
              className={`tab-button ${activeTab === 'modelfile' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('modelfile');
                navigate('/models?tab=modelfile', { replace: true });
              }}
            >
              Modelfile作成
            </button>
            <button
              className={`tab-button ${activeTab === 'converter' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('converter');
                navigate('/models?tab=converter', { replace: true });
              }}
            >
              モデル変換
            </button>
            <button
              className={`tab-button ${activeTab === 'sharing' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('sharing');
                navigate('/models?tab=sharing', { replace: true });
              }}
            >
              📤 モデル共有
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

          {activeTab === 'huggingface' && <HuggingFaceSearch />}

          {activeTab === 'modelfile' && <ModelfileEditor />}

          {activeTab === 'converter' && <ModelConverter />}

          {activeTab === 'sharing' && <ModelSharing />}
        </div>
      </div>
    </div>
  );
};
