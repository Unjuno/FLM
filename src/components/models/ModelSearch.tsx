// ModelSearch - モデル検索コンポーネント

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useTransition,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { safeInvoke } from '../../utils/tauri';
import { listen } from '@tauri-apps/api/event';
import { ModelDownloadProgress } from './ModelDownloadProgress';
import { ErrorMessage } from '../common/ErrorMessage';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { logger } from '../../utils/logger';
import { FORMATTING } from '../../constants/config';
import { useI18n } from '../../contexts/I18nContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { extractErrorMessage } from '../../utils/errorHandler';
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
  modified_at?: string;
}

/**
 * モデル検索コンポーネント
 */
interface ModelSearchProps {
  onModelSelected?: (model: ModelInfo) => void;
}

export const ModelSearch: React.FC<ModelSearchProps> = ({
  onModelSelected,
}) => {
  const { t } = useI18n();
  const { showInfo } = useNotifications();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('all');
  const [selectedUseCase, setSelectedUseCase] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'size' | 'name' | 'newest'>(
    'popular'
  );
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    progress: number;
    speed: number;
    remaining: number;
    downloaded: number;
    total: number;
  } | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<
    'downloading' | 'paused' | 'verifying' | 'complete' | 'error'
  >('downloading');
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用

  // 仮想スクロール用のref
  const parentRef = useRef<HTMLDivElement>(null);

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
          // データベースが空の場合は暫定実装を使用
          setModels([
            {
              name: 'llama3:8b',
              description: '高性能な汎用チャットモデル（Meta製）',
              size: 4649132864,
              parameters: 8000000000,
              category: 'chat',
              recommended: true,
            },
            {
              name: 'llama3:70b',
              description: '超大規模汎用チャットモデル（高精度版）',
              size: 40724254720,
              parameters: 70000000000,
              category: 'chat',
              recommended: true,
            },
            {
              name: 'llama3.1:8b',
              description: 'Llama 3.1の改良版（最新モデル）',
              size: 4800000000,
              parameters: 8000000000,
              category: 'chat',
              recommended: true,
            },
            {
              name: 'llama3.1:70b',
              description: 'Llama 3.1の大規模版',
              size: 40800000000,
              parameters: 70000000000,
              category: 'chat',
              recommended: true,
            },
            {
              name: 'llama3.2:1b',
              description: '軽量で高速なLlama 3.2モデル',
              size: 1200000000,
              parameters: 1000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'llama3.2:3b',
              description: 'バランス型Llama 3.2モデル',
              size: 2400000000,
              parameters: 3000000000,
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
              name: 'codellama:13b',
              description: '大規模コード生成モデル',
              size: 7318691840,
              parameters: 13000000000,
              category: 'code',
              recommended: true,
            },
            {
              name: 'codellama:34b',
              description: '超大規模コード生成モデル',
              size: 19200000000,
              parameters: 34000000000,
              category: 'code',
              recommended: false,
            },
            {
              name: 'mistral:7b',
              description: '効率的な多目的モデル',
              size: 4117237760,
              parameters: 7000000000,
              category: 'chat',
              recommended: true,
            },
            {
              name: 'mistral:8x7b',
              description: 'Mixture of Expertsモデル（高性能）',
              size: 47000000000,
              parameters: 56000000000,
              category: 'chat',
              recommended: true,
            },
            {
              name: 'phi3:mini',
              description: 'Microsoft製の軽量高性能モデル',
              size: 2300000000,
              parameters: 3800000000,
              category: 'chat',
              recommended: true,
            },
            {
              name: 'phi3:medium',
              description: 'Microsoft製の中規模モデル',
              size: 7800000000,
              parameters: 14000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'gemma:2b',
              description: 'Google製の軽量モデル',
              size: 1600000000,
              parameters: 2000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'gemma:7b',
              description: 'Google製の中規模モデル',
              size: 5100000000,
              parameters: 7000000000,
              category: 'chat',
              recommended: true,
            },
            {
              name: 'neural-chat:7b',
              description: '会話に最適化されたモデル',
              size: 4200000000,
              parameters: 7000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'starling-lm:7b',
              description: 'OpenAIフォーマット対応モデル',
              size: 4300000000,
              parameters: 7000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'openchat:7b',
              description: 'オープンソースチャットモデル',
              size: 4100000000,
              parameters: 7000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'dolphin-mixtral:8x7b',
              description: 'ファインチューニング済みMixtral',
              size: 47000000000,
              parameters: 56000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'qwen:7b',
              description: 'Alibaba製の高性能モデル',
              size: 4600000000,
              parameters: 7000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'qwen:14b',
              description: 'Alibaba製の大規模モデル',
              size: 9000000000,
              parameters: 14000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'tinyllama:1.1b',
              description: '最小サイズの軽量モデル',
              size: 637000000,
              parameters: 1100000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'nous-hermes:13b',
              description: '推論に優れたモデル',
              size: 7400000000,
              parameters: 13000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'wizardcoder:13b',
              description: 'コード生成特化モデル',
              size: 7300000000,
              parameters: 13000000000,
              category: 'code',
              recommended: false,
            },
            {
              name: 'deepseek-coder:6.7b',
              description: 'コード生成に特化した中国製モデル',
              size: 3900000000,
              parameters: 6700000000,
              category: 'code',
              recommended: false,
            },
            {
              name: 'starcoder:15b',
              description: '大規模コード生成モデル',
              size: 31000000000,
              parameters: 15000000000,
              category: 'code',
              recommended: false,
            },
            {
              name: 'orca-mini:3b',
              description: '軽量会話モデル',
              size: 2000000000,
              parameters: 3000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'vicuna:13b',
              description: 'オープンソースチャットモデル',
              size: 7300000000,
              parameters: 13000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'falcon:7b',
              description: 'Abu Dhabi製の高性能モデル',
              size: 3900000000,
              parameters: 7000000000,
              category: 'chat',
              recommended: false,
            },
            {
              name: 'falcon:40b',
              description: 'Abu Dhabi製の超大規模モデル',
              size: 22000000000,
              parameters: 40000000000,
              category: 'chat',
              recommended: false,
            },
          ]);
        }
      } catch (catalogErr) {
        const { isDev } = await import('../../utils/env');
        if (isDev()) {
          logger.warn(
            'モデルカタログの取得に失敗しました。暫定リストを使用します',
            'ModelSearch'
          );
          if (catalogErr instanceof Error) {
            logger.error('モデルカタログ取得エラー', catalogErr, 'ModelSearch');
          } else {
            logger.warn(
              'モデルカタログ取得エラー（詳細）',
              'ModelSearch',
              String(catalogErr)
            );
          }
        }
        setModels([
          {
            name: 'llama3:8b',
            description: '高性能な汎用チャットモデル（Meta製）',
            size: 4649132864,
            parameters: 8000000000,
            category: 'chat',
            recommended: true,
          },
          {
            name: 'llama3:70b',
            description: '超大規模汎用チャットモデル（高精度版）',
            size: 40724254720,
            parameters: 70000000000,
            category: 'chat',
            recommended: true,
          },
          {
            name: 'llama3.1:8b',
            description: 'Llama 3.1の改良版（最新モデル）',
            size: 4800000000,
            parameters: 8000000000,
            category: 'chat',
            recommended: true,
          },
          {
            name: 'llama3.1:70b',
            description: 'Llama 3.1の大規模版',
            size: 40800000000,
            parameters: 70000000000,
            category: 'chat',
            recommended: true,
          },
          {
            name: 'llama3.2:1b',
            description: '軽量で高速なLlama 3.2モデル',
            size: 1200000000,
            parameters: 1000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'llama3.2:3b',
            description: 'バランス型Llama 3.2モデル',
            size: 2400000000,
            parameters: 3000000000,
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
            name: 'codellama:13b',
            description: '大規模コード生成モデル',
            size: 7318691840,
            parameters: 13000000000,
            category: 'code',
            recommended: true,
          },
          {
            name: 'codellama:34b',
            description: '超大規模コード生成モデル',
            size: 19200000000,
            parameters: 34000000000,
            category: 'code',
            recommended: false,
          },
          {
            name: 'mistral:7b',
            description: '効率的な多目的モデル',
            size: 4117237760,
            parameters: 7000000000,
            category: 'chat',
            recommended: true,
          },
          {
            name: 'mistral:8x7b',
            description: 'Mixture of Expertsモデル（高性能）',
            size: 47000000000,
            parameters: 56000000000,
            category: 'chat',
            recommended: true,
          },
          {
            name: 'phi3:mini',
            description: 'Microsoft製の軽量高性能モデル',
            size: 2300000000,
            parameters: 3800000000,
            category: 'chat',
            recommended: true,
          },
          {
            name: 'phi3:medium',
            description: 'Microsoft製の中規模モデル',
            size: 7800000000,
            parameters: 14000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'gemma:2b',
            description: 'Google製の軽量モデル',
            size: 1600000000,
            parameters: 2000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'gemma:7b',
            description: 'Google製の中規模モデル',
            size: 5100000000,
            parameters: 7000000000,
            category: 'chat',
            recommended: true,
          },
          {
            name: 'neural-chat:7b',
            description: '会話に最適化されたモデル',
            size: 4200000000,
            parameters: 7000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'starling-lm:7b',
            description: 'OpenAIフォーマット対応モデル',
            size: 4300000000,
            parameters: 7000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'openchat:7b',
            description: 'オープンソースチャットモデル',
            size: 4100000000,
            parameters: 7000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'dolphin-mixtral:8x7b',
            description: 'ファインチューニング済みMixtral',
            size: 47000000000,
            parameters: 56000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'qwen:7b',
            description: 'Alibaba製の高性能モデル',
            size: 4600000000,
            parameters: 7000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'qwen:14b',
            description: 'Alibaba製の大規模モデル',
            size: 9000000000,
            parameters: 14000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'tinyllama:1.1b',
            description: '最小サイズの軽量モデル',
            size: 637000000,
            parameters: 1100000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'nous-hermes:13b',
            description: '推論に優れたモデル',
            size: 7400000000,
            parameters: 13000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'wizardcoder:13b',
            description: 'コード生成特化モデル',
            size: 7300000000,
            parameters: 13000000000,
            category: 'code',
            recommended: false,
          },
          {
            name: 'deepseek-coder:6.7b',
            description: 'コード生成に特化した中国製モデル',
            size: 3900000000,
            parameters: 6700000000,
            category: 'code',
            recommended: false,
          },
          {
            name: 'starcoder:15b',
            description: '大規模コード生成モデル',
            size: 31000000000,
            parameters: 15000000000,
            category: 'code',
            recommended: false,
          },
          {
            name: 'orca-mini:3b',
            description: '軽量会話モデル',
            size: 2000000000,
            parameters: 3000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'vicuna:13b',
            description: 'オープンソースチャットモデル',
            size: 7300000000,
            parameters: 13000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'falcon:7b',
            description: 'Abu Dhabi製の高性能モデル',
            size: 3900000000,
            parameters: 7000000000,
            category: 'chat',
            recommended: false,
          },
          {
            name: 'falcon:40b',
            description: 'Abu Dhabi製の超大規模モデル',
            size: 22000000000,
            parameters: 40000000000,
            category: 'chat',
            recommended: false,
          },
        ]);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'モデル一覧の取得に失敗しました'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // フィルタとソートを適用（useMemoでメモ化してパフォーマンス最適化）
  // 仮想スクロールの設定で使用するため、先に定義する必要がある
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
          model.category === 'summarization';

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

  // 仮想スクロールの設定（100件以上の場合に有効化）
  const shouldUseVirtualScroll = filteredModels.length >= 100;
  const rowVirtualizer = useVirtualizer({
    count: filteredModels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // サイドバー項目の高さの推定値（px）
    overscan: 5, // 表示領域外のレンダリング数
    enabled: shouldUseVirtualScroll,
  });

  const downloadAbortControllerRef = useRef<AbortController | null>(null);
  const unsubscribeProgressRef = useRef<(() => void) | null>(null);
  const pausedModelRef = useRef<ModelInfo | null>(null);

  // カテゴリ表示名を取得
  const getCategoryLabel = useCallback((category: string): string => {
    const categoryLabels: Record<string, string> = {
      chat: 'チャット',
      code: 'コード生成',
      translation: '翻訳',
      summarization: '要約',
      qa: '質問応答',
      other: 'その他',
    };
    return categoryLabels[category] || 'その他';
  }, []);

  // モデルダウンロード開始（useCallbackでメモ化）
  const handleDownload = useCallback(
    async (model: ModelInfo) => {
      if (!model.size) {
        setError('モデルサイズ情報がありません。このモデルは取得できません。');
        return;
      }

      setDownloadingModel(model.name);
      setDownloadStatus('downloading');
      setDownloadProgress({
        progress: 0,
        speed: 0,
        remaining: 0,
        downloaded: 0,
        total: model.size,
      });

      const abortController = new AbortController();
      downloadAbortControllerRef.current = abortController;

      // 最終ステータスを追跡するローカル変数（finallyブロックで使用）
      let finalStatus:
        | 'downloading'
        | 'paused'
        | 'verifying'
        | 'complete'
        | 'error' = 'downloading';

      // ステータス文字列を内部ステータスにマッピングするヘルパー関数
      const mapStatus = (
        status: string
      ): 'downloading' | 'paused' | 'verifying' | 'complete' | 'error' => {
        if (status === 'completed' || status === 'success') return 'complete';
        if (status === 'paused') return 'paused';
        if (status === 'verifying') return 'verifying';
        if (status === 'error' || status === 'failed') return 'error';
        return 'downloading';
      };

      try {
        // 進捗イベントリスナーを設定
        const unsubscribe = await listen<{
          status: string;
          progress: number;
          downloaded_bytes: number;
          total_bytes: number;
          speed_bytes_per_sec: number;
          message?: string | null;
        }>('model_download_progress', event => {
          if (abortController.signal.aborted) {
            return;
          }

          const { status, downloaded_bytes, total_bytes, speed_bytes_per_sec } =
            event.payload;

          const downloaded = downloaded_bytes || 0;
          const total = total_bytes || model.size || 0;
          const speed = speed_bytes_per_sec || 0;
          const remaining =
            speed > 0 && total > 0 ? (total - downloaded) / speed : 0;
          const progressPercent = total > 0 ? (downloaded / total) * 100 : 0;

          // ステータスをマッピング
          const mappedStatus = mapStatus(status);
          finalStatus = mappedStatus;

          setDownloadStatus(mappedStatus);
          setDownloadProgress({
            progress: mappedStatus === 'complete' ? 100 : progressPercent,
            downloaded,
            speed,
            remaining: mappedStatus === 'complete' ? 0 : remaining,
            total: total || model.size || 0,
          });
        });

        unsubscribeProgressRef.current = unsubscribe;

        // 実際のIPCコマンドを呼び出し
        await safeInvoke('download_model', {
          modelName: model.name,
        });

        // ダウンロード完了通知
        if (!abortController.signal.aborted) {
          if (
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            new Notification('取得完了', {
              body: `${model.name} の取得が完了しました`,
              icon: '/icon.png',
            });
          }
        }
      } catch (err) {
        // Abortエラーは一時停止によるものなので、エラーとして扱わない
        if (abortController.signal.aborted) {
          finalStatus = 'paused';
          setDownloadStatus('paused');
          // 一時停止時はモデル情報を保持
          pausedModelRef.current = model;
        } else {
          const errorMessage = extractErrorMessage(err, '不明なエラー');
          finalStatus = 'error';
          setDownloadStatus('error');
          setError(`ダウンロードに失敗しました: ${errorMessage}`);
        }
      } finally {
        // 完了またはエラー、一時停止以外の場合はクリーンアップ
        // finalStatusはイベントハンドラー内で更新されるため、型アサーションを使用
        const status = finalStatus as
          | 'downloading'
          | 'paused'
          | 'verifying'
          | 'complete'
          | 'error';

        // 一時停止時はモデル情報とAbortControllerを保持（再開時に使用）
        if (status === 'paused') {
          // 一時停止時はモデル情報を保持
          pausedModelRef.current = model;
          // イベントリスナーは既にhandlePauseDownloadで解除されている
        } else {
          // イベントリスナーを解除
          if (unsubscribeProgressRef.current) {
            unsubscribeProgressRef.current();
            unsubscribeProgressRef.current = null;
          }

          if (status !== 'complete' && status !== 'error') {
            setDownloadingModel(null);
            setDownloadProgress(null);
          }

          pausedModelRef.current = null;
          downloadAbortControllerRef.current = null;
        }
        // インストール済みリストの更新は別のuseEffectで処理されるため、ここでは何もしない
      }
    },
    []
  );

  // ダウンロード完了時のモデルリスト更新をクリーンアップ
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (downloadStatus === 'complete') {
      timeoutId = setTimeout(() => {
        loadModels();
      }, FORMATTING.MS_PER_SECOND);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [downloadStatus, loadModels]);

  // ダウンロード一時停止（useCallbackでメモ化）
  const handlePauseDownload = useCallback(() => {
    if (downloadAbortControllerRef.current && downloadingModel) {
      // ダウンロードを中断
      downloadAbortControllerRef.current.abort();

      // 状態を一時停止に設定
      setDownloadStatus('paused');

      // 現在のモデル情報を保持
      const currentModel = models.find(m => m.name === downloadingModel);
      if (currentModel) {
        pausedModelRef.current = currentModel;
      }

      // イベントリスナーを解除（再開時に新しいものを設定するため）
      if (unsubscribeProgressRef.current) {
        unsubscribeProgressRef.current();
        unsubscribeProgressRef.current = null;
      }

      // AbortControllerは再開時に新しいものを作成するため、ここではnullにしない
    }
  }, [downloadingModel, models]);

  // ダウンロード再開（useCallbackでメモ化）
  const handleResumeDownload = useCallback(() => {
    if (pausedModelRef.current && downloadingModel) {
      // 一時停止されたモデルでダウンロードを再開
      // handleDownloadを呼び出すことで、既存のロジックを再利用
      handleDownload(pausedModelRef.current);
    }
  }, [downloadingModel, handleDownload]);

  // ダウンロードキャンセル（useCallbackでメモ化）
  const handleCancelDownload = useCallback(() => {
    if (downloadAbortControllerRef.current) {
      downloadAbortControllerRef.current.abort();
    }
    setDownloadingModel(null);
    setDownloadProgress(null);
    setDownloadStatus('downloading');
    downloadAbortControllerRef.current = null;
    pausedModelRef.current = null;
    // イベントリスナーを解除
    if (unsubscribeProgressRef.current) {
      unsubscribeProgressRef.current();
      unsubscribeProgressRef.current = null;
    }
  }, []);

  if (loading) {
    return (
      <div className="model-search-loading">
        <SkeletonLoader type="list" count={5} />
        <p>{t('modelSelection.loading')}</p>
      </div>
    );
  }

  return (
    <div className="model-search lmstudio-layout">
      {/* LM Studio風レイアウト: 左サイドバー + 右メインエリア */}
      <div className="lmstudio-sidebar">
        {/* サイドバーヘッダー */}
        <div className="sidebar-header">
          <input
            type="text"
            placeholder="検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="sidebar-search-input"
          />
          <button
            onClick={loadModels}
            className="sidebar-refresh-button"
            title="更新"
          ></button>
        </div>

        {/* フィルタ（コンパクト） */}
        <div className="sidebar-filters">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="sidebar-filter"
            title="カテゴリ"
          >
            <option value="all">全てのカテゴリ</option>
            <option value="chat">チャット</option>
            <option value="code">コード生成</option>
            <option value="translation">翻訳</option>
            <option value="summarization">要約</option>
            <option value="qa">質問応答</option>
            <option value="other">その他</option>
          </select>
          <select
            value={selectedSizeFilter}
            onChange={e => setSelectedSizeFilter(e.target.value)}
            className="sidebar-filter"
            title="サイズ"
          >
            <option value="all">全てのサイズ</option>
            <option value="small">小（1-3GB）</option>
            <option value="medium">中（3-7GB）</option>
            <option value="large">大（7GB以上）</option>
          </select>
          <select
            value={selectedUseCase}
            onChange={e => setSelectedUseCase(e.target.value)}
            className="sidebar-filter"
            title="用途"
          >
            <option value="all">全ての用途</option>
            <option value="general">汎用</option>
            <option value="specialized">専門用途</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="sidebar-filter"
            title="ソート"
          >
            <option value="popular">人気順</option>
            <option value="size">サイズ順</option>
            <option value="name">名前順</option>
            <option value="newest">新着順</option>
          </select>
        </div>

        {/* モデル一覧（コンパクト） */}
        <div 
          ref={parentRef}
          className={`sidebar-model-list ${shouldUseVirtualScroll ? 'virtual-scroll-container' : ''}`}
          style={shouldUseVirtualScroll ? {
            height: '600px',
            overflow: 'auto',
          } : undefined}
        >
          {filteredModels.length === 0 && !loading && (
            <div className="sidebar-empty">
              <p>モデルが見つかりませんでした</p>
            </div>
          )}
          {shouldUseVirtualScroll ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const model = filteredModels[virtualRow.index];
                return (
                  <div
                    key={model.name}
                    className={`sidebar-model-item virtual-scroll-item ${selectedModel?.name === model.name ? 'active' : ''} ${model.recommended ? 'recommended' : ''}`}
                    ref={(el) => {
                      if (el) {
                        el.style.setProperty('--virtual-top', '0');
                        el.style.setProperty('--virtual-left', '0');
                        el.style.setProperty('--virtual-width', '100%');
                        el.style.setProperty('--virtual-height', `${virtualRow.size}px`);
                        el.style.setProperty('--virtual-transform', `translateY(${virtualRow.start}px)`);
                      }
                    }}
                    onClick={() => setSelectedModel(model)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedModel(model);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`モデル ${model.name} を選択`}
                  >
                    <div className="sidebar-model-name">{model.name}</div>
                    <div className="sidebar-model-meta">
                      {model.size && (
                        <span className="sidebar-model-size">
                          {(model.size / FORMATTING.BYTES_PER_GB).toFixed(
                            FORMATTING.DECIMAL_PLACES_SHORT
                          )}
                          GB
                        </span>
                      )}
                      {model.recommended && (
                        <span className="sidebar-recommended-badge"></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            filteredModels.map(model => (
              <div
                key={model.name}
                className={`sidebar-model-item ${selectedModel?.name === model.name ? 'active' : ''} ${model.recommended ? 'recommended' : ''}`}
                onClick={() => setSelectedModel(model)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedModel(model);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`モデル ${model.name} を選択`}
              >
                <div className="sidebar-model-name">{model.name}</div>
                <div className="sidebar-model-meta">
                  {model.size && (
                    <span className="sidebar-model-size">
                      {(model.size / FORMATTING.BYTES_PER_GB).toFixed(
                        FORMATTING.DECIMAL_PLACES_SHORT
                      )}
                      GB
                    </span>
                  )}
                  {model.recommended && (
                    <span className="sidebar-recommended-badge"></span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* メインエリア */}
      <div className="lmstudio-main">
        {error && (
          <ErrorMessage
            message={error}
            type="model"
            onClose={() => setError(null)}
            onRetry={() => {
              setError(null);
              loadModels();
            }}
            suggestion="モデルダウンロードに問題がある場合は、Ollamaが正常に起動しているか確認してください。"
          />
        )}

        {/* 人気モデル・初心者向けモデルの表示（モデル未選択時） */}
        {!selectedModel && !loading && (
          <div className="popular-models-section">
            {popularModels.length > 0 && (
              <div className="popular-models-group">
                <h3 className="popular-models-title">人気モデルトップ5</h3>
                <div className="popular-models-grid">
                  {popularModels.map(model => (
                    <div
                      key={model.name}
                      className="popular-model-card"
                      onClick={() => setSelectedModel(model)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedModel(model);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`人気モデル ${model.name} を選択`}
                    >
                      <div className="popular-model-header">
                        <h4 className="popular-model-name">{model.name}</h4>
                        <span className="popular-model-badge">推奨</span>
                      </div>
                      {model.description && (
                        <p className="popular-model-description">
                          {model.description}
                        </p>
                      )}
                      {model.size && (
                        <div className="popular-model-size">
                          {(model.size / FORMATTING.BYTES_PER_GB).toFixed(
                            FORMATTING.DECIMAL_PLACES_SHORT
                          )}
                          GB
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {beginnerModels.length > 0 && (
              <div className="beginner-models-group">
                <h3 className="beginner-models-title">初心者向けモデル</h3>
                <div className="beginner-models-grid">
                  {beginnerModels.map(model => (
                    <div
                      key={model.name}
                      className="beginner-model-card"
                      onClick={() => setSelectedModel(model)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedModel(model);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`初心者向けモデル ${model.name} を選択`}
                    >
                      <div className="beginner-model-header">
                        <h4 className="beginner-model-name">{model.name}</h4>
                        <span className="beginner-model-badge">初心者向け</span>
                      </div>
                      {model.description && (
                        <p className="beginner-model-description">
                          {model.description}
                        </p>
                      )}
                      {model.size && (
                        <div className="beginner-model-size">
                          {(model.size / FORMATTING.BYTES_PER_GB).toFixed(
                            FORMATTING.DECIMAL_PLACES_SHORT
                          )}
                          GB
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* モデル詳細表示 */}
        {selectedModel ? (
          <div className="main-model-details">
            <div className="detail-header">
              <div className="detail-title-section">
                <h2 className="detail-model-name">{selectedModel.name}</h2>
                {selectedModel.recommended && (
                  <span className="detail-recommended-badge">推奨モデル</span>
                )}
              </div>
              <div className="detail-actions">
                <button
                  className="detail-action-button primary"
                  onClick={() => {
                    startTransition(() => {
                      handleDownload(selectedModel);
                    });
                  }}
                  disabled={downloadingModel === selectedModel.name || isPending}
                >
                  {downloadingModel === selectedModel.name
                    ? '取得中...'
                    : 'モデルを取得'}
                </button>
                {onModelSelected && (
                  <button
                    className="detail-action-button secondary"
                    onClick={() => onModelSelected(selectedModel)}
                  >
                    API作成に使用
                  </button>
                )}
              </div>
            </div>

            <div className="detail-content">
              {selectedModel.description && (
                <div className="detail-section">
                  <h3 className="detail-section-title">説明</h3>
                  <p className="detail-section-text">
                    {selectedModel.description}
                  </p>
                </div>
              )}

              <div className="detail-info-grid">
                {selectedModel.category && (
                  <div className="detail-info-item">
                    <span className="detail-info-label">カテゴリ</span>
                    <span className="detail-info-value">
                      {getCategoryLabel(selectedModel.category)}
                    </span>
                  </div>
                )}

                {selectedModel.parameters && (
                  <div className="detail-info-item">
                    <span className="detail-info-label">パラメータ数</span>
                    <span className="detail-info-value">
                      {(
                        selectedModel.parameters /
                        FORMATTING.PARAMETERS_PER_BILLION
                      ).toFixed(FORMATTING.DECIMAL_PLACES_SHORT)}
                      B
                    </span>
                  </div>
                )}

                {selectedModel.size && (
                  <div className="detail-info-item">
                    <span className="detail-info-label">サイズ</span>
                    <span className="detail-info-value">
                      {(selectedModel.size / FORMATTING.BYTES_PER_GB).toFixed(
                        FORMATTING.DECIMAL_PLACES
                      )}{' '}
                      GB
                    </span>
                  </div>
                )}
              </div>

              {/* 関連モデル（似たモデルの提案） */}
              {(() => {
                // 同じカテゴリまたは類似のパラメータ数のモデルを探す
                const relatedModels = models
                  .filter(
                    model =>
                      model.name !== selectedModel.name &&
                      (model.category === selectedModel.category ||
                        (selectedModel.parameters &&
                          model.parameters &&
                          Math.abs(
                            model.parameters - selectedModel.parameters
                          ) <
                            selectedModel.parameters * 0.5))
                  )
                  .slice(0, 3); // 最大3つまで表示

                if (relatedModels.length > 0) {
                  return (
                    <div className="detail-section">
                      <h3 className="detail-section-title">関連モデル</h3>
                      <div className="related-models-grid">
                        {relatedModels.map(relatedModel => (
                          <div
                            key={relatedModel.name}
                            className="related-model-card"
                            onClick={() => setSelectedModel(relatedModel)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedModel(relatedModel);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`関連モデル ${relatedModel.name} を選択`}
                          >
                            <div className="related-model-header">
                              <h4 className="related-model-name">
                                {relatedModel.name}
                              </h4>
                              {relatedModel.recommended && (
                                <span className="related-model-badge"></span>
                              )}
                            </div>
                            {relatedModel.description && (
                              <p className="related-model-description">
                                {relatedModel.description.length > 60
                                  ? relatedModel.description.substring(0, 60) +
                                    '...'
                                  : relatedModel.description}
                              </p>
                            )}
                            {relatedModel.size && (
                              <div className="related-model-size">
                                {(
                                  relatedModel.size / FORMATTING.BYTES_PER_GB
                                ).toFixed(FORMATTING.DECIMAL_PLACES_SHORT)}
                                GB
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        ) : (
          <div className="main-empty-state">
            <div className="empty-state-content">
              <h2>モデルを選択してください</h2>
              <p>
                左側のサイドバーからモデルを選択すると、詳細情報が表示されます。
              </p>

              {/* 初めての方へセクション */}
              <div className="beginner-guide-section">
                <h3 className="beginner-guide-title">初めての方へ</h3>
                <div className="beginner-guide-content">
                  <p className="beginner-guide-text">
                    初めてモデルを使う方は、まず推奨モデルから始めることをおすすめします。
                    推奨モデルは、一般的な用途で高い性能を発揮するモデルです。
                  </p>
                  <div className="beginner-recommended-models">
                    <h4>推奨モデル</h4>
                    <ul>
                      <li>
                        <strong>llama3:8b</strong> - 高性能な汎用チャットモデル
                      </li>
                      <li>
                        <strong>codellama:7b</strong> - コード生成に特化
                      </li>
                      <li>
                        <strong>mistral:7b</strong> - 効率的な多目的モデル
                      </li>
                      <li>
                        <strong>phi3:mini</strong> - 軽量高性能モデル
                      </li>
                    </ul>
                  </div>
                  <div className="beginner-help-link">
                    <button
                      type="button"
                      onClick={() => {
                        showInfo(
                          'どのモデルを選べばいい？',
                          '・チャット・会話: llama3, mistral など\n・コード生成: codellama など\n・軽量モデル（メモリが少ない場合）: phi3:mini など\n・初心者向け: 推奨マークがついているモデル',
                          10000
                        );
                      }}
                      className="help-link-button"
                    >
                      どのモデルを選べばいい？
                    </button>
                  </div>
                </div>
              </div>

              <div className="empty-state-hints">
                <h3>モデル選択のヒント</h3>
                <ul>
                  <li>モデル名の横にある推奨マークは推奨モデルを示します</li>
                  <li>
                    サイズが大きいモデルほど高性能ですが、メモリを多く使用します
                  </li>
                  <li>用途に応じてカテゴリフィルタを使用すると便利です</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ダウンロード進捗表示 */}
        {downloadingModel && downloadProgress && (
          <ModelDownloadProgress
            modelName={downloadingModel}
            progress={downloadProgress}
            status={downloadStatus}
            onPause={handlePauseDownload}
            onResume={handleResumeDownload}
            onCancel={handleCancelDownload}
          />
        )}
      </div>
    </div>
  );
};
