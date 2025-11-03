// FLM - Webサイト用モデル設定の読み込み・バリデーション

import type { WebModelConfig, WebModelDefinition } from '../types/webModel';

/**
 * デフォルト設定ファイルのパス
 */
const DEFAULT_CONFIG_PATH = '/assets/web-models-config.json';

/**
 * 設定ファイルを読み込む
 */
export async function loadWebModelConfig(
  customPath?: string
): Promise<WebModelConfig> {
  const configPath = customPath || DEFAULT_CONFIG_PATH;

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
    console.error('Webサイト用モデル設定の読み込みエラー:', error);
    throw new Error(
      `設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
    );
  }
}

/**
 * 設定ファイルのバリデーション
 */
export function validateConfig(config: any): asserts config is WebModelConfig {
  // 必須フィールドのチェック
  if (!config.version || typeof config.version !== 'string') {
    throw new Error('設定ファイルにversionフィールドが必要です');
  }

  if (!config.lastUpdated || typeof config.lastUpdated !== 'string') {
    throw new Error('設定ファイルにlastUpdatedフィールドが必要です');
  }

  if (!Array.isArray(config.models)) {
    throw new Error('設定ファイルにmodels配列が必要です');
  }

  if (config.models.length === 0) {
    throw new Error('設定ファイルにモデル定義が1つ以上必要です');
  }

  // 各モデル定義のバリデーション
  const modelIds = new Set<string>();
  const modelNameEnginePairs = new Set<string>();

  config.models.forEach((model: any, index: number) => {
    // 必須フィールドのチェック
    if (!model.id || typeof model.id !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: idフィールドが必要です`);
    }

    if (!model.name || typeof model.name !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: nameフィールドが必要です`);
    }

    if (!model.modelName || typeof model.modelName !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: modelNameフィールドが必要です`);
    }

    if (!model.engine || typeof model.engine !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: engineフィールドが必要です`);
    }

    if (!model.description || typeof model.description !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: descriptionフィールドが必要です`);
    }

    if (!model.category || typeof model.category !== 'string') {
      throw new Error(`モデル定義 ${index + 1}: categoryフィールドが必要です`);
    }

    if (!model.defaultSettings || typeof model.defaultSettings !== 'object') {
      throw new Error(`モデル定義 ${index + 1}: defaultSettingsオブジェクトが必要です`);
    }

    // IDの一意性チェック
    if (modelIds.has(model.id)) {
      throw new Error(`モデル定義 ${index + 1}: id "${model.id}" が重複しています`);
    }
    modelIds.add(model.id);

    // モデル名+エンジンの一意性チェック
    const pairKey = `${model.modelName}:${model.engine}`;
    if (modelNameEnginePairs.has(pairKey)) {
      throw new Error(
        `モデル定義 ${index + 1}: モデル名 "${model.modelName}" とエンジン "${model.engine}" の組み合わせが重複しています`
      );
    }
    modelNameEnginePairs.add(pairKey);

    // ポート番号の範囲チェック
    if (model.defaultSettings.port !== undefined) {
      const port = model.defaultSettings.port;
      if (typeof port !== 'number' || port < 1024 || port > 65535) {
        throw new Error(
          `モデル定義 ${index + 1}: portは1024-65535の範囲である必要があります`
        );
      }
    }

    // カテゴリの妥当性チェック
    const validCategories = ['chat', 'code', 'vision', 'audio', 'multimodal'];
    if (!validCategories.includes(model.category)) {
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
  return config.models.filter((model) => model.category === category);
}

/**
 * 推奨モデルのみを取得
 */
export function getRecommendedModels(
  config: WebModelConfig
): WebModelDefinition[] {
  return config.models.filter((model) => model.recommended === true);
}

/**
 * IDでモデルを検索
 */
export function findModelById(
  config: WebModelConfig,
  id: string
): WebModelDefinition | undefined {
  return config.models.find((model) => model.id === id);
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
    (model) => model.modelName === modelName && model.engine === engine
  );
}

