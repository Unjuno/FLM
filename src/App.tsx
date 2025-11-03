// App - メインアプリケーションコンポーネント

import { Routes, Route, Navigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { OllamaSetup } from "./pages/OllamaSetup";
import { ApiCreate } from "./pages/ApiCreate";
import { WebServiceSetup } from "./pages/WebServiceSetup";
import { ApiList } from "./pages/ApiList";
import { ApiTest } from "./pages/ApiTest";
import { ApiDetails } from "./pages/ApiDetails";
import { ApiSettings } from "./pages/ApiSettings";
import { ApiEdit } from "./pages/ApiEdit";
import { ApiKeys } from "./pages/ApiKeys";
import { ModelManagement } from "./pages/ModelManagement";
import { ApiLogs } from "./pages/ApiLogs";
import { PerformanceDashboard } from "./pages/PerformanceDashboard";
import { Help } from "./pages/Help";
import { Settings } from "./pages/Settings";
import { AlertSettings } from "./pages/AlertSettings";
import { AlertHistory } from "./pages/AlertHistory";
import { BackupRestore } from "./pages/BackupRestore";
import { About } from "./pages/About";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";
import { useGlobalKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { I18nProvider } from "./contexts/I18nContext";
import "./App.css";

/**
 * メインアプリケーションコンポーネント
 * ルーティング設定を含みます
 */
function App() {
  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  return (
    <ErrorBoundary>
      <I18nProvider>
        <ThemeProvider>
          <NotificationProvider>
            <div className="app">
              <Routes>
                {/* ホーム画面 */}
                <Route path="/" element={<Home />} />
                
                {/* Ollamaセットアップ画面 */}
                <Route path="/ollama-setup" element={<OllamaSetup />} />
                
                {/* API作成画面 */}
                <Route path="/api/create" element={<ApiCreate />} />
                
                {/* Webサイトサービスセットアップ画面 */}
                <Route path="/web-service/setup" element={<WebServiceSetup />} />
                
                {/* API一覧画面 */}
                <Route path="/api/list" element={<ApiList />} />
                
                {/* APIテスト画面 */}
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
                
                {/* About画面 */}
                <Route path="/about" element={<About />} />
                
                {/* プライバシーポリシー画面 */}
                <Route path="/privacy" element={<PrivacyPolicy />} />
                
                {/* 利用規約画面 */}
                <Route path="/terms" element={<TermsOfService />} />
                
                {/* デフォルトルートはホームにリダイレクト */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
            </NotificationProvider>
          </ThemeProvider>
        </I18nProvider>
      </ErrorBoundary>
  );
}

export default App;