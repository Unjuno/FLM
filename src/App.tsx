// App - メインアプリケーションコンポーネント

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { AppLoading } from './components/common/AppLoading';

// 頻繁に使用されるページは通常インポート（初期バンドルに含める）
import { ApiList } from './pages/ApiList';
import { ApiTest } from './pages/ApiTest';
import { ApiDetails } from './pages/ApiDetails';

// 使用頻度の低いページはLazy Loading（コード分割）
// エラーハンドリング付きのlazy loadingヘルパー関数
// 注意: loggerは後でインポートされるため、エラー時はconsole.errorを使用
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyLoad = (importFn: () => Promise<{ [key: string]: React.ComponentType<any> }>, componentName: string) => {
  return lazy(() =>
    importFn()
      .then(module => {
        const component = module[componentName] || module.default;
        if (!component) {
          throw new Error(`コンポーネント "${componentName}" が見つかりません`);
        }
        return { default: component };
      })
      .catch(error => {
        // loggerがまだインポートされていない可能性があるため、console.errorを使用
        // eslint-disable-next-line no-console
        console.error(`[App] ページの読み込みに失敗しました: ${componentName}`, error);
        // エラーを再スローしてErrorBoundaryでキャッチできるようにする
        throw error;
      })
  );
};

const OllamaSetup = lazyLoad(() => import('./pages/OllamaSetup'), 'OllamaSetup');
const ApiCreate = lazyLoad(() => import('./pages/ApiCreate'), 'ApiCreate');
const WebServiceSetup = lazyLoad(() => import('./pages/WebServiceSetup'), 'WebServiceSetup');
const ApiTestSelector = lazyLoad(() => import('./pages/ApiTestSelector'), 'ApiTestSelector');
const ApiSettings = lazyLoad(() => import('./pages/ApiSettings'), 'ApiSettings');
const ApiEdit = lazyLoad(() => import('./pages/ApiEdit'), 'ApiEdit');
const ApiKeys = lazyLoad(() => import('./pages/ApiKeys'), 'ApiKeys');
const ModelManagement = lazyLoad(() => import('./pages/ModelManagement'), 'ModelManagement');
const ApiLogs = lazyLoad(() => import('./pages/ApiLogs'), 'ApiLogs');
const PerformanceDashboard = lazyLoad(() => import('./pages/PerformanceDashboard'), 'PerformanceDashboard');
const Help = lazyLoad(() => import('./pages/Help'), 'Help');
const Settings = lazyLoad(() => import('./pages/Settings'), 'Settings');
const AlertSettings = lazyLoad(() => import('./pages/AlertSettings'), 'AlertSettings');
const AlertHistory = lazyLoad(() => import('./pages/AlertHistory'), 'AlertHistory');
const BackupRestore = lazyLoad(() => import('./pages/BackupRestore'), 'BackupRestore');
const SchedulerSettings = lazyLoad(() => import('./pages/SchedulerSettings'), 'SchedulerSettings');
const CertificateManagement = lazyLoad(() => import('./pages/CertificateManagement'), 'CertificateManagement');
const AuditLogs = lazyLoad(() => import('./pages/AuditLogs'), 'AuditLogs');
const OAuthSettings = lazyLoad(() => import('./pages/OAuthSettings'), 'OAuthSettings');
const PluginManagement = lazyLoad(() => import('./pages/PluginManagement'), 'PluginManagement');
const EngineManagement = lazyLoad(() => import('./pages/EngineManagement'), 'EngineManagement');
const EngineSettings = lazyLoad(() => import('./pages/EngineSettings'), 'EngineSettings');
const ModelCatalogManagement = lazyLoad(() => import('./pages/ModelCatalogManagement'), 'ModelCatalogManagement');
const Diagnostics = lazyLoad(() => import('./pages/Diagnostics'), 'Diagnostics');
const ErrorLogs = lazyLoad(() => import('./pages/ErrorLogs'), 'ErrorLogs');
const About = lazyLoad(() => import('./pages/About'), 'About');
const PrivacyPolicy = lazyLoad(() => import('./pages/PrivacyPolicy'), 'PrivacyPolicy');
const TermsOfService = lazyLoad(() => import('./pages/TermsOfService'), 'TermsOfService');
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './styles/common.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { I18nProvider } from './contexts/I18nContext';
import { safeInvoke } from './utils/tauri';
import { logger } from './utils/logger';
import { useAppUpdate } from './hooks/useAppUpdate';
import './App.css';

// Lazy Loading用のフォールバックコンポーネント
const PageLoading: React.FC = () => (
  <div className="page-loading">
    <img 
      src="/logo.png" 
      alt="FLM" 
      className="page-loading-logo" 
      width="32" 
      height="32"
      aria-hidden="true"
    />
    <p>読み込み中...</p>
  </div>
);

/**
 * メインアプリケーションコンポーネント
 * ルーティング設定を含みます
 */
/**
 * アップデートチェックコンポーネント
 * NotificationProvider内でuseAppUpdateを呼び出すためのラッパー
 */
const AppUpdateChecker: React.FC = () => {
  // アプリケーション起動時に自動アップデートチェック（ユーザー同意後に有効化）
  useAppUpdate({ autoCheck: false, showNotification: false });
  return null;
};

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();

  // タイムアウトIDを保存（クリーンアップ用）
  const initTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const redirectTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // アプリケーション初期化処理
  useEffect(() => {
    // 最大15秒後に強制的にアプリを表示（初回起動時のデータベース初期化が長引く場合の対策）
    const forceShowTimeout = setTimeout(() => {
      logger.warn('初期化タイムアウト: 強制的にアプリを表示します', 'App');
      setIsInitializing(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flm-app-initialized'));
      }
    }, 15000);

    const initializeApp = async () => {
      try {
        // データベース接続確認（オプション）
        // エラーが発生してもアプリは起動できるようにする
        try {
          // データベース初期化を確認するため、API一覧取得を試行
          // タイムアウトを設定して、応答がない場合でもアプリを起動できるようにする
          // 初回起動時はデータベース初期化に時間がかかるため、タイムアウトを10秒に延長
          const initPromise = safeInvoke('list_apis');
          const timeoutPromise = new Promise<never>((_, reject) => {
            initTimeoutIdRef.current = setTimeout(() => reject(new Error('初期化タイムアウト')), 10000);
          });
          
          await Promise.race([initPromise, timeoutPromise]);
          
          // 成功した場合はタイムアウトをクリア
          if (initTimeoutIdRef.current) {
            clearTimeout(initTimeoutIdRef.current);
            initTimeoutIdRef.current = null;
          }

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
              resolveError instanceof Error
                ? resolveError.message
                : String(resolveError),
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
            err instanceof Error ? err.message : String(err),
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
          }, 100);
        }
      } catch (err) {
        // 予期しないエラーが発生した場合
        logger.error(
          'アプリケーション初期化エラー',
          err instanceof Error ? err.message : String(err),
          'App'
        );
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

  // 初期化中の場合は読み込み画面を表示
  if (isInitializing) {
    return (
      <I18nProvider>
        <ThemeProvider>
          <AppLoading />
        </ThemeProvider>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <NotificationProvider>
            <AppUpdateChecker />
            <div className="app">
              <Suspense fallback={<PageLoading />}>
                <Routes>
                  {/* ホーム画面 */}
                  <Route path="/" element={<Home />} />

                  {/* Ollamaセットアップ画面 */}
                  <Route path="/ollama-setup" element={<OllamaSetup />} />

                  {/* API作成画面 */}
                  <Route path="/api/create" element={<ApiCreate />} />

                  {/* Webサイトサービスセットアップ画面 */}
                  <Route
                    path="/web-service/setup"
                    element={<WebServiceSetup />}
                  />

                  {/* API一覧画面 */}
                  <Route path="/api/list" element={<ApiList />} />

                  {/* APIテスト選択画面 */}
                  <Route path="/api/test" element={<ApiTestSelector />} />

                  {/* APIテスト画面（特定のAPI） */}
                  <Route path="/api/test/:id" element={<ApiTest />} />

                  {/* API情報画面 */}
                  <Route path="/api/details/:id" element={<ApiDetails />} />

                  {/* API設定変更画面（統合） */}
                  <Route path="/api/settings/:id" element={<ApiEdit />} />
                  <Route path="/api/edit/:id" element={<ApiEdit />} />

                  {/* モデル管理画面 */}
                  <Route path="/models" element={<ModelManagement />} />

                  {/* APIキー管理画面 */}
                  <Route path="/api/keys" element={<ApiKeys />} />

                  {/* APIログ一覧画面 */}
                  <Route path="/logs" element={<ApiLogs />} />

                  {/* パフォーマンスダッシュボード画面 */}
                  <Route path="/performance" element={<PerformanceDashboard />} />

                  {/* ヘルプ画面 */}
                  <Route path="/help" element={<Help />} />

                  {/* 設定画面 */}
                  <Route path="/settings" element={<Settings />} />

                  {/* アラート設定画面 */}
                  <Route path="/alerts/settings" element={<AlertSettings />} />

                  {/* アラート履歴画面 */}
                  <Route path="/alerts/history" element={<AlertHistory />} />

                  {/* バックアップ・復元画面 */}
                  <Route path="/backup" element={<BackupRestore />} />

                  {/* スケジューラ設定画面 */}
                  <Route path="/scheduler" element={<SchedulerSettings />} />

                  {/* 証明書管理画面 */}
                  <Route
                    path="/certificates"
                    element={<CertificateManagement />}
                  />

                  {/* 監査ログ画面 */}
                  <Route path="/audit-logs" element={<AuditLogs />} />

                  {/* OAuth認証設定画面 */}
                  <Route path="/oauth" element={<OAuthSettings />} />

                  {/* プラグイン管理画面 */}
                  <Route path="/plugins" element={<PluginManagement />} />

                  {/* エンジン管理画面 */}
                  <Route path="/engines" element={<EngineManagement />} />

                  {/* エンジン設定画面 */}
                  <Route
                    path="/engines/settings/:engineType"
                    element={<EngineSettings />}
                  />

                  {/* 診断ツール */}
                  <Route path="/diagnostics" element={<Diagnostics />} />

                  {/* エラーログ画面 */}
                  <Route path="/error-logs" element={<ErrorLogs />} />

                  {/* モデルカタログ管理画面 */}
                  <Route
                    path="/models/catalog"
                    element={<ModelCatalogManagement />}
                  />

                  {/* About画面 */}
                  <Route path="/about" element={<About />} />

                  {/* プライバシーポリシー画面 */}
                  <Route path="/privacy" element={<PrivacyPolicy />} />

                  {/* 利用規約画面 */}
                  <Route path="/terms" element={<TermsOfService />} />

                  {/* デフォルトルートはホームにリダイレクト */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </div>
          </NotificationProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </I18nProvider>
  );
}

export default App;
