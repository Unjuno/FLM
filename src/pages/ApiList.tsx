// FLM - API一覧ページ
// フロントエンドエージェント (FE) 実装
// F002: API利用機能 - API一覧画面

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { SettingsExport } from '../components/api/SettingsExport';
import { Tooltip } from '../components/common/Tooltip';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
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
  const [selectedApiIds, setSelectedApiIds] = useState<Set<string>>(new Set());
  
  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

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

  // API選択のトグル（FE-008-02）
  const handleToggleSelection = useCallback((apiId: string) => {
    setSelectedApiIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(apiId)) {
        newSet.delete(apiId);
      } else {
        newSet.add(apiId);
      }
      return newSet;
    });
  }, []);

  // 全選択/全解除（FE-008-02）
  const handleSelectAll = useCallback(() => {
    if (selectedApiIds.size === apis.length) {
      setSelectedApiIds(new Set());
    } else {
      setSelectedApiIds(new Set(apis.map(api => api.id)));
    }
  }, [selectedApiIds, apis]);

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
            <Tooltip content="ホーム画面に戻ります">
              <button className="back-button" onClick={() => navigate('/')}>
                ← ホームに戻る
              </button>
            </Tooltip>
            <h1>API一覧</h1>
          </div>
          <div className="header-actions">
            <Tooltip content="新しいAPIエンドポイントを作成します。Ollamaモデルを選択してAPIを設定できます。">
              <button className="create-button" onClick={() => navigate('/api/create')}>
                + 新しいAPIを作成
              </button>
            </Tooltip>
            <Tooltip content="API一覧を最新の状態に更新します。起動・停止状態も更新されます。">
              <button className="refresh-button" onClick={loadApis}>
                🔄 更新
              </button>
            </Tooltip>
          </div>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        {/* 設定エクスポート・インポート（FE-008-02で追加） */}
        {apis.length > 0 && (
          <div className="settings-export-section">
            <SettingsExport
              selectedApiIds={selectedApiIds.size > 0 ? Array.from(selectedApiIds) : undefined}
              onImportComplete={(result) => {
                // インポート完了後、API一覧を再読み込み
                loadApis();
                // 選択をクリア
                setSelectedApiIds(new Set());
                console.log(`インポート完了: ${result.imported}件追加、${result.skipped}件スキップ、${result.renamed}件リネーム`);
              }}
            />
          </div>
        )}

        {apis.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h2>APIがまだ作成されていません</h2>
            <p>新しいAPIを作成して、ローカルLLMのAPIを利用しましょう。</p>
            <Tooltip content="Ollamaモデルを使用して新しいAPIエンドポイントを作成します。作成後はOpenAI互換の形式で利用できます。">
              <button className="create-button primary" onClick={() => navigate('/api/create')}>
                + 新しいAPIを作成
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="api-list">
            {/* 全選択/全解除ボタン（FE-008-02） */}
            <div className="api-list-controls">
              <label className="select-all-checkbox">
                <input
                  type="checkbox"
                  checked={selectedApiIds.size === apis.length && apis.length > 0}
                  onChange={handleSelectAll}
                  aria-label="すべてのAPIを選択"
                />
                <span>すべて選択（{selectedApiIds.size}件選択中）</span>
              </label>
            </div>
            {apis.map((api) => (
              <div key={api.id} className="api-card">
                <div className="api-card-header">
                  <label className="api-select-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedApiIds.has(api.id)}
                      onChange={() => handleToggleSelection(api.id)}
                      aria-label={`${api.name}を選択`}
                    />
                  </label>
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
                  <Tooltip 
                    content={api.status === 'running' 
                      ? 'APIを停止します。停止後はリクエストを受け付けなくなります。' 
                      : 'APIを起動します。起動後はリクエストを受け付けるようになります。'}
                    position="top"
                  >
                    <button
                      className={`action-button ${api.status === 'running' ? 'stop' : 'start'}`}
                      onClick={() => handleToggleStatus(api.id, api.status)}
                    >
                      {api.status === 'running' ? '停止' : '起動'}
                    </button>
                  </Tooltip>
                  <Tooltip content="このAPIをテストできます。チャット形式でAPIの動作を確認します。" position="top">
                    <button
                      className="action-button test"
                      onClick={() => navigate(`/api/test/${api.id}`)}
                    >
                      テスト
                    </button>
                  </Tooltip>
                  <Tooltip content="APIの詳細情報を表示します。エンドポイント、APIキー、モデル情報などを確認できます。" position="top">
                    <button
                      className="action-button details"
                      onClick={() => navigate(`/api/details/${api.id}`)}
                    >
                      詳細
                    </button>
                  </Tooltip>
                  <Tooltip content="APIの設定を確認・変更します。ポート番号や認証設定などを変更できます。" position="top">
                    <button
                      className="action-button settings"
                      onClick={() => navigate(`/api/settings/${api.id}`)}
                    >
                      設定
                    </button>
                  </Tooltip>
                  <Tooltip content="APIの設定を変更します。変更後は再起動が必要な場合があります。" position="top">
                    <button
                      className="action-button edit"
                      onClick={() => navigate(`/api/edit/${api.id}`)}
                    >
                      設定変更
                    </button>
                  </Tooltip>
                  <Tooltip content="このAPIを削除します。関連するプロセスも停止され、この操作は取り消せません。" position="top">
                    <button
                      className="action-button delete"
                      onClick={() => handleDelete(api.id, api.name)}
                    >
                      削除
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
