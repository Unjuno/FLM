// InstalledModelsList - インストール済みモデル一覧コンポーネント

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ModelCard } from './ModelCard';
import './InstalledModelsList.css';

/**
 * インストール済みモデル情報
 */
interface InstalledModel {
  name: string;
  size: number;
  parameters?: number;
  installed_at: string;
  last_used_at?: string;
  usage_count: number;
}

/**
 * インストール済みモデル一覧コンポーネント
 */
interface InstalledModelsListProps {
  onModelSelected?: (model: { name: string; size?: number; description?: string }) => void;
}

export const InstalledModelsList: React.FC<InstalledModelsListProps> = ({
  onModelSelected,
}) => {
  const [models, setModels] = useState<InstalledModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'installed' | 'usage'>('installed');
  const [filterQuery, setFilterQuery] = useState('');

  // インストール済みモデルを読み込む（useCallbackでメモ化）
  const loadInstalledModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // バックエンドのIPCコマンドを呼び出し
      const result = await invoke<Array<{
        name: string;
        size: number;
        parameters?: number;
        installed_at: string;
        last_used_at?: string;
        usage_count: number;
      }>>('get_installed_models');

      // レスポンスをInstalledModel形式に変換
      const models: InstalledModel[] = result.map((m: {
        name: string;
        size: number;
        parameters?: number;
        installed_at: string;
        last_used_at?: string;
        usage_count: number;
      }) => ({
        name: m.name,
        size: m.size,
        parameters: m.parameters,
        installed_at: m.installed_at,
        last_used_at: m.last_used_at,
        usage_count: m.usage_count,
      }));
      
      setModels(models);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'インストール済みモデルの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstalledModels();
  }, [loadInstalledModels]);

  // フィルタとソートを適用（useMemoでメモ化してパフォーマンス最適化）
  const filteredModels = useMemo(() => {
    let filtered = [...models];

    // 検索クエリでフィルタ
    if (filterQuery) {
      filtered = filtered.filter(model =>
        model.name.toLowerCase().includes(filterQuery.toLowerCase())
      );
    }

    // ソート
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return a.size - b.size;
        case 'installed':
          return new Date(b.installed_at).getTime() - new Date(a.installed_at).getTime();
        case 'usage':
          return b.usage_count - a.usage_count;
        default:
          return 0;
      }
    });

    return filtered;
  }, [models, sortBy, filterQuery]);

  // モデル削除（useCallbackでメモ化）
  const handleDelete = useCallback(async (modelName: string) => {
    if (!window.confirm(`モデル "${modelName}" を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      // バックエンドのdelete_modelコマンドを呼び出し
      await invoke('delete_model', { name: modelName });

      // 一覧を更新
      await loadInstalledModels();
    } catch (err) {
      alert(`削除エラー: ${err instanceof Error ? err.message : '不明なエラー'}`);
    }
  }, [loadInstalledModels]);

  // 日時をフォーマット（useCallbackでメモ化）
  const formatDate = useCallback((isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  if (loading) {
    return (
      <div className="installed-models-loading">
        <div className="loading-spinner"></div>
        <p>インストール済みモデルを読み込んでいます...</p>
      </div>
    );
  }

  return (
    <div className="installed-models-list">
      <div className="list-header">
        <div className="search-sort">
          <input
            type="text"
            placeholder="モデル名で検索..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="search-input"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="sort-select"
            aria-label="ソート順"
          >
            <option value="installed">インストール日時順</option>
            <option value="name">名前順</option>
            <option value="size">サイズ順</option>
            <option value="usage">使用頻度順</option>
          </select>
        </div>
        <button onClick={loadInstalledModels} className="refresh-button">
          🔄 更新
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {filteredModels.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h2>インストール済みモデルがありません</h2>
          <p>「モデル検索・ダウンロード」タブからモデルをダウンロードしてください。</p>
        </div>
      ) : (
        <div className="model-grid">
          {filteredModels.map((model) => (
            <div key={model.name} className="installed-model-card">
              <ModelCard
                model={{
                  name: model.name,
                  size: model.size,
                  parameters: model.parameters,
                }}
                onViewDetails={() => {}}
                onDownload={() => {}}
                onUseForApi={() => onModelSelected?.({
                  name: model.name,
                  size: model.size,
                })}
              />
              <div className="model-meta">
                <div className="meta-item">
                  <span className="meta-label">インストール日時:</span>
                  <span className="meta-value">{formatDate(model.installed_at)}</span>
                </div>
                {model.last_used_at && (
                  <div className="meta-item">
                    <span className="meta-label">最終使用:</span>
                    <span className="meta-value">{formatDate(model.last_used_at)}</span>
                  </div>
                )}
                <div className="meta-item">
                  <span className="meta-label">使用回数:</span>
                  <span className="meta-value">{model.usage_count}回</span>
                </div>
              </div>
              <button
                className="delete-model-button"
                onClick={() => handleDelete(model.name)}
              >
                🗑️ 削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
