// HuggingFaceSearch - Hugging Faceモデル検索コンポーネント

import React, { useState, useCallback, useTransition } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { useNotifications } from '../../contexts/NotificationContext';
import { ErrorMessage } from '../common/ErrorMessage';
import { InfoBanner } from '../common/InfoBanner';
import { ModelDetailModal } from './ModelDetailModal';
import './HuggingFaceSearch.css';

/**
 * Hugging Faceモデル情報
 */
interface HuggingFaceModel {
  id: string;
  author: string;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag?: string;
  library_name?: string;
  task?: string;
}

/**
 * Hugging Face検索結果
 */
interface HuggingFaceSearchResult {
  models: HuggingFaceModel[];
  total: number;
}

/**
 * Hugging Face検索コンポーネント
 */
export const HuggingFaceSearch: React.FC = () => {
  const { showSuccess, showError: showErrorNotification } = useNotifications();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<HuggingFaceModel[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<HuggingFaceModel | null>(
    null
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用

  /**
   * モデルを検索
   */
  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setError('検索クエリを入力してください');
      return;
    }

    try {
      setSearching(true);
      setError(null);

      const result = await safeInvoke<HuggingFaceSearchResult>(
        'search_huggingface_models',
        {
          query: query.trim(),
          limit: 20,
        }
      );

      setResults(result.models);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました');
    } finally {
      setSearching(false);
    }
  }, [query]);

  /**
   * Enterキーで検索
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  /**
   * モデル詳細を表示
   */
  const handleViewDetails = async (modelId: string) => {
    try {
      setError(null);
      const modelInfo = await safeInvoke<HuggingFaceModel | null>(
        'get_huggingface_model_info',
        {
          modelId,
        }
      );
      if (modelInfo) {
        setSelectedModel(modelInfo);
        setShowDetailModal(true);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'モデル情報の取得に失敗しました';
      setError(errorMessage);
      showErrorNotification(errorMessage);
    }
  };

  /**
   * モデルをダウンロードして変換
   */
  const handleDownloadModel = async (modelId: string) => {
    try {
      setDownloading(modelId);
      setError(null);

      // モデル情報を取得
      const modelInfo = await safeInvoke<HuggingFaceModel | null>(
        'get_huggingface_model_info',
        {
          modelId,
        }
      );

      if (!modelInfo) {
        throw new Error('モデル情報の取得に失敗しました');
      }

      // モデルをダウンロード（Ollama形式に変換）
      // 注意: Hugging FaceモデルはOllama形式に変換する必要があるため、
      // 現在はOllamaモデル名として直接ダウンロードを試みます
      // 将来的には、Hugging FaceモデルをOllama形式に変換する機能を追加する予定
      await safeInvoke('download_model', {
        modelName: modelId,
      });

      showSuccess(`モデル "${modelId}" のダウンロードを開始しました`);

      // 必要に応じてGGUF形式に変換
      try {
        await safeInvoke('convert_model', {
          sourcePath: modelId,
          targetName: modelId.replace(/\//g, '_'),
          outputFormat: 'gguf',
          quantization: 'Q4_K_M',
        });
        showSuccess(`モデル "${modelId}" の変換が完了しました`);
      } catch (convertErr) {
        // 変換エラーは警告として表示（ダウンロードは成功している可能性がある）
        showErrorNotification(
          convertErr instanceof Error
            ? `モデル変換エラー: ${convertErr.message}`
            : 'モデル変換に失敗しましたが、ダウンロードは完了しています'
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'モデルのダウンロードに失敗しました';
      setError(errorMessage);
      showErrorNotification(errorMessage);
    } finally {
      setDownloading(null);
    }
  };

  /**
   * モーダルでダウンロードを実行
   */
  const handleModalDownload = async () => {
    if (selectedModel) {
      setShowDetailModal(false);
      await handleDownloadModel(selectedModel.id);
    }
  };

  /**
   * ModelDetailModal用のモデル情報を変換
   */
  const convertToModelInfo = (model: HuggingFaceModel) => {
    return {
      name: model.id,
      description: model.pipeline_tag || model.task || undefined,
      author: model.author,
      category:
        model.pipeline_tag === 'text-generation'
          ? ('chat' as const)
          : model.pipeline_tag === 'text2text-generation'
            ? ('translation' as const)
            : ('other' as const),
      recommended: model.downloads > 100000 || model.likes > 100,
      license:
        model.tags.find(tag => tag.toLowerCase().includes('license')) ||
        undefined,
    };
  };

  return (
    <div className="huggingface-search">
      <div className="huggingface-search-header">
        <h2>Hugging Faceモデル検索</h2>
        <p className="huggingface-search-description">
          Hugging Face
          Hubからモデルを検索して、Ollamaで使用できる形式に変換できます。
        </p>
      </div>

      <div className="huggingface-search-controls">
        <div className="search-input-group">
          <input
            type="text"
            className="search-input"
            placeholder="モデル名、作成者、タグで検索..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={searching}
          />
          <button
            className="search-button"
            onClick={() => {
              startTransition(() => {
                handleSearch();
              });
            }}
            disabled={searching || !query.trim() || isPending}
          >
            {searching ? '検索中...' : '検索'}
          </button>
        </div>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          type="general"
          onClose={() => setError(null)}
        />
      )}

      {results.length > 0 && (
        <div className="huggingface-results">
          <div className="results-header">
            <p className="results-count">{total}件のモデルが見つかりました</p>
          </div>

          <div className="models-grid">
            {results.map(model => (
              <div
                key={model.id}
                className={`model-card ${selectedModel?.id === model.id ? 'selected' : ''}`}
                onClick={() => setSelectedModel(model)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedModel(model);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`モデル ${model.id} を選択`}
              >
                <div className="model-card-header">
                  <h3 className="model-name">{model.id}</h3>
                  <div className="model-stats">
                    <span className="stat-item">
                      {model.downloads.toLocaleString()}
                    </span>
                    <span className="stat-item">
                      {model.likes.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="model-card-body">
                  <div className="model-info">
                    <span className="model-author">作成者: {model.author}</span>
                    {model.pipeline_tag && (
                      <span className="model-tag">
                        タグ: {model.pipeline_tag}
                      </span>
                    )}
                    {model.task && (
                      <span className="model-task">タスク: {model.task}</span>
                    )}
                  </div>
                  {model.tags.length > 0 && (
                    <div className="model-tags">
                      {model.tags.slice(0, 5).map((tag, idx) => (
                        <span key={idx} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="model-card-actions">
                  <button
                    className="action-button primary"
                    onClick={e => {
                      e.stopPropagation();
                      // モデル情報を取得して詳細表示
                      handleViewDetails(model.id);
                    }}
                    type="button"
                    aria-label={`${model.id}の詳細を見る`}
                  >
                    詳細を見る
                  </button>
                  <button
                    className="action-button secondary"
                    onClick={e => {
                      e.stopPropagation();
                      // モデルをダウンロードして変換
                      handleDownloadModel(model.id);
                    }}
                    type="button"
                    aria-label={`${model.id}をダウンロード`}
                    disabled={downloading === model.id}
                  >
                    {downloading === model.id
                      ? 'ダウンロード中...'
                      : 'ダウンロード'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !searching && query && (
        <InfoBanner
          type="info"
          message="検索結果がありません。別のキーワードで検索してください。"
        />
      )}

      {showDetailModal && selectedModel && (
        <ModelDetailModal
          model={convertToModelInfo(selectedModel)}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedModel(null);
          }}
          onDownload={handleModalDownload}
        />
      )}
    </div>
  );
};
