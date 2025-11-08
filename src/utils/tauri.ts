// tauri - Tauri環境の検出と安全なinvoke関数を提供

import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { parseError, logError, ErrorCategory } from './errorHandler';
import { logger } from './logger';

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
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> })?.env;
    const value = metaEnv?.VITE_WEB_API_BASE_URL;
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  } catch (error) {
    // import.meta が存在しない環境（Jest など）ではここに到達するため、エラーは握りつぶす
    const isTestEnv =
      typeof process !== 'undefined' &&
      process.env &&
      process.env.NODE_ENV === 'test';
    if (!isTestEnv) {
      // eslint-disable-next-line no-console
      console.debug('[safeInvoke] import.meta.env からの取得に失敗しました', error);
    }
  }

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
      // eslint-disable-next-line no-console
      console.debug('[safeInvoke] window.location からの取得に失敗しました', error);
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
    if (process.env.NODE_ENV === 'development') {
      console.warn('[isTauriAvailable] tauriInvoke が関数ではありません:', typeof tauriInvoke);
    }
    return false;
  }
  
  // windowが存在するかチェック
  const hasWindow = typeof window !== 'undefined';
  if (!hasWindow) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[isTauriAvailable] window が undefined です');
    }
    return false;
  }
  
  // window.__TAURI__の存在をチェック（withGlobalTauri: trueの場合に利用可能）
  const hasTauriGlobal = '__TAURI__' in window;
  if (hasTauriGlobal) {
    const tauriGlobalDefined = typeof window.__TAURI__ !== 'undefined';
    if (tauriGlobalDefined && process.env.NODE_ENV === 'development') {
      console.log('[isTauriAvailable] ✓ Tauri環境が利用可能です（window.__TAURI__ も利用可能）');
    }
  } else if (process.env.NODE_ENV === 'development') {
    // window.__TAURI__がなくても、インポートしたinvoke関数が動作する可能性があるため、警告のみ
    console.debug('[isTauriAvailable] window.__TAURI__ は存在しませんが、インポートしたinvoke関数を使用します');
  }
  
  // invoke関数が利用可能であれば、Tauri環境として認識
  if (process.env.NODE_ENV === 'development') {
    console.log('[isTauriAvailable] ✓ Tauri環境が利用可能です（invoke関数を使用）');
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
]);

// IPC呼び出しのタイムアウト設定（30秒）
const IPC_TIMEOUT_MS = 30000;

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
    process.env.NODE_ENV === 'development' ||
    process.env.FLM_DEBUG === '1' ||
    process.env.FLM_DEBUG === 'true' ||
    (typeof window !== 'undefined' && (window as unknown as { FLM_DEBUG?: string }).FLM_DEBUG === '1')
  );
}

export async function safeInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  const isDev = isDebugMode();
  
  // 開発環境またはデバッグモードのみログ出力
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(
      `[safeInvoke] コマンド呼び出し: ${cmd}`,
      args ? `引数: ${JSON.stringify(args)}` : '引数なし'
    );
  }

  // キャッシュチェック（読み取り専用コマンドのみ）
  if (CACHEABLE_COMMANDS.has(cmd) {
    const cacheKey = args ? `${cmd}:${JSON.stringify(args)}` : cmd;
    const cached = invokeCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && now - cached.timestamp < CACHE_TTL) {
      // アクセス情報を更新
      cached.accessCount++;
      cached.lastAccess = now;
      
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log(`[safeInvoke] キャッシュから取得: ${cmd} (アクセス回数: ${cached.accessCount})`);
      }
      return cached.data as T;
    }
    
    // 期限切れのキャッシュを削除
    if (cached && now - cached.timestamp >= CACHE_TTL) {
      invokeCache.delete(cacheKey);
    }
  }

  const isAvailable = isTauriAvailable();
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(`[safeInvoke] Tauri環境チェック結果: ${isAvailable}`);
  }

  if (isAvailable) {
    try {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log(`[safeInvoke] invoke実行中: ${cmd}`);
      }
      
      // タイムアウト付きでIPC呼び出しを実行
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`IPC呼び出しがタイムアウトしました: ${cmd} (${IPC_TIMEOUT_MS}ms)`));
        }, IPC_TIMEOUT_MS);
      });
      
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
            if (isDev) {
              // eslint-disable-next-line no-console
              console.log(`[safeInvoke] キャッシュエントリを削除: ${oldestKey}`);
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
      
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log(`[safeInvoke] コマンド成功: ${cmd}`, result);
      }
      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[safeInvoke] ✗ コマンドエラー: ${cmd}`, error);
      
      // 元のエラーメッセージを取得
      const originalMessage = error instanceof Error ? error.message : String(error);
      
      // エラーカテゴリを自動判定（APIカテゴリをデフォルトにしない）
      let errorCategory: ErrorCategory | undefined;
      const lowerMessage = originalMessage.toLowerCase();
      if (lowerMessage.includes('timeout') || lowerMessage.includes('タイムアウト')) {
        errorCategory = ErrorCategory.NETWORK;
      } else if (lowerMessage.includes('ollama')) {
        errorCategory = ErrorCategory.OLLAMA;
      } else if (lowerMessage.includes('model')) {
        errorCategory = ErrorCategory.MODEL;
      } else if (lowerMessage.includes('database') || lowerMessage.includes('sql')) {
        errorCategory = ErrorCategory.DATABASE;
      } else if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
        errorCategory = ErrorCategory.NETWORK;
      } else if (lowerMessage.includes('port') || lowerMessage.includes('api') || lowerMessage.includes('eaddrinuse')) {
        errorCategory = ErrorCategory.API;
      }
      
      const errorInfo = parseError(error, errorCategory);
      logError(errorInfo, `safeInvoke:${cmd}`);
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error(`[safeInvoke] エラー情報:`, errorInfo);
        // eslint-disable-next-line no-console
        console.error(`[safeInvoke] 元のエラーメッセージ:`, originalMessage);
      }
      
      // 開発環境では元のエラーメッセージも含める
      const finalMessage = isDev && originalMessage !== errorInfo.message
        ? `${errorInfo.message} (詳細: ${originalMessage})`
        : errorInfo.message;
      
      throw new Error(finalMessage);
    }
  }

  const webApiBaseUrl = getWebApiBaseUrl();

  if (webApiBaseUrl && typeof fetch === 'function') {
    const fallbackUrl = buildFallbackUrl(webApiBaseUrl);

    try {
      // eslint-disable-next-line no-console
      console.log(`[safeInvoke] fetchフォールバックを実行: ${fallbackUrl}`);

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
        throw new Error(data.error.message || 'IPCフォールバックで未知のエラーが発生しました');
      }

      if ('result' in data) {
        return data.result;
      }

      throw new Error('IPCフォールバックのレスポンス形式が不正です');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[safeInvoke] フォールバック呼び出しでエラー発生: ${cmd}`, error);
      throw error instanceof Error
        ? error
        : new Error(`IPCフォールバックで未知のエラーが発生しました: ${String(error)}`);
    }
  }

  // eslint-disable-next-line no-console
  console.error('[safeInvoke] Tauri環境が利用できずフォールバックも無効です');
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
    // 開発環境の判定: テスト環境とVite環境の両方で動作するようにprocess.envを使用
    // 注: Vite環境ではimport.meta.env.DEVが利用可能だが、Jest環境ではパースエラーになるため
    // process.env.NODE_ENVを使用（Viteは自動的にprocess.envを設定する）
    const isDev =
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV !== 'production';

    if (typeof window !== 'undefined' && isDev) {
      logger.warn(
        `${featureName}を使用するには、Tauriアプリケーションとして起動する必要があります。`,
        'tauri'
      );
    }
  }
}
