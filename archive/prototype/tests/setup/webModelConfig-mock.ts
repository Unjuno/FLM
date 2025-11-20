// webModelConfig-mock - webModelConfig.tsのモック（Jest環境でimport.metaを回避するため）

import type {
  WebModelConfig,
  WebModelDefinition,
} from '../../src/types/webModel';
import { PORT_RANGE } from '../../src/constants/config';
import { isDev } from './env-mock';

/**
 * デフォルト設定ファイルのパス（Jest環境用）
 */
const DEFAULT_CONFIG_URL = '/assets/web-models-config.json';

/**
 * 設定ファイルを読み込む
 */
export async function loadWebModelConfig(
  customPath?: string
): Promise<WebModelConfig> {
  const configPath = customPath || DEFAULT_CONFIG_URL;

  try {
    const response = await fetch(configPath);
    if (!response.ok) {
      throw new Error(`設定ファイルの読み込みに失敗: ${response.statusText}`);
    }

    const config: WebModelConfig = await response.json();

    // バリデーション
    validateConfig(config);

    return config;
  } catch (error) {
    if (isDev()) {
      console.error('Webサイト用モデル設定の読み込みエラー:', error);
    }
    throw new Error(
      `設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
    );
  }
}

/**
 * 設定ファイルのバリデーション
 */
export function validateConfig(
  config: unknown
): asserts config is WebModelConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error('設定ファイルはオブジェクトである必要があります');
  }

  const configObj = config as Record<string, unknown>;

  // 必須フィールドのチェック
  if (!configObj.version || typeof configObj.version !== 'string') {
    throw new Error('設定ファイルにversionフィールドが必要です');
  }

  if (!configObj.lastUpdated || typeof configObj.lastUpdated !== 'string') {
    throw new Error('設定ファイルにlastUpdatedフィールドが必要です');
  }

  if (!Array.isArray(configObj.models)) {
    throw new Error('設定ファイルにmodels配列が必要です');
  }

  if (configObj.models.length === 0) {
    throw new Error('設定ファイルにモデル定義が1つ以上必要です');
  }

  // 各モデル定義のバリデーション
  const modelIds = new Set<string>();
  const modelNameEnginePairs = new Set<string>();

  configObj.models.forEach((model: unknown, index: number) => {
    if (typeof model !== 'object' || model === null) {
      throw new Error(
        `モデル定義 ${index + 1}: モデル定義はオブジェクトである必要があります`
      );
    }

    const modelObj = model as Record<string, unknown>;
    // 必須フィールドのチェック
    if (!modelObj.id || typeof modelObj.id !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: idフィールドが必要です`);
    }

    if (!modelObj.name || typeof modelObj.name !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: nameフィールドが必要です`);
    }

    if (!modelObj.modelName || typeof modelObj.modelName !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: modelNameフィールドが必要です`);
    }

    if (!modelObj.engine || typeof modelObj.engine !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: engineフィールドが必要です`);
    }

    if (!modelObj.description || typeof modelObj.description !== 'string') {
      throw new Error(
        `モデル定義 ${index + 1}: descriptionフィールドが必要です`
      );
    }

    if (!modelObj.category || typeof modelObj.category !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: categoryフィールドが必要です`);
    }

    if (
      !modelObj.defaultSettings ||
      typeof modelObj.defaultSettings !== 'object' ||
      modelObj.defaultSettings === null
    ) {
      throw new Error(
        `モデル定義 ${index + 1}: defaultSettingsオブジェクトが必要です`
      );
    }

    // IDの一意性チェック
    const modelId = modelObj.id;
    if (modelIds.has(modelId)) {
      throw new Error(
        `モデル定義 ${index + 1}: id "${modelId}" が重複しています`
      );
    }
    modelIds.add(modelId);

    // モデル名+エンジンの一意性チェック
    const modelName = modelObj.modelName;
    const engine = modelObj.engine;
    const pairKey = `${modelName}:${engine}`;
    if (modelNameEnginePairs.has(pairKey)) {
      throw new Error(
        `モデル定義 ${index + 1}: モデル名 "${modelName}" とエンジン "${engine}" の組み合わせが重複しています`
      );
    }
    modelNameEnginePairs.add(pairKey);

    // ポート番号の範囲チェック
    const defaultSettings = modelObj.defaultSettings as Record<string, unknown>;
    if (defaultSettings.port !== undefined) {
      const port = defaultSettings.port;
      if (
        typeof port !== 'number' ||
        port < PORT_RANGE.MIN ||
        port > PORT_RANGE.MAX
      ) {
        throw new Error(
          `モデル定義 ${index + 1}: portは${PORT_RANGE.MIN}-${PORT_RANGE.MAX}の範囲である必要があります`
        );
      }
    }

    // カテゴリの妥当性チェック
    const validCategories = [
      'chat',
      'code',
      'translation',
      'summarization',
      'qa',
      'vision',
      'audio',
      'multimodal',
      'image-generation',
      'audio-generation',
      'embedding',
      'video-generation',
      'other',
    ];
    const category = modelObj.category;
    if (!validCategories.includes(category)) {
      throw new Error(
        `モデル定義 ${index + 1}: categoryは ${validCategories.join(', ')} のいずれかである必要があります`
      );
    }
  });
}

/**
 * カテゴリでフィルタリング
 */
export function filterByCategory(
  config: WebModelConfig,
  category: string
): WebModelDefinition[] {
  return config.models.filter(model => model.category === category);
}

/**
 * 推奨モデルのみを取得
 */
export function getRecommendedModels(
  config: WebModelConfig
): WebModelDefinition[] {
  return config.models.filter(model => model.recommended === true);
}

/**
 * IDでモデルを検索
 */
export function findModelById(
  config: WebModelConfig,
  id: string
): WebModelDefinition | undefined {
  return config.models.find(model => model.id === id);
}

/**
 * モデル名でモデルを検索
 */
export function findModelByName(
  config: WebModelConfig,
  modelName: string,
  engine: string
): WebModelDefinition | undefined {
  return config.models.find(
    model => model.modelName === modelName && model.engine === engine
  );
}
