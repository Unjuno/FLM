// errorHandler - エラーハンドリングユーティリティ

import { PORT_RANGE } from '../constants/config';
import { logger } from './logger';

/**
 * 翻訳関数の型定義
 */
type TranslateFunction = (key: string, params?: Record<string, string | number>) => string;

/**
 * グローバルな翻訳関数（デフォルトは日本語）
 */
let globalTranslate: TranslateFunction | null = null;

/**
 * 翻訳関数を設定
 */
export function setTranslateFunction(translate: TranslateFunction): void {
  globalTranslate = translate;
}

/**
 * 翻訳関数を取得（設定されていない場合はデフォルトの日本語メッセージを返す）
 */
function t(key: string, params?: Record<string, string | number>): string {
  if (globalTranslate) {
    return globalTranslate(key, params);
  }
  // デフォルトの日本語メッセージ（フォールバック）
  return getDefaultMessage(key, params);
}

/**
 * デフォルトの日本語メッセージを取得
 */
function getDefaultMessage(key: string, params?: Record<string, string | number>): string {
  // 簡単なフォールバック実装
  const messages: Record<string, string> = {
    'errors.general.unexpected': '予期しないエラーが発生しました',
    'errors.ollama.notFound': 'Ollamaが見つかりませんでした。ホーム画面から「Ollamaセットアップ」を実行してOllamaをダウンロードしてください。',
    'errors.ollama.connectionFailed': 'Ollamaに接続できませんでした。Ollamaが起動しているか確認してください。',
    'errors.ollama.startFailed': 'Ollamaの起動に失敗しました。Ollamaが正しくインストールされているか確認してください。',
    'errors.ollama.general': 'Ollamaでエラーが発生しました。Ollamaの設定を確認してください。',
    'errors.api.portInUse': 'このポート番号は既に使用されています。自動的に代替ポートが検出されますが、別のポート番号を手動で指定することもできます。',
    'errors.api.portInvalid': `ポート番号は${params?.min || PORT_RANGE.MIN}から${params?.max || PORT_RANGE.MAX}の間の数字を入力してください。`,
    'errors.api.portNotFound': '使用可能なポート番号が見つかりませんでした。他のアプリケーションが多くのポートを使用している可能性があります。不要なアプリケーションを終了してから再度お試しください。',
    'errors.api.authProxyStartFailedPort': '認証プロキシの起動に失敗しました。ポート番号が既に使用されている可能性があります。別のポート番号を試してください。',
    'errors.api.authProxyStartFailed': '認証プロキシの起動に失敗しました。アプリケーションを再起動してから再度お試しください。',
    'errors.api.general': 'APIでエラーが発生しました。設定を確認してください。',
    'errors.model.notFound': 'モデルが見つかりませんでした。モデルをダウンロードしてから再度お試しください。',
    'errors.model.downloadFailed': 'モデルのダウンロードに失敗しました。インターネット接続を確認してください。',
    'errors.model.general': 'モデルでエラーが発生しました。モデルの設定を確認してください。',
    'errors.database.locked': 'データベースが使用中です。しばらく待ってから再度お試しください。',
    'errors.database.connectionFailed': 'データベースへの接続に失敗しました。アプリケーションを再起動してください。',
    'errors.database.general': 'データベースでエラーが発生しました。アプリケーションを再起動してください。',
    'errors.network.general': 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
    'errors.network.timeout': 'リクエストがタイムアウトしました。ネットワーク接続を確認してください。',
    'errors.network.connectionFailed': 'ネットワーク接続に失敗しました。インターネット接続を確認してください。',
    'errors.network.retryFailed': 'リトライ後も接続に失敗しました。ネットワーク接続を確認してください。',
    'errors.permission.general': '必要な権限がありません。権限設定を確認してください。',
    'errors.validation.general': '入力内容に誤りがあります。入力内容を確認してください。',
    'errors.ollama.suggestion': 'Ollamaが正しくインストールされ、起動しているか確認してください。',
    'errors.api.suggestion': 'ポート番号が既に使用されていないか、設定を確認してください。',
    'errors.model.suggestion': 'モデルが正しくダウンロードされているか確認してください。',
    'errors.database.suggestion': 'アプリケーションを再起動してみてください。',
    'errors.network.suggestion': 'インターネット接続を確認してください。',
    'errors.permission.suggestion': '必要な権限があるか確認してください。',
    'errors.validation.suggestion': '入力内容を確認してください。',
    'errors.suggestion.general': '問題が続く場合は、アプリケーションを再起動してみてください。',
  };
  
  let message = messages[key] || key;
  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      message = message.replace(`{{${paramKey}}}`, String(paramValue));
    });
  }
  return message;
}

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
 * Tauriの構造化エラーオブジェクトからメッセージを抽出
 * 例: {OllamaError: {message: "..."}} や {ApiError: {message: "...", code: "..."}}
 */
function extractTauriErrorMessage(error: unknown): string | null {
  if (error === null || error === undefined) {
    return null;
  }

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    
    const errorTypes = [
      'OllamaError',
      'ApiError',
      'ModelError',
      'DatabaseError',
      'ValidationError',
      'IoError',
      'ProcessError',
      'AuthError',
      'ConnectionError',
    ];
    
    for (const errorType of errorTypes) {
      if (errorType in errorObj && typeof errorObj[errorType] === 'object' && errorObj[errorType] !== null) {
        const typedError = errorObj[errorType] as Record<string, unknown>;
        if (typeof typedError.message === 'string') {
          return typedError.message;
        }
      }
    }
    
    if ('message' in errorObj && typeof errorObj.message === 'string') {
      return errorObj.message;
    }
  }

  return null;
}

/**
 * エラーメッセージからカテゴリを自動判定
 * @param errorMessage - エラーメッセージ（小文字化済み）
 * @returns カテゴリとリトライ可能フラグ
 */
function detectErrorCategory(errorMessage: string): {
  category: ErrorCategory;
  retryable: boolean;
} {
  // 未実装機能のエラーを優先的に検出
  if (
    errorMessage.includes('未実装') ||
    errorMessage.includes('not implemented') ||
    errorMessage.includes('feature_not_implemented') ||
    errorMessage.includes('将来実装予定')
  ) {
    return { category: ErrorCategory.GENERAL, retryable: false };
  }
  
  if (errorMessage.includes('ollama')) {
    return { category: ErrorCategory.OLLAMA, retryable: false };
  }
  
  if (
    errorMessage.includes('port') ||
    errorMessage.includes('api') ||
    errorMessage.includes('eaddrinuse') ||
    errorMessage.includes('認証プロキシ')
  ) {
    return { category: ErrorCategory.API, retryable: false };
  }
  
  if (
    errorMessage.includes('model') ||
    errorMessage.includes('ダウンロード')
  ) {
    return { category: ErrorCategory.MODEL, retryable: false };
  }
  
  if (
    errorMessage.includes('database') ||
    errorMessage.includes('sql')
  ) {
    return { category: ErrorCategory.DATABASE, retryable: false };
  }
  
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('connection')
  ) {
    return { category: ErrorCategory.NETWORK, retryable: true };
  }
  
  if (
    errorMessage.includes('permission') ||
    errorMessage.includes('権限')
  ) {
    return { category: ErrorCategory.PERMISSION, retryable: false };
  }
  
  return { category: ErrorCategory.GENERAL, retryable: false };
}

/**
 * エラーを解析してErrorInfoに変換
 */
export function parseError(
  error: unknown,
  category?: ErrorCategory
): ErrorInfo {
  const timestamp = new Date().toISOString();
  let message = t('errors.general.unexpected');
  let technicalDetails: string | undefined;
  let retryable = false;
  let finalCategory = category || ErrorCategory.GENERAL;

  const tauriMessage = extractTauriErrorMessage(error);
  if (tauriMessage) {
    const errorMessage = tauriMessage.toLowerCase();
    
    if (!category) {
      const detected = detectErrorCategory(errorMessage);
      finalCategory = detected.category;
      retryable = detected.retryable;
    }

    message = getUserFriendlyMessage(tauriMessage, finalCategory);
    technicalDetails = JSON.stringify(error, null, 2);
    retryable = retryable || isRetryableError(tauriMessage);
  } else if (error instanceof Error) {
    technicalDetails = error.stack;
    const errorMessage = error.message.toLowerCase();

    if (!category) {
      const detected = detectErrorCategory(errorMessage);
      finalCategory = detected.category;
      retryable = detected.retryable;
    }

    message = getUserFriendlyMessage(error.message, finalCategory);

    if (!retryable) {
      retryable = isRetryableError(error.message);
    }
  } else if (typeof error === 'string') {
    const errorMessage = error.toLowerCase();
    if (!category) {
      const detected = detectErrorCategory(errorMessage);
      finalCategory = detected.category;
      retryable = detected.retryable;
    }
    message = getUserFriendlyMessage(error, finalCategory);
    retryable = retryable || isRetryableError(error);
  } else {
    message = t('errors.general.unexpected');
    technicalDetails = JSON.stringify(error, null, 2);
  }

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
function getUserFriendlyMessage(
  errorMessage: string,
  category: ErrorCategory
): string {
  const lowerMessage = errorMessage.toLowerCase();

  switch (category) {
    case ErrorCategory.OLLAMA:
      if (
        lowerMessage.includes('not found') ||
        lowerMessage.includes('見つかりません') ||
        lowerMessage.includes('見つかりませんでした')
      ) {
        return t('errors.ollama.notFound');
      }
      if (
        lowerMessage.includes('connection') ||
        lowerMessage.includes('接続') ||
        lowerMessage.includes('接続できません')
      ) {
        return t('errors.ollama.connectionFailed');
      }
      if (
        lowerMessage.includes('起動') &&
        (lowerMessage.includes('失敗') || lowerMessage.includes('failed'))
      ) {
        return t('errors.ollama.startFailed');
      }
      return t('errors.ollama.general');

    case ErrorCategory.API:
      if (
        lowerMessage.includes('port') &&
        (lowerMessage.includes('already') ||
          lowerMessage.includes('使用中') ||
          lowerMessage.includes('eaddrinuse') ||
          lowerMessage.includes('既に使用されています'))
      ) {
        return t('errors.api.portInUse');
      }
      if (lowerMessage.includes('port') && lowerMessage.includes('invalid')) {
        return t('errors.api.portInvalid', { min: PORT_RANGE.MIN, max: PORT_RANGE.MAX });
      }
      if (
        lowerMessage.includes('使用可能なポート') &&
        (lowerMessage.includes('見つかりません') ||
          lowerMessage.includes('not found'))
      ) {
        return t('errors.api.portNotFound');
      }
      if (
        lowerMessage.includes('認証プロキシ') &&
        (lowerMessage.includes('起動') || lowerMessage.includes('start'))
      ) {
        if (lowerMessage.includes('ポート') || lowerMessage.includes('port')) {
          return t('errors.api.authProxyStartFailedPort');
        }
        return t('errors.api.authProxyStartFailed');
      }
      return t('errors.api.general');

    case ErrorCategory.MODEL:
      if (
        lowerMessage.includes('not found') ||
        lowerMessage.includes('見つかりません')
      ) {
        return t('errors.model.notFound');
      }
      if (
        lowerMessage.includes('download') ||
        lowerMessage.includes('ダウンロード')
      ) {
        return t('errors.model.downloadFailed');
      }
      return t('errors.model.general');

    case ErrorCategory.DATABASE:
      if (lowerMessage.includes('locked') || lowerMessage.includes('使用中')) {
        return t('errors.database.locked');
      }
      if (
        lowerMessage.includes('connection') ||
        lowerMessage.includes('接続')
      ) {
        return t('errors.database.connectionFailed');
      }
      return t('errors.database.general');

    case ErrorCategory.NETWORK:
      if (
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('タイムアウト')
      ) {
        return t('errors.network.timeout');
      }
      if (
        lowerMessage.includes('connection') ||
        lowerMessage.includes('接続')
      ) {
        return t('errors.network.connectionFailed');
      }
      if (
        lowerMessage.includes('retry') ||
        lowerMessage.includes('リトライ')
      ) {
        return t('errors.network.retryFailed');
      }
      return t('errors.network.general');

    case ErrorCategory.PERMISSION:
      return t('errors.permission.general');

    case ErrorCategory.VALIDATION:
      return (
        errorMessage || t('errors.validation.general')
      );

    case ErrorCategory.GENERAL:
      // 未実装機能のエラーを検出
      if (
        lowerMessage.includes('未実装') ||
        lowerMessage.includes('not implemented') ||
        lowerMessage.includes('feature_not_implemented') ||
        lowerMessage.includes('将来実装予定')
      ) {
        // 元のエラーメッセージをそのまま返す（既に適切な説明が含まれている）
        return errorMessage || 'この機能は現在未実装です。将来のバージョンで実装予定です。';
      }
      return errorMessage || t('errors.general.unexpected');

    default:
      return errorMessage || t('errors.general.unexpected');
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
      return t('errors.ollama.suggestion');
    case ErrorCategory.API:
      return t('errors.api.suggestion');
    case ErrorCategory.MODEL:
      return t('errors.model.suggestion');
    case ErrorCategory.DATABASE:
      return t('errors.database.suggestion');
    case ErrorCategory.VALIDATION:
      return t('errors.validation.suggestion');
    case ErrorCategory.NETWORK:
      return t('errors.network.suggestion');
    case ErrorCategory.PERMISSION:
      return t('errors.permission.suggestion');
    default:
      return t('errors.suggestion.general');
  }
}

/**
 * エラーをログに記録
 */
export function logError(error: ErrorInfo, context?: string): void {
  const errorContext = context || 'ErrorHandler';
  logger.error(
    `Error [${error.category}]: ${error.message}`,
    error.originalError instanceof Error
      ? error.originalError
      : new Error(error.message),
    errorContext
  );

  // 開発環境でのみ追加情報をデバッグログに記録
  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV !== 'production';
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
 * @param error - エラーオブジェクト
 * @param fallbackMessage - フォールバックメッセージ（デフォルト: '予期しないエラーが発生しました'）
 * @returns エラーメッセージ文字列
 */
export function errorToString(error: unknown, fallbackMessage?: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallbackMessage || t('errors.general.unexpected');
}

/**
 * エラーからメッセージを抽出（監査レポートの推奨事項に基づき、コードの重複を解消）
 * 多くのページで使用されている `err instanceof Error ? err.message : String(err)` パターンを統一
 * @param error - エラーオブジェクト
 * @param fallbackMessage - フォールバックメッセージ（オプション）
 * @returns エラーメッセージ文字列
 */
export function extractErrorMessage(error: unknown, fallbackMessage?: string): string {
  return errorToString(error, fallbackMessage);
}

/**
 * エラーをErrorオブジェクトに変換
 * `err instanceof Error ? err : new Error(...)` パターンを統一
 * @param error - エラーオブジェクト
 * @param fallbackMessage - フォールバックメッセージ（オプション）
 * @returns Errorオブジェクト
 */
export function toError(error: unknown, fallbackMessage?: string): Error {
  if (error instanceof Error) {
    return error;
  }
  const message = extractErrorMessage(error, fallbackMessage);
  return new Error(message);
}
