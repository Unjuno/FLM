/**
 * アプリケーションのルーティング設定
 *
 * ルート定義を一元管理し、メンテナンス性を向上させます。
 */

import { RouteObject } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Home } from './pages/Home';
import { ChatTester } from './pages/ChatTester';
import { SecurityEvents } from './pages/SecurityEvents';
import { IpBlocklistManagement } from './pages/IpBlocklistManagement';
import { IpWhitelistManagement } from './pages/IpWhitelistManagement';
import { Settings } from './pages/Settings';
import { SetupWizard } from './pages/SetupWizard';
import { ModelProfiles } from './pages/ModelProfiles';
import { ModelComparison } from './pages/ModelComparison';
import { AlertSettings } from './pages/AlertSettings';

/**
 * アプリケーションのルート定義
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <AppLayout>
        <Home />
      </AppLayout>
    ),
  },
  {
    path: '/chat/tester',
    element: (
      <AppLayout>
        <ChatTester />
      </AppLayout>
    ),
  },
  {
    path: '/security/events',
    element: (
      <AppLayout>
        <SecurityEvents />
      </AppLayout>
    ),
  },
  {
    path: '/security/ip-blocklist',
    element: (
      <AppLayout>
        <IpBlocklistManagement />
      </AppLayout>
    ),
  },
  {
    path: '/security/ip-whitelist',
    element: (
      <AppLayout>
        <IpWhitelistManagement />
      </AppLayout>
    ),
  },
  {
    path: '/settings',
    element: (
      <AppLayout>
        <Settings />
      </AppLayout>
    ),
  },
  {
    path: '/models/profiles',
    element: (
      <AppLayout>
        <ModelProfiles />
      </AppLayout>
    ),
  },
  {
    path: '/models/comparison',
    element: (
      <AppLayout>
        <ModelComparison />
      </AppLayout>
    ),
  },
  {
    path: '/setup',
    element: (
      <AppLayout>
        <SetupWizard />
      </AppLayout>
    ),
  },
  {
    path: '/settings/alerts',
    element: (
      <AppLayout>
        <AlertSettings />
      </AppLayout>
    ),
  },
];
