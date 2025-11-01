// FLM - モデル選択コンポーネント
// フロントエンドエージェント (FE) 実装
// F001: API作成機能 - モデル選択画面

import React, { useState, useEffect } from 'react';
import type { SelectedModel } from '../../types/api';
import './ModelSelect.css';

interface ModelInfo {
  name: string;
  size?: number;
  modified_at?: string;
}

interface ModelSelectProps {
  onSelect: (model: SelectedModel) => void;
  onCancel: () => void;
}

/**
 * モデル選択コンポーネント
 * Ollama APIからモデル一覧を取得して表示します
 */
export const ModelSelect: React.FC<ModelSelectProps> = ({ onSelect, onCancel }) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null);

  // モデル一覧を取得
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        // TODO: バックエンドIPCコマンドを呼び出してモデル一覧を取得
        // 現在は仮のデータを使用
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) {
          throw new Error('モデル一覧の取得に失敗しました');
        }
        const data = await response.json();
        setModels(data.models || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  // モデルを選択
  const handleSelectModel = (model: ModelInfo) => {
    setSelectedModelName(model.name);
    onSelect({
      name: model.name,
      size: model.size,
    });
  };

  // サイズをフォーマット
  const formatSize = (bytes?: number): string => {
    if (!bytes) return '不明';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="model-select">
      <div className="model-select-header">
        <h2>使用するモデルを選択</h2>
        <p className="model-select-description">
          作成するAPIで使用するOllamaモデルを選択してください
        </p>
      </div>

      {loading && (
        <div className="model-select-loading">
          <div className="spinner"></div>
          <p>モデル一覧を取得しています...</p>
        </div>
      )}

      {error && (
        <div className="model-select-error">
          <span className="error-icon">⚠️</span>
          <p className="error-message">{error}</p>
          <button className="button secondary" onClick={() => window.location.reload()}>
            再試行
          </button>
        </div>
      )}

      {!loading && !error && models.length === 0 && (
        <div className="model-select-empty">
          <span className="empty-icon">ℹ️</span>
          <p>インストールされているモデルがありません</p>
          <p className="empty-submessage">
            モデル管理ページでモデルをダウンロードしてください
          </p>
          <button className="button primary" onClick={onCancel}>
            モデル管理に移動
          </button>
        </div>
      )}

      {!loading && !error && models.length > 0 && (
        <div className="model-select-content">
          <div className="model-list">
            {models.map((model) => (
              <div
                key={model.name}
                className={`model-card ${selectedModelName === model.name ? 'selected' : ''}`}
                onClick={() => handleSelectModel(model)}
              >
                <div className="model-card-header">
                  <h3 className="model-name">{model.name}</h3>
                  {model.size && (
                    <span className="model-size">{formatSize(model.size)}</span>
                  )}
                </div>
                {model.modified_at && (
                  <div className="model-card-footer">
                    <span className="model-modified">
                      最終更新: {new Date(model.modified_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="model-select-actions">
            <button className="button secondary" onClick={onCancel}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
