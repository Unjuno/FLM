// App - メインアプリケーションコンポーネント

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { AppLoading } from './components/common/AppLoading';

// 頻繁に使用されるページは通常インポート（初期バンドルに含める）
import { ApiList } from './pages/ApiList';
import { ApiTest } from './pages/ApiTest';
import { ApiDetails } from './pages/ApiDetails';

// 使用頻度の低いページはLazy Loading（コード分割）
const OllamaSetup = lazy(() => import('./pages/OllamaSetup').then(m => ({ default: m.OllamaSetup })));
const ApiCreate = lazy(() => import('./pages/ApiCreate').then(m => ({ default: m.ApiCreate })));
const WebServiceSetup = lazy(() => import('./pages/WebServiceSetup').then(m => ({ default: m.WebServiceSetup })));
const ApiTestSelector = lazy(() => import('./pages/ApiTestSelector').then(m => ({ default: m.ApiTestSelector })));
const ApiSettings = lazy(() => import('./pages/ApiSettings').then(m => ({ default: m.ApiSettings })));
const ApiEdit = lazy(() => import('./pages/ApiEdit').then(m => ({ default: m.ApiEdit })));
const ApiKeys = lazy(() => import('./pages/ApiKeys').then(m => ({ default: m.ApiKeys })));
const ModelManagement = lazy(() => import('./pages/ModelManagement').then(m => ({ default: m.ModelManagement })));
const ApiLogs = lazy(() => import('./pages/ApiLogs').then(m => ({ default: m.ApiLogs })));
const PerformanceDashboard = lazy(() => import('./pages/PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard })));
const Help = lazy(() => import('./pages/Help').then(m => ({ default: m.Help })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const AlertSettings = lazy(() => import('./pages/AlertSettings').then(m => ({ default: m.AlertSettings })));
const AlertHistory = lazy(() => import('./pages/AlertHistory').then(m => ({ default: m.AlertHistory })));
const BackupRestore = lazy(() => import('./pages/BackupRestore').then(m => ({ default: m.BackupRestore })));
const SchedulerSettings = lazy(() => import('./pages/SchedulerSettings').then(m => ({ default: m.SchedulerSettings })));
const CertificateManagement = lazy(() => import('./pages/CertificateManagement').then(m => ({ default: m.CertificateManagement })));
const AuditLogs = lazy(() => import('./pages/AuditLogs').then(m => ({ default: m.AuditLogs })));
const OAuthSettings = lazy(() => import('./pages/OAuthSettings').then(m => ({ default: m.OAuthSettings })));
const PluginManagement = lazy(() => import('./pages/PluginManagement').then(m => ({ default: m.PluginManagement })));
const EngineManagement = lazy(() => import('./pages/EngineManagement').then(m => ({ default: m.EngineManagement })));
const EngineSettings = lazy(() => import('./pages/EngineSettings').then(m => ({ default: m.EngineSettings })));
const ModelCatalogManagement = lazy(() => import('./pages/ModelCatalogManagement').then(m => ({ default: m.ModelCatalogManagement })));
const Diagnostics = lazy(() => import('./pages/Diagnostics').then(m => ({ default: m.Diagnostics })));
const About = lazy(() => import('./pages/About').then(m => ({ default: m.About })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/TermsOfService').then(m => ({ default: m.TermsOfService })));
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
function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // アプリケーション起動時に自動アップデートチェック（ユーザー同意後に有効化）
  useAppUpdate({ autoCheck: false, showNotification: false });

  // アプリケーション初期化処理
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // データベース接続確認（オプション）
        // エラーが発生してもアプリは起動できるようにする
        try {
          // データベース初期化を確認するため、API一覧取得を試行
          // タイムアウトを設定して、応答がない場合でもアプリを起動できるようにする
          const initPromise = safeInvoke('list_apis');
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('初期化タイムアウト')), 3000)
          );
          
          await Promise.race([initPromise, timeoutPromise]);

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
          logger.warn(
            '初期化確認でエラーが発生しましたが、アプリを起動します',
            err instanceof Error ? err.message : String(err),
            'App'
          );
        }

        // 初期化完了
        setIsInitializing(false);
      } catch (err) {
        // 予期しないエラーが発生した場合
        logger.error(
          'アプリケーション初期化エラー',
          err instanceof Error ? err.message : String(err),
          'App'
        );
        // エラーが発生しても、アプリは起動を続ける
        // 初期化エラーは記録されるが、ユーザーはアプリを使用できる
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

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

                  {/* API設定変更画面 */}
                  <Route path="/api/settings/:id" element={<ApiSettings />} />
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
