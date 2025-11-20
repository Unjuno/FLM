// ModelSelectionSidebar - モデル選択サイドバーコンポーネント

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ENGINE_NAMES } from './ModelSelection';
import { FORMATTING } from '../../constants/config';
import './ModelSelection.css';

/**
 * Ollamaモデル情報
 */
export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  family?: string;
  format?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
  description?: string;
  recommended?: boolean;
}

/**
 * モデル選択サイドバーのプロップス
 */
interface ModelSelectionSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedEngine: string;
  availableEngines: string[];
  viewMode: 'installed' | 'catalog' | 'all';
  onViewModeChange: (mode: 'installed' | 'catalog' | 'all') => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedSizeFilter: string;
  onSizeFilterChange: (size: string) => void;
  filteredModels: OllamaModel[];
  models: OllamaModel[];
  catalogModelsAsOllama: OllamaModel[];
  localSelectedModel: OllamaModel | null;
  onModelSelect: (model: OllamaModel) => void;
  isRecommended: (modelName: string) => boolean;
  loading: boolean;
  error: string | null;
  isAnyEngineStarting: boolean;
  checkingEngine: boolean;
  onRefresh: () => void;
  onEngineChange?: (engineType: string) => void;
}

/**
 * モデル選択サイドバーコンポーネント
 */
export const ModelSelectionSidebar: React.FC<ModelSelectionSidebarProps> = ({
  searchQuery,
  onSearchChange,
  selectedEngine,
  availableEngines,
  viewMode,
  onViewModeChange,
  selectedCategory,
  onCategoryChange,
  selectedSizeFilter,
  onSizeFilterChange,
  filteredModels,
  models,
  catalogModelsAsOllama,
  localSelectedModel,
  onModelSelect,
  isRecommended,
  loading,
  error,
  isAnyEngineStarting,
  checkingEngine,
  onRefresh,
  onEngineChange,
}) => {
  const navigate = useNavigate();

  return (
    <div className="lmstudio-sidebar">
      {/* サイドバーヘッダー */}
      <div className="sidebar-header">
        <input
          type="text"
          placeholder="検索..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="sidebar-search-input"
        />
        <div className="sidebar-header-actions">
          <button
            onClick={() =>
              navigate('/models', {
                state: { returnTo: 'api/create', selectedEngine },
              })
            }
            className="sidebar-search-models-button"
            title="モデルを検索・ダウンロード（LM Studioのように多様なモデルを検索できます）"
          >
            検索
          </button>
          <button
            onClick={onRefresh}
            className="sidebar-refresh-button"
            title={
              isAnyEngineStarting || checkingEngine
                ? 'エンジン起動中です...'
                : '更新'
            }
            disabled={isAnyEngineStarting || checkingEngine}
          >
            更新
          </button>
        </div>
      </div>

      {/* エンジン選択 */}
      <div className="sidebar-filters">
        <label htmlFor="engine-select" className="sidebar-filter-label">
          LLMエンジン
        </label>
        <select
          id="engine-select"
          value={selectedEngine}
          disabled={isAnyEngineStarting || checkingEngine}
          onChange={e => {
            if (isAnyEngineStarting || checkingEngine) {
              return;
            }
            const newEngineType = e.target.value;
            if (onEngineChange) {
              onEngineChange(newEngineType);
            }
          }}
          className="sidebar-filter"
          title={
            isAnyEngineStarting || checkingEngine
              ? 'エンジン起動中です...'
              : 'LLMエンジン'
          }
          aria-label="LLMエンジン"
        >
          {availableEngines.map(engine => (
            <option key={engine} value={engine}>
              {ENGINE_NAMES[engine] || engine}
            </option>
          ))}
        </select>
      </div>

      {/* 表示モード選択 */}
      <div className="sidebar-filters">
        <label htmlFor="view-mode-select" className="sidebar-filter-label">
          表示モード
        </label>
        <select
          id="view-mode-select"
          value={viewMode}
          onChange={e =>
            onViewModeChange(e.target.value as 'installed' | 'catalog' | 'all')
          }
          className="sidebar-filter"
          aria-label="表示モード"
        >
          <option value="all">すべてのモデル</option>
          <option value="installed">インストール済み</option>
          <option value="catalog">カタログから選択</option>
        </select>
      </div>

      {/* カテゴリフィルター */}
      <div className="sidebar-filters">
        <label htmlFor="category-select" className="sidebar-filter-label">
          カテゴリ
        </label>
        <select
          id="category-select"
          value={selectedCategory}
          onChange={e => onCategoryChange(e.target.value)}
          className="sidebar-filter"
          aria-label="カテゴリ"
        >
          <option value="all">すべて</option>
          <option value="chat">チャット</option>
          <option value="code">コード生成</option>
          <option value="translation">翻訳</option>
          <option value="summarization">要約</option>
          <option value="qa">質問応答</option>
          <option value="vision">画像認識</option>
          <option value="audio">音声処理</option>
          <option value="multimodal">マルチモーダル</option>
          <option value="image-generation">画像生成</option>
          <option value="audio-generation">音声生成</option>
          <option value="embedding">埋め込み</option>
          <option value="video-generation">動画生成</option>
          <option value="other">その他</option>
        </select>
      </div>

      {/* サイズフィルター */}
      <div className="sidebar-filters">
        <label htmlFor="size-select" className="sidebar-filter-label">
          サイズ
        </label>
        <select
          id="size-select"
          value={selectedSizeFilter}
          onChange={e => onSizeFilterChange(e.target.value)}
          className="sidebar-filter"
          aria-label="サイズ"
        >
          <option value="all">すべて</option>
          <option value="small">小（3GB未満）</option>
          <option value="medium">中（3-10GB）</option>
          <option value="large">大（10-30GB）</option>
          <option value="xlarge">超大（30GB以上）</option>
          <option value="unknown">サイズ不明</option>
        </select>
      </div>

      {/* モデル一覧（コンパクト） */}
      <div className="sidebar-model-list">
        {filteredModels.length === 0 && !loading && !error && (
          <div className="sidebar-empty">
            <p>モデルが見つかりませんでした</p>
            <button
              onClick={() =>
                navigate('/models', {
                  state: { returnTo: 'api/create', selectedEngine },
                })
              }
              className="sidebar-empty-search-button"
              title="モデルを検索・ダウンロード"
            >
              モデルを検索・ダウンロード
            </button>
          </div>
        )}
        {filteredModels.length === 0 && !loading && error && (
          <div className="sidebar-empty">
            <p>エラーが発生しました</p>
            <p className="sidebar-empty-submessage">
              詳細は右側のメインエリアをご確認ください
            </p>
          </div>
        )}
        {filteredModels.map(model => {
          const isInstalled = models.some(m => m.name === model.name);
          const isFromCatalog = catalogModelsAsOllama.some(
            m => m.name === model.name
          );

          return (
            <div
              key={model.name}
              className={`sidebar-model-item ${
                localSelectedModel?.name === model.name ? 'active' : ''
              } ${model.recommended || isRecommended(model.name) ? 'recommended' : ''} ${
                isInstalled ? 'installed' : isFromCatalog ? 'catalog' : ''
              }`}
              onClick={() => onModelSelect(model)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onModelSelect(model);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`${model.name}を選択`}
              title={model.description || model.name}
            >
              <div className="sidebar-model-name">{model.name}</div>
              <div className="sidebar-model-meta">
                {model.size > 0 && (
                  <span className="sidebar-model-size">
                    {(model.size / FORMATTING.BYTES_PER_GB).toFixed(
                      FORMATTING.DECIMAL_PLACES_SHORT
                    )}
                    GB
                  </span>
                )}
                {model.parameter_size && (
                  <span className="sidebar-model-params">
                    {model.parameter_size}
                  </span>
                )}
                {(model.recommended || isRecommended(model.name)) && (
                  <span className="sidebar-recommended-badge">推奨</span>
                )}
                {!isInstalled && isFromCatalog && (
                  <span
                    className="sidebar-catalog-badge"
                    title="カタログから選択可能（ダウンロードが必要）"
                  >
                    カタログ
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
