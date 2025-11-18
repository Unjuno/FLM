// ApiTest - APIテストページ

import React, { useState, useEffect, useTransition, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { InfoBanner } from '../components/common/InfoBanner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { LLMTestRunner } from '../components/api/LLMTestRunner';
import { useI18n } from '../contexts/I18nContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  MESSAGE_LIMITS,
  HTTP_HEADERS,
  API_ENDPOINTS,
} from '../constants/config';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import { retry, isRetryableError } from '../utils/retry';
import { extractEndpointUrl } from '../utils/llmTest';
import { formatTime } from '../utils/formatters';
import './ApiTest.css';

/**
 * チャットメッセージ
 */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: number;
}

/**
 * APIテストページ
 * チャットインターフェースでAPIをテストします
 * 
 * @remarks
 * - Tauri環境ではIPC経由でHTTPリクエストを送信（自己署名証明書の問題を回避）
 * - リトライ機能付きでAPIリクエストを送信
 * - コンポーネントアンマウント時にリクエストを自動キャンセル
 */
export const ApiTest: React.FC = () => {
  const { id: apiId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showError: showErrorNotification } = useNotifications();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingApiInfo, setLoadingApiInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiInfo, setApiInfo] = useState<{
    endpoint: string;
    apiKey?: string;
    name: string;
    model_name: string;
    timeout_secs?: number | null;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('header.apiList') || 'API一覧', path: '/api/list' },
    ];
    if (apiInfo) {
      items.push(
        { label: apiInfo.name, path: `/api/details/${apiId}` },
        { label: t('apiTest.test') || 'テスト' }
      );
    } else {
      items.push({ label: t('apiTest.title') || 'APIテスト' });
    }
    return items;
  }, [t, apiInfo, apiId]);

  useEffect(() => {
    if (apiId) {
      loadApiInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  // メモリリーク対策: コンポーネントアンマウント時にリクエストをキャンセル
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * API情報を取得
   * API詳細情報とAPIキーを含めて取得
   */
  const loadApiInfo = async () => {
    if (!apiId) {
      setLoadingApiInfo(false);
      setError('API IDが指定されていません');
      return;
    }

    try {
      setLoadingApiInfo(true);
      setError(null);
      const apiDetails = await safeInvoke<{
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        enable_auth: boolean;
        status: string;
        api_key: string | null;
        timeout_secs?: number | null;
        created_at: string;
        updated_at: string;
      }>('get_api_details', { apiId: apiId });

      setApiInfo({
        endpoint: apiDetails.endpoint,
        apiKey: apiDetails.api_key || undefined,
        name: apiDetails.name,
        model_name: apiDetails.model_name,
        timeout_secs: apiDetails.timeout_secs ?? null,
      });
    } catch (err) {
      logger.error('API情報の取得に失敗しました', err, 'ApiTest');
    } finally {
      setLoadingApiInfo(false);
    }
  };

  /**
   * メッセージ送信
   * 入力検証後、APIリクエストを送信し、レスポンスをチャットに追加
   */
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !apiInfo || loading) return;

    const trimmedInput = inputText.trim();
    if (trimmedInput.length === 0) {
      return;
    }

    if (trimmedInput.length > MESSAGE_LIMITS.MAX_LENGTH) {
      showErrorNotification(
        'メッセージが長すぎます',
        `${MESSAGE_LIMITS.MAX_LENGTH.toLocaleString()}文字以下で入力してください。`
      );
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    // 既存のリクエストをキャンセルしてから新しいリクエストを開始
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // タイムアウト設定: API個別設定 > グローバル設定 > デフォルト(30秒)
    let TIMEOUT_MS = 30000;
    if (apiInfo?.timeout_secs) {
      TIMEOUT_MS = apiInfo.timeout_secs * 1000;
    } else {
      try {
        const appSettings = await safeInvoke<{
          default_api_timeout_secs?: number | null;
        }>('get_app_settings');
        TIMEOUT_MS = (appSettings.default_api_timeout_secs ?? 30) * 1000;
      } catch (err) {
        logger.warn('グローバルタイムアウト設定の取得に失敗しました。デフォルト値を使用します。', 'ApiTest', err);
      }
    }
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, TIMEOUT_MS);

    try {
      // エンドポイント文字列から実際のURLを抽出（表示用文字列から最初のURLを取得）
      const actualEndpoint = extractEndpointUrl(apiInfo.endpoint);
      
      // Tauri環境ではIPC経由でHTTPリクエストを送信（自己署名証明書の問題を回避）
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      
      const response = await retry(
        async () => {
          if (isTauri) {
            const ipcResponse = await safeInvoke<{
              status: number;
              headers: Record<string, string>;
              body: string;
            }>('send_http_request', {
              options: {
                url: `${actualEndpoint}${API_ENDPOINTS.CHAT_COMPLETIONS}`,
                method: 'POST',
                headers: {
                  [HTTP_HEADERS.CONTENT_TYPE]: HTTP_HEADERS.CONTENT_TYPE_JSON,
                  ...(apiInfo.apiKey && {
                    [HTTP_HEADERS.AUTHORIZATION]: `${HTTP_HEADERS.AUTHORIZATION_PREFIX}${apiInfo.apiKey}`,
                  }),
                },
                body: JSON.stringify({
                  model: apiInfo.model_name,
                  messages: [
                    ...messages.map(m => ({
                      role: m.role as 'user' | 'assistant' | 'system',
                      content:
                        typeof m.content === 'string' ? m.content : String(m.content),
                    })),
                    { role: 'user' as const, content: userMessage.content },
                  ],
                }),
                timeout_secs: Math.floor(TIMEOUT_MS / 1000),
              },
            });

            if (ipcResponse.status < 200 || ipcResponse.status >= 300) {
              let errorMessage = `APIエラー: ${ipcResponse.status}`;
              try {
                const errorData = JSON.parse(ipcResponse.body);
                if (errorData.error?.message) {
                  errorMessage = errorData.error.message;
                }
              } catch {
                // JSON解析に失敗した場合はステータスコードのみを使用
              }
              throw new Error(errorMessage);
            }

            // Responseオブジェクト互換のインターフェースを返す
            return {
              ok: true,
              status: ipcResponse.status,
              statusText: 'OK',
              json: async () => JSON.parse(ipcResponse.body),
            } as Response;
          } else {
            // ブラウザ環境では通常のfetchを使用
            const fetchResponse = await fetch(
              `${actualEndpoint}${API_ENDPOINTS.CHAT_COMPLETIONS}`,
              {
                method: 'POST',
                headers: {
                  [HTTP_HEADERS.CONTENT_TYPE]: HTTP_HEADERS.CONTENT_TYPE_JSON,
                  ...(apiInfo.apiKey && {
                    [HTTP_HEADERS.AUTHORIZATION]: `${HTTP_HEADERS.AUTHORIZATION_PREFIX}${apiInfo.apiKey}`,
                  }),
                },
                body: JSON.stringify({
                  model: apiInfo.model_name,
                  messages: [
                    ...messages.map(m => ({
                      role: m.role as 'user' | 'assistant' | 'system',
                      content:
                        typeof m.content === 'string' ? m.content : String(m.content),
                    })),
                    { role: 'user' as const, content: userMessage.content },
                  ],
                }),
                signal: controller.signal,
              }
            );

            if (!fetchResponse.ok) {
              throw new Error(`APIエラー: ${fetchResponse.status} ${fetchResponse.statusText}`);
            }

            return fetchResponse;
          }
        },
        {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true,
          shouldRetry: (error) => {
            // タイムアウトや証明書エラーはリトライしない
            if (error instanceof Error && error.name === 'AbortError') {
              return false;
            }
            if (error instanceof TypeError && error.message.includes('CERT_AUTHORITY_INVALID')) {
              return false;
            }
            return isRetryableError(error);
          },
          onRetry: (attempt, maxRetries) => {
            logger.debug(`APIリクエストをリトライ中... (${attempt}/${maxRetries})`, 'ApiTest');
          },
        }
      );

      clearTimeout(timeoutId);

      const data = await response.json();

      // レスポンス構造の検証
      if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error(
          'APIレスポンスが無効です: choicesが空または存在しません'
        );
      }

      const firstChoice = data.choices[0];
      if (
        !firstChoice ||
        !firstChoice.message ||
        typeof firstChoice.message.content !== 'string'
      ) {
        throw new Error(
          'APIレスポンスが無効です: message.contentが存在しません'
        );
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: firstChoice.message.content,
        timestamp: new Date(),
        tokens: data.usage?.total_tokens ?? undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      clearTimeout(timeoutId);
      
      // 証明書エラーの場合は分かりやすいメッセージを表示
      const errorMessageStr = extractErrorMessage(err);
      if (
        errorMessageStr.includes('CERT_AUTHORITY_INVALID') ||
        errorMessageStr.includes('ERR_CERT') ||
        errorMessageStr.includes('certificate') ||
        errorMessageStr.includes('Failed to fetch') ||
        (err instanceof TypeError && errorMessageStr.includes('fetch'))
      ) {
        const errorMessage = '自己署名証明書の検証エラーが発生しました。\n' +
          'これは正常な動作です（FLMは自動生成された自己署名証明書を使用します）。\n' +
          'ブラウザのセキュリティ警告を無視して接続を続行してください。\n' +
          'または、Tauriアプリケーション内でテストを実行してください（証明書検証を自動的にスキップします）。';
        const errorChatMessage: ChatMessage = {
          role: 'assistant',
          content: `エラー: ${errorMessage}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorChatMessage]);
        setError(errorMessage);
        logger.error('証明書検証エラー', err instanceof Error ? err : new Error(extractErrorMessage(err)), 'ApiTest');
        // 証明書エラーは正常な動作（自己署名証明書のため）
        return;
      }
      
      // タイムアウトエラーの処理
      if (err instanceof Error && err.name === 'AbortError') {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: 'エラー: リクエストがタイムアウトしました（30秒以内に応答がありませんでした）',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        showErrorNotification(
          'リクエストがタイムアウトしました',
          '30秒以内に応答がありませんでした。ネットワーク接続を確認してください。'
        );
      } else {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `エラー: ${extractErrorMessage(err, 'APIへのリクエストに失敗しました')}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        
        logger.error(
          'APIリクエストに失敗しました',
          err,
          'ApiTest'
        );
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [inputText, apiInfo, loading, messages, showErrorNotification]);

  /**
   * Enterキーで送信（Shift+Enterで改行）
   */
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (loadingApiInfo) {
    return (
      <div className="api-test-page">
        <div className="api-test-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="api-test-header">
            <SkeletonLoader type="title" width="200px" />
            <SkeletonLoader type="paragraph" count={1} />
          </header>
          <div className="chat-container">
            <SkeletonLoader type="card" count={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-test-page">
      <div className="api-test-container">
        <Breadcrumb items={breadcrumbItems} />
        {error && (
          <ErrorMessage
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {apiInfo && messages.length === 0 && (
          <InfoBanner
            type="info"
            title="LLMテストについて"
            message="この画面でLLMモデルをテストできます。メッセージを入力して送信すると、AIモデルが応答を返します。会話を続けることで、モデルの性能や動作を確認できます。"
            dismissible
          />
        )}

        <header className="api-test-header">
          <div className="header-top">
            <button
              className="back-button"
              onClick={() => navigate('/api/test')}
            >
              ← LLMテストに戻る
            </button>
            <h1>{apiInfo?.name || t('apiTest.title') || 'APIテスト'}</h1>
          </div>
          <div className="api-info-bar">
            <span className="endpoint-label">エンドポイント:</span>
            <code>{apiInfo?.endpoint || '読み込み中...'}</code>
          </div>
        </header>

        {apiInfo && apiId && (
          <LLMTestRunner
            apiId={apiId}
            onTestComplete={(results) => {
              const successCount = results.filter(r => r.success).length;
              logger.info(
                `自動テスト完了: ${successCount}/${results.length} 成功`,
                'ApiTest'
              );
            }}
          />
        )}

        <div className="chat-container">
          <div className="messages-area">
            {messages.length === 0 ? (
              <div className="empty-messages">
                <p>メッセージを入力してLLMモデルをテストしてください</p>
                <p className="empty-hint">
                  例: 「こんにちは」や「PythonでHello Worldを書いて」など
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <div className="message-header">
                    <span className="message-role">
                      {message.role === 'user'
                        ? '👤 あなた'
                        : '🤖 アシスタント'}
                    </span>
                    <span className="message-time">
                      {formatTime(message.timestamp.toISOString(), 'ja-JP', false)}
                    </span>
                    {message.tokens && (
                      <span className="message-tokens">
                        {message.tokens} トークン
                      </span>
                    )}
                  </div>
                  <div className="message-content">{message.content}</div>
                </div>
              ))
            )}
            {loading && (
              <div className="message assistant loading">
                <div className="loading-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </div>

          <div className="input-area">
            <textarea
              className="message-input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('apiTest.messagePlaceholder') || 'メッセージを入力... (Enterで送信、Shift+Enterで改行)'}
              rows={3}
              disabled={loading || !apiInfo}
              aria-label={t('apiTest.messageInput') || 'メッセージ入力欄'}
            />
            <button
              className="send-button"
              onClick={() => {
                startTransition(() => {
                  handleSend();
                });
              }}
              disabled={!inputText.trim() || loading || !apiInfo || isPending}
              aria-label={t('apiTest.sendButton') || 'メッセージを送信'}
            >
              {loading ? (t('apiTest.sending') || '送信中...') : (t('apiTest.send') || '送信')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
