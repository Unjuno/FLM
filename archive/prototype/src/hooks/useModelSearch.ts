// useModelSearch - モデル検索・フィルター・ソートロジックを管理するカスタムフック

import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';

/**
 * モデル情報
 */
export interface ModelInfo {
  name: string;
  description?: string;
  size?: number;
  parameters?: number;
  category?: 'chat' | 'code' | 'translation' | 'summarization' | 'qa' | 'vision' | 'audio' | 'multimodal' | 'image-generation' | 'audio-generation' | 'embedding' | 'video-generation' | 'other';
  recommended?: boolean;
  author?: string;
  license?: string;
  modified_at?: string;
}

/**
 * モデル検索・フィルター・ソートの状態
 */
export interface ModelSearchState {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string;
  selectedSizeFilter: string;
  selectedUseCase: string;
  sortBy: 'popular' | 'size' | 'name' | 'newest';
  filteredModels: ModelInfo[];
  popularModels: ModelInfo[];
  beginnerModels: ModelInfo[];
}

/**
 * モデル検索・フィルター・ソートロジックを管理するカスタムフック
 */
export const useModelSearch = (fallbackModels: ModelInfo[] = []) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('all');
  const [selectedUseCase, setSelectedUseCase] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'size' | 'name' | 'newest'>('popular');

  // モデル一覧を取得（useCallbackでメモ化）
  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // データベースからモデルカタログを取得（フォールバック: オフライン時もキャッシュから取得可能）
      try {
        const catalogModels = await safeInvoke<
          Array<{
            name: string;
            description?: string | null;
            size?: number | null;
            parameters?: number | null;
            category?: string | null;
            recommended: boolean;
            author?: string | null;
            license?: string | null;
            modified_at?: string | null;
          }>
        >('get_model_catalog');

        if (catalogModels && catalogModels.length > 0) {
          // データベースから取得したモデルを変換（キャッシュされた情報を使用）
          const convertedModels: ModelInfo[] = catalogModels.map(model => ({
            name: model.name,
            description: model.description || undefined,
            size: model.size ? Number(model.size) : undefined,
            parameters: model.parameters ? Number(model.parameters) : undefined,
            category: (model.category as ModelInfo['category']) || undefined,
            recommended: model.recommended,
            author: model.author || undefined,
            license: model.license || undefined,
            modified_at: model.modified_at || undefined,
          }));
          setModels(convertedModels);
        } else {
          // データベースが空の場合はフォールバックモデルを使用
          setModels(fallbackModels);
        }
      } catch (catalogErr) {
        const { isDev } = await import('../utils/env');
        if (isDev()) {
          logger.warn(
            'モデルカタログの取得に失敗しました。暫定リストを使用します',
            'useModelSearch'
          );
          if (catalogErr instanceof Error) {
            logger.error('モデルカタログ取得エラー', catalogErr, 'useModelSearch');
          } else {
            logger.warn(
              'モデルカタログ取得エラー（詳細）',
              'useModelSearch',
              String(catalogErr)
            );
          }
        }
        setModels(fallbackModels);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'モデル一覧の取得に失敗しました'));
    } finally {
      setLoading(false);
    }
  }, [fallbackModels]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // フィルタとソートを適用（useMemoでメモ化してパフォーマンス最適化）
  const filteredModels = useMemo(() => {
    let filtered = [...models];

    // 検索クエリでフィルタ
    if (searchQuery) {
      filtered = filtered.filter(
        model =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // カテゴリでフィルタ
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(model => model.category === selectedCategory);
    }

    // サイズでフィルタ（小: 1-3GB、中: 3-7GB、大: 7GB以上）
    if (selectedSizeFilter !== 'all') {
      filtered = filtered.filter(model => {
        if (!model.size) return false;
        const sizeGB = model.size / (1024 * 1024 * 1024);
        switch (selectedSizeFilter) {
          case 'small':
            return sizeGB >= 1 && sizeGB < 3;
          case 'medium':
            return sizeGB >= 3 && sizeGB < 7;
          case 'large':
            return sizeGB >= 7;
          default:
            return true;
        }
      });
    }

    // 用途でフィルタ（汎用/専門用途）
    // 専門用途は医療、法律、プログラミングなどの専門的なカテゴリを含むモデル
    if (selectedUseCase !== 'all') {
      filtered = filtered.filter(model => {
        const isGeneral = model.category === 'chat' || model.category === 'qa';
        const isSpecialized =
          model.category === 'code' ||
          model.category === 'translation' ||
          model.category === 'summarization' ||
          model.category === 'vision' ||
          model.category === 'audio' ||
          model.category === 'multimodal' ||
          model.category === 'image-generation' ||
          model.category === 'audio-generation' ||
          model.category === 'embedding' ||
          model.category === 'video-generation';

        if (selectedUseCase === 'general') {
          return isGeneral;
        } else if (selectedUseCase === 'specialized') {
          return isSpecialized;
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
          // modified_atフィールドがあれば日時でソート、なければ変更なし
          if (a.modified_at && b.modified_at) {
            return (
              new Date(b.modified_at).getTime() -
              new Date(a.modified_at).getTime()
            );
          }
          if (a.modified_at) return -1;
          if (b.modified_at) return 1;
          return 0;
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    models,
    searchQuery,
    selectedCategory,
    selectedSizeFilter,
    selectedUseCase,
    sortBy,
  ]);

  // 人気トップ5を取得（推奨モデルから選出）
  const popularModels = useMemo(() => {
    return models.filter(model => model.recommended).slice(0, 5);
  }, [models]);

  // 初心者向けモデルを取得（小サイズで推奨のモデル）
  const beginnerModels = useMemo(() => {
    return models
      .filter(model => {
        if (!model.recommended || !model.size) return false;
        const sizeGB = model.size / (1024 * 1024 * 1024);
        return sizeGB < 5; // 5GB未満の推奨モデルを初心者向けとする
      })
      .slice(0, 5);
  }, [models]);

  return {
    models,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedSizeFilter,
    setSelectedSizeFilter,
    selectedUseCase,
    setSelectedUseCase,
    sortBy,
    setSortBy,
    filteredModels,
    popularModels,
    beginnerModels,
    loadModels,
  };
};

