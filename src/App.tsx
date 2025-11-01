// FLM - メインアプリケーションコンポーネント
// フロントエンドエージェント (FE) 実装

import { Routes, Route, Navigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { OllamaSetup } from "./pages/OllamaSetup";
import { ApiCreate } from "./pages/ApiCreate";
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
import "./App.css";

/**
 * メインアプリケーションコンポーネント
 * ルーティング設定を含みます
 */
function App() {
  return (
    <div className="app">
      <Routes>
        {/* ホーム画面 */}
        <Route path="/" element={<Home />} />
        
        {/* Ollamaセットアップ画面 */}
        <Route path="/ollama-setup" element={<OllamaSetup />} />
        
        {/* API作成画面 */}
        <Route path="/api/create" element={<ApiCreate />} />
        
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
        
        {/* デフォルトルートはホームにリダイレクト */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;