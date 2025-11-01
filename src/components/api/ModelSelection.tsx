// FLM - Model Selection Component
// フロントエンドエージェント (FE) 実装
// F001: API作成機能 - モデル選択画面

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ErrorMessage } from '../common/ErrorMessage';
import { InfoBanner } from '../common/InfoBanner';
import type { SelectedModel } from '../../types/api';
import './ModelSelection.css';

/**
 * Ollamaモデル情報
 */
interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  family?: string;
  format?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

/**
 * モデル選択コンポーネント
 */
interface ModelSelectionProps {
  onModelSelected: (model: SelectedModel) => void;
  selectedModel: SelectedModel | null;
}

export const ModelSelection: React.FC<ModelSelectionProps> = ({
  onModelSelected,
  selectedModel,
}) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedModel, setLocalSelectedModel] = useState<OllamaModel | null>(null);

  // 推奨モデルのリスト
  const recommendedModels = ['llama3', 'llama3.2', 'mistral', 'codellama', 'phi3'];

  useEffect(() => {
    loadModels();
  }, []);

  // 既に選択されているモデルがある場合は、ローカル状態を初期化
  useEffect(() => {
    if (selectedModel && models.length > 0) {
      const found = models.find(m => m.name === selectedModel.name);
      if (found) {
        setLocalSelectedModel(found);
      }
    }
  }, [selectedModel, models]);

  // モデル一覧を取得
  const loadModels = async () => {
    try {
      setLoading(true);
      setError(null);

      // バックエンドのIPCコマンドを呼び出し
      try {
        const result = await invoke<Array<{
          name: string;
          size: number;
          modified_at: string;
          parameter_size?: string;
        }>>('get_models_list');

        // レスポンスをOllamaModel形式に変換
        const modelsData: OllamaModel[] = result.map(model => ({
          name: model.name,
          size: model.size,
          modified_at: model.modified_at,
          parameter_size: model.parameter_size,
        }));

        setModels(modelsData);
      } catch (err) {
        // エラーの場合、ユーザーフレンドリーなメッセージを表示
        const errorMessage = err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました';
        
        // Ollamaが起動していない可能性がある場合は、より具体的なメッセージを表示
        if (errorMessage.includes('Ollama') || errorMessage.includes('接続')) {
          setError('Ollamaが起動していません。Ollamaを起動してから再度お試しください。');
        } else {
          setError(errorMessage);
        }

        // 開発用: サンプルデータを表示（デバッグ時のみ）
        if (import.meta.env.DEV) {
          setModels([
            {
              name: 'llama3:8b',
              size: 4649132864,
              modified_at: new Date().toISOString(),
              parameter_size: '8B',
            },
            {
              name: 'mistral:7b',
              size: 4117237760,
              modified_at: new Date().toISOString(),
              parameter_size: '7B',
            },
          ]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 検索フィルタ
  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // サイズをフォーマット
  const formatSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // 推奨モデルかどうか
  const isRecommended = (modelName: string): boolean => {
    return recommendedModels.some(rec => modelName.toLowerCase().includes(rec.toLowerCase()));
  };

  const handleModelSelect = (model: OllamaModel) => {
    setLocalSelectedModel(model);
  };

  const handleNext = () => {
    if (localSelectedModel) {
      onModelSelected({
        name: localSelectedModel.name,
        size: localSelectedModel.size,
        description: localSelectedModel.parameter_size ? `${localSelectedModel.parameter_size} パラメータ` : undefined,
      });
    }
  };

  if (loading) {
    return (
      <div className="model-selection-loading">
        <div className="loading-spinner"></div>
        <p>モデル一覧を読み込んでいます...</p>
      </div>
    );
  }

  return (
    <div className="model-selection">
      <div className="model-selection-header">
        <h2>使用するモデルを選択</h2>
        <p className="model-selection-description">
          インストール済みのOllamaモデルから選択してください
        </p>
        <div className="model-search">
          <input
            type="text"
            placeholder="モデル名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button onClick={loadModels} className="refresh-button">
            🔄 更新
          </button>
        </div>
      </div>

      {/* エラーメッセージ（改善版） */}
      {error && (
        <ErrorMessage
          message={error}
          type="ollama"
          suggestion={error.includes('Ollama') || error.includes('起動') ? 
            'Ollamaを起動してから再度お試しください。Ollamaがインストールされていない場合は、ホーム画面から「Ollamaセットアップ」を実行してください。' : 
            undefined
          }
        />
      )}

      {/* 初めての方へのガイダンス */}
      {!loading && !error && filteredModels.length > 0 && (
        <InfoBanner
          type="tip"
          title="モデルの選び方"
          message="推奨モデル（⭐マーク）から始めることをおすすめします。チャット用途にはllama3やmistral、コード生成にはcodellamaが適しています。"
          dismissible
        />
      )}

      {filteredModels.length === 0 ? (
        <div className="model-selection-empty">
          <p>モデルが見つかりませんでした</p>
          <p className="empty-hint">
            モデルをインストールするには、「モデル管理」からモデルをダウンロードしてください。
          </p>
        </div>
      ) : (
        <div className="model-grid">
          {filteredModels.map((model) => (
            <div
              key={model.name}
              className={`model-card ${isRecommended(model.name) ? 'recommended' : ''} ${
                selectedModel?.name === model.name ? 'selected' : ''
              }`}
              onClick={() => handleModelSelect(model)}
            >
              {isRecommended(model.name) && (
                <div className="recommended-badge">⭐ 推奨</div>
              )}
              <h3 className="model-name">{model.name}</h3>
              {model.size && (
                <div className="model-info">
                  <span className="model-size">📦 {formatSize(model.size)}</span>
                  {model.parameter_size && (
                    <span className="model-params">⚙️ {model.parameter_size}</span>
                  )}
                </div>
              )}
              <button 
                className="select-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleModelSelect(model);
                }}
              >
                {localSelectedModel?.name === model.name ? '✓ 選択済み' : '選択'}
              </button>
            </div>
          ))}
        </div>
      )}

      {localSelectedModel && (
        <div className="model-selection-actions">
          <button
            className="next-button"
            onClick={handleNext}
          >
            次へ →
          </button>
        </div>
      )}
    </div>
  );
};

