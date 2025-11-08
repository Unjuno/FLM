// autoFix - エラー自動修正ユーティリティ

import { parseError, ErrorCategory, ErrorInfo } from './errorHandler';
import { safeInvoke } from './tauri';
import { logger } from './logger';

/**
 * 自動修正の結果
 */
export interface AutoFixResult {
  /** 修正が成功したか */
  success: boolean;
  /** 修正されたエラー */
  fixedError: ErrorInfo;
  /** 修正内容の説明 */
  fixDescription: string;
  /** 修正後の結果（修正が成功した場合） */
  result?: unknown;
  /** 修正後のエラー（修正が失敗した場合） */
  remainingError?: ErrorInfo;
}

/**
 * 自動修正の設定
 */
export interface AutoFixConfig {
  /** 自動修正を試みるか（デフォルト: true） */
  enabled?: boolean;
  /** 修正試行のコールバック */
  onFixAttempt?: (error: ErrorInfo, fixDescription: string) => void;
  /** 修正成功のコールバック */
  onFixSuccess?: (result: AutoFixResult) => void;
  /** 修正失敗のコールバック */
  onFixFailure?: (result: AutoFixResult) => void;
}

/**
 * エラーを自動修正する
 *
 * @param error 修正対象のエラー
 * @param config 自動修正の設定
 * @returns 修正結果
 */
export async function autoFixError(
  error: unknown,
  config: AutoFixConfig = {}
): Promise<AutoFixResult> {
  const { enabled = true, onFixAttempt, onFixSuccess, onFixFailure } = config;

  if (!enabled) {
    const errorInfo = parseError(error);
    return {
      success: false,
      fixedError: errorInfo,
      fixDescription: '自動修正が無効になっています',
      remainingError: errorInfo,
    };
  }

  const errorInfo = parseError(error);

  // エラーの種類に応じて自動修正を試みる
  let fixResult: AutoFixResult | null = null;

  switch (errorInfo.category) {
    case ErrorCategory.OLLAMA:
      fixResult = await fixOllamaError(errorInfo);
      break;
    case ErrorCategory.API:
      fixResult = await fixApiError(errorInfo);
      break;
    case ErrorCategory.MODEL:
      fixResult = await fixModelError(errorInfo);
      break;
    case ErrorCategory.NETWORK:
      fixResult = await fixNetworkError(errorInfo);
      break;
    default:
      // その他のエラーは自動修正不可
      fixResult = {
        success: false,
        fixedError: errorInfo,
        fixDescription: 'このエラーは自動修正できません',
        remainingError: errorInfo,
      };
  }

  // 修正試行のコールバック
  if (onFixAttempt && fixResult) {
    onFixAttempt(errorInfo, fixResult.fixDescription);
  }

  // 修正結果のコールバック
  if (fixResult.success && onFixSuccess) {
    onFixSuccess(fixResult);
  } else if (!fixResult.success && onFixFailure) {
    onFixFailure(fixResult);
  }

  return fixResult;
}

/**
 * OLLAMAエラーを自動修正
 */
async function fixOllamaError(error: ErrorInfo): Promise<AutoFixResult> {
  const errorMessage = error.message.toLowerCase();

  // OLLAMAが見つからない場合
  if (
    errorMessage.includes('見つかりません') ||
    errorMessage.includes('not found')
  ) {
    try {
      logger.info(
        'OLLAMAが見つかりません。自動ダウンロードを試みます...',
        'autoFix'
      );

      // OLLAMAの検出を試みる
      const detectionResult = await safeInvoke<{
        installed: boolean;
        running: boolean;
        portable: boolean;
      }>('detect_ollama');

      if (!detectionResult.installed && !detectionResult.portable) {
        // OLLAMAがインストールされていない場合、ダウンロードを試みる
        logger.info('OLLAMAを自動ダウンロードします...', 'autoFix');
        await safeInvoke('download_ollama');

        // ダウンロード後に再度検出
        const newDetection = await safeInvoke<{
          installed: boolean;
          running: boolean;
          portable: boolean;
        }>('detect_ollama');

        if (newDetection.installed || newDetection.portable) {
          // ダウンロード成功後、起動を試みる
          if (!newDetection.running) {
            logger.info('OLLAMAを自動起動します...', 'autoFix');
            await safeInvoke('start_ollama');
          }

          return {
            success: true,
            fixedError: error,
            fixDescription: 'OLLAMAを自動的にダウンロード・起動しました',
            result: newDetection,
          };
        }
      } else if (!detectionResult.running) {
        // OLLAMAはインストールされているが起動していない場合
        logger.info('OLLAMAを自動起動します...', 'autoFix');
        await safeInvoke('start_ollama');

        // 起動確認
        const runningCheck = await safeInvoke<{
          running: boolean;
        }>('detect_ollama');

        if (runningCheck.running) {
          return {
            success: true,
            fixedError: error,
            fixDescription: 'OLLAMAを自動的に起動しました',
            result: runningCheck,
          };
        }
      }
    } catch (fixError) {
      logger.error('OLLAMAの自動修正に失敗しました', fixError, 'autoFix');
      return {
        success: false,
        fixedError: error,
        fixDescription: 'OLLAMAの自動修正に失敗しました',
        remainingError: parseError(fixError, ErrorCategory.OLLAMA),
      };
    }
  }

  // OLLAMA接続エラーの場合
  if (errorMessage.includes('接続') || errorMessage.includes('connection')) {
    try {
      logger.info(
        'OLLAMA接続エラーを修正するため、OLLAMAを再起動します...',
        'autoFix'
      );

      // OLLAMAを停止して再起動
      await safeInvoke('stop_ollama');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
      await safeInvoke('start_ollama');

      // 起動確認
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒待機
      const runningCheck = await safeInvoke<{
        running: boolean;
      }>('detect_ollama');

      if (runningCheck.running) {
        return {
          success: true,
          fixedError: error,
          fixDescription: 'OLLAMAを再起動しました',
          result: runningCheck,
        };
      }
    } catch (fixError) {
      logger.error('OLLAMAの再起動に失敗しました', fixError, 'autoFix');
      return {
        success: false,
        fixedError: error,
        fixDescription: 'OLLAMAの再起動に失敗しました',
        remainingError: parseError(fixError, ErrorCategory.OLLAMA),
      };
    }
  }

  return {
    success: false,
    fixedError: error,
    fixDescription: 'OLLAMAエラーの自動修正ができませんでした',
    remainingError: error,
  };
}

/**
 * APIエラーを自動修正
 */
async function fixApiError(error: ErrorInfo): Promise<AutoFixResult> {
  const errorMessage = error.message.toLowerCase();

  // ポート競合エラーの場合
  if (
    errorMessage.includes('port') &&
    (errorMessage.includes('使用中') ||
      errorMessage.includes('already') ||
      errorMessage.includes('eaddrinuse'))
  ) {
    try {
      logger.info(
        'ポート競合エラーを検出しました。代替ポートを自動検出します...',
        'autoFix'
      );

      // 代替ポートを検出
      const portResult = await safeInvoke<{
        recommended_port: number;
        alternative_ports: number[];
      }>('find_available_port', { start_port: 8080 });

      if (portResult && portResult.recommended_port) {
        return {
          success: true,
          fixedError: error,
          fixDescription: `代替ポート ${portResult.recommended_port} を自動検出しました`,
          result: portResult,
        };
      }
    } catch (fixError) {
      logger.error('代替ポートの検出に失敗しました', fixError, 'autoFix');
      return {
        success: false,
        fixedError: error,
        fixDescription: '代替ポートの検出に失敗しました',
        remainingError: parseError(fixError, ErrorCategory.API),
      };
    }
  }

  // 認証プロキシエラーの場合
  if (
    errorMessage.includes('認証プロキシ') ||
    errorMessage.includes('auth proxy')
  ) {
    try {
      logger.info(
        '認証プロキシエラーを検出しました。プロキシを再起動します...',
        'autoFix'
      );

      // 認証プロキシの再起動は、API起動時に自動的に行われるため、
      // ここではエラーメッセージのみを返す
      return {
        success: false,
        fixedError: error,
        fixDescription:
          '認証プロキシの再起動が必要です。APIを再起動してください',
        remainingError: error,
      };
    } catch (fixError) {
      logger.error('認証プロキシの修正に失敗しました', fixError, 'autoFix');
      return {
        success: false,
        fixedError: error,
        fixDescription: '認証プロキシの修正に失敗しました',
        remainingError: parseError(fixError, ErrorCategory.API),
      };
    }
  }

  return {
    success: false,
    fixedError: error,
    fixDescription: 'APIエラーの自動修正ができませんでした',
    remainingError: error,
  };
}

/**
 * モデルエラーを自動修正
 */
async function fixModelError(error: ErrorInfo): Promise<AutoFixResult> {
  // モデルエラーは自動修正不可（ダウンロードは重いため）
  return {
    success: false,
    fixedError: error,
    fixDescription:
      'モデルエラーは自動修正できません。モデル管理画面からモデルをダウンロードしてください',
    remainingError: error,
  };
}

/**
 * ネットワークエラーを自動修正
 */
async function fixNetworkError(error: ErrorInfo): Promise<AutoFixResult> {
  // ネットワークエラーは自動修正不可（接続の問題はユーザーが解決する必要がある）
  return {
    success: false,
    fixedError: error,
    fixDescription:
      'ネットワークエラーは自動修正できません。インターネット接続を確認してください',
    remainingError: error,
  };
}

/**
 * エラーが自動修正可能かどうかを判定
 */
export function canAutoFix(error: unknown): boolean {
  const errorInfo = parseError(error);

  switch (errorInfo.category) {
    case ErrorCategory.OLLAMA:
      const errorMessage = errorInfo.message.toLowerCase();
      return (
        errorMessage.includes('見つかりません') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('接続') ||
        errorMessage.includes('connection')
      );
    case ErrorCategory.API:
      const apiMessage = errorInfo.message.toLowerCase();
      return (
        (apiMessage.includes('port') &&
          (apiMessage.includes('使用中') ||
            apiMessage.includes('already') ||
            apiMessage.includes('eaddrinuse'))) ||
        apiMessage.includes('認証プロキシ') ||
        apiMessage.includes('auth proxy')
      );
    case ErrorCategory.MODEL:
    case ErrorCategory.NETWORK:
      return false; // モデルとネットワークエラーは自動修正不可
    default:
      return false;
  }
}
