// FLM - API関連の型定義
// フロントエンドエージェント (FE) 実装

/**
 * 選択されたモデル情報
 */
export interface SelectedModel {
  name: string;
  size?: number;
  description?: string;
}

/**
 * API設定情報
 */
export interface ApiConfig {
  name: string;
  port: number;
  enableAuth: boolean;
}

/**
 * API作成結果
 */
export interface ApiCreationResult {
  id: string;
  name: string;
  endpoint: string;
  apiKey?: string;
  port: number;
}

/**
 * API情報
 */
export interface ApiInfo {
  id: string;
  name: string;
  endpoint: string;
  port: number;
  status: 'running' | 'stopped';
  model: string;
  created_at: string;
}

