// Chat Tester page

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import {
  fetchChatModels,
  sendChatCompletion,
  getProxyEndpoint,
  ChatModel,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '../services/chatTester';
import { isValidTemperature, isValidMaxTokens, sanitizeNumber } from '../utils/validation';
import { createErrorHandler } from '../utils/errorHandler';
import { DEFAULT_CHAT_CONFIG } from '@/config/constants';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import './ChatTester.css';

export const ChatTester: React.FC = () => {
  const { t } = useI18n();
  const [proxyEndpoint, setProxyEndpoint] = useState<string | null>(null);
  const [models, setModels] = useState<ChatModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [messages, setMessages] = useState<
    Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  >([{ role: 'user', content: '' }]);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(DEFAULT_CHAT_CONFIG.TEMPERATURE);
  const [maxTokens, setMaxTokens] = useState<number>(DEFAULT_CHAT_CONFIG.MAX_TOKENS);

  const [response, setResponse] = useState<ChatCompletionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleProxyEndpointError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: t('chatTester.proxyEndpointError'),
      }),
    [t]
  );

  const loadProxyEndpoint = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = await getProxyEndpoint();
      setProxyEndpoint(endpoint);
      if (!endpoint) {
        setError(t('chatTester.proxyNotRunning'));
      }
    } catch (err) {
      const result = handleProxyEndpointError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
    } finally {
      setLoading(false);
    }
  }, [handleProxyEndpointError, t]);

  const handleModelsError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: t('chatTester.modelListError'),
      }),
    [t]
  );

  const handleSendError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: t('chatTester.sendError'),
      }),
    [t]
  );

  const loadModels = useCallback(async () => {
    if (!proxyEndpoint) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const modelList = await fetchChatModels(proxyEndpoint);
      setModels(modelList);
      // why: モデルリスト取得時に、選択されていない場合は最初のモデルを選択する
      // alt: selectedModelを依存配列に含める（不要な再読み込みが発生する）
      // evidence: selectedModelが変更されてもモデルリストを再読み込みする必要はない
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0].id);
      }
    } catch (err) {
      const result = handleModelsError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxyEndpoint, handleModelsError]);

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
      setError(t('chatTester.proxyEndpointNotAvailable'));
      return;
    }

    if (!selectedModel) {
      setError(t('chatTester.selectModelError'));
      return;
    }

    // Validate temperature
    if (!isValidTemperature(temperature)) {
      setError(t('chatTester.temperatureError'));
      return;
    }

    // Validate max tokens
    if (!isValidMaxTokens(maxTokens)) {
      setError(t('chatTester.maxTokensError'));
      return;
    }

    const validMessages = messages.filter((m) => m.content.trim().length > 0);
    if (validMessages.length === 0) {
      setError(t('chatTester.messageRequired'));
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
    } catch (err) {
      const result = handleSendError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-tester">
      <div className="page-header">
        <h1>{t('chatTester.title')}</h1>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {!proxyEndpoint && !loading && (
        <div className="proxy-warning">
          <p>{t('chatTester.proxyNotRunning')}</p>
        </div>
      )}

      {loading && !proxyEndpoint && (
        <LoadingSpinner message={t('chatTester.fetchingProxyEndpoint')} />
      )}

      {proxyEndpoint && (
        <div className="chat-tester-content">
          <div className="tester-config">
            <h2>{t('chatTester.settings')}</h2>
            <div className="config-section">
              <label>
                {t('chatTester.proxyEndpoint')}:
                <code className="endpoint-display">{proxyEndpoint}</code>
              </label>
            </div>
            <div className="config-section">
              <label htmlFor="model-select">
                {t('chatTester.model')}:
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="model-select"
                  disabled={loading || models.length === 0}
                  aria-label={t('chatTester.model')}
                  aria-describedby={models.length === 0 && !loading ? 'model-select-help' : undefined}
                >
                  <option value="">{t('chatTester.selectModel')}</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
                {models.length === 0 && !loading && (
                  <span id="model-select-help" className="help-text">
                    {t('chatTester.modelNotAvailable')}
                  </span>
                )}
                {loading && models.length === 0 ? (
                  <LoadingSpinner size="small" message={t('chatTester.fetchingModelList')} />
                ) : (
                  <button
                    className="button-secondary button-small"
                    onClick={loadModels}
                    disabled={loading}
                  >
                    {t('chatTester.refresh')}
                  </button>
                )}
              </label>
            </div>
            <div className="config-section">
              <label htmlFor="api-key-input">
                {t('chatTester.apiKey')}:
                <input
                  id="api-key-input"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('chatTester.apiKeyPlaceholder')}
                  className="input-text"
                  aria-label={t('chatTester.apiKey')}
                />
              </label>
            </div>
            <div className="config-section">
              <label htmlFor="streaming-checkbox">
                <input
                  id="streaming-checkbox"
                  type="checkbox"
                  checked={streaming}
                  onChange={(e) => setStreaming(e.target.checked)}
                />
                {t('chatTester.streaming')}
              </label>
            </div>
            <div className="config-section">
              <label htmlFor="temperature-input">
                Temperature:
                <input
                  id="temperature-input"
                  type="number"
                  value={temperature}
                  onChange={(e) => {
                    const sanitized = sanitizeNumber(e.target.value, 0, 2);
                    if (sanitized !== null) {
                      setTemperature(sanitized);
                    }
                  }}
                  min="0"
                  max="2"
                  step="0.1"
                  className="input-number"
                  aria-label="Temperature（0.0から2.0の範囲）"
                  aria-describedby="temperature-help"
                />
                <span id="temperature-help" className="help-text">
                  {t('chatTester.temperatureError')}
                </span>
              </label>
            </div>
            <div className="config-section">
              <label htmlFor="max-tokens-input">
                Max Tokens:
                <input
                  id="max-tokens-input"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => {
                    const sanitized = sanitizeNumber(e.target.value, 1);
                    if (sanitized !== null && Number.isInteger(sanitized)) {
                      setMaxTokens(sanitized);
                    }
                  }}
                  min="1"
                  className="input-number"
                  aria-label="Max Tokens（1以上の整数）"
                  aria-describedby="max-tokens-help"
                />
                <span id="max-tokens-help" className="help-text">
                  {t('chatTester.maxTokensError')}
                </span>
              </label>
            </div>
          </div>

          <div className="tester-messages">
            <h2>{t('chatTester.message')}</h2>
            <div className="messages-list">
              {messages.map((message, index) => (
                <div key={index} className="message-item">
                  <div className="message-header">
                    <label htmlFor={`role-select-${index}`} className="sr-only">
                      メッセージ{index + 1}のロールを選択
                    </label>
                    <select
                      id={`role-select-${index}`}
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
                        aria-label={`メッセージ${index + 1}を削除`}
                      >
                        削除
                      </button>
                    )}
                  </div>
                  <label htmlFor={`message-textarea-${index}`} className="sr-only">
                    メッセージ{index + 1}の内容を入力
                  </label>
                  <textarea
                    id={`message-textarea-${index}`}
                    value={message.content}
                    onChange={(e) => handleMessageChange(index, e.target.value)}
                    placeholder={t('chatTester.message') + '...'}
                    className="message-textarea"
                    rows={4}
                  />
                </div>
              ))}
            </div>
            <button
              className="button-secondary"
              onClick={handleAddMessage}
              aria-label="新しいメッセージを追加"
            >
              + {t('chatTester.addMessage')}
            </button>
            <div className="send-actions">
              {loading ? (
                <LoadingSpinner size="small" message="送信中..." />
              ) : (
                <button
                  className="button-primary"
                  onClick={handleSend}
                  disabled={!selectedModel || !proxyEndpoint}
                >
                  {t('chatTester.send')}
                </button>
              )}
            </div>
          </div>

          {response && (
            <div className="tester-response">
              <h2>{t('chatTester.response')}</h2>
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

