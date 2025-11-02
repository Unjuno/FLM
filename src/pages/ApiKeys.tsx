// FLM - APIキー管理ページ
// フロントエンドエージェント (FE) 実装
// F005: 認証機能 - APIキー一覧表示UI

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { ErrorMessage } from '../components/common/ErrorMessage';
import './ApiKeys.css';

/**
 * APIキー情報
 */
interface ApiKeyInfo {
  apiId: string;
  apiName: string;
  apiEndpoint: string;
  apiKey: string | null;
  hasKey: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

/**
 * APIキー管理ページ
 * すべてのAPIとそのAPIキーを一覧表示・管理します
 */
export const ApiKeys: React.FC = () => {
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  // APIキー一覧を取得
  const loadApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);

      // バックエンドのIPCコマンドを呼び出し
      // list_apisコマンドでAPI一覧を取得し、認証が有効なAPIに対して
      // 必要に応じてget_api_keyコマンドで個別にAPIキーを取得します
      const apis = await invoke<Array<{
        id: string;
        name: string;
        endpoint: string;
        enable_auth: boolean;
        created_at: string;
      }>>('list_apis');

      const apiKeyInfos: ApiKeyInfo[] = apis
        .filter(api => api.enable_auth)
        .map(api => ({
          apiId: api.id,
          apiName: api.name,
          apiEndpoint: api.endpoint,
          apiKey: null, // セキュリティ上の理由で、APIキーは別途取得コマンドが必要
          hasKey: true, // enable_authがtrueの場合はAPIキーが存在すると仮定
          createdAt: api.created_at,
        }));

      setApiKeys(apiKeyInfos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'APIキー一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 特定のAPIキーを取得（表示時のみ）
  const loadApiKey = async (apiId: string) => {
    try {
      // バックエンドのget_api_keyコマンドを呼び出し
      const key = await invoke<string | null>('get_api_key', { api_id: apiId });
      return key;
    } catch (err) {
      console.error('APIキーの取得に失敗しました:', err);
      return null;
    }
  };

  // APIキーの表示/非表示を切り替え
  const toggleKeyVisibility = async (apiId: string) => {
    if (visibleKeys.has(apiId)) {
      setVisibleKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(apiId);
        return newSet;
      });
    } else {
      // 表示する場合、APIキーを取得
      const key = await loadApiKey(apiId);
      if (key) {
        setApiKeys(prev => prev.map(info => 
          info.apiId === apiId ? { ...info, apiKey: key } : info
        ));
        setVisibleKeys(prev => new Set(prev).add(apiId));
      } else {
        setError('APIキーの取得に失敗しました。セキュリティ上の理由で、APIキーは作成時のみ表示されます。');
      }
    }
  };

  // クリップボードにコピー
  const copyToClipboard = async (text: string, apiId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(apiId);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      setError('クリップボードへのコピーに失敗しました');
    }
  };

  // APIキーを再生成
  const handleRegenerateKey = async (apiId: string) => {
    if (!confirm('APIキーを再生成しますか？現在のAPIキーは無効になります。')) {
      return;
    }

    try {
      setError(null);

      // バックエンドのregenerate_api_keyコマンドを呼び出し
      const newKey = await invoke<string>('regenerate_api_key', { api_id: apiId });

      // 新しいAPIキーを表示
      alert(`APIキーを再生成しました。新しいAPIキーを安全に保存してください。\n\n新しいAPIキー: ${newKey}`);
      
      // 一覧を更新
      await loadApiKeys();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'APIキーの再生成に失敗しました');
    }
  };

  // APIキーを削除
  const handleDeleteKey = async (apiId: string) => {
    if (!confirm('このAPIキーを削除しますか？この操作は取り消せません。')) {
      return;
    }

    try {
      setError(null);
      
      // バックエンドのdelete_api_keyコマンドを呼び出し
      await invoke('delete_api_key', { api_id: apiId });

      // 一覧を更新
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'APIキーの削除に失敗しました');
    }
  };

  // フォーマットされた日時を取得
  const formatDateTime = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString('ja-JP');
    } catch {
      return dateString;
    }
  };

  // APIキーを部分的にマスク
  const maskApiKey = (key: string | null): string => {
    if (!key) return '••••••••••••••••••••••••••••••••';
    if (key.length <= 8) return '••••••••';
    return `${key.substring(0, 4)}••••••••${key.substring(key.length - 4)}`;
  };

  if (loading) {
    return (
      <div className="api-keys-page">
        <div className="api-keys-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>APIキー一覧を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-keys-page">
      <div className="api-keys-container">
        <header className="api-keys-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← ホームに戻る
          </button>
          <h1>APIキー管理</h1>
          <button className="refresh-button" onClick={loadApiKeys}>
            🔄 更新
          </button>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="api-keys-content">
          <section className="info-section">
            <h2>APIキーについて</h2>
            <div className="info-box">
              <p>
                APIキーは認証が有効になっているAPIに対して自動的に生成されます。
                セキュリティ上の理由から、APIキーは作成時に一度だけ表示されます。
              </p>
              <p className="warning-text">
                ⚠️ APIキーは秘密にしてください。他人に共有したり、公開の場に投稿しないでください。
              </p>
            </div>
          </section>

          {apiKeys.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔑</div>
              <h2>APIキーがありません</h2>
              <p>認証が有効になっているAPIがまだ作成されていません。</p>
              <button className="primary-button" onClick={() => navigate('/api/create')}>
                新しいAPIを作成
              </button>
            </div>
          ) : (
            <section className="keys-section">
              <h2>APIキー一覧</h2>
              <div className="keys-list">
                {apiKeys.map((keyInfo) => (
                  <div key={keyInfo.apiId} className="key-card">
                    <div className="key-card-header">
                      <div className="key-info">
                        <h3>{keyInfo.apiName}</h3>
                        <code className="api-endpoint">{keyInfo.apiEndpoint}</code>
                      </div>
                      <div className="key-status">
                        {keyInfo.hasKey ? (
                          <span className="status-badge active">有効</span>
                        ) : (
                          <span className="status-badge inactive">なし</span>
                        )}
                      </div>
                    </div>

                    {keyInfo.hasKey && (
                      <div className="key-card-body">
                        <div className="key-display">
                          <div className="key-value-container">
                            <code className={`key-value ${visibleKeys.has(keyInfo.apiId) ? 'visible' : 'hidden'}`}>
                              {visibleKeys.has(keyInfo.apiId) && keyInfo.apiKey
                                ? keyInfo.apiKey
                                : maskApiKey(keyInfo.apiKey)}
                            </code>
                            <button
                              className="toggle-button"
                              onClick={() => toggleKeyVisibility(keyInfo.apiId)}
                              disabled={!keyInfo.apiKey && !visibleKeys.has(keyInfo.apiId)}
                            >
                              {visibleKeys.has(keyInfo.apiId) ? '👁️ 非表示' : '👁️ 表示'}
                            </button>
                          </div>
                          {visibleKeys.has(keyInfo.apiId) && keyInfo.apiKey && (
                            <button
                              className="copy-button"
                              onClick={() => copyToClipboard(keyInfo.apiKey!, keyInfo.apiId)}
                            >
                              {copied === keyInfo.apiId ? '✓ コピー済み' : '📋 コピー'}
                            </button>
                          )}
                        </div>
                        <div className="key-meta">
                          <span className="meta-item">
                            作成日: {formatDateTime(keyInfo.createdAt)}
                          </span>
                          {keyInfo.lastUsedAt && (
                            <span className="meta-item">
                              最終使用: {formatDateTime(keyInfo.lastUsedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="key-card-actions">
                      <button
                        className="action-button"
                        onClick={() => navigate(`/api/details/${keyInfo.apiId}`)}
                      >
                        📋 詳細を見る
                      </button>
                      <button
                        className="action-button regenerate"
                        onClick={() => handleRegenerateKey(keyInfo.apiId)}
                      >
                        🔑 キーを再生成
                      </button>
                      <button
                        className="action-button danger"
                        onClick={() => handleDeleteKey(keyInfo.apiId)}
                      >
                        🗑️ キーを削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

