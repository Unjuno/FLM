/**
 * アプリケーション初期化用のカスタムフック
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';

/**
 * 初期化タイムアウト設定
 */
const INIT_TIMEOUT_MS = 10000; // 10秒
const FORCE_SHOW_TIMEOUT_MS = 15000; // 15秒
const REDIRECT_DELAY_MS = 100; // 100ms

/**
 * アプリケーション初期化フックの戻り値
 */
export interface UseAppInitializationReturn {
  /** 初期化中かどうか */
  isInitializing: boolean;
}

/**
 * アプリケーション初期化処理を管理するフック
 */
export function useAppInitialization(): UseAppInitializationReturn {
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();
  const initTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const redirectTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 最大15秒後に強制的にアプリを表示（初回起動時のデータベース初期化が長引く場合の対策）
    const forceShowTimeout = setTimeout(() => {
      logger.warn('初期化タイムアウト: 強制的にアプリを表示します', 'App');
      setIsInitializing(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flm-app-initialized'));
      }
    }, FORCE_SHOW_TIMEOUT_MS);

    const initializeApp = async () => {
      try {
        // 初回起動時の言語自動検出
        try {
          const hasInitialized = sessionStorage.getItem('flm-initialized');
          if (!hasInitialized) {
            // 初回起動時のみOSの言語設定を検出
            const osLanguage = navigator.language || navigator.languages?.[0] || 'ja';
            const detectedLanguage = osLanguage.startsWith('ja')
              ? 'ja'
              : osLanguage.startsWith('en')
              ? 'en'
              : 'ja'; // 日本語または英語以外の場合は日本語をデフォルト

            // 設定を取得して、言語が設定されていない場合のみ自動設定
            try {
              const settings = await safeInvoke<{ language?: string }>(
                'get_app_settings'
              );
              if (!settings?.language) {
                // 言語が設定されていない場合のみ自動設定
                await safeInvoke('update_app_settings', {
                  language: detectedLanguage,
                });
                logger.info(
                  `初回起動: OSの言語設定を検出して設定しました (${detectedLanguage})`,
                  'App'
                );
              }
            } catch (settingsError) {
              // 設定の取得・更新に失敗してもアプリは起動を続ける
              logger.warn(
                '初回起動時の言語自動検出に失敗しましたが、アプリを起動します',
                extractErrorMessage(settingsError),
                'App'
              );
            }
          }
        } catch (langError) {
          // 言語検出エラーは記録するが、アプリは起動を続ける
          logger.warn(
            '言語自動検出でエラーが発生しましたが、アプリを起動します',
            extractErrorMessage(langError),
            'App'
          );
        }

        // データベース接続確認（オプション）
        // エラーが発生してもアプリは起動できるようにする
        try {
          // データベース初期化を確認するため、API一覧取得を試行
          // タイムアウトを設定して、応答がない場合でもアプリを起動できるようにする
          // 初回起動時はデータベース初期化に時間がかかるため、タイムアウトを10秒に延長
          const initPromise = safeInvoke('list_apis');
          const timeoutPromise = new Promise<never>((_, reject) => {
            initTimeoutIdRef.current = setTimeout(
              () => reject(new Error('初期化タイムアウト')),
              INIT_TIMEOUT_MS
            );
          });

          await Promise.race([initPromise, timeoutPromise]);

          // 成功した場合はタイムアウトをクリア
          if (initTimeoutIdRef.current) {
            clearTimeout(initTimeoutIdRef.current);
            initTimeoutIdRef.current = null;
          }

          // ポート競合の自動解決を試行
          try {
            const resolutions = await safeInvoke<
              Array<{
                api_id: string;
                api_name: string;
                old_port: number;
                new_port: number;
                reason: string;
              }>
            >('resolve_port_conflicts');

            if (Array.isArray(resolutions) && resolutions.length > 0) {
              logger.info(
                'ポート競合を自動解決しました',
                JSON.stringify(resolutions),
                'App'
              );

              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('flm-auto-port-resolved', {
                    detail: resolutions,
                  })
                );
              }
            }
          } catch (resolveError) {
            logger.warn(
              'ポート競合の自動解決に失敗しましたが起動を継続します',
              extractErrorMessage(resolveError),
              'App'
            );
          }
        } catch (err) {
          // 初期化エラーは記録するが、アプリは起動を続ける
          // エラー時もタイムアウトをクリア
          if (initTimeoutIdRef.current) {
            clearTimeout(initTimeoutIdRef.current);
            initTimeoutIdRef.current = null;
          }
          logger.warn(
            '初期化確認でエラーが発生しましたが、アプリを起動します',
            extractErrorMessage(err),
            'App'
          );
        }

        // 初期化完了
        clearTimeout(forceShowTimeout);
        setIsInitializing(false);

        // 初期ローディング画面を非表示にするイベントを発火
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('flm-app-initialized'));
        }

        // 初期化完了後、初回起動時はホーム画面にリダイレクト
        // セッションストレージで初回起動かどうかを判定
        const hasInitialized = sessionStorage.getItem('flm-initialized');
        if (!hasInitialized) {
          sessionStorage.setItem('flm-initialized', 'true');
          // 少し遅延を入れて、DOMが完全にレンダリングされた後にリダイレクト
          redirectTimeoutIdRef.current = setTimeout(() => {
            navigate('/', { replace: true });
            redirectTimeoutIdRef.current = null;
          }, REDIRECT_DELAY_MS);
        }
      } catch (err) {
        // 予期しないエラーが発生した場合
        logger.error('アプリケーション初期化エラー', err, 'App');
        // エラーが発生しても、アプリは起動を続ける
        // 初期化エラーは記録されるが、ユーザーはアプリを使用できる
        clearTimeout(forceShowTimeout);
        setIsInitializing(false);

        // エラーが発生しても初期ローディング画面を非表示にする
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('flm-app-initialized'));
        }

        // エラーが発生した場合も、ホーム画面にリダイレクト
        const hasInitialized = sessionStorage.getItem('flm-initialized');
        if (!hasInitialized) {
          sessionStorage.setItem('flm-initialized', 'true');
          navigate('/', { replace: true });
        }
      }
    };

    initializeApp();

    // クリーンアップ
    return () => {
      clearTimeout(forceShowTimeout);
      if (initTimeoutIdRef.current) {
        clearTimeout(initTimeoutIdRef.current);
        initTimeoutIdRef.current = null;
      }
      if (redirectTimeoutIdRef.current) {
        clearTimeout(redirectTimeoutIdRef.current);
        redirectTimeoutIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // デバッグ用: 初期化完了をログに記録
  useEffect(() => {
    if (!isInitializing) {
      logger.info('アプリケーション初期化完了', 'App');
    }
  }, [isInitializing]);

  return { isInitializing };
}
