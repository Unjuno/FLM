// api - API関連の型定義

/**
 * モデルの機能（キャパビリティ）
 */
export interface ModelCapabilities {
  vision?: boolean; // 画像処理（画像認識・画像生成・画像説明など）
  audio?: boolean; // 音声処理（音声認識・音声合成・音声変換など）
  video?: boolean; // 動画処理（動画認識・動画生成など）
}

/**
 * 選択されたモデル情報
 */
export interface SelectedModel {
  name: string;
  size?: number;
  description?: string;
  capabilities?: ModelCapabilities; // モデルの機能
  webModelId?: string; // Webサイト用モデルのID（該当する場合）
}

/**
 * メモリ・リソース設定
 */
export interface MemorySettings {
  context_window?: number; // コンテキストウィンドウサイズ（トークン数、デフォルト: モデル依存）
  num_gpu_layers?: number; // GPUレイヤー数（0=CPUのみ、デフォルト: モデル依存）
  num_threads?: number; // CPUスレッド数（デフォルト: システム依存）
  batch_size?: number; // バッチサイズ（デフォルト: 512）
  use_mmap?: boolean; // メモリマップドファイルを使用（デフォルト: true）
  use_mlock?: boolean; // メモリをロック（デフォルト: false）
  low_mem?: boolean; // 低メモリモード（デフォルト: false）
}

/**
 * モデル生成パラメータ
 */
export interface ModelParameters {
  temperature?: number; // 温度（0.0-2.0、デフォルト: 0.7）
  top_p?: number; // Top-p（0.0-1.0、デフォルト: 0.9）
  top_k?: number; // Top-k（1-100、デフォルト: 40）
  max_tokens?: number; // 最大トークン数（デフォルト: 1024）
  repeat_penalty?: number; // 繰り返しペナルティ（0.0-2.0、デフォルト: 1.1）
  seed?: number; // シード値（オプション）
  memory?: MemorySettings; // メモリ・リソース設定
}

/**
 * マルチモーダル機能設定
 */
export interface MultimodalSettings {
  enableVision?: boolean; // 画像処理機能を有効化
  enableAudio?: boolean; // 音声処理機能を有効化
  enableVideo?: boolean; // 動画処理機能を有効化
  maxImageSize?: number; // 最大画像サイズ（MB、デフォルト: 10）
  maxAudioSize?: number; // 最大音声サイズ（MB、デフォルト: 50）
  maxVideoSize?: number; // 最大動画サイズ（MB、デフォルト: 100）
  supportedImageFormats?: string[]; // サポートする画像形式（デフォルト: ['jpg', 'jpeg', 'png', 'gif', 'webp']）
  supportedAudioFormats?: string[]; // サポートする音声形式（デフォルト: ['mp3', 'wav', 'ogg', 'm4a']）
  supportedVideoFormats?: string[]; // サポートする動画形式（デフォルト: ['mp4', 'webm', 'mov']）
}

/**
 * API設定情報
 */
export interface ApiConfig {
  name: string;
  port: number;
  enableAuth: boolean;
  engineType?: string; // エンジンタイプ（'ollama', 'lm_studio', 'vllm', 'llama_cpp'）
  engineConfig?: string; // エンジン固有設定（JSON形式）
  modelParameters?: ModelParameters; // モデル生成パラメータ
  multimodal?: MultimodalSettings; // マルチモーダル機能設定
  timeout_secs?: number | null; // タイムアウト（秒、nullの場合はグローバル設定を使用）
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
  external_endpoint?: string | null; // 外部アクセス用エンドポイント（ローカルIPアドレス）
  port: number;
  status: 'running' | 'stopped';
  model_name: string; // モデル名（統一されたプロパティ名）
  created_at: string;
  updated_at?: string; // 更新日時（オプション）
}

/**
 * API作成リクエスト
 */
export interface ApiCreateRequest {
  name: string;
  model_name: string;
  port: number;
  enable_auth: boolean;
  engine_type: string;
  engine_config?: string | null;
  timeout_secs?: number | null; // タイムアウト（秒、Noneの場合はグローバル設定を使用）
}

/**
 * API作成レスポンス
 */
export interface ApiCreateResponse {
  id: string;
  name: string;
  endpoint: string;
  api_key: string | null;
  model_name: string;
  port: number;
  status: string;
}

/**
 * API詳細レスポンス（APIキーを含む）
 */
export interface ApiDetailsResponse {
  id: string;
  name: string;
  endpoint: string;
  model_name: string;
  port: number;
  enable_auth: boolean;
  status: string;
  api_key: string | null;
  timeout_secs?: number | null; // タイムアウト（秒、Noneの場合はグローバル設定を使用）
  created_at: string;
  updated_at: string;
}

/**
 * API設定情報（編集用）
 */
export interface ApiSettingsForm {
  name: string;
  port: number;
  enableAuth: boolean;
  timeout_secs?: number | null;
}

/**
 * API更新リクエスト
 */
export interface ApiUpdateRequest {
  api_id: string;
  config: {
    name?: string;
    port?: number;
    enable_auth?: boolean;
    engine_config?: string | null; // エンジン固有設定（JSON形式）
    timeout_secs?: number | null; // タイムアウト（秒、Noneの場合はグローバル設定を使用）
  };
}
