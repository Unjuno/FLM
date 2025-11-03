// ModelCard - モデルカードコンポーネント

import React from 'react';
import './ModelCard.css';

/**
 * モデル情報
 */
interface ModelInfo {
  name: string;
  description?: string;
  size?: number;
  parameters?: number;
  category?: 'chat' | 'code' | 'translation' | 'summarization' | 'qa' | 'other';
  recommended?: boolean;
}

/**
 * モデルカードコンポーネント
 */
interface ModelCardProps {
  model: ModelInfo;
  onViewDetails: () => void;
  onDownload: () => void;
  onUseForApi?: () => void;
  isDownloading?: boolean;
  viewMode?: 'grid' | 'list';
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  onViewDetails,
  onDownload,
  onUseForApi,
  isDownloading = false,
  viewMode = 'grid',
}) => {
  // サイズをフォーマット
  const formatSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // パラメータ数をフォーマット
  const formatParameters = (params: number): string => {
    const billion = params / 1000000000;
    if (billion >= 1) {
      return `${billion.toFixed(1)}B`;
    }
    const million = params / 1000000;
    return `${million.toFixed(0)}M`;
  };

  // カテゴリ表示
  const getCategoryLabel = (category?: string): string => {
    switch (category) {
      case 'chat': return 'チャット';
      case 'code': return 'コード生成';
      case 'translation': return '翻訳';
      case 'summarization': return '要約';
      case 'qa': return '質問応答';
      default: return 'その他';
    }
  };

  return (
    <div className={`model-card ${model.recommended ? 'recommended' : ''} ${viewMode === 'list' ? 'list-view' : 'grid-view'}`}>
      {model.recommended && (
        <div className="recommended-badge">⭐ 推奨</div>
      )}
      
      <div className="model-card-header">
        <h3 className="model-name">{model.name}</h3>
        {model.category && (
          <span
            className={`category-badge category-${model.category}`}
            data-category={model.category}
          >
            {getCategoryLabel(model.category)}
          </span>
        )}
      </div>

      {model.description && (
        <p className="model-description">{model.description}</p>
      )}

      <div className="model-info">
        {model.parameters && (
          <div className="info-item">
            <span className="info-icon">⚙️</span>
            <span className="info-label">パラメータ数（大きいほど高性能）:</span>
            <span className="info-value">{formatParameters(model.parameters)}</span>
          </div>
        )}
        {model.size && (
          <div className="info-item">
            <span className="info-icon">📦</span>
            <span className="info-label">サイズ:</span>
            <span className="info-value">{formatSize(model.size)}</span>
          </div>
        )}
        {model.recommended && (
          <div className="info-item">
            <span className="info-icon">⭐</span>
            <span className="info-label">人気度:</span>
            <span className="info-value">⭐⭐⭐⭐⭐</span>
          </div>
        )}
      </div>

      <div className="model-card-actions">
        <button
          className="action-button details"
          onClick={onViewDetails}
        >
          詳細を見る
        </button>
        {onUseForApi && (
          <button
            className="action-button use"
            onClick={onUseForApi}
          >
            API作成に使用
          </button>
        )}
        <button
          className={`action-button download ${isDownloading ? 'downloading' : ''}`}
          onClick={onDownload}
          disabled={isDownloading}
        >
          {isDownloading ? 'ダウンロード中...' : '📥 ダウンロード'}
        </button>
      </div>
    </div>
  );
};

