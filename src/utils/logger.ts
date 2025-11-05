// logger - 統一ロガーユーティリティ

/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * ロガー設定
 */
interface LoggerConfig {
  /** 最小ログレベル（このレベル以上のログのみ出力） */
  minLevel: LogLevel;
  /** 開発環境でのみログを出力するか */
  devOnly: boolean;
  /** ログにタイムスタンプを含めるか */
  includeTimestamp: boolean;
  /** ログにコンテキスト情報を含めるか */
  includeContext: boolean;
}

/**
 * 開発環境かどうかを判定するヘルパー関数
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: isDevelopment() ? LogLevel.DEBUG : LogLevel.ERROR,
  devOnly: true,
  includeTimestamp: true,
  includeContext: true,
};

/**
 * ロガークラス
 */
class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * ログレベルを数値に変換
   */
  private getLevelValue(level: LogLevel): number {
    const levels = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
    };
    return levels[level] ?? 0;
  }

  /**
   * ログを出力すべきかチェック
   */
  private shouldLog(level: LogLevel): boolean {
    // 開発環境のみの設定で、本番環境の場合は出力しない
    if (this.config.devOnly && !isDevelopment()) {
      return false;
    }

    // 最小ログレベルより低い場合は出力しない
    const minLevelValue = this.getLevelValue(this.config.minLevel);
    const currentLevelValue = this.getLevelValue(level);
    return currentLevelValue >= minLevelValue;
  }

  /**
   * ログメッセージをフォーマット
   */
  private formatMessage(level: LogLevel, message: string, context?: string): string {
    const parts: string[] = [];

    // タイムスタンプ
    if (this.config.includeTimestamp) {
      const timestamp = new Date().toISOString();
      parts.push(`[${timestamp}]`);
    }

    // ログレベル
    parts.push(`[${level.toUpperCase()}]`);

    // コンテキスト
    if (this.config.includeContext && context) {
      parts.push(`[${context}]`);
    }

    // メッセージ
    parts.push(message);

    return parts.join(' ');
  }

  /**
   * デバッグログ
   */
  debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    console.debug(this.formatMessage(LogLevel.DEBUG, message), ...args);
  }

  /**
   * 情報ログ
   */
  info(message: string, context?: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.info(this.formatMessage(LogLevel.INFO, message, context), ...args);
  }

  /**
   * 警告ログ
   */
  warn(message: string, context?: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    console.warn(this.formatMessage(LogLevel.WARN, message, context), ...args);
  }

  /**
   * エラーログ
   */
  error(message: string, error?: unknown, context?: string): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const formattedMessage = this.formatMessage(LogLevel.ERROR, message, context);
    
    if (error instanceof Error) {
      console.error(formattedMessage, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    } else if (error !== undefined) {
      console.error(formattedMessage, error);
    } else {
      console.error(formattedMessage);
    }
  }

  /**
   * グループログ（開発環境のみ）
   */
  group(label: string): void {
    if (isDevelopment()) {
      console.group(label);
    }
  }

  /**
   * グループ終了
   */
  groupEnd(): void {
    if (isDevelopment()) {
      console.groupEnd();
    }
  }

  /**
   * 設定を更新
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

/**
 * グローバルロガーインスタンス
 */
export const logger = new Logger();

/**
 * ロガーをエクスポート（名前付きエクスポートでも使用可能）
 */
export default logger;

