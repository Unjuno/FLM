// App - メインアプリケーションコンポーネント

import React, { Suspense } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { AppLoading } from './components/common/AppLoading';
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './styles/common.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { I18nProvider } from './contexts/I18nContext';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useAppInitialization } from './hooks/useAppInitialization';
import { routes } from './routes';
import './App.css';

// Lazy Loading用のフォールバックコンポーネント
const PageLoading: React.FC = () => (
  <div className="page-loading">
    <img
      src="/logo.png"
      alt=""
      className="page-loading-logo"
      width="32"
      height="32"
      aria-hidden="true"
    />
    <p>読み込み中...</p>
  </div>
);

/**
 * アップデートチェックコンポーネント
 *
 * NotificationProvider内でuseAppUpdateを呼び出すためのラッパー
 * アプリケーション起動時に自動アップデートチェックを実行します（ユーザー同意後に有効化）
 */
const AppUpdateChecker: React.FC = () => {
  useAppUpdate({ autoCheck: false, showNotification: false });
  return null;
};

/**
 * メインアプリケーションコンポーネント
 *
 * アプリケーションのルートコンポーネントです。
 * プロバイダーの設定、ルーティング、初期化処理を担当します。
 */
function App() {
  useGlobalKeyboardShortcuts();
  const { isInitializing } = useAppInitialization();

  // useRoutesを使用してルーティングを設定（条件分岐の前に呼び出す必要がある）
  const routing = useRoutes([
    ...routes,
    {
      path: '*',
      element: <Navigate to="/" replace />,
    },
  ]);

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
              <Suspense fallback={<PageLoading />}>{routing}</Suspense>
            </div>
          </NotificationProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </I18nProvider>
  );
}

export default App;
