// FLM - モデル検索コンポーネント
// フロントエンドエージェント (FE) 実装
// F004: モデル管理機能 - モデル検索画面

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ModelCard } from './ModelCard';
import { ModelDetailModal } from './ModelDetailModal';
import { ModelDownloadProgress } from './ModelDownloadProgress';
import './ModelSearch.css';

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
}

/**
 * モデル検索コンポーネント
 */
interface ModelSearchProps {
  onModelSelected?: (model: ModelInfo) => void;
}

export const ModelSearch: React.FC<ModelSearchProps> = ({ onModelSelected }) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [selectedUse, setSelectedUse] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'size' | 'name' | 'newest'>('popular');
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    progress: number;
    speed: number;
    remaining: number;
    downloaded: number;
    total: number;
  } | null>(null);

  // モデル一覧を取得（useCallbackでメモ化）
  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // TODO: バックエンドエージェントが実装するIPCコマンドを呼び出し
      // const result = await invoke<{ models: ModelInfo[] }>('get_model_catalog');

      // 暫定実装（バックエンド実装待ち）
      setModels([
        {
          name: 'llama3:8b',
          description: '高性能な汎用チャットモデル',
          size: 4649132864,
          parameters: 8000000000,
          category: 'chat',
          recommended: true,
        },
        {
          name: 'codellama:7b',
          description: 'コード生成に特化したモデル',
          size: 3858733056,
          parameters: 7000000000,
          category: 'code',
          recommended: true,
        },
        {
          name: 'mistral:7b',
          description: '効率的な多目的モデル',
          size: 4117237760,
          parameters: 7000000000,
          category: 'chat',
          recommended: true,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // フィルタとソートを適用（useMemoでメモ化してパフォーマンス最適化）
  const filteredModels = useMemo(() => {
    let filtered = [...models];

    // 検索クエリでフィルタ
    if (searchQuery) {
      filtered = filtered.filter(model =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // カテゴリでフィルタ
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(model => model.category === selectedCategory);
    }

    // サイズでフィルタ
    if (selectedSize !== 'all') {
      filtered = filtered.filter(model => {
        if (!model.size) return false;
        const gb = model.size / (1024 * 1024 * 1024);
        if (selectedSize === 'small') return gb < 4;
        if (selectedSize === 'medium') return gb >= 4 && gb < 10;
        if (selectedSize === 'large') return gb >= 10;
        return true;
      });
    }

    // 用途でフィルタ
    if (selectedUse !== 'all') {
      filtered = filtered.filter(model => {
        if (selectedUse === 'general') {
          return model.category === 'chat';
        }
        if (selectedUse === 'specialized') {
          return model.category !== 'chat' && model.category !== 'other';
        }
        return true;
      });
    }

    // ソート
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          if (a.recommended && !b.recommended) return -1;
          if (!a.recommended && b.recommended) return 1;
          return 0;
        case 'size':
          return (a.size || 0) - (b.size || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'newest':
          return 0; // TODO: 日時情報でソート
        default:
          return 0;
      }
    });

    return filtered;
  }, [models, searchQuery, selectedCategory, selectedSize, selectedUse, sortBy]);

  const [isDownloadPaused, setIsDownloadPaused] = useState(false);
  const [downloadAbortController, setDownloadAbortController] = useState<AbortController | null>(null);

  // サイズをフォーマット（useCallbackでメモ化、handleDownloadより前に定義）
  const formatSize = useCallback((bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }, []);

  // モデルダウンロード開始（useCallbackでメモ化、依存関係にformatSizeとloadModelsを含む）
  const handleDownload = useCallback(async (model: ModelInfo) => {
    if (!model.size) {
      alert('モデルサイズ情報がありません');
      return;
    }

    const confirmMessage = `モデル "${model.name}" をダウンロードしますか？\nサイズ: ${formatSize(model.size)}\n必要容量: ${formatSize(model.size)}`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDownloadingModel(model.name);
    setIsDownloadPaused(false);
    setDownloadProgress({
      progress: 0,
      speed: 0,
      remaining: 0,
      downloaded: 0,
      total: model.size,
    });

    const abortController = new AbortController();
    setDownloadAbortController(abortController);

    try {
      // TODO: バックエンドエージェントが実装するIPCコマンドを呼び出し
      // await invoke('download_model', {
      //   model: model.name,
      //   onProgress: (progress) => {
      //     setDownloadProgress(progress);
      //   },
      // });

      // 暫定実装（バックエンド実装待ち）
      // ダウンロードシミュレーション
      for (let i = 0; i <= 100; i += 5) {
        if (abortController.signal.aborted) {
          break;
        }
        
        if (isDownloadPaused) {
          await new Promise(resolve => {
            const checkPaused = setInterval(() => {
              if (!isDownloadPaused) {
                clearInterval(checkPaused);
                resolve(null);
              }
            }, 100);
          });
        }

        await new Promise(resolve => setTimeout(resolve, 200));
        const downloaded = (model.size * i) / 100;
        const elapsed = i * 0.2;
        const speed = elapsed > 0 ? downloaded / elapsed : 0;
        const remaining = speed > 0 ? (model.size - downloaded) / speed : 0;

        setDownloadProgress({
          progress: i,
          downloaded,
          speed,
          remaining,
          total: model.size,
        });
      }

      if (!abortController.signal.aborted) {
        // ダウンロード完了通知
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('ダウンロード完了', {
            body: `${model.name} のダウンロードが完了しました`,
            icon: '/icon.png',
          });
        }
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        alert(`ダウンロードエラー: ${err instanceof Error ? err.message : '不明なエラー'}`);
      }
    } finally {
      setDownloadingModel(null);
      setDownloadProgress(null);
      setDownloadAbortController(null);
      loadModels(); // インストール済みリストを更新
    }
  }, [formatSize, loadModels]);

  // ダウンロード一時停止（useCallbackでメモ化）
  const handlePauseDownload = useCallback(() => {
    setIsDownloadPaused(true);
  }, []);

  // ダウンロード再開（useCallbackでメモ化）
  const handleResumeDownload = useCallback(() => {
    setIsDownloadPaused(false);
  }, []);

  // ダウンロードキャンセル（useCallbackでメモ化）
  const handleCancelDownload = useCallback(() => {
    if (downloadAbortController) {
      downloadAbortController.abort();
    }
    setDownloadingModel(null);
    setDownloadProgress(null);
    setIsDownloadPaused(false);
    setDownloadAbortController(null);
  }, []);


  if (loading) {
    return (
      <div className="model-search-loading">
        <div className="loading-spinner"></div>
        <p>モデル一覧を読み込んでいます...</p>
      </div>
    );
  }

  return (
    <div className="model-search">
      {/* 検索・フィルタセクション */}
      <div className="search-filters">
        <div className="search-bar">
          <input
            type="text"
            placeholder="モデル名または説明で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button onClick={loadModels} className="refresh-button">
            🔄 更新
          </button>
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <label>カテゴリ</label>
             <select
               value={selectedCategory}
               onChange={(e) => setSelectedCategory(e.target.value)}
               aria-label="カテゴリフィルタ"
             >
              <option value="all">全て</option>
              <option value="chat">チャット</option>
              <option value="code">コード生成</option>
              <option value="translation">翻訳</option>
              <option value="summarization">要約</option>
              <option value="qa">質問応答</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div className="filter-group">
            <label>サイズ</label>
             <select
               value={selectedSize}
               onChange={(e) => setSelectedSize(e.target.value)}
               aria-label="サイズフィルタ"
             >
              <option value="all">全て</option>
              <option value="small">小（4GB未満）</option>
              <option value="medium">中（4GB-10GB）</option>
              <option value="large">大（10GB以上）</option>
            </select>
          </div>

          <div className="filter-group">
            <label>用途</label>
             <select
               value={selectedUse}
               onChange={(e) => setSelectedUse(e.target.value)}
               aria-label="用途フィルタ"
             >
              <option value="all">全て</option>
              <option value="general">汎用</option>
              <option value="specialized">専門用途</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sort-filter">ソート</label>
            <select
              id="sort-filter"
              title="並び順を選択"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="popular">人気順</option>
              <option value="size">サイズ順</option>
              <option value="name">名前順</option>
              <option value="newest">新着順</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ガイダンスセクション */}
      {filteredModels.length === 0 && !loading && (
        <div className="guidance-section">
          <h3>初めての方へ</h3>
          <p>
            FLMでは、Ollamaモデルを使用してローカルLLMのAPIを作成できます。
            推奨モデルから始めることをおすすめします。
          </p>
          <details>
            <summary>どのモデルを選べばいい？</summary>
            <ul>
              <li><strong>チャット</strong>: 一般的な会話や質問応答に適しています（llama3, mistralなど）</li>
              <li><strong>コード生成</strong>: プログラミングに特化しています（codellamaなど）</li>
              <li><strong>サイズ</strong>: パラメータ数が大きいほど高性能ですが、メモリを多く使用します</li>
            </ul>
          </details>
        </div>
      )}

      {/* モデル一覧 */}
      <div className="model-grid">
        {filteredModels.map((model) => (
          <ModelCard
            key={model.name}
            model={model}
            onViewDetails={() => setSelectedModel(model)}
            onDownload={() => handleDownload(model)}
            onUseForApi={() => onModelSelected?.(model)}
            isDownloading={downloadingModel === model.name}
          />
        ))}
      </div>

      {/* ダウンロード進捗表示 */}
      {downloadingModel && downloadProgress && (
        <ModelDownloadProgress
          modelName={downloadingModel}
          progress={downloadProgress}
          onPause={handlePauseDownload}
          onResume={handleResumeDownload}
          onCancel={handleCancelDownload}
        />
      )}

      {/* モデル詳細モーダル */}
      {selectedModel && (
        <ModelDetailModal
          model={selectedModel}
          onClose={() => setSelectedModel(null)}
          onDownload={() => {
            handleDownload(selectedModel);
            setSelectedModel(null);
          }}
        />
      )}
    </div>
  );
};
