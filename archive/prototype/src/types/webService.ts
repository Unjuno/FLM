// webService - Webサイトサービス要件の型定義

/**
 * Webサイトサービスの要件
 */
export interface WebServiceRequirements {
  // 基本要件
  category?: 'chat' | 'code' | 'translation' | 'summarization' | 'qa' | 'vision' | 'audio' | 'multimodal' | 'image-generation' | 'audio-generation' | 'embedding' | 'video-generation' | 'other';
  useCase?: string; // 具体的な用途（例: "チャットボット", "FAQ自動応答", "画像説明生成"）

  // パフォーマンス要件
  responseTime?: 'fast' | 'medium' | 'slow'; // レスポンス時間要件
  quality?: 'high' | 'medium' | 'low'; // 品質要件

  // リソース要件
  availableMemory?: number; // 利用可能メモリ（GB）
  hasGpu?: boolean; // GPU利用可否
  maxModelSize?: number; // 最大モデルサイズ（GB）

  // 機能要件
  needsVision?: boolean; // 画像処理が必要か
  needsAudio?: boolean; // 音声処理が必要か
  needsVideo?: boolean; // 動画処理が必要か

  // その他
  preferredPort?: number; // 希望するポート番号
  enableAuth?: boolean; // 認証が必要か
}

/**
 * モデル選定結果
 */
export interface ModelSelectionResult {
  model: {
    id: string;
    name: string;
    modelName: string;
    engine: string;
    description: string;
  };
  score: number; // 適合スコア（0-100）
  reason: string; // 選定理由
  config: {
    port: number;
    enableAuth: boolean;
    modelParameters: Record<string, any>;
    memory?: Record<string, any>;
    multimodal?: Record<string, any>;
  };
}

/**
 * API自動作成結果
 */
export interface AutoApiCreationResult {
  apiId: string;
  apiName: string;
  endpoint: string;
  apiKey?: string;
  status: 'created' | 'running' | 'error';
  message?: string;
}
