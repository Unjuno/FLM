// ModelDetailModal - モデル詳細モーダルコンポーネント

import React from 'react';
import './ModelDetailModal.css';

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
  author?: string;
  license?: string;
  usageExamples?: string[];
  systemRequirements?: {
    minMemory?: string;
    minDisk?: string;
    os?: string[];
  };
}

/**
 * モデル詳細モーダルコンポーネント
 */
interface ModelDetailModalProps {
  model: ModelInfo;
  onClose: () => void;
  onDownload: () => void;
}

export const ModelDetailModal: React.FC<ModelDetailModalProps> = ({
  model,
  onClose,
  onDownload,
}) => {
  // サイズをフォーマット
  const formatSize = (bytes?: number): string => {
    if (!bytes) return '不明';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // パラメータ数をフォーマット
  const formatParameters = (params?: number): string => {
    if (!params) return '不明';
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
    <div className="model-detail-modal-overlay" onClick={onClose}>
      <div className="model-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{model.name}</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-content">
          {/* 基本情報 */}
          <section className="detail-section">
            <h3>基本情報</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">カテゴリ:</span>
                <span className="detail-value">{getCategoryLabel(model.category)}</span>
              </div>
              {model.parameters && (
                <div className="detail-item">
                  <span className="detail-label">パラメータ数（大きいほど高性能）:</span>
                  <span className="detail-value">{formatParameters(model.parameters)}</span>
                </div>
              )}
              {model.size && (
                <div className="detail-item">
                  <span className="detail-label">サイズ:</span>
                  <span className="detail-value">{formatSize(model.size)}</span>
                </div>
              )}
              {model.recommended && (
                <div className="detail-item">
                  <span className="detail-label">推奨:</span>
                  <span className="detail-value">⭐ 推奨モデル</span>
                </div>
              )}
            </div>
          </section>

          {/* 説明 */}
          {model.description && (
            <section className="detail-section">
              <h3>説明</h3>
              <p className="description-text">{model.description}</p>
            </section>
          )}

          {/* 使用例 */}
          {model.usageExamples && model.usageExamples.length > 0 && (
            <section className="detail-section">
              <h3>使用例</h3>
              <ul className="usage-examples">
                {model.usageExamples.map((example, index) => (
                  <li key={index}>{example}</li>
                ))}
              </ul>
            </section>
          )}

          {/* システム要件 */}
          {model.systemRequirements && (
            <section className="detail-section">
              <h3>システム要件</h3>
              <div className="requirements-list">
                {model.systemRequirements.minMemory && (
                  <div className="requirement-item">
                    <span className="requirement-label">最小メモリ:</span>
                    <span className="requirement-value">{model.systemRequirements.minMemory}</span>
                  </div>
                )}
                {model.systemRequirements.minDisk && (
                  <div className="requirement-item">
                    <span className="requirement-label">最小ディスク容量:</span>
                    <span className="requirement-value">{model.systemRequirements.minDisk}</span>
                  </div>
                )}
                {model.systemRequirements.os && model.systemRequirements.os.length > 0 && (
                  <div className="requirement-item">
                    <span className="requirement-label">対応OS:</span>
                    <span className="requirement-value">
                      {model.systemRequirements.os.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 作成者・ライセンス */}
          {(model.author || model.license) && (
            <section className="detail-section">
              <h3>情報</h3>
              <div className="detail-grid">
                {model.author && (
                  <div className="detail-item">
                    <span className="detail-label">作成者:</span>
                    <span className="detail-value">{model.author}</span>
                  </div>
                )}
                {model.license && (
                  <div className="detail-item">
                    <span className="detail-label">ライセンス:</span>
                    <span className="detail-value">{model.license}</span>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>
            閉じる
          </button>
          <button className="button-primary" onClick={onDownload}>
            📥 ダウンロード
          </button>
        </div>
      </div>
    </div>
  );
};
