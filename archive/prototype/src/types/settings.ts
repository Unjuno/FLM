/**
 * アプリケーション設定の型定義
 */

/**
 * アプリケーション設定
 */
export interface AppSettings {
  theme: string | null;
  language: string | null;
  auto_refresh_interval: number | null;
  log_retention_days: number | null;
  audit_log_retention_days: number | null;
  notifications_enabled: boolean | null;
  stop_apis_on_exit: boolean | null;
  diagnostics_enabled: boolean | null;
  performance_metrics_enabled: boolean | null;
  include_ip_address_in_audit_log: boolean | null;
  device_id_enabled: boolean | null;
  show_incomplete_features: boolean | null;
  default_api_timeout_secs: number | null;
}

/**
 * Ollamaアップデートチェック結果
 */
export interface OllamaUpdateCheck {
  update_available: boolean;
  current_version: string | null;
  latest_version: string;
}

/**
 * ダウンロード進捗情報（エンジン用）
 */
export interface EngineDownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
  message?: string;
}

/**
 * エンジンアップデートチェック結果
 */
export interface EngineUpdateCheck {
  update_available: boolean;
  current_version: string | null;
  latest_version: string;
}

/**
 * エンジン検出結果
 */
export interface EngineDetectionResult {
  engine_type: string;
  installed: boolean;
  running: boolean;
  version?: string;
  path?: string;
  message?: string;
}

