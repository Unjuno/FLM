// webModel - Webサイト用モデル設定の型定義

/**
 * モデルの機能（キャパビリティ）
 */
export interface WebModelCapabilities {
  vision?: boolean;
  audio?: boolean;
  video?: boolean;
}

/**
 * モデルパラメータ設定
 */
export interface WebModelParameters {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  repeat_penalty?: number;
}

/**
 * メモリ設定
 */
export interface WebMemorySettings {
  context_window?: number;
  num_gpu_layers?: number;
  batch_size?: number;
}

/**
 * マルチモーダル設定
 */
export interface WebMultimodalSettings {
  enableVision?: boolean;
  enableAudio?: boolean;
  enableVideo?: boolean;
  maxImageSize?: number;
  maxAudioSize?: number;
  maxVideoSize?: number;
}

/**
 * デフォルト設定
 */
export interface WebModelDefaultSettings {
  port?: number;
  enableAuth?: boolean;
  modelParameters?: WebModelParameters;
  memory?: WebMemorySettings;
  multimodal?: WebMultimodalSettings;
}

/**
 * システム要件
 */
export interface WebModelRequirements {
  minMemory?: number; // GB
  recommendedMemory?: number; // GB
  gpuRecommended?: boolean;
}

/**
 * Webサイト用モデル定義
 */
export interface WebModelDefinition {
  id: string;
  name: string;
  modelName: string;
  engine: string;
  description: string;
  category: 'chat' | 'code' | 'vision' | 'audio' | 'multimodal';
  capabilities?: WebModelCapabilities;
  size?: number;
  recommended?: boolean;
  icon?: string;
  tags?: string[];
  defaultSettings: WebModelDefaultSettings;
  useCases?: string[];
  requirements?: WebModelRequirements;
}

/**
 * Webサイト用モデル設定ファイル
 */
export interface WebModelConfig {
  version: string;
  lastUpdated: string;
  description?: string;
  models: WebModelDefinition[];
}
