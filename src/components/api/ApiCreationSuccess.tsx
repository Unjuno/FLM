// ApiCreationSuccess - API作成成功コンポーネント

import React, { useState } from 'react';
import type { ApiCreationResult } from '../../types/api';
import './ApiCreationSuccess.css';

/**
 * API作成成功コンポーネント
 */
interface ApiCreationSuccessProps {
  result: ApiCreationResult;
  onGoHome: () => void;
}

export const ApiCreationSuccess: React.FC<ApiCreationSuccessProps> = ({ result, onGoHome }) => {
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [copied, setCopied] = useState<'endpoint' | 'apiKey' | 'code' | null>(null);
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'javascript'>('curl');

  const copyToClipboard = async (text: string, type: 'endpoint' | 'apiKey' | 'code' = 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('コピーに失敗しました:', err);
    }
  };

  const getActiveCode = (): string => {
    switch (activeTab) {
      case 'curl':
        return sampleCurl;
      case 'python':
        return samplePython;
      case 'javascript':
        return sampleJavaScript;
    }
  };

  const sampleCurl = `curl -X POST ${result.endpoint}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${result.apiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "model": "local-llm",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'`;

  const samplePython = `import requests

response = requests.post(
    "${result.endpoint}/v1/chat/completions",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer ${result.apiKey || 'YOUR_API_KEY'}"
    },
    json={
        "model": "local-llm",
        "messages": [
            {"role": "user", "content": "Hello, how are you?"}
        ]
    }
)

print(response.json())`;

  const sampleJavaScript = `fetch('${result.endpoint}/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${result.apiKey || 'YOUR_API_KEY'}'
  },
  body: JSON.stringify({
    model: 'local-llm',
    messages: [
      { role: 'user', content: 'Hello, how are you?' }
    ]
  })
})
.then(response => response.json())
.then(data => console.log(data));`;

  return (
    <div className="api-creation-success">
      <div className="success-header">
        <div className="success-icon">✅</div>
        <h2>API作成が完了しました！</h2>
        <p className="success-message">
          <strong>{result.name}</strong> の作成が正常に完了しました。
        </p>
      </div>

      <div className="success-content">
        <div className="info-section">
          <h3>APIエンドポイント</h3>
          <div className="info-item">
            <code>{result.endpoint}</code>
            <button
              className="copy-button"
              onClick={() => copyToClipboard(result.endpoint, 'endpoint')}
            >
              {copied === 'endpoint' ? '✓ コピーしました' : '📋 コピー'}
            </button>
          </div>
        </div>

        {result.apiKey && (
          <div className="info-section">
            <h3>APIキー</h3>
            <div className="info-item">
              <div className="api-key-container">
                <code className={apiKeyVisible ? 'api-key-visible' : 'api-key-hidden'}>
                  {apiKeyVisible ? result.apiKey : '••••••••••••••••••••••••••••••••'}
                </code>
                <button
                  className="toggle-button"
                  onClick={() => setApiKeyVisible(!apiKeyVisible)}
                >
                  {apiKeyVisible ? '👁️ 非表示' : '👁️ 表示'}
                </button>
              </div>
              <button
                className="copy-button"
                onClick={() => copyToClipboard(result.apiKey!, 'apiKey')}
              >
                {copied === 'apiKey' ? '✓ コピーしました' : '📋 コピー'}
              </button>
              <small className="warning-text">
                ⚠️ このAPIキーは表示できるのは今回だけです。安全な場所に保存してください。
              </small>
            </div>
          </div>
        )}

        <div className="info-section">
          <h3>サンプルコード</h3>
          <div className="code-tabs">
            <button 
              className={`code-tab ${activeTab === 'curl' ? 'active' : ''}`}
              onClick={() => setActiveTab('curl')}
            >
              cURL
            </button>
            <button 
              className={`code-tab ${activeTab === 'python' ? 'active' : ''}`}
              onClick={() => setActiveTab('python')}
            >
              Python
            </button>
            <button 
              className={`code-tab ${activeTab === 'javascript' ? 'active' : ''}`}
              onClick={() => setActiveTab('javascript')}
            >
              JavaScript
            </button>
          </div>
          <div className="code-block">
            <pre>
              <code>{getActiveCode()}</code>
            </pre>
            <button
              className="copy-code-button"
              onClick={() => copyToClipboard(getActiveCode(), 'code')}
            >
              {copied === 'code' ? '✓ コピーしました' : '📋 コピー'}
            </button>
          </div>
        </div>
      </div>

      <div className="success-actions">
        <button className="button-primary" onClick={onGoHome}>
          ホームに戻る
        </button>
      </div>
    </div>
  );
};
