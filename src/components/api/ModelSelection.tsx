// FLM - Model Selection Component
// フロントエンドエージェント (FE) 実装
// F001: API作成機能 - モデル選択画面

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { safeInvoke } from '../../utils/tauri';
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
  engineType?: string; // エンジンタイプ（オプション）
  onEngineChange?: (engineType: string) => void; // エンジン変更時のコールバック（オプション）
}

export const ModelSelection: React.FC<ModelSelectionProps> = ({
  onModelSelected,
  selectedModel,
  engineType = 'ollama',
  onEngineChange,
}) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelectedModel, setLocalSelectedModel] = useState<OllamaModel | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<string>(engineType);
  const [availableEngines, setAvailableEngines] = useState<string[]>([]);

  // 推奨モデルのリスト
  const recommendedModels = ['llama3', 'llama3.2', 'mistral', 'codellama', 'phi3'];

  // engineTypeプロップが変更されたときにselectedEngineを更新
  useEffect(() => {
    if (engineType && engineType !== selectedEngine) {
      setSelectedEngine(engineType);
      setLocalSelectedModel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineType]);

  // 利用可能なエンジン一覧を取得
  useEffect(() => {
    loadAvailableEngines();
  }, []);

  // 利用可能なエンジン一覧を取得（useCallbackでメモ化）
  const loadAvailableEngines = useCallback(async () => {
    try {
      const engines = await invoke<string[]>('get_available_engines');
      setAvailableEngines(engines);
    } catch (err) {
      console.error('エンジン一覧の取得に失敗:', err);
      setAvailableEngines(['ollama']);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [selectedEngine]);

  // 既に選択されているモデルがある場合は、ローカル状態を初期化
  useEffect(() => {
    if (selectedModel && models.length > 0) {
      const found = models.find(m => m.name === selectedModel.name);
      if (found) {
        setLocalSelectedModel(found);
      }
    }
  }, [selectedModel, models]);

  // モデル一覧を取得（useCallbackでメモ化）
  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // バックエンドのIPCコマンドを呼び出し（エンジン別）
      try {
        let result: Array<{
          name: string;
          size?: number;
          modified_at?: string;
          parameter_size?: string;
        }>;
        
        if (selectedEngine === 'ollama') {
          // 後方互換性のため、Ollamaの場合は既存のコマンドを使用
          result = await safeInvoke<Array<{
            name: string;
            size: number;
            modified_at: string;
            parameter_size?: string;
          }>>('get_models_list');
        } else {
          // 他のエンジンの場合はエンジン別のコマンドを使用
          result = await safeInvoke<Array<{
            name: string;
            size?: number;
            modified_at?: string;
            parameter_size?: string;
          }>>('get_engine_models', {
            engine_type: selectedEngine,
          });
        }

        // レスポンスをOllamaModel形式に変換
        const modelsData: OllamaModel[] = result.map(model => ({
          name: model.name,
          size: model.size || 0,
          modified_at: model.modified_at || new Date().toISOString(),
          parameter_size: model.parameter_size,
        }));

        setModels(modelsData);
      } catch (err) {
        // エラーの場合、ユーザーフレンドリーなメッセージを表示
        const errorMessage = err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました';
        
        // エンジンが起動していない可能性がある場合は、より具体的なメッセージを表示
        const engineNames: { [key: string]: string } = {
          'ollama': 'Ollama',
          'lm_studio': 'LM Studio',
          'vllm': 'vLLM',
          'llama_cpp': 'llama.cpp',
        };
        const engineName = engineNames[selectedEngine] || selectedEngine;
        
        if (errorMessage.includes(engineName) || errorMessage.includes('接続') || errorMessage.includes('起動')) {
          setError(`${engineName}が起動していません。${engineName}を起動してから再度お試しください。`);
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
  }, [selectedEngine]);

  // 検索フィルタ（useMemoでメモ化）
  const filteredModels = useMemo(() => {
    return models.filter(model =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [models, searchQuery]);

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

  // カテゴリ表示名を取得（モデル名から推測）
  const getCategoryLabel = useCallback((modelName: string): string => {
    const name = modelName.toLowerCase();
    if (name.includes('code') || name.includes('coder')) return 'コード生成';
    if (name.includes('chat')) return 'チャット';
    return '汎用';
  }, []);

  if (loading) {
    return (
      <div className="model-selection-loading">
        <div className="loading-spinner"></div>
        <p>モデル一覧を読み込んでいます...</p>
      </div>
    );
  }

  return (
    <div className="model-selection lmstudio-layout">
      {/* LM Studio風レイアウト: 左サイドバー + 右メインエリア */}
      <div className="lmstudio-sidebar">
        {/* サイドバーヘッダー */}
        <div className="sidebar-header">
          <input
            type="text"
            placeholder="検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sidebar-search-input"
          />
          <button onClick={loadModels} className="sidebar-refresh-button" title="更新">
            🔄
          </button>
        </div>

        {/* エンジン選択 */}
        <div className="sidebar-filters">
          <label htmlFor="engine-select" className="sidebar-filter-label">LLMエンジン</label>
          <select
            id="engine-select"
            value={selectedEngine}
            onChange={(e) => {
              const newEngineType = e.target.value;
              setSelectedEngine(newEngineType);
              setLocalSelectedModel(null);
              // エンジン変更を親コンポーネントに通知
              if (onEngineChange) {
                onEngineChange(newEngineType);
              }
            }}
            className="sidebar-filter"
          >
            {availableEngines.map((engine) => {
              const engineNames: { [key: string]: string } = {
                'ollama': 'Ollama',
                'lm_studio': 'LM Studio',
                'vllm': 'vLLM',
                'llama_cpp': 'llama.cpp',
              };
              return (
                <option key={engine} value={engine}>
                  {engineNames[engine] || engine}
                </option>
              );
            })}
          </select>
        </div>

        {/* モデル一覧（コンパクト） */}
        <div className="sidebar-model-list">
          {error && (
            <div className="sidebar-error">
              <p>{error}</p>
            </div>
          )}
          {filteredModels.length === 0 && !loading && (
            <div className="sidebar-empty">
              <p>モデルが見つかりませんでした</p>
            </div>
          )}
          {filteredModels.map((model) => (
            <div
              key={model.name}
              className={`sidebar-model-item ${
                localSelectedModel?.name === model.name ? 'active' : ''
              } ${isRecommended(model.name) ? 'recommended' : ''}`}
              onClick={() => handleModelSelect(model)}
            >
              <div className="sidebar-model-name">{model.name}</div>
              <div className="sidebar-model-meta">
                {model.size && (
                  <span className="sidebar-model-size">
                    {(model.size / (1024 * 1024 * 1024)).toFixed(1)}GB
                  </span>
                )}
                {isRecommended(model.name) && <span className="sidebar-recommended-badge">⭐</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* メインエリア */}
      <div className="lmstudio-main">
        {/* エラーメッセージ */}
        {error && (
          <ErrorMessage
            message={error}
            type="ollama"
            suggestion={error.includes('Ollama') || error.includes('起動') ? 
              'Ollamaを起動してから再度お試しください。Ollamaがインストールされていない場合は、ホーム画面から「Ollamaセットアップ」を実行してください。' : 
              undefined
            }
            onRetry={() => {
              setError(null);
              loadModels();
            }}
          />
        )}

        {/* モデル詳細表示 */}
        {localSelectedModel ? (
          <div className="main-model-details">
            <div className="detail-header">
              <div className="detail-title-section">
                <h2 className="detail-model-name">{localSelectedModel.name}</h2>
                {isRecommended(localSelectedModel.name) && (
                  <span className="detail-recommended-badge">⭐ 推奨モデル</span>
                )}
              </div>
              <div className="detail-actions">
                <button
                  className="detail-action-button primary"
                  onClick={handleNext}
                  disabled={!localSelectedModel}
                >
                  次へ →
                </button>
              </div>
            </div>

            <div className="detail-content">
              {/* 初めての方へのガイダンス */}
              {isRecommended(localSelectedModel.name) && (
                <InfoBanner
                  type="tip"
                  title="推奨モデル"
                  message="このモデルは推奨モデルです。チャット用途やコード生成に最適化されています。"
                  dismissible
                />
              )}

              <div className="detail-info-grid">
                {localSelectedModel.size && (
                  <div className="detail-info-item">
                    <span className="detail-info-label">サイズ</span>
                    <span className="detail-info-value">
                      {formatSize(localSelectedModel.size)}
                    </span>
                  </div>
                )}

                {localSelectedModel.parameter_size && (
                  <div className="detail-info-item">
                    <span className="detail-info-label">パラメータ数</span>
                    <span className="detail-info-value">
                      {localSelectedModel.parameter_size}
                    </span>
                  </div>
                )}

                <div className="detail-info-item">
                  <span className="detail-info-label">カテゴリ</span>
                  <span className="detail-info-value">
                    {getCategoryLabel(localSelectedModel.name)}
                  </span>
                </div>

                {localSelectedModel.modified_at && (
                  <div className="detail-info-item">
                    <span className="detail-info-label">更新日時</span>
                    <span className="detail-info-value">
                      {new Date(localSelectedModel.modified_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="main-empty-state">
            <div className="empty-state-content">
              <h2>モデルを選択してください</h2>
              <p>左側のサイドバーからモデルを選択すると、詳細情報が表示されます。</p>
              <div className="empty-state-hints">
                <h3>推奨モデル</h3>
                <ul>
                  <li><strong>llama3:8b</strong> - 高性能な汎用チャットモデル</li>
                  <li><strong>codellama:7b</strong> - コード生成に特化</li>
                  <li><strong>mistral:7b</strong> - 効率的な多目的モデル</li>
                  <li><strong>phi3:mini</strong> - 軽量高性能モデル</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

