// ApiCreationSuccess - API作成成功コンポーネント

import React, { useState } from 'react';
import type { ApiCreationResult } from '../../types/api';
import { generateSampleCode } from '../../utils/apiCodeGenerator';
import { SAMPLE_DATA, TIMEOUT } from '../../constants/config';
import type { ApiInfo } from '../../types/api';
import { logger } from '../../utils/logger';
import { copyToClipboard } from '../../utils/clipboard';
import { extractErrorMessage } from '../../utils/errorHandler';
import './ApiCreationSuccess.css';

/**
 * API作成成功コンポーネント
 */
interface ApiCreationSuccessProps {
  result: ApiCreationResult;
  onGoHome: () => void;
  onStartApi?: () => Promise<void>;
}

export const ApiCreationSuccess: React.FC<ApiCreationSuccessProps> = ({
  result,
  onGoHome,
  onStartApi,
}) => {
  const [starting, setStarting] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [copied, setCopied] = useState<'endpoint' | 'apiKey' | 'code' | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'javascript'>(
    'curl'
  );

  const handleCopyToClipboard = async (
    text: string,
    type: 'endpoint' | 'apiKey' | 'code' = 'code'
  ) => {
    try {
      await copyToClipboard(text);
      setCopied(type);
      setTimeout(() => setCopied(null), TIMEOUT.COPY_NOTIFICATION);
    } catch (err) {
      logger.error(
        'コピーに失敗しました',
        err instanceof Error ? err : new Error(extractErrorMessage(err)),
        'ApiCreationSuccess'
      );
    }
  };

  // apiCodeGeneratorを使用してサンプルコードを生成
  const apiInfoForGenerator: ApiInfo = {
    id: result.id,
    name: result.name,
    endpoint: result.endpoint,
    port: result.port,
    status: 'running',
    model_name: SAMPLE_DATA.DEFAULT_MODEL,
    created_at: new Date().toISOString(),
  };

  const getActiveCode = (): string => {
    return generateSampleCode(activeTab, {
      apiInfo: apiInfoForGenerator,
      apiKey: result.apiKey,
      sampleMessage: SAMPLE_DATA.MESSAGE_EN_FULL,
    });
  };

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
              onClick={() => handleCopyToClipboard(result.endpoint, 'endpoint')}
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
                <code
                  className={
                    apiKeyVisible ? 'api-key-visible' : 'api-key-hidden'
                  }
                >
                  {apiKeyVisible
                    ? result.apiKey
                    : '••••••••••••••••••••••••••••••••'}
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
                onClick={() => handleCopyToClipboard(result.apiKey!, 'apiKey')}
              >
                {copied === 'apiKey' ? '✓ コピーしました' : '📋 コピー'}
              </button>
              <small className="warning-text">
                ⚠️
                このAPIキーは表示できるのは今回だけです。安全な場所に保存してください。
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
              onClick={() => handleCopyToClipboard(getActiveCode(), 'code')}
            >
              {copied === 'code' ? '✓ コピーしました' : '📋 コピー'}
            </button>
          </div>
        </div>
      </div>

      <div className="success-actions">
        {onStartApi && (
          <button
            className="button-secondary"
            onClick={async () => {
              if (onStartApi) {
                setStarting(true);
                try {
                  await onStartApi();
                } catch (err) {
                  // エラーは親コンポーネントで処理される
                } finally {
                  setStarting(false);
                }
              }
            }}
            disabled={starting}
          >
            {starting ? '起動中...' : 'APIを起動'}
          </button>
        )}
        <button className="button-primary" onClick={onGoHome}>
          ホームに戻る
        </button>
      </div>
    </div>
  );
};
