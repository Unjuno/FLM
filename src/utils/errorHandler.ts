// errorHandler - エラーハンドリングユーティリティ

import { PORT_RANGE } from '../constants/config';
import { logger } from './logger';

/**
 * エラーの種類
 */
export enum ErrorCategory {
  OLLAMA = 'ollama',
  API = 'api',
  MODEL = 'model',
  DATABASE = 'database',
  VALIDATION = 'validation',
  NETWORK = 'network',
  PERMISSION = 'permission',
  GENERAL = 'general',
}

/**
 * エラー情報
 */
export interface ErrorInfo {
  /** 元のエラーオブジェクト */
  originalError: unknown;
  /** エラーメッセージ（ユーザーフレンドリー） */
  message: string;
  /** エラーの種類 */
  category: ErrorCategory;
  /** 技術的な詳細（開発環境のみ） */
  technicalDetails?: string;
  /** 推奨される対処法 */
  suggestion?: string;
  /** リトライ可能か */
  retryable: boolean;
  /** エラーのタイムスタンプ */
  timestamp: string;
}

/**
 * エラーを解析してErrorInfoに変換
 */
export function parseError(error: unknown, category?: ErrorCategory): ErrorInfo {
  const timestamp = new Date().toISOString();
  let message = '予期しないエラーが発生しました';
  let technicalDetails: string | undefined;
  let retryable = false;
  let finalCategory = category || ErrorCategory.GENERAL;

  // Errorオブジェクトの場合
  if (error instanceof Error) {
    technicalDetails = error.stack;
    const errorMessage = error.message.toLowerCase();

    // カテゴリの自動判定
    if (!category) {
      if (errorMessage.includes('ollama')) {
        finalCategory = ErrorCategory.OLLAMA;
      } else if (errorMessage.includes('port') || errorMessage.includes('api')) {
        finalCategory = ErrorCategory.API;
      } else if (errorMessage.includes('model') || errorMessage.includes('ダウンロード')) {
        finalCategory = ErrorCategory.MODEL;
      } else if (errorMessage.includes('database') || errorMessage.includes('sql')) {
        finalCategory = ErrorCategory.DATABASE;
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        finalCategory = ErrorCategory.NETWORK;
        retryable = true;
      } else if (errorMessage.includes('permission') || errorMessage.includes('権限')) {
        finalCategory = ErrorCategory.PERMISSION;
      }
    }

    // ユーザーフレンドリーなメッセージの生成
    message = getUserFriendlyMessage(error.message, finalCategory);
    
    // リトライ可能かどうかの判定
    if (!retryable) {
      retryable = isRetryableError(error.message);
    }
  } else if (typeof error === 'string') {
    message = getUserFriendlyMessage(error, finalCategory);
    retryable = isRetryableError(error);
  } else {
    message = '予期しないエラーが発生しました';
    technicalDetails = String(error);
  }

  // 推奨される対処法の生成
  const suggestion = getSuggestion(finalCategory);

  return {
    originalError: error,
    message,
    category: finalCategory,
    technicalDetails,
    suggestion,
    retryable,
    timestamp,
  };
}

/**
 * ユーザーフレンドリーなエラーメッセージを取得
 */
function getUserFriendlyMessage(errorMessage: string, category: ErrorCategory): string {
  const lowerMessage = errorMessage.toLowerCase();

  switch (category) {
    case ErrorCategory.OLLAMA:
      if (lowerMessage.includes('not found') || lowerMessage.includes('見つかりません')) {
        return 'Ollamaが見つかりませんでした。Ollamaをインストールしてから再度お試しください。';
      }
      if (lowerMessage.includes('connection') || lowerMessage.includes('接続')) {
        return 'Ollamaに接続できませんでした。Ollamaが起動しているか確認してください。';
      }
      return 'Ollamaでエラーが発生しました。Ollamaの設定を確認してください。';

    case ErrorCategory.API:
      if (lowerMessage.includes('port') && (lowerMessage.includes('already') || lowerMessage.includes('使用中'))) {
        return 'このポート番号は既に使用されています。別のポート番号を試してください。';
      }
      if (lowerMessage.includes('port') && lowerMessage.includes('invalid')) {
        return `ポート番号は${PORT_RANGE.MIN}から${PORT_RANGE.MAX}の間の数字を入力してください。`;
      }
      return 'APIでエラーが発生しました。設定を確認してください。';

    case ErrorCategory.MODEL:
      if (lowerMessage.includes('not found') || lowerMessage.includes('見つかりません')) {
        return 'モデルが見つかりませんでした。モデルをダウンロードしてから再度お試しください。';
      }
      if (lowerMessage.includes('download') || lowerMessage.includes('ダウンロード')) {
        return 'モデルのダウンロードに失敗しました。インターネット接続を確認してください。';
      }
      return 'モデルでエラーが発生しました。モデルの設定を確認してください。';

    case ErrorCategory.DATABASE:
      if (lowerMessage.includes('locked') || lowerMessage.includes('使用中')) {
        return 'データベースが使用中です。しばらく待ってから再度お試しください。';
      }
      if (lowerMessage.includes('connection') || lowerMessage.includes('接続')) {
        return 'データベースへの接続に失敗しました。アプリケーションを再起動してください。';
      }
      return 'データベースでエラーが発生しました。アプリケーションを再起動してください。';

    case ErrorCategory.NETWORK:
      return 'ネットワーク接続に問題があります。インターネット接続を確認してください。';

    case ErrorCategory.PERMISSION:
      return '必要な権限がありません。権限設定を確認してください。';

    case ErrorCategory.VALIDATION:
      return errorMessage || '入力内容に誤りがあります。入力内容を確認してください。';

    default:
      return errorMessage || '予期しないエラーが発生しました。';
  }
}

/**
 * エラーがリトライ可能かどうかを判定
 */
function isRetryableError(errorMessage: string): boolean {
  const lowerMessage = errorMessage.toLowerCase();
  const retryablePatterns = [
    'network',
    'connection',
    'timeout',
    'temporary',
    '一時的',
    '接続',
    'タイムアウト',
  ];
  return retryablePatterns.some(pattern => lowerMessage.includes(pattern));
}

/**
 * エラーの種類に応じた推奨対処法を取得
 */
function getSuggestion(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.OLLAMA:
      return 'Ollamaが正しくインストールされ、起動しているか確認してください。';
    case ErrorCategory.API:
      return 'ポート番号が既に使用されていないか、設定を確認してください。';
    case ErrorCategory.MODEL:
      return 'モデルが正しくダウンロードされているか確認してください。';
    case ErrorCategory.DATABASE:
      return 'アプリケーションを再起動してみてください。';
    case ErrorCategory.VALIDATION:
      return '入力内容を確認してください。';
    case ErrorCategory.NETWORK:
      return 'インターネット接続を確認してください。';
    case ErrorCategory.PERMISSION:
      return '必要な権限があるか確認してください。';
    default:
      return '問題が続く場合は、アプリケーションを再起動してみてください。';
  }
}

/**
 * エラーをログに記録
 */
export function logError(error: ErrorInfo, context?: string): void {
  const errorContext = context || 'ErrorHandler';
  logger.error(
    `Error [${error.category}]: ${error.message}`,
    error.originalError instanceof Error ? error.originalError : new Error(error.message),
    errorContext
  );
  
  // 追加情報をデバッグログに記録
  // テスト環境とVite環境の両方で動作するようにprocess.envを使用
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
  if (isDev) {
    logger.debug('Error details:', {
      category: error.category,
      retryable: error.retryable,
      timestamp: error.timestamp,
      suggestion: error.suggestion,
      technicalDetails: error.technicalDetails,
    });
  }
}

/**
 * エラーを安全に表示用文字列に変換
 */
export function errorToString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '予期しないエラーが発生しました';
}

