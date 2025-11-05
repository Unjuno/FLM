// config - アプリケーション設定定数

/**
 * ロケール設定
 */
export const LOCALE = {
  DEFAULT: 'ja-JP', // デフォルトロケール（日本語）
  ENGLISH: 'en-US', // 英語ロケール
} as const;

/**
 * 日時フォーマット設定
 */
export const DATE_TIME_FORMAT = {
  DEFAULT_LOCALE: LOCALE.DEFAULT, // デフォルトロケール
  DEFAULT_INCLUDE_YEAR: true, // デフォルトで年を含める
  DEFAULT_INCLUDE_TIME: true, // デフォルトで時刻を含める
  DEFAULT_INCLUDE_SECONDS: true, // デフォルトで秒を含める
  MONTH_DAY_FORMAT: '2-digit', // 月日のフォーマット
  YEAR_FORMAT: 'numeric', // 年のフォーマット
  TIME_FORMAT: '2-digit', // 時刻のフォーマット
} as const;

/**
 * ポート番号の範囲
 */
export const PORT_RANGE = {
  MIN: 1024,
  MAX: 65535,
  DEFAULT: 8080,
} as const;

/**
 * ページネーション設定
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_ITEMS_PER_PAGE: 20,
  PAGE_RANGE_DISPLAY: 2, // Current page +/- 2
  MIN_PAGE: 1, // 最小ページ番号
} as const;

/**
 * 自動更新間隔の設定（秒単位）
 */
export const AUTO_REFRESH = {
  MIN_INTERVAL: 5, // 最小間隔（秒）
  MAX_INTERVAL: 300, // 最大間隔（秒）
  DEFAULT_INTERVAL: 30, // デフォルト間隔（秒）
} as const;

/**
 * アラート設定のデフォルト値
 */
export const ALERT_DEFAULTS = {
  RESPONSE_TIME_THRESHOLD: 5000, // 5秒（ミリ秒）
} as const;

/**
 * タイムアウト設定（ミリ秒）
 */
export const TIMEOUT = {
  API_REQUEST: 30000, // 30秒
  REFRESH_INTERVAL: 5000, // 5秒
  AUTO_REFRESH_INTERVAL: 30000, // 30秒
  UI_UPDATE_DELAY: 300, // 0.3秒
  SUCCESS_MESSAGE: 5000, // 5秒（成功メッセージの表示時間）
  ERROR_MESSAGE: 3000, // 3秒（エラーメッセージの表示時間）
  PRINT_DELAY: 250, // 0.25秒（印刷処理の待機時間）
  WINDOW_CLOSE_DELAY: 250, // 0.25秒（ウィンドウクローズの待機時間）
  PORT_CHECK_DELAY: 500, // 0.5秒（ポート確認の遅延時間）
  ANIMATION_DURATION: 300, // 0.3秒（アニメーション完了時間）
  COPY_NOTIFICATION: 2000, // 2秒（コピー通知の表示時間）
  RETRY_DELAY: 2000, // 2秒（リトライ処理の待機時間）
  VISIBILITY_DELAY: 10, // 0.01秒（表示遅延時間）
} as const;

/**
 * モデルパラメータの範囲とデフォルト値
 */
export const MODEL_PARAMETERS = {
  TEMPERATURE: { MIN: 0, MAX: 2, DEFAULT: 0.7 },
  TOP_P: { MIN: 0, MAX: 1, DEFAULT: 0.9 },
  TOP_K: { MIN: 1, MAX: 100, DEFAULT: 40 },
  REPEAT_PENALTY: { MIN: 0, MAX: 2, DEFAULT: 1.1 },
  MAX_TOKENS: { MIN: 1, DEFAULT: 1024 },
} as const;

/**
 * メモリ設定の範囲とデフォルト値
 */
export const MEMORY_SETTINGS = {
  CONTEXT_WINDOW: { MIN: 128, MAX: 131072 }, // 128から131072（128Kトークン）
  NUM_GPU_LAYERS: { MIN: 0, MAX: 999 }, // 0から999（実用的な上限）
  NUM_THREADS: { MIN: 1, MAX: 128 }, // 1から128（一般的なCPUコア数の上限）
  BATCH_SIZE: { MIN: 1, MAX: 4096, DEFAULT: 512 }, // 1から4096
} as const;

/**
 * ログ保持期間の設定（日単位）
 */
export const LOG_RETENTION = {
  MIN_DAYS: 1, // 最小保持期間（日）
  MAX_DAYS: 365, // 最大保持期間（日）
  DEFAULT_DAYS: 30, // デフォルト保持期間（日）
} as const;

/**
 * マルチモーダル設定の範囲とデフォルト値（MB単位）
 */
export const MULTIMODAL_SETTINGS = {
  MAX_IMAGE_SIZE: { MIN: 1, MAX: 100, DEFAULT: 10 }, // MB
  MAX_AUDIO_SIZE: { MIN: 1, MAX: 500, DEFAULT: 50 }, // MB
  MAX_VIDEO_SIZE: { MIN: 1, MAX: 1000, DEFAULT: 100 }, // MB
} as const;

/**
 * アラート閾値の範囲とデフォルト値
 */
export const ALERT_THRESHOLDS = {
  RESPONSE_TIME: { MIN: 100, MAX: 60000, UNIT: 'ms', LABEL: 'レスポンス時間' }, // ミリ秒
  ERROR_RATE: { MIN: 0, MAX: 100, UNIT: '%', LABEL: 'エラー率' }, // パーセンテージ
  CPU_USAGE: { MIN: 0, MAX: 100, UNIT: '%', LABEL: 'CPU使用率' }, // パーセンテージ
  MEMORY_USAGE: { MIN: 0, MAX: 100, UNIT: '%', LABEL: 'メモリ使用率' }, // パーセンテージ
} as const;

/**
 * UI表示用の警告閾値
 */
export const UI_WARNING_THRESHOLDS = {
  ERROR_RATE_HIGH: 5, // エラー率が5%を超える場合に警告表示（%）
} as const;

/**
 * メッセージ長の制限
 */
export const MESSAGE_LIMITS = {
  MAX_LENGTH: 100000, // 100,000文字
} as const;

/**
 * API名の検証設定
 */
export const API_NAME = {
  MIN_LENGTH: 1, // 最小文字数
  MAX_LENGTH: 100, // 最大文字数（データベース制限を考慮）
} as const;

/**
 * モデル名の検証設定
 */
export const MODEL_NAME = {
  MIN_LENGTH: 1, // 最小文字数
  MAX_LENGTH: 255, // 最大文字数（一般的なデータベースのVARCHAR制限）
} as const;

/**
 * APIキーの設定
 */
export const API_KEY = {
  MIN_LENGTH: 32, // 最小長（セキュリティ要件）
  DEFAULT_LENGTH: 32, // デフォルト長
} as const;

/**
 * リフレッシュ間隔（ミリ秒）
 */
export const REFRESH_INTERVALS = {
  API_LIST: 5000, // 5秒
  LOGS: 5000, // 5秒
  PERFORMANCE: 30000, // 30秒
  CHARTS: 30000, // 30秒
  METRICS_FLUSH: 60000, // 1分（メトリクスバッファのフラッシュ間隔）
} as const;

/**
 * HTTPステータスコードの定義
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  MIN_ERROR_CODE: 400, // エラーコードの最小値
  MAX_ERROR_CODE: 599, // エラーコードの最大値
  DEFAULT_ERROR_CODES: [400, 401, 403, 404, 500, 502, 503] as const, // デフォルトのエラーコード一覧
} as const;

/**
 * バックエンドサーバー設定
 */
export const SERVER_CONFIG = {
  METRICS_FLUSH_INTERVAL: 60000, // 1分（メトリクスバッファのフラッシュ間隔）
  GRACEFUL_SHUTDOWN_TIMEOUT: 10000, // 10秒（グレースフルシャットダウンのタイムアウト）
  MAX_REQUEST_BODY_SIZE: 10240, // 10KB（リクエストボディの最大保存サイズ）
  METRICS_BUFFER_MAX_SIZE: 100, // メトリクスバッファの最大値数
} as const;

/**
 * 通知設定
 */
export const NOTIFICATION = {
  DEFAULT_DURATION: 5000, // デフォルト表示時間（ミリ秒）
  ERROR_DURATION: 8000, // エラー通知の表示時間（ミリ秒）
  MAX_NOTIFICATIONS: 5, // 最大同時表示数
} as const;

/**
 * APIエンドポイント設定
 */
export const API_ENDPOINTS = {
  CHAT_COMPLETIONS: '/v1/chat/completions', // チャット補完エンドポイント
  MODELS: '/v1/models', // モデル一覧エンドポイント
  PULL: '/api/pull', // モデルプルエンドポイント
  DELETE: '/api/delete', // モデル削除エンドポイント
  TAGS: '/api/tags', // タグ一覧エンドポイント
  HEALTH: '/health', // ヘルスチェックエンドポイント
} as const;

/**
 * HTTPヘッダー設定
 */
export const HTTP_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  CONTENT_TYPE_JSON: 'application/json',
  AUTHORIZATION: 'Authorization',
  AUTHORIZATION_PREFIX: 'Bearer ',
} as const;

/**
 * サンプルデータ
 */
export const SAMPLE_DATA = {
  MESSAGE: 'こんにちは', // デフォルトサンプルメッセージ（日本語）
  MESSAGE_EN: 'Hello!', // デフォルトサンプルメッセージ（英語）
  MESSAGE_EN_FULL: 'Hello, how are you?', // 完全なサンプルメッセージ（英語）
  PLACEHOLDER_API_KEY: 'YOUR_API_KEY', // APIキーのプレースホルダー
  DEFAULT_MODEL: 'local-llm', // デフォルトモデル名
} as const;

/**
 * フォーマット関連の文字列定数
 */
export const FORMAT_STRINGS = {
  UNKNOWN: '不明', // 不明な値の表示
  CALCULATING: '計算中...', // 計算中の表示
  ZERO: '0', // ゼロの表示
  ZERO_BYTES: '0 B', // ゼロバイトの表示
} as const;

/**
 * Ollamaダウンロード関連の設定
 */
export const OLLAMA_DOWNLOAD = {
  MIN_SPEED_THRESHOLD: 0.1, // 最小速度閾値（bytes/sec、これ以下の場合は計算中と表示）
} as const;

/**
 * 数値フォーマット設定
 */
export const FORMATTING = {
  BYTES_PER_KB: 1024, // 1KBのバイト数
  BYTES_PER_MB: 1024 * 1024, // 1MBのバイト数
  BYTES_PER_GB: 1024 * 1024 * 1024, // 1GBのバイト数
  DECIMAL_PLACES: 2, // デフォルトの小数点以下の桁数
  DECIMAL_PLACES_SHORT: 1, // 短い形式の小数点以下の桁数
  PERCENTAGE_MULTIPLIER: 100, // パーセンテージ変換用の乗数
  PARAMETERS_PER_BILLION: 1000000000, // 10億（パラメータ数表示用）
  MS_PER_SECOND: 1000, // 1秒あたりのミリ秒数
  MICROSECONDS_PER_MS: 1000, // 1ミリ秒あたりのマイクロ秒数
  SECONDS_PER_MINUTE: 60, // 1分あたりの秒数
} as const;

/**
 * 入力ステップ設定
 */
export const INPUT_STEPS = {
  ERROR_RATE: 0.1, // エラー率の入力ステップ
  RESPONSE_TIME: 100, // レスポンス時間の入力ステップ（ミリ秒）
  DEFAULT: 1, // デフォルトの入力ステップ
} as const;

/**
 * 表示用の文字列切り詰め設定
 */
export const DISPLAY_LIMITS = {
  LOG_ID_LENGTH: 8, // ログIDの表示文字数
  ERROR_MESSAGE_LENGTH: 20, // エラーメッセージの表示文字数
  API_KEY_VISIBLE_START: 4, // APIキーの先頭表示文字数
  API_KEY_VISIBLE_END: 4, // APIキーの末尾表示文字数
  API_KEY_SHORT_LENGTH: 8, // APIキーの短い形式の長さ（この長さ以下の場合は完全にマスク）
} as const;

/**
 * チャート・グラフの設定
 */
export const CHART_CONFIG = {
  HEIGHT: 300, // チャートの標準高さ
  X_AXIS_HEIGHT: 80, // X軸の高さ
  PIE_OUTER_RADIUS: 80, // パイチャートの外側半径
  MARGIN: {
    TOP: 5,
    RIGHT: 30,
    LEFT: 20,
    BOTTOM: 5,
  },
  STROKE_WIDTH: 2, // 線の太さ
  DOT_RADIUS: 3, // ドットの半径
  PERCENTAGE_DOMAIN_MAX: 100, // パーセンテージチャートの最大値（%）
  STROKE_DASHARRAY: '5 5', // 破線のパターン
  THRESHOLD_STROKE_WIDTH: 1, // 閾値ラインの太さ
} as const;

/**
 * チャート・グラフで使用する色の設定
 */
export const CHART_COLORS = {
  SUCCESS: '#4caf50', // 成功（緑）
  WARNING: '#ff9800', // 警告（オレンジ）
  ERROR: '#f44336', // エラー（赤）
  ERROR_DARK: '#d32f2f', // エラー（ダーク赤）
  GRAY: '#757575', // グレー
  PRIMARY: '#667eea', // プライマリ（紫）
  SECONDARY: '#8884d8', // セカンダリ（薄紫）
  ORANGE: '#ff9800', // オレンジ
  BLUE: '#2196f3', // 青
} as const;

