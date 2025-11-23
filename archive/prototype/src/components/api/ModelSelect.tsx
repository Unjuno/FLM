/* eslint-disable jsx-a11y/aria-props */
// ModelSelect - モデル選択コンポーネント

import React, { useState, useEffect } from 'react';
import { safeInvoke } from '../../utils/tauri';
import type { SelectedModel } from '../../types/api';
import { useI18n } from '../../contexts/I18nContext';
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
export const ModelSelect: React.FC<ModelSelectProps> = ({
  onSelect,
  onCancel,
}) => {
  const { t } = useI18n();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  );

  // モデル一覧を取得
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        // バックエンドIPCコマンドを呼び出してモデル一覧を取得
        const modelsList = await safeInvoke<
          Array<{
            name: string;
            size: number | null;
            modified_at: string;
            parameter_size: string | null;
          }>
        >('get_models_list');

        const modelInfos: ModelInfo[] = modelsList.map(model => ({
          name: model.name,
          size: model.size || undefined,
          modified_at: model.modified_at || undefined,
        }));

        setModels(modelInfos);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました'
        );
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
        <h2 id="model-select-heading">{t('modelSelect.title')}</h2>
        <p className="model-select-description" role="doc-subtitle">
          {t('modelSelect.description')}
        </p>
      </div>

      {loading && (
        <div
          className="model-select-loading"
          role="status"
          aria-live="polite"
          aria-label={t('modelSelect.loadingAria')}
        >
          <div className="spinner" aria-hidden="true"></div>
          <p>{t('modelSelect.loading')}</p>
        </div>
      )}

      {error && (
        <div className="model-select-error" role="alert" aria-live="assertive">
          <span className="error-icon" aria-hidden="true">
            ⚠️
          </span>
          <p className="error-message">{error}</p>
          <button
            className="button secondary"
            onClick={() => window.location.reload()}
            aria-label={t('modelSelect.retryAria')}
            type="button"
          >
            {t('modelSelect.retry')}
          </button>
        </div>
      )}

      {!loading && !error && models.length === 0 && (
        <div
          className="model-select-empty"
          role="status"
          aria-labelledby="model-select-heading"
        >
          <span className="empty-icon" aria-hidden="true">
            ℹ️
          </span>
          <p>{t('modelSelect.empty')}</p>
          <p className="empty-submessage">{t('modelSelect.emptySubmessage')}</p>
          <button
            className="button primary"
            onClick={onCancel}
            aria-label={t('modelSelect.goToModelManagementAria')}
            type="button"
          >
            {t('modelSelect.goToModelManagement')}
          </button>
        </div>
      )}

      {!loading && !error && models.length > 0 && (
        <div className="model-select-content">
          <div
            className="model-list"
            role="listbox"
            aria-labelledby="model-select-heading"
            aria-label="利用可能なモデル一覧"
          >
            {models.map(model => (
              <div
                key={model.name}
                className={`model-card ${selectedModelName === model.name ? 'selected' : ''}`}
                onClick={() => handleSelectModel(model)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectModel(model);
                  }
                }}
                role="option"
                aria-selected={
                  selectedModelName === model.name ? 'true' : 'false'
                }
                tabIndex={0}
                aria-label={`モデル ${model.name}${selectedModelName === model.name ? '（選択中）' : ''}${model.size ? `、サイズ ${formatSize(model.size)}` : ''}${model.modified_at ? `、最終更新 ${new Date(model.modified_at).toLocaleDateString('ja-JP')}` : ''}`}
              >
                <div className="model-card-header">
                  <h3 className="model-name">{model.name}</h3>
                  {model.size && (
                    <span
                      className="model-size"
                      aria-label={`サイズ: ${formatSize(model.size)}`}
                    >
                      {formatSize(model.size)}
                    </span>
                  )}
                </div>
                {model.modified_at && (
                  <div className="model-card-footer">
                    <span
                      className="model-modified"
                      aria-label={`最終更新: ${new Date(model.modified_at).toLocaleDateString('ja-JP')}`}
                    >
                      最終更新:{' '}
                      {new Date(model.modified_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="model-select-actions">
            <button
              className="button secondary"
              onClick={onCancel}
              aria-label="モデル選択をキャンセルする"
              type="button"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
