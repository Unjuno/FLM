// ApiInfo - API情報ページ

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { API_KEY, TIMEOUT } from '../constants/config';
import type { ApiInfo as BaseApiInfo, ApiDetailsResponse } from '../types/api';
import { generateSampleCode } from '../utils/apiCodeGenerator';
import './ApiInfo.css';

/**
 * API情報（拡張版 - apiKeyを含む）
 */
interface ApiInfoWithKey extends BaseApiInfo {
  apiKey?: string;
}

/**
 * API情報ページ
 * APIの詳細情報とサンプルコードを表示します
 */
export const ApiInfo: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [apiInfo, setApiInfo] = useState<ApiInfoWithKey | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'javascript'>('curl');

  useEffect(() => {
    if (id) {
      loadApiInfo(id);
    }
  }, [id]);

  const loadApiInfo = async (apiId: string) => {
    try {
      setLoading(true);
      setError(null);

      // バックエンドのIPCコマンドを呼び出してAPI詳細を取得（APIキーを含む）
      const apiDetails = await safeInvoke<ApiDetailsResponse>('get_api_details', { api_id: apiId });

      setApiInfo({
        id: apiDetails.id,
        name: apiDetails.name,
        endpoint: apiDetails.endpoint,
        apiKey: apiDetails.api_key || undefined,
        port: apiDetails.port,
        model_name: apiDetails.model_name,
        status: (apiDetails.status === 'running' ? 'running' : 'stopped') as 'running' | 'stopped',
        created_at: apiDetails.created_at,
        updated_at: apiDetails.updated_at,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // クリップボードにコピー
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), TIMEOUT.COPY_NOTIFICATION);
    } catch (err) {
      setError('クリップボードへのコピーに失敗しました');
    }
  };

  // サンプルコード生成
  const getSampleCode = useCallback((language: 'curl' | 'python' | 'javascript'): string => {
    if (!apiInfo) return '';

    return generateSampleCode(language, {
      apiInfo,
      apiKey: apiInfo.apiKey,
    });
  }, [apiInfo]);

  if (loading) {
    return (
      <div className="api-info-page">
        <div className="api-info-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>API情報を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !apiInfo) {
    return (
      <div className="api-info-page">
        <div className="api-info-container">
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <p>{error || 'API情報が見つかりませんでした'}</p>
            <button className="back-button" onClick={() => navigate('/api/list')}>
              API一覧に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-info-page">
      <div className="api-info-container">
        <header className="api-info-header">
          <button className="back-button" onClick={() => navigate('/api/list')}>
            ← API一覧に戻る
          </button>
          <h1>API情報</h1>
        </header>

        <div className="api-info-content">
          <section className="info-section">
            <h2>基本情報</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">API名:</span>
                <span className="info-value">{apiInfo.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">モデル:</span>
                <span className="info-value">{apiInfo.model_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">ステータス:</span>
                <span className={`info-value status-${apiInfo.status}`}>
                  {apiInfo.status === 'running' ? '実行中' : '停止中'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">ポート:</span>
                <span className="info-value">{apiInfo.port}</span>
              </div>
              <div className="info-item">
                <span className="info-label">作成日:</span>
                <span className="info-value">
                  {new Date(apiInfo.created_at).toLocaleString('ja-JP')}
                </span>
              </div>
            </div>
          </section>

          <section className="info-section">
            <h2>エンドポイント</h2>
            <div className="endpoint-display">
              <code className="endpoint-url">{apiInfo.endpoint}</code>
              <button
                className="copy-button"
                onClick={() => copyToClipboard(apiInfo.endpoint, 'endpoint')}
              >
                {copied === 'endpoint' ? '✓ コピー済み' : '📋 コピー'}
              </button>
            </div>
          </section>

          {apiInfo.apiKey && (
            <section className="info-section">
              <h2>APIキー</h2>
              <div className="api-key-display">
                <code className={`api-key-value ${showApiKey ? 'visible' : 'hidden'}`}>
                  {showApiKey ? apiInfo.apiKey : '•'.repeat(API_KEY.DEFAULT_LENGTH)}
                </code>
                <div className="api-key-actions">
                  {apiInfo.apiKey.startsWith('***') ? (
                    <p className="api-key-note">
                      ⚠️ APIキーは作成時にのみ表示されます。キーを紛失した場合は再生成してください。
                    </p>
                  ) : (
                    <>
                      <button
                        className="toggle-button"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? '👁️ 非表示' : '👁️ 表示'}
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(apiInfo.apiKey!, 'apikey')}
                      >
                        {copied === 'apikey' ? '✓ コピー済み' : '📋 コピー'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {!apiInfo.apiKey.startsWith('***') && (
                <p className="api-key-warning">
                  ⚠️ APIキーは秘密にしてください。他人に共有しないでください。
                </p>
              )}
            </section>
          )}

          <section className="info-section">
            <h2>サンプルコード</h2>
            <div className="sample-code-tabs">
              <button 
                className={`tab-button ${activeTab === 'curl' ? 'active' : ''}`}
                onClick={() => setActiveTab('curl')}
              >
                curl
              </button>
              <button 
                className={`tab-button ${activeTab === 'python' ? 'active' : ''}`}
                onClick={() => setActiveTab('python')}
              >
                Python
              </button>
              <button 
                className={`tab-button ${activeTab === 'javascript' ? 'active' : ''}`}
                onClick={() => setActiveTab('javascript')}
              >
                JavaScript
              </button>
            </div>
            <div className="sample-code-container">
              <div className={`sample-code-block ${activeTab === 'curl' ? 'active' : ''}`}>
                <pre>
                  <code>{getSampleCode('curl')}</code>
                </pre>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(getSampleCode('curl'), 'curl')}
                >
                  {copied === 'curl' ? '✓ コピー済み' : '📋 コピー'}
                </button>
              </div>
              <div className={`sample-code-block ${activeTab === 'python' ? 'active' : ''}`}>
                <pre>
                  <code>{getSampleCode('python')}</code>
                </pre>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(getSampleCode('python'), 'python')}
                >
                  {copied === 'python' ? '✓ コピー済み' : '📋 コピー'}
                </button>
              </div>
              <div className={`sample-code-block ${activeTab === 'javascript' ? 'active' : ''}`}>
                <pre>
                  <code>{getSampleCode('javascript')}</code>
                </pre>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(getSampleCode('javascript'), 'javascript')}
                >
                  {copied === 'javascript' ? '✓ コピー済み' : '📋 コピー'}
                </button>
              </div>
            </div>
          </section>

          <section className="info-section">
            <div className="action-buttons">
              <button
                className="action-button primary"
                onClick={() => navigate(`/api/test/${apiInfo.id}`)}
              >
                🧪 APIをテスト
              </button>
              <button
                className="action-button"
                onClick={() => navigate(`/api/settings/${apiInfo.id}`)}
              >
                ⚙️ 設定を変更
              </button>
              <button
                className="action-button"
                onClick={() => navigate('/api/list')}
              >
                📋 API一覧に戻る
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

