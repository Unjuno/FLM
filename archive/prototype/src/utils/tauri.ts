// SPDX-License-Identifier: MIT
// tauri - Tauri環境の検出と安全なinvoke関数を提供

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import {
  parseError,
  logError,
  ErrorCategory,
  extractErrorMessage,
} from './errorHandler';
import { logger } from './logger';
import { isDev as isDevEnvironment } from './env';

interface FallbackInvokeSuccess<T> {
  result: T;
  error?: never;
}

interface FallbackInvokeError {
  result?: never;
  error: {
    message: string;
    code?: string;
  };
}

type FallbackInvokeResponse<T> = FallbackInvokeSuccess<T> | FallbackInvokeError;

const FALLBACK_ENDPOINT = '/invoke';

function getWebApiBaseUrl(): string | undefined {
  // Jest環境ではimport.metaが使用できないため、process.envのみを使用
  // Vite環境でもprocess.env.VITE_WEB_API_BASE_URLが設定されているため、この方法で動作します
  if (
    typeof process !== 'undefined' &&
    process.env &&
    typeof process.env.VITE_WEB_API_BASE_URL === 'string' &&
    process.env.VITE_WEB_API_BASE_URL.trim() !== ''
  ) {
    return process.env.VITE_WEB_API_BASE_URL.trim();
  }

  if (typeof window !== 'undefined') {
    try {
      const { protocol, hostname } = window.location;
      if (protocol.startsWith('http') && hostname) {
        return `${protocol}//${hostname}:1420`;
      }
    } catch (error) {
      logger.debug(
        '[safeInvoke] window.location からの取得に失敗しました',
        error
      );
    }
  }

  return undefined;
}

function buildFallbackUrl(baseUrl: string): string {
  if (baseUrl.endsWith('/')) {
    return `${baseUrl.slice(0, -1)}${FALLBACK_ENDPOINT}`;
  }
  return `${baseUrl}${FALLBACK_ENDPOINT}`;
}

/**
 * Tauri環境が利用可能かどうかをチェック
 * @returns Tauri環境が利用可能な場合はtrue
 */
export function isTauriAvailable(): boolean {
  // まず、インポートしたinvoke関数が利用可能かチェック（最も重要）
  const invokeIsFunction = typeof tauriInvoke === 'function';
  if (!invokeIsFunction) {
    if (isDevEnvironment()) {
      logger.warn(
        '[isTauriAvailable] tauriInvoke が関数ではありません',
        typeof tauriInvoke,
        'tauri'
      );
    }
    return false;
  }

  // windowが存在するかチェック
  const hasWindow = typeof window !== 'undefined';
  if (!hasWindow) {
    if (isDevEnvironment()) {
      logger.warn(
        '[isTauriAvailable] window が undefined です',
        undefined,
        'tauri'
      );
    }
    return false;
  }

  // window.__TAURI__またはwindow.__TAURI_IPC__の存在をチェック（Tauri環境の必須条件）
  // Tauri 2.xでは__TAURI_IPC__も使用される可能性があるため、両方をチェック
  const hasTauriGlobal = '__TAURI__' in window;
  const hasTauriIpc = '__TAURI_IPC__' in window;

  if (!hasTauriGlobal && !hasTauriIpc) {
    // window.__TAURI__もwindow.__TAURI_IPC__も存在しない場合、ブラウザ環境と判断
    if (isDevEnvironment()) {
      logger.debug(
        '[isTauriAvailable] window.__TAURI__ と window.__TAURI_IPC__ が存在しません。ブラウザ環境と判断します。'
      );
    }
    return false;
  }

  // Tauri環境が利用可能
  if (isDevEnvironment()) {
    if (hasTauriGlobal) {
      logger.debug(
        '[isTauriAvailable] ✓ Tauri環境が利用可能です（window.__TAURI__ が利用可能）'
      );
    } else if (hasTauriIpc) {
      logger.debug(
        '[isTauriAvailable] ✓ Tauri環境が利用可能です（window.__TAURI_IPC__ が利用可能）'
      );
    }
  }
  return true;
}

/**
 * 安全にTauriのinvoke関数を呼び出す
 * Tauri環境が利用できない場合はエラーをスローする
 *
 * @param cmd IPCコマンド名
 * @param args コマンド引数
 * @returns Promise<T> コマンドの戻り値
 * @throws Error Tauri環境が利用できない場合
 */
// IPC呼び出しのキャッシュ（読み取り専用コマンド用）
// キャッシュ戦略の最適化: LRUキャッシュとTTLを実装
interface CacheEntry {
  data: unknown;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

const invokeCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5000; // 5秒間キャッシュ
const MAX_CACHE_SIZE = 100; // 最大キャッシュエントリ数

// キャッシュ可能なコマンド（読み取り専用）
const CACHEABLE_COMMANDS = new Set([
  'list_apis',
  'get_system_resources',
  'detect_ollama',
  'check_ollama_health',
  'get_app_settings',
  'get_installed_models',
  'get_all_plugins',
  'get_schedule_tasks',
  'detect_engine', // エンジン検出は頻繁に呼ばれるためキャッシュ
  'detect_all_engines', // 全エンジン検出もキャッシュ
]);

// IPC呼び出しのタイムアウト設定（30秒）
const IPC_TIMEOUT_MS = 30000;

// 長時間かかる可能性のあるコマンドのタイムアウト設定
// install_engine（特にvLLM）は30分かかる可能性があるため、タイムアウトを延長
const LONG_RUNNING_COMMANDS = new Set([
  'start_api',
  'update_engine',
  'download_model',
  'detect_engine', // エンジン検出は時間がかかる可能性があるため
  'detect_all_engines', // 全エンジン検出も時間がかかる可能性があるため
]);

// 非常に長時間かかる可能性のあるコマンド（vLLMインストールなど）
const VERY_LONG_RUNNING_COMMANDS = new Set([
  'install_engine', // vLLMのインストールは30分かかる可能性がある
]);

/**
 * IPC呼び出しキャッシュをクリア
 * 書き込み操作後に呼び出すことで、次回の読み取り時に最新データを取得
 */
export function clearInvokeCache(cmd?: string): void {
  if (cmd) {
    invokeCache.delete(cmd);
  } else {
    invokeCache.clear();
  }
}

// デバッグモードが有効かどうかを判定
function isDebugMode(): boolean {
  return (
    isDevEnvironment() ||
    (typeof process !== 'undefined' &&
      process.env &&
      process.env.FLM_DEBUG === '1') ||
    (typeof process !== 'undefined' &&
      process.env &&
      process.env.FLM_DEBUG === 'true') ||
    (typeof window !== 'undefined' &&
      (window as unknown as { FLM_DEBUG?: string }).FLM_DEBUG === '1')
  );
}

export async function safeInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  const debugLoggingEnabled = isDebugMode();

  // 開発環境またはデバッグモードのみログ出力
  if (debugLoggingEnabled) {
    logger.debug(
      `[safeInvoke] コマンド呼び出し: ${cmd}`,
      args ? `引数: ${JSON.stringify(args)}` : '引数なし'
    );
  }

  // キャッシュチェック（読み取り専用コマンドのみ）
  if (CACHEABLE_COMMANDS.has(cmd)) {
    const cacheKey = args ? `${cmd}:${JSON.stringify(args)}` : cmd;
    const cached = invokeCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL) {
      // アクセス情報を更新
      cached.accessCount++;
      cached.lastAccess = now;

      if (debugLoggingEnabled) {
        logger.debug(
          `[safeInvoke] キャッシュから取得: ${cmd} (アクセス回数: ${cached.accessCount})`
        );
      }
      return cached.data as T;
    }

    // 期限切れのキャッシュを削除
    if (cached && now - cached.timestamp >= CACHE_TTL) {
      invokeCache.delete(cacheKey);
    }
  }

  const isAvailable = isTauriAvailable();
  if (debugLoggingEnabled) {
    logger.debug(`[safeInvoke] Tauri環境チェック結果: ${isAvailable}`);
  }

  if (isAvailable) {
    try {
      if (debugLoggingEnabled) {
        logger.debug(`[safeInvoke] invoke実行中: ${cmd}`);
      }

      // タイムアウト付きでIPC呼び出しを実行
      // 長時間かかる可能性のあるコマンドはタイムアウトを延長
      // install_engine（特にvLLM）は30分かかる可能性があるため、タイムアウトを10分に設定
      let timeoutMs = IPC_TIMEOUT_MS;
      if (VERY_LONG_RUNNING_COMMANDS.has(cmd)) {
        timeoutMs = 600000; // 10分（vLLMインストールはバックエンドで30分のタイムアウトがあるため、フロントエンド側でも長めに設定）
      } else if (LONG_RUNNING_COMMANDS.has(cmd)) {
        timeoutMs = IPC_TIMEOUT_MS * 2; // 60秒
      }
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `IPC呼び出しがタイムアウトしました: ${cmd} (${timeoutMs}ms)`
            )
          );
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([
          tauriInvoke<T>(cmd, args),
          timeoutPromise,
        ]);

        // キャッシュに保存（読み取り専用コマンドのみ）
        if (CACHEABLE_COMMANDS.has(cmd)) {
          const cacheKey = args ? `${cmd}:${JSON.stringify(args)}` : cmd;
          const now = Date.now();

          // キャッシュサイズ制限: LRU方式で古いエントリを削除
          if (invokeCache.size >= MAX_CACHE_SIZE) {
            // 最も古いアクセス時刻のエントリを削除
            let oldestKey: string | null = null;
            let oldestAccess = Infinity;

            for (const [key, entry] of invokeCache.entries()) {
              if (entry.lastAccess < oldestAccess) {
                oldestAccess = entry.lastAccess;
                oldestKey = key;
              }
            }

            if (oldestKey) {
              invokeCache.delete(oldestKey);
              if (debugLoggingEnabled) {
                logger.debug(
                  `[safeInvoke] キャッシュエントリを削除: ${oldestKey}`
                );
              }
            }
          }

          invokeCache.set(cacheKey, {
            data: result,
            timestamp: now,
            accessCount: 1,
            lastAccess: now,
          });
        }

        if (debugLoggingEnabled) {
          logger.debug(`[safeInvoke] コマンド成功: ${cmd}`, result);
        }
        return result;
      } finally {
        if (typeof timeoutId !== 'undefined') {
          clearTimeout(timeoutId);
        }
      }
    } catch (error) {
      // エラーオブジェクトの詳細を取得（parseErrorがTauriエラーを処理する）
      const errorInfo = parseError(error);

      // エラーログを出力
      logger.error(`[safeInvoke] ✗ コマンドエラー: ${cmd}`, error, 'tauri');

      if (debugLoggingEnabled) {
        // Tauriの構造化エラーをJSON形式で表示
        if (typeof error === 'object' && error !== null) {
          try {
            logger.debug(
              `[safeInvoke] エラーオブジェクト (JSON): ${JSON.stringify(error, null, 2)}`
            );
          } catch {
            // JSON文字列化に失敗した場合は無視
          }
        }
        logger.debug(`[safeInvoke] エラー情報:`, errorInfo);
        if (errorInfo.technicalDetails) {
          logger.debug(`[safeInvoke] 技術的詳細:`, errorInfo.technicalDetails);
        }
      }

      logError(errorInfo, `safeInvoke:${cmd}`);

      // 開発環境では元のエラーメッセージも含める
      const finalMessage = errorInfo.message;

      throw new Error(finalMessage);
    }
  }

  const webApiBaseUrl = getWebApiBaseUrl();

  if (webApiBaseUrl && typeof fetch === 'function') {
    const fallbackUrl = buildFallbackUrl(webApiBaseUrl);

    try {
      logger.debug(`[safeInvoke] fetchフォールバックを実行: ${fallbackUrl}`);

      const response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cmd, args }),
      });

      if (!response.ok) {
        throw new Error(
          `IPCフォールバック呼び出しに失敗しました: HTTP ${response.status}`
        );
      }

      const data = (await response.json()) as FallbackInvokeResponse<T>;

      if ('error' in data && data.error) {
        throw new Error(
          data.error.message || 'IPCフォールバックで未知のエラーが発生しました'
        );
      }

      if ('result' in data) {
        return data.result;
      }

      throw new Error('IPCフォールバックのレスポンス形式が不正です');
    } catch (error) {
      logger.error(
        `[safeInvoke] フォールバック呼び出しでエラー発生: ${cmd}`,
        error,
        'tauri'
      );
      throw error instanceof Error
        ? error
        : new Error(
            `IPCフォールバックで未知のエラーが発生しました: ${extractErrorMessage(error)}`
          );
    }
  }

  logger.error(
    '[safeInvoke] Tauri環境が利用できずフォールバックも無効です',
    undefined,
    'tauri'
  );
  throw new Error(
    'アプリケーションが正しく起動していません。Tauriアプリケーションを再起動するか、VITE_WEB_API_BASE_URL を設定してください。'
  );
}

/**
 * Tauri環境をチェックし、利用できない場合は警告を表示
 * 開発環境でのみ警告を出力します
 * @param featureName 機能名（エラーメッセージ用、デフォルト: 'この機能'）
 */
export function checkTauriEnvironment(featureName: string = 'この機能'): void {
  if (!isTauriAvailable()) {
    if (typeof window !== 'undefined' && isDevEnvironment()) {
      logger.warn(
        `${featureName}を使用するには、Tauriアプリケーションとして起動する必要があります。`,
        'tauri'
      );
    }
  }
}
