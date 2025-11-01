// FLM - API一覧ページ
// フロントエンドエージェント (FE) 実装
// F002: API利用機能 - API一覧画面

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ErrorMessage } from '../components/common/ErrorMessage';
import './ApiList.css';

/**
 * API情報
 */
interface ApiInfo {
  id: string;
  name: string;
  model: string;
  port: number;
  status: 'running' | 'stopped' | 'error';
  endpoint: string;
  created_at: string;
}

/**
 * API一覧ページ
 * 作成済みのAPIを表示・管理します
 */
export const ApiList: React.FC = () => {
  const navigate = useNavigate();
  const [apis, setApis] = useState<ApiInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API一覧を取得（useCallbackでメモ化してパフォーマンス最適化）
  const loadApis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // バックエンドのIPCコマンドを呼び出し
      const result = await invoke<Array<{
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        enable_auth: boolean;
        status: string;
        created_at: string;
        updated_at: string;
      }>>('list_apis');

      // レスポンスをApiInfo形式に変換
      const apiInfos: ApiInfo[] = result.map(api => ({
        id: api.id,
        name: api.name,
        model: api.model_name,
        port: api.port,
        status: (api.status === 'running' ? 'running' : 
                 api.status === 'stopped' ? 'stopped' : 'error') as 'running' | 'stopped' | 'error',
        endpoint: api.endpoint,
        created_at: api.created_at,
      }));

      setApis(apiInfos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApis();
    
    // ステータスを定期的に更新（5秒ごと）
    const interval = setInterval(() => {
      loadApis();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadApis]);

  // APIの起動/停止（useCallbackでメモ化）
  const handleToggleStatus = useCallback(async (apiId: string, currentStatus: string) => {
    try {
      setError(null);
      
      // バックエンドのIPCコマンドを呼び出し
      if (currentStatus === 'running') {
        await invoke('stop_api', { api_id: apiId });
      } else {
        await invoke('start_api', { api_id: apiId });
      }
      
      // 一覧を再読み込み
      await loadApis();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'APIの状態変更に失敗しました';
      setError(errorMessage);
    }
  }, [loadApis]);

  // APIの削除（useCallbackでメモ化）
  const handleDelete = useCallback(async (apiId: string, apiName: string) => {
    const confirmed = window.confirm(
      `API "${apiName}" を削除しますか？\n\nこの操作は取り消せません。関連するプロセスも停止されます。`
    );

    if (!confirmed) return;

    try {
      setError(null);
      
      // バックエンドIPCコマンドを呼び出し
      await invoke('delete_api', { api_id: apiId });

      // 一覧を再読み込み
      await loadApis();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'APIの削除に失敗しました';
      setError(errorMessage);
    }
  }, [loadApis]);

  // ステータステキストを取得（パフォーマンス最適化：関数として定義）
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'running':
        return '実行中';
      case 'stopped':
        return '停止中';
      case 'error':
        return 'エラー';
      default:
        return '不明';
    }
  };

  if (loading) {
    return (
      <div className="api-list-page">
        <div className="api-list-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>API一覧を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-list-page">
      <div className="api-list-container">
        <header className="api-list-header">
          <div className="header-top">
            <button className="back-button" onClick={() => navigate('/')}>
              ← ホームに戻る
            </button>
            <h1>API一覧</h1>
          </div>
          <div className="header-actions">
            <button className="create-button" onClick={() => navigate('/api/create')}>
              + 新しいAPIを作成
            </button>
            <button className="refresh-button" onClick={loadApis}>
              🔄 更新
            </button>
          </div>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        {apis.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h2>APIがまだ作成されていません</h2>
            <p>新しいAPIを作成して、ローカルLLMのAPIを利用しましょう。</p>
            <button className="create-button primary" onClick={() => navigate('/api/create')}>
              + 新しいAPIを作成
            </button>
          </div>
        ) : (
          <div className="api-list">
            {apis.map((api) => (
              <div key={api.id} className="api-card">
                <div className="api-card-header">
                  <h3 className="api-name">{api.name}</h3>
                  <div className={`status-badge status-${api.status}`}>
                    {getStatusText(api.status)}
                  </div>
                </div>

                <div className="api-info">
                  <div className="info-row">
                    <span className="info-label">モデル:</span>
                    <span className="info-value">{api.model}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">エンドポイント:</span>
                    <code className="info-value">{api.endpoint}</code>
                  </div>
                  <div className="info-row">
                    <span className="info-label">ポート:</span>
                    <span className="info-value">{api.port}</span>
                  </div>
                </div>

                <div className="api-actions">
                  <button
                    className={`action-button ${api.status === 'running' ? 'stop' : 'start'}`}
                    onClick={() => handleToggleStatus(api.id, api.status)}
                  >
                    {api.status === 'running' ? '停止' : '起動'}
                  </button>
                  <button
                    className="action-button test"
                    onClick={() => navigate(`/api/test/${api.id}`)}
                  >
                    テスト
                  </button>
                  <button
                    className="action-button details"
                    onClick={() => navigate(`/api/details/${api.id}`)}
                  >
                    詳細
                  </button>
                  <button
                    className="action-button settings"
                    onClick={() => navigate(`/api/settings/${api.id}`)}
                  >
                    設定
                  </button>
                  <button
                    className="action-button edit"
                    onClick={() => navigate(`/api/edit/${api.id}`)}
                  >
                    設定変更
                  </button>
                  <button
                    className="action-button delete"
                    onClick={() => handleDelete(api.id, api.name)}
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
