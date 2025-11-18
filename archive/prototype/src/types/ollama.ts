// Ollama関連の型定義
// INTERFACE_SPEC.mdに基づいて定義

/**
 * Ollamaの状態情報
 */
export interface OllamaStatus {
  installed: boolean; // インストール済みか
  running: boolean; // 実行中か
  portable: boolean; // ポータブル版が存在するか
  version?: string; // バージョン情報（存在する場合）
  portable_path?: string; // ポータブル版のパス（存在する場合）
  system_path?: string; // システムパス上のOllamaのパス（存在する場合）
}

/**
 * ダウンロード進捗情報
 */
export interface DownloadProgress {
  status: string; // "downloading" | "extracting" | "completed" | "error"
  progress: number; // 0.0 - 100.0
  downloaded_bytes: number; // ダウンロード済みバイト数
  total_bytes: number; // 総バイト数
  speed_bytes_per_sec: number; // ダウンロード速度（バイト/秒）
  message?: string | null; // ステータスメッセージ
}

/**
 * Ollamaヘルスチェック結果
 */
export interface OllamaHealthStatus {
  running: boolean;
  port_available: boolean;
}

/**
 * ダウンロード完了情報
 */
export interface DownloadComplete {
  success: boolean;
  path: string;
}

/**
 * Ollamaエラー
 */
export interface OllamaError {
  message: string;
}

/**
 * ダウンロード状態
 */
export type DownloadStatus =
  | 'idle' // 待機中
  | 'detecting' // 検出中
  | 'downloading' // ダウンロード中
  | 'extracting' // 展開中
  | 'completed' // 完了
  | 'error'; // エラー
