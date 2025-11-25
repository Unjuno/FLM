// SPDX-License-Identifier: MIT
// ChatTester - Chat tester page for testing proxy endpoints

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import {
  fetchChatModels,
  sendChatCompletion,
  getProxyEndpoint,
  ChatModel,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '../services/chatTester';
import './ChatTester.css';

export const ChatTester: React.FC = () => {
  const { t } = useI18n();
  const { showError, showSuccess } = useNotifications();

  const [proxyEndpoint, setProxyEndpoint] = useState<string | null>(null);
  const [models, setModels] = useState<ChatModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [messages, setMessages] = useState<
    Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  >([{ role: 'user', content: '' }]);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(1000);

  const [response, setResponse] = useState<ChatCompletionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'Chat Tester' },
    ],
    [t]
  );

  const loadProxyEndpoint = useCallback(async () => {
    try {
      const endpoint = await getProxyEndpoint();
      setProxyEndpoint(endpoint);
      if (!endpoint) {
        setError('プロキシが実行されていません。Dashboardでプロキシを起動してください。');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'プロキシエンドポイントの取得に失敗しました'
      );
    }
  }, []);

  const loadModels = useCallback(async () => {
    if (!proxyEndpoint) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const modelList = await fetchChatModels(proxyEndpoint);
      setModels(modelList);
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'モデルリストの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  }, [proxyEndpoint, selectedModel]);

  useEffect(() => {
    void loadProxyEndpoint();
  }, [loadProxyEndpoint]);

  useEffect(() => {
    if (proxyEndpoint) {
      void loadModels();
    }
  }, [proxyEndpoint, loadModels]);

  const handleAddMessage = () => {
    setMessages([...messages, { role: 'user', content: '' }]);
  };

  const handleRemoveMessage = (index: number) => {
    if (messages.length > 1) {
      setMessages(messages.filter((_, i) => i !== index));
    }
  };

  const handleMessageChange = (index: number, content: string) => {
    const newMessages = [...messages];
    newMessages[index] = { ...newMessages[index], content };
    setMessages(newMessages);
  };

  const handleRoleChange = (
    index: number,
    role: 'system' | 'user' | 'assistant'
  ) => {
    const newMessages = [...messages];
    newMessages[index] = { ...newMessages[index], role };
    setMessages(newMessages);
  };

  const handleSend = async () => {
    if (!proxyEndpoint) {
      showError('プロキシエンドポイントが取得できません');
      return;
    }

    if (!selectedModel) {
      showError('モデルを選択してください');
      return;
    }

    const validMessages = messages.filter((m) => m.content.trim().length > 0);
    if (validMessages.length === 0) {
      showError('メッセージを入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const request: ChatCompletionRequest = {
        model: selectedModel,
        messages: validMessages,
        stream: streaming,
        temperature,
        max_tokens: maxTokens,
      };

      const result = await sendChatCompletion(
        proxyEndpoint,
        apiKey || null,
        request
      );
      setResponse(result);
      showSuccess('リクエストが成功しました');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'チャットリクエストの送信に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-tester">
      <Breadcrumb items={breadcrumbItems} />
      <div className="page-header">
        <h1>Chat Tester</h1>
      </div>

      {error && <ErrorMessage message={error} />}

      {!proxyEndpoint && (
        <div className="proxy-warning">
          <p>プロキシが実行されていません。Dashboardでプロキシを起動してください。</p>
        </div>
      )}

      {proxyEndpoint && (
        <div className="chat-tester-content">
          <div className="tester-config">
            <h2>設定</h2>
            <div className="config-section">
              <label>
                プロキシエンドポイント:
                <code className="endpoint-display">{proxyEndpoint}</code>
              </label>
            </div>
            <div className="config-section">
              <label>
                モデル:
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="model-select"
                  disabled={loading || models.length === 0}
                >
                  <option value="">選択してください</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
                <button
                  className="button-secondary button-small"
                  onClick={loadModels}
                  disabled={loading}
                >
                  {loading ? '読み込み中...' : '更新'}
                </button>
              </label>
            </div>
            <div className="config-section">
              <label>
                APIキー (オプション):
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Bearer token"
                  className="input-text"
                />
              </label>
            </div>
            <div className="config-section">
              <label>
                <input
                  type="checkbox"
                  checked={streaming}
                  onChange={(e) => setStreaming(e.target.checked)}
                />
                Streaming (SSE)
              </label>
            </div>
            <div className="config-section">
              <label>
                Temperature:
                <input
                  type="number"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  min="0"
                  max="2"
                  step="0.1"
                  className="input-number"
                />
              </label>
            </div>
            <div className="config-section">
              <label>
                Max Tokens:
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                  min="1"
                  className="input-number"
                />
              </label>
            </div>
          </div>

          <div className="tester-messages">
            <h2>メッセージ</h2>
            <div className="messages-list">
              {messages.map((message, index) => (
                <div key={index} className="message-item">
                  <div className="message-header">
                    <select
                      value={message.role}
                      onChange={(e) =>
                        handleRoleChange(
                          index,
                          e.target.value as 'system' | 'user' | 'assistant'
                        )
                      }
                      className="role-select"
                    >
                      <option value="system">System</option>
                      <option value="user">User</option>
                      <option value="assistant">Assistant</option>
                    </select>
                    {messages.length > 1 && (
                      <button
                        className="button-danger button-small"
                        onClick={() => handleRemoveMessage(index)}
                      >
                        削除
                      </button>
                    )}
                  </div>
                  <textarea
                    value={message.content}
                    onChange={(e) => handleMessageChange(index, e.target.value)}
                    placeholder="メッセージを入力..."
                    className="message-textarea"
                    rows={4}
                  />
                </div>
              ))}
            </div>
            <button
              className="button-secondary"
              onClick={handleAddMessage}
            >
              + メッセージを追加
            </button>
            <div className="send-actions">
              <button
                className="button-primary"
                onClick={handleSend}
                disabled={loading || !selectedModel || !proxyEndpoint}
              >
                {loading ? '送信中...' : '送信'}
              </button>
            </div>
          </div>

          {response && (
            <div className="tester-response">
              <h2>レスポンス</h2>
              {response.request_id && (
                <div className="response-meta">
                  <p>
                    <strong>Request ID:</strong> <code>{response.request_id}</code>
                  </p>
                </div>
              )}
              <div className="response-content">
                <h3>選択された応答:</h3>
                {response.choices && response.choices.length > 0 && (
                  <div className="choice-item">
                    <p>
                      <strong>Role:</strong> {response.choices[0].message.role}
                    </p>
                    <p>
                      <strong>Content:</strong>
                    </p>
                    <pre className="response-text">
                      {response.choices[0].message.content}
                    </pre>
                    <p>
                      <strong>Finish Reason:</strong> {response.choices[0].finish_reason}
                    </p>
                  </div>
                )}
                {response.usage && (
                  <div className="response-usage">
                    <h4>使用量:</h4>
                    <ul>
                      <li>Prompt Tokens: {response.usage.prompt_tokens}</li>
                      <li>Completion Tokens: {response.usage.completion_tokens}</li>
                      <li>Total Tokens: {response.usage.total_tokens}</li>
                    </ul>
                  </div>
                )}
              </div>
              <div className="response-raw">
                <h3>Raw JSON:</h3>
                <pre className="json-display">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

