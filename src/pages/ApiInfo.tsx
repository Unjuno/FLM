// FLM - API情報ページ
// フロントエンドエージェント (FE) 実装
// F002: API利用機能 - API情報画面

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import './ApiInfo.css';

/**
 * API情報
 */
interface ApiInfo {
  id: string;
  name: string;
  endpoint: string;
  apiKey?: string;
  port: number;
  model: string;
  status: 'running' | 'stopped';
  created_at: string;
}

/**
 * API情報ページ
 * APIの詳細情報とサンプルコードを表示します
 */
export const ApiInfo: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [apiInfo, setApiInfo] = useState<ApiInfo | null>(null);
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

      // バックエンドのIPCコマンドを呼び出し（list_apisから該当APIを取得）
      const apis = await invoke<Array<{
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

      type ApiListItem = {
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        enable_auth: boolean;
        status: string;
        created_at: string;
        updated_at: string;
      };
      const api = apis.find((a: ApiListItem) => a.id === apiId);
      
      if (!api) {
        setError('APIが見つかりませんでした');
        return;
      }

      // APIキーは別途取得する必要があるが、現在の実装ではAPIキーは作成時のみ表示される
      // セキュリティ上の理由で、APIキー取得コマンドは後で実装
      setApiInfo({
        id: api.id,
        name: api.name,
        endpoint: api.endpoint,
        apiKey: api.enable_auth ? undefined : undefined, // TODO: APIキー取得コマンドで取得
        port: api.port,
        model: api.model_name,
        status: (api.status === 'running' ? 'running' : 'stopped') as 'running' | 'stopped',
        created_at: api.created_at,
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
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      setError('クリップボードへのコピーに失敗しました');
    }
  };

  // サンプルコード生成
  const generateSampleCode = (language: 'curl' | 'python' | 'javascript') => {
    if (!apiInfo) return '';

    const apiKey = apiInfo.apiKey || 'YOUR_API_KEY';
    const endpoint = apiInfo.endpoint;
    const authHeader = apiInfo.apiKey ? `Authorization: Bearer ${apiKey}` : '';

    switch (language) {
      case 'curl':
        return `curl ${endpoint}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  ${authHeader ? `-H "${authHeader}" \\` : ''}
  -d '{
    "model": "${apiInfo.model}",
    "messages": [
      {"role": "user", "content": "こんにちは"}
    ]
  }'`;

      case 'python':
        return `import requests

url = "${endpoint}/v1/chat/completions"
headers = {
    "Content-Type": "application/json"${apiInfo.apiKey ? `,\n    "Authorization": "Bearer ${apiKey}"` : ''}
}

data = {
    "model": "${apiInfo.model}",
    "messages": [
        {"role": "user", "content": "こんにちは"}
    ]
}

response = requests.post(url, json=data, headers=headers)
print(response.json())`;

      case 'javascript':
        return `const response = await fetch("${endpoint}/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"${apiInfo.apiKey ? `,\n    "Authorization": "Bearer ${apiKey}"` : ''}
  },
  body: JSON.stringify({
    model: "${apiInfo.model}",
    messages: [
      { role: "user", content: "こんにちは" }
    ]
  })
});

const data = await response.json();
console.log(data);`;

      default:
        return '';
    }
  };

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
                <span className="info-value">{apiInfo.model}</span>
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
                  {showApiKey ? apiInfo.apiKey : '•'.repeat(32)}
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
                  <code>{generateSampleCode('curl')}</code>
                </pre>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(generateSampleCode('curl'), 'curl')}
                >
                  {copied === 'curl' ? '✓ コピー済み' : '📋 コピー'}
                </button>
              </div>
              <div className={`sample-code-block ${activeTab === 'python' ? 'active' : ''}`}>
                <pre>
                  <code>{generateSampleCode('python')}</code>
                </pre>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(generateSampleCode('python'), 'python')}
                >
                  {copied === 'python' ? '✓ コピー済み' : '📋 コピー'}
                </button>
              </div>
              <div className={`sample-code-block ${activeTab === 'javascript' ? 'active' : ''}`}>
                <pre>
                  <code>{generateSampleCode('javascript')}</code>
                </pre>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(generateSampleCode('javascript'), 'javascript')}
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

