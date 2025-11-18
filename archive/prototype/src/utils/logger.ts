// logger - 統一ロガーユーティリティ

import { isDev } from './env';

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
 * デバッグモードが有効かどうかを判定するヘルパー関数
 */
function isDebugMode(): boolean {
  return (
    isDev() ||
    (typeof process !== 'undefined' &&
      (process.env.FLM_DEBUG === '1' || process.env.FLM_DEBUG === 'true')) ||
    (typeof window !== 'undefined' &&
      (window as unknown as { FLM_DEBUG?: string }).FLM_DEBUG === '1')
  );
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: isDebugMode() ? LogLevel.DEBUG : LogLevel.ERROR,
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
    // 開発環境のみの設定で、本番環境の場合は出力しない（デバッグモードが有効な場合は除く）
    if (this.config.devOnly && !isDev() && !isDebugMode()) {
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
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: string
  ): string {
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

    const formattedMessage = this.formatMessage(
      LogLevel.ERROR,
      message,
      context
    );

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

    // エラーログをデータベースに保存（非同期、エラーは無視）
    this.logErrorToDatabase(message, error, context).catch(() => {
      // エラーログの保存に失敗しても、アプリケーションの動作には影響しない
    });
  }

  /**
   * エラーログをデータベースに保存
   */
  private async logErrorToDatabase(
    message: string,
    error?: unknown,
    context?: string
  ): Promise<void> {
    try {
      // Tauri環境が利用可能な場合のみ保存
      if (typeof window === 'undefined' || !window.__TAURI__) {
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      
      let errorMessage = message;
      let errorStack: string | undefined;
      let errorCategory = 'general';

      if (error instanceof Error) {
        errorMessage = error.message || message;
        errorStack = error.stack;
        // エラーの種類に応じてカテゴリを判定
        if (error.message.toLowerCase().includes('network') || 
            error.message.toLowerCase().includes('connection') ||
            error.message.toLowerCase().includes('timeout')) {
          errorCategory = 'network';
        } else if (error.message.toLowerCase().includes('database') ||
                   error.message.toLowerCase().includes('sql')) {
          errorCategory = 'database';
        } else if (error.message.toLowerCase().includes('api')) {
          errorCategory = 'api';
        } else if (error.message.toLowerCase().includes('ollama')) {
          errorCategory = 'ollama';
        } else if (error.message.toLowerCase().includes('model')) {
          errorCategory = 'model';
        }
      }

      // コンテキスト情報をJSON形式で保存
      const contextJson = context ? JSON.stringify({ context }) : null;

      await invoke('save_error_log', {
        request: {
          error_category: errorCategory,
          error_message: errorMessage,
          error_stack: errorStack,
          context: contextJson,
          source: 'frontend',
          api_id: null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
      });
    } catch (e) {
      // エラーログの保存に失敗しても、アプリケーションの動作には影響しない
      // デバッグモードの場合のみコンソールに出力
      if (isDev() || isDebugMode()) {
        console.debug('[Logger] エラーログのデータベース保存に失敗しました:', e);
      }
    }
  }

  /**
   * グループログ（開発環境のみ）
   */
  group(label: string): void {
    if (isDev()) {
      console.group(label);
    }
  }

  /**
   * グループ終了
   */
  groupEnd(): void {
    if (isDev()) {
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
