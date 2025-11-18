/**
 * アプリケーションのルーティング設定
 * 
 * ルート定義を一元管理し、メンテナンス性を向上させます。
 */

import React, { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { logger } from './utils/logger';

// 頻繁に使用されるページは通常インポート（初期バンドルに含める）
import { Home } from './pages/Home';
import { ApiList } from './pages/ApiList';
import { ApiTest } from './pages/ApiTest';
import { ApiDetails } from './pages/ApiDetails';

// エラーハンドリング付きのlazy loadingヘルパー関数
const lazyLoad = (
  importFn: () => Promise<{ [key: string]: React.ComponentType<Record<string, never>> }>,
  componentName: string
) => {
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
        logger.error(
          `ページの読み込みに失敗しました: ${componentName}`,
          error,
          'Routes'
        );
        throw error;
      })
  );
};

// 使用頻度の低いページはLazy Loading（コード分割）
const OllamaSetup = lazyLoad(() => import('./pages/OllamaSetup'), 'OllamaSetup');
const ApiCreate = lazyLoad(() => import('./pages/ApiCreate'), 'ApiCreate');
const WebServiceSetup = lazyLoad(
  () => import('./pages/WebServiceSetup'),
  'WebServiceSetup'
);
const ApiTestSelector = lazyLoad(
  () => import('./pages/ApiTestSelector'),
  'ApiTestSelector'
);
const ApiEdit = lazyLoad(() => import('./pages/ApiEdit'), 'ApiEdit');
const ApiInfo = lazyLoad(() => import('./pages/ApiInfo'), 'ApiInfo');
const ApiSettings = lazyLoad(() => import('./pages/ApiSettings'), 'ApiSettings');
const ApiKeys = lazyLoad(() => import('./pages/ApiKeys'), 'ApiKeys');
const ModelManagement = lazyLoad(
  () => import('./pages/ModelManagement'),
  'ModelManagement'
);
const ApiLogs = lazyLoad(() => import('./pages/ApiLogs'), 'ApiLogs');
const PerformanceDashboard = lazyLoad(
  () => import('./pages/PerformanceDashboard'),
  'PerformanceDashboard'
);
const Help = lazyLoad(() => import('./pages/Help'), 'Help');
const Settings = lazyLoad(() => import('./pages/Settings'), 'Settings');
const AlertSettings = lazyLoad(
  () => import('./pages/AlertSettings'),
  'AlertSettings'
);
const AlertHistory = lazyLoad(
  () => import('./pages/AlertHistory'),
  'AlertHistory'
);
const BackupRestore = lazyLoad(
  () => import('./pages/BackupRestore'),
  'BackupRestore'
);
const SchedulerSettings = lazyLoad(
  () => import('./pages/SchedulerSettings'),
  'SchedulerSettings'
);
const CertificateManagement = lazyLoad(
  () => import('./pages/CertificateManagement'),
  'CertificateManagement'
);
const AuditLogs = lazyLoad(() => import('./pages/AuditLogs'), 'AuditLogs');
const OAuthSettings = lazyLoad(
  () => import('./pages/OAuthSettings'),
  'OAuthSettings'
);
const PluginManagement = lazyLoad(
  () => import('./pages/PluginManagement'),
  'PluginManagement'
);
const EngineManagement = lazyLoad(
  () => import('./pages/EngineManagement'),
  'EngineManagement'
);
const EngineSettings = lazyLoad(
  () => import('./pages/EngineSettings'),
  'EngineSettings'
);
const ModelCatalogManagement = lazyLoad(
  () => import('./pages/ModelCatalogManagement'),
  'ModelCatalogManagement'
);
const Diagnostics = lazyLoad(() => import('./pages/Diagnostics'), 'Diagnostics');
const ErrorLogs = lazyLoad(() => import('./pages/ErrorLogs'), 'ErrorLogs');
const About = lazyLoad(() => import('./pages/About'), 'About');
const PrivacyPolicy = lazyLoad(
  () => import('./pages/PrivacyPolicy'),
  'PrivacyPolicy'
);
const TermsOfService = lazyLoad(
  () => import('./pages/TermsOfService'),
  'TermsOfService'
);

/**
 * アプリケーションのルート定義
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/ollama-setup',
    element: <OllamaSetup />,
  },
  {
    path: '/api/create',
    element: <ApiCreate />,
  },
  {
    path: '/web-service/setup',
    element: <WebServiceSetup />,
  },
  {
    path: '/api/list',
    element: <ApiList />,
  },
  {
    path: '/api/test',
    element: <ApiTestSelector />,
  },
  {
    path: '/api/test/:id',
    element: <ApiTest />,
  },
  {
    path: '/api/details/:id',
    element: <ApiDetails />,
  },
  {
    path: '/api/info/:id',
    element: <ApiInfo />,
  },
  {
    path: '/api/settings/:id',
    element: <ApiSettings />,
  },
  {
    path: '/api/edit/:id',
    element: <ApiEdit />,
  },
  {
    path: '/models',
    element: <ModelManagement />,
  },
  {
    path: '/api/keys',
    element: <ApiKeys />,
  },
  {
    path: '/logs',
    element: <ApiLogs />,
  },
  {
    path: '/performance',
    element: <PerformanceDashboard />,
  },
  {
    path: '/help',
    element: <Help />,
  },
  {
    path: '/settings',
    element: <Settings />,
  },
  {
    path: '/alerts/settings',
    element: <AlertSettings />,
  },
  {
    path: '/alerts/history',
    element: <AlertHistory />,
  },
  {
    path: '/backup',
    element: <BackupRestore />,
  },
  {
    path: '/scheduler',
    element: <SchedulerSettings />,
  },
  {
    path: '/certificates',
    element: <CertificateManagement />,
  },
  {
    path: '/audit-logs',
    element: <AuditLogs />,
  },
  {
    path: '/oauth',
    element: <OAuthSettings />,
  },
  {
    path: '/plugins',
    element: <PluginManagement />,
  },
  {
    path: '/engines',
    element: <EngineManagement />,
  },
  {
    path: '/engines/settings/:engineType',
    element: <EngineSettings />,
  },
  {
    path: '/diagnostics',
    element: <Diagnostics />,
  },
  {
    path: '/error-logs',
    element: <ErrorLogs />,
  },
  {
    path: '/models/catalog',
    element: <ModelCatalogManagement />,
  },
  {
    path: '/about',
    element: <About />,
  },
  {
    path: '/privacy',
    element: <PrivacyPolicy />,
  },
  {
    path: '/terms',
    element: <TermsOfService />,
  },
];

