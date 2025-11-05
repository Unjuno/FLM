// ModelCatalogManagement - モデルカタログ管理ページ
// モデルカタログの更新・管理

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './ModelCatalogManagement.css';

/**
 * モデルカタログ情報
 */
interface ModelCatalogInfo {
  name: string;
  description: string;
  size: number;
  parameters: number;
  category: string;
  recommended: boolean;
  author?: string;
  license?: string;
  modified_at?: string;
}

/**
 * モデルカタログ管理ページ
 */
export const ModelCatalogManagement: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const [models, setModels] = useState<ModelCatalogInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  useEffect(() => {
    loadModelCatalog();
  }, []);

  /**
   * モデルカタログを読み込む
   */
  const loadModelCatalog = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const catalog = await safeInvoke<ModelCatalogInfo[]>('get_model_catalog', {});
      setModels(catalog);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'モデルカタログの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * モデルカタログを更新
   */
  const handleUpdateCatalog = async () => {
    try {
      setUpdating(true);
      setError(null);
      
      const updatedCount = await safeInvoke<number>('update_model_catalog', {});
      showSuccess(`モデルカタログを更新しました（${updatedCount}件のモデル）`);
      await loadModelCatalog(); // 更新後に再読み込み
    } catch (err) {
      showError(err instanceof Error ? err.message : 'モデルカタログの更新に失敗しました');
    } finally {
      setUpdating(false);
    }
  };

  /**
   * フィルタリングされたモデル一覧を取得
   */
  const filteredModels = models.filter((model) => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (model.description && model.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || model.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  /**
   * カテゴリ一覧を取得
   */
  const categories = Array.from(new Set(models.map((m) => m.category))).sort();

  /**
   * サイズをフォーマット
   */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  /**
   * パラメータ数をフォーマット
   */
  const formatParameters = (params: number): string => {
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
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>モデルカタログを読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="model-catalog-management-page">
      <div className="model-catalog-management-container">
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
            onClose={() => setError(null)}
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
                onClick={handleUpdateCatalog}
                disabled={updating}
              >
                {updating ? '更新中...' : '🔄 カタログを更新'}
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
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">すべてのカテゴリ</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="catalog-models-section">
            <h2>モデル一覧 ({filteredModels.length}件)</h2>
            <div className="models-grid">
              {filteredModels.map((model) => (
                <div key={model.name} className="model-card">
                  <div className="model-header">
                    <h3 className="model-name">{model.name}</h3>
                    {model.recommended && (
                      <span className="recommended-badge">⭐ 推奨</span>
                    )}
                  </div>
                  <div className="model-body">
                    {model.description && (
                      <p className="model-description">{model.description}</p>
                    )}
                    <div className="model-meta">
                      <div className="model-meta-item">
                        <span className="meta-label">サイズ:</span>
                        <span className="meta-value">{formatSize(model.size)}</span>
                      </div>
                      <div className="model-meta-item">
                        <span className="meta-label">パラメータ:</span>
                        <span className="meta-value">{formatParameters(model.parameters)}</span>
                      </div>
                      <div className="model-meta-item">
                        <span className="meta-label">カテゴリ:</span>
                        <span className="meta-value">{model.category}</span>
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
                        最終更新: {new Date(model.modified_at).toLocaleDateString('ja-JP')}
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

