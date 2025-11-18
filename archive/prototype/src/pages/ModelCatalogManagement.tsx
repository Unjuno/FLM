// SPDX-License-Identifier: MIT
// ModelCatalogManagement - モデルカタログ管理ページ
// モデルカタログの更新・管理

import React, { useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import './ModelCatalogManagement.css';

/**
 * モデルカタログ情報
 */
interface ModelCatalogInfo {
  name: string;
  description?: string | null;
  size?: number | null;
  parameters?: number | null;
  category?: string | null;
  recommended: boolean;
  author?: string | null;
  license?: string | null;
  modified_at?: string | null;
}

/**
 * モデルカタログ管理ページ
 */
export const ModelCatalogManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError } = useNotifications();
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: 'モデル管理', path: '/models' },
    { label: 'モデルカタログ管理' },
  ], [t]);

  // モデルカタログを読み込む非同期操作
  const loadModelCatalogOperation = React.useCallback(async (): Promise<ModelCatalogInfo[]> => {
    return await safeInvoke<ModelCatalogInfo[]>(
      'get_model_catalog',
      {}
    );
  }, []);

  // 非同期操作フックを使用
  const {
    data: modelsData,
    loading,
    error,
    execute: loadModelCatalog,
    clearError,
  } = useAsyncOperation<ModelCatalogInfo[]>(loadModelCatalogOperation, {
    autoExecute: true,
    logErrors: true,
    context: 'ModelCatalogManagement',
  });

  // モデルデータ（デフォルトは空配列）
  const models: ModelCatalogInfo[] = React.useMemo(
    () => modelsData ?? [],
    [modelsData]
  );

  /**
   * モデルカタログを更新
   */
  const handleUpdateCatalog = async () => {
    try {
      setUpdating(true);
      clearError();

      const updatedCount = await safeInvoke<number>('update_model_catalog', {});
      showSuccess(`モデルカタログを更新しました（${updatedCount}件のモデル）`);
      await loadModelCatalog(); // 更新後に再読み込み
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'モデルカタログの更新に失敗しました'
      );
    } finally {
      setUpdating(false);
    }
  };

  /**
   * フィルタリングされたモデル一覧を取得
   */
  const filteredModels = models.filter((model: ModelCatalogInfo) => {
    const matchesSearch =
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (model.description &&
        model.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'all' || (model.category || 'other') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  /**
   * カテゴリ表示名を取得
   */
  const getCategoryLabel = (category: string | null | undefined): string => {
    if (!category) return 'その他';
    const categoryLabels: Record<string, string> = {
      chat: 'チャット',
      code: 'コード生成',
      translation: '翻訳',
      summarization: '要約',
      qa: '質問応答',
      vision: '画像認識',
      audio: '音声処理',
      multimodal: 'マルチモーダル',
      'image-generation': '画像生成',
      'audio-generation': '音声生成',
      embedding: '埋め込み',
      'video-generation': '動画生成',
      other: 'その他',
    };
    return categoryLabels[category] || category;
  };

  /**
   * カテゴリ一覧を取得
   */
  const categories = React.useMemo<string[]>(
    () =>
      Array.from(
        new Set(
          models.map(model => model.category ?? 'other')
        )
      ).sort(),
    [models]
  );

  /**
   * サイズをフォーマット
   */
  const formatSize = (bytes: number | null | undefined): string => {
    if (!bytes || bytes === 0) return '不明';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  /**
   * パラメータ数をフォーマット
   */
  const formatParameters = (params: number | null | undefined): string => {
    if (!params || params === 0) return '不明';
    if (params >= 1000000000) {
      return `${(params / 1000000000).toFixed(1)}B`;
    }
    if (params >= 1000000) {
      return `${(params / 1000000).toFixed(0)}M`;
    }
    return `${params.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="model-catalog-management-page">
        <div className="model-catalog-management-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="model-catalog-management-header">
            <button className="back-button" onClick={() => navigate('/models')}>
              ← 戻る
            </button>
            <h1>モデルカタログ管理</h1>
          </header>
          <div className="model-catalog-management-content">
            <SkeletonLoader type="title" width="250px" />
            <SkeletonLoader type="paragraph" count={2} />
            <div className="margin-top-md">
              <SkeletonLoader type="button" width="150px" />
            </div>
            <div className="margin-top-xl">
              <SkeletonLoader type="card" count={6} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="model-catalog-management-page">
      <div className="model-catalog-management-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="model-catalog-management-header">
          <button className="back-button" onClick={() => navigate('/models')}>
            ← 戻る
          </button>
          <h1>モデルカタログ管理</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={clearError}
          />
        )}

        <div className="model-catalog-management-content">
          <div className="catalog-info-banner">
            <h2>モデルカタログ管理</h2>
            <p>
              モデルカタログの表示・更新ができます。モデルカタログは定期的に自動更新されます（7日ごと）。
            </p>
          </div>

          <div className="catalog-controls">
            <div className="catalog-actions">
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  startTransition(() => {
                    handleUpdateCatalog();
                  });
                }}
                disabled={updating || isPending}
              >
                {updating ? '更新中...' : 'カタログを更新'}
              </button>
              <span className="catalog-count">
                {models.length}件のモデルが登録されています
              </span>
            </div>

            <div className="catalog-filters">
              <input
                type="text"
                className="filter-input"
                placeholder="モデル名または説明で検索..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select
                className="filter-select"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                aria-label="カテゴリを選択"
              >
                <option value="all">すべてのカテゴリ</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {getCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="catalog-models-section">
            <h2>モデル一覧 ({filteredModels.length}件)</h2>
            <div className="models-grid">
              {filteredModels.map(model => (
                <div key={model.name} className="model-card">
                  <div className="model-header">
                    <h3 className="model-name">{model.name}</h3>
                    {model.recommended && (
                      <span className="recommended-badge">推奨</span>
                    )}
                  </div>
                  <div className="model-body">
                    {model.description && (
                      <p className="model-description">{model.description}</p>
                    )}
                    <div className="model-meta">
                      <div className="model-meta-item">
                        <span className="meta-label">サイズ:</span>
                        <span className="meta-value">
                          {formatSize(model.size)}
                        </span>
                      </div>
                      <div className="model-meta-item">
                        <span className="meta-label">パラメータ:</span>
                        <span className="meta-value">
                          {formatParameters(model.parameters)}
                        </span>
                      </div>
                      <div className="model-meta-item">
                        <span className="meta-label">カテゴリ:</span>
                        <span className="meta-value">{getCategoryLabel(model.category)}</span>
                      </div>
                      {model.author && (
                        <div className="model-meta-item">
                          <span className="meta-label">作成者:</span>
                          <span className="meta-value">{model.author}</span>
                        </div>
                      )}
                      {model.license && (
                        <div className="model-meta-item">
                          <span className="meta-label">ライセンス:</span>
                          <span className="meta-value">{model.license}</span>
                        </div>
                      )}
                    </div>
                    {model.modified_at && (
                      <p className="model-updated">
                        最終更新:{' '}
                        {new Date(model.modified_at).toLocaleDateString(
                          'ja-JP'
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {filteredModels.length === 0 && (
              <div className="no-models">
                <p>該当するモデルが見つかりませんでした</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
