// App - メインアプリケーションコンポーネント

import React, { Suspense } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { routes } from './routes';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NotificationSystem } from './components/common/NotificationSystem';
import { logger } from './utils/logger';
import './styles/common.css';
import './App.css';

// Lazy Loading用のフォールバックコンポーネント
const PageLoading: React.FC = () => (
  <div className="page-loading">
    <p>読み込み中...</p>
  </div>
);

/**
 * メインアプリケーションコンポーネント
 *
 * アプリケーションのルートコンポーネントです。
 * ルーティングを担当します。
 */
function App() {
  // useRoutesを使用してルーティングを設定
  const routing = useRoutes([
    ...routes,
    {
      path: '*',
      element: <Navigate to="/" replace />,
    },
  ]);

  const handleError = (error: Error, errorInfo: React.ErrorInfo): void => {
    logger.error('Application error caught by ErrorBoundary:', error, errorInfo);
  };

  return (
    <ErrorBoundary onError={handleError}>
      <div className="app">
        <Suspense fallback={<PageLoading />}>{routing}</Suspense>
        <NotificationSystem />
      </div>
    </ErrorBoundary>
  );
}

export default App;
