// ModelDetailModal - モデル詳細モーダルコンポーネント

import React, { useEffect, useRef } from 'react';
import './ModelDetailModal.css';

/**
 * モデル情報
 */
interface ModelInfo {
  name: string;
  description?: string;
  size?: number;
  parameters?: number;
  category?: 'chat' | 'code' | 'translation' | 'summarization' | 'qa' | 'vision' | 'audio' | 'multimodal' | 'image-generation' | 'audio-generation' | 'embedding' | 'video-generation' | 'other';
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
  allModels?: ModelInfo[];
  onSelectModel?: (model: ModelInfo) => void;
}

export const ModelDetailModal: React.FC<ModelDetailModalProps> = ({
  model,
  onClose,
  onDownload,
  allModels = [],
  onSelectModel,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // フォーカストラップの実装
  useEffect(() => {
    // モーダルが開いたときの処理
    previousActiveElement.current = document.activeElement as HTMLElement;

    // 最初のフォーカス可能な要素にフォーカスを移動
    const modal = modalRef.current;
    if (modal) {
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }

    // フォーカストラップのハンドラー
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modal) return;

      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: 逆方向
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: 順方向
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // ESCキーで閉じる
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscape);

    // クリーンアップ: モーダルが閉じたときに元の要素にフォーカスを戻す
    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscape);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [onClose]);

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
    return categoryLabels[category] || 'その他';
  };

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="model-detail-modal-overlay"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={modalRef}
        className="model-detail-modal"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
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
                <span className="detail-value">
                  {getCategoryLabel(model.category)}
                </span>
              </div>
              {model.parameters && (
                <div className="detail-item">
                  <span className="detail-label">
                    パラメータ数（大きいほど高性能）:
                  </span>
                  <span className="detail-value">
                    {formatParameters(model.parameters)}
                  </span>
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
                  <span className="detail-value">推奨モデル</span>
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
                    <span className="requirement-value">
                      {model.systemRequirements.minMemory}
                    </span>
                  </div>
                )}
                {model.systemRequirements.minDisk && (
                  <div className="requirement-item">
                    <span className="requirement-label">最小ディスク容量:</span>
                    <span className="requirement-value">
                      {model.systemRequirements.minDisk}
                    </span>
                  </div>
                )}
                {model.systemRequirements.os &&
                  model.systemRequirements.os.length > 0 && (
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

          {/* 関連モデル（似たモデルの提案） */}
          {allModels.length > 0 &&
            (() => {
              // 同じカテゴリまたは類似のパラメータ数のモデルを探す
              const relatedModels = allModels
                .filter(
                  m =>
                    m.name !== model.name &&
                    (m.category === model.category ||
                      (model.parameters &&
                        m.parameters &&
                        Math.abs(m.parameters - model.parameters) <
                          model.parameters * 0.5))
                )
                .slice(0, 3); // 最大3つまで表示

              if (relatedModels.length > 0) {
                return (
                  <section className="detail-section">
                    <h3>関連モデル</h3>
                    <div className="related-models-list">
                      {relatedModels.map(relatedModel => (
                        <div
                          key={relatedModel.name}
                          className="related-model-item"
                          onClick={() => {
                            if (onSelectModel) {
                              onSelectModel(relatedModel);
                              onClose();
                            }
                          }}
                          onKeyDown={e => {
                            if (
                              (e.key === 'Enter' || e.key === ' ') &&
                              onSelectModel
                            ) {
                              e.preventDefault();
                              onSelectModel(relatedModel);
                              onClose();
                            }
                          }}
                          role="button"
                          tabIndex={onSelectModel ? 0 : -1}
                          aria-label={`関連モデル ${relatedModel.name} を選択`}
                        >
                          <div className="related-model-header">
                            <span className="related-model-name">
                              {relatedModel.name}
                            </span>
                            {relatedModel.recommended && (
                              <span className="related-model-badge"></span>
                            )}
                          </div>
                          {relatedModel.description && (
                            <p className="related-model-description">
                              {relatedModel.description.length > 80
                                ? relatedModel.description.substring(0, 80) +
                                  '...'
                                : relatedModel.description}
                            </p>
                          )}
                          {relatedModel.size && (
                            <div className="related-model-size">
                              {(
                                relatedModel.size /
                                (1024 * 1024 * 1024)
                              ).toFixed(2)}{' '}
                              GB
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              }
              return null;
            })()}
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
