// useApiList - API一覧の取得と管理用カスタムフック

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke, clearInvokeCache } from '../utils/tauri';
import { REFRESH_INTERVALS } from '../constants/config';
import { useIsMounted } from './useIsMounted';
import { useI18n } from '../contexts/I18nContext';
import { logger } from '../utils/logger';
import { extractErrorMessage, toError } from '../utils/errorHandler';
import { usePolling } from './usePolling';
import { useRequestThrottle } from './useRequestThrottle';
import { convertApiStatus } from '../utils/apiStatusConverter';
import type { ApiInfo } from '../types/api';

/**
 * API情報（拡張版 - errorステータスを含む）
 */
export interface ApiInfoExtended extends Omit<ApiInfo, 'status'> {
  status: 'running' | 'preparing' | 'stopped' | 'error';
  /** プロキシサーバーが実際に起動しているか（データベースの状態とは独立） */
  proxy_running?: boolean;
}

/**
 * API一覧の取得と管理用カスタムフック
 *
 * @returns API一覧の状態と操作関数
 */
export const useApiList = () => {
  const { t } = useI18n();
  const isMounted = useIsMounted();
  const [apis, setApis] = useState<ApiInfoExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 最新のt関数を保持するためのref（無限ループを防ぐ）
  const tRef = useRef(t);
  // ローディング状態を追跡するref（重複リクエストを防ぐ）
  const isLoadingRef = useRef(false);
  // リクエストスロットリング
  const { canRequest, updateRequestTime } = useRequestThrottle({
    minInterval: 5000, // 5秒（過剰な呼び出しを防ぐため延長）
  });

  // refを最新の値に更新
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  /**
   * API一覧を取得
   * @param force 強制更新フラグ（trueの場合、クールダウンチェックをスキップ）
   */
  const loadApis = useCallback(
    async (force: boolean = false) => {
      if (!isMounted()) return;

      // 既にローディング中の場合はスキップ
      if (isLoadingRef.current) {
        return;
      }

      // 強制更新でない場合、最後のリクエストから一定時間経過していない場合はスキップ
      if (!canRequest(force)) {
        return;
      }

      isLoadingRef.current = true;
      updateRequestTime();

      const currentT = tRef.current;

      try {
        if (isMounted()) {
          setLoading(true);
          setError(null);
        }

        // バックエンドのIPCコマンドを呼び出し
        const result = await safeInvoke<
          Array<{
            id: string;
            name: string;
            endpoint: string;
            model_name: string;
            port: number;
            enable_auth: boolean;
            status: string;
            created_at: string;
            updated_at: string;
          }>
        >('list_apis');

        // 結果が配列でない場合の処理
        if (!Array.isArray(result)) {
          logger.warn('list_apisの結果が配列ではありません', 'useApiList');
          if (isMounted()) {
            setApis([]);
          }
          return;
        }

        // レスポンスをApiInfo形式に変換
        const apiInfos: ApiInfoExtended[] = await Promise.all(
          result.map(async api => {
            const status = convertApiStatus(api.status);

            // データベースで「running」と記録されているAPIについて、プロキシサーバーの実際の状態を確認
            let proxy_running: boolean | undefined = undefined;
            if (status === 'running') {
              try {
                const healthResult = await safeInvoke<{
                  is_running: boolean;
                  port: number;
                  https_port: number;
                  message: string;
                }>('check_proxy_health', { port: api.port });
                proxy_running = healthResult.is_running;
              } catch (err) {
                // エラーが発生した場合は、プロキシが起動していないとみなす
                proxy_running = false;
                logger.debug(
                  `プロキシヘルスチェックエラー (API: ${api.name}, ポート: ${api.port}):`,
                  err,
                  'useApiList'
                );
              }
            }

            return {
              id: api.id,
              name: api.name,
              model_name: api.model_name,
              port: api.port,
              status,
              endpoint: api.endpoint,
              created_at: api.created_at,
              updated_at: api.updated_at,
              proxy_running,
            };
          })
        );

        // アンマウントチェック
        if (isMounted()) {
          setApis(apiInfos);
        }
      } catch (err) {
        const errorMessage = extractErrorMessage(
          err,
          currentT('apiList.messages.loadError')
        );
        if (isMounted()) {
          setError(errorMessage);
        }
        logger.error(
          currentT('apiList.messages.loadError'),
          toError(err),
          'useApiList'
        );
      } finally {
        // アンマウントチェック
        if (isMounted()) {
          setLoading(false);
        }
        isLoadingRef.current = false;
      }
    },
    [isMounted, canRequest, updateRequestTime]
  );

  // 初回読み込み（マウント時のみ実行）
  useEffect(() => {
    void loadApis(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回のみ実行

  // ポーリング用のラッパー関数
  const pollLoadApis = useCallback(
    async (options?: { force?: boolean }) => {
      await loadApis(options?.force ?? false);
    },
    [loadApis]
  );

  // ポーリング設定（usePollingがvisibilitychangeも処理する）
  // 初回読み込みはloadApisで直接実行するため、ポーリングは初回読み込みをスキップ
  usePolling(pollLoadApis, {
    interval: REFRESH_INTERVALS.API_LIST,
    minRequestInterval: 5000, // 5秒（操作を妨げないように延長）
    enabled: true, // 常に有効
    skipWhenHidden: true,
    skipInitialLoad: true, // 初回読み込みはloadApisで実行するためスキップ
  });

  /**
   * キャッシュをクリアしてAPI一覧を再読み込み
   * 明示的なリフレッシュのため、クールダウンチェックをスキップ
   */
  const refreshApis = useCallback(async () => {
    // 既にローディング中の場合はスキップ（明示的なリフレッシュでも重複を防ぐ）
    if (isLoadingRef.current) {
      return;
    }
    clearInvokeCache('list_apis');
    // 強制更新フラグを有効にして、クールダウンチェックをスキップ
    await loadApis(true);
  }, [loadApis]);

  return {
    apis,
    loading,
    error,
    loadApis,
    refreshApis,
    setError,
  };
};
