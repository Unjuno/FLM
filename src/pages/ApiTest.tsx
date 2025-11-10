// ApiTest - APIテストページ

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { InfoBanner } from '../components/common/InfoBanner';
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
  } | null>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('header.apiList') || 'API一覧', path: '/api/list' },
    ];
    if (apiInfo) {
      items.push(
        { label: apiInfo.name, path: `/api/details/${apiId}` },
        { label: 'テスト' }
      );
    } else {
      items.push({ label: 'APIテスト' });
    }
    return items;
  }, [t, apiInfo, apiId]);

  useEffect(() => {
    if (apiId) {
      loadApiInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  // コンポーネントのアンマウント時にリクエストをキャンセル
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // API情報を取得
  const loadApiInfo = async () => {
    if (!apiId) {
      setLoadingApiInfo(false);
      setError('API IDが指定されていません');
      return;
    }

    try {
      setLoadingApiInfo(true);
      setError(null);
      // バックエンドのIPCコマンドを呼び出してAPI詳細を取得（APIキーを含む）
      const apiDetails = await safeInvoke<{
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        enable_auth: boolean;
        status: string;
        api_key: string | null;
        created_at: string;
        updated_at: string;
      }>('get_api_details', { apiId: apiId });

      setApiInfo({
        endpoint: apiDetails.endpoint,
        apiKey: apiDetails.api_key || undefined,
        name: apiDetails.name,
        model_name: apiDetails.model_name,
      });
    } catch (err) {
      logger.error('API情報の取得に失敗しました', err, 'ApiTest');
    } finally {
      setLoadingApiInfo(false);
    }
  };

  // メッセージ送信
  const handleSend = async () => {
    if (!inputText.trim() || !apiInfo || loading) return;

    // 入力検証: メッセージ長の制限
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

    // 既存のリクエストをキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 新しいAbortControllerを作成
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // タイムアウト設定（30秒）
    const TIMEOUT_MS = 30000;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, TIMEOUT_MS);

    try {
      // エンドポイント文字列から実際のURLを抽出（「または」を含む表示用文字列から最初のURLを取得）
      const actualEndpoint = extractEndpointUrl(apiInfo.endpoint);
      
      // APIリクエスト送信（リトライ機能付き）
      const response = await retry(
        async () => {
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
                model: apiInfo.model_name, // API作成時に指定されたモデル名を使用
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

          // エラーレスポンスもエラーとして扱う
          if (!fetchResponse.ok) {
            throw new Error(`APIエラー: ${fetchResponse.status} ${fetchResponse.statusText}`);
          }

          return fetchResponse;
        },
        {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true,
          shouldRetry: (error) => {
            // AbortError（タイムアウト）の場合はリトライしない
            if (error instanceof Error && error.name === 'AbortError') {
              return false;
            }
            // その他のエラーはリトライ可能かどうかを判定
            return isRetryableError(error);
          },
          onRetry: (attempt, maxRetries) => {
            logger.debug(`APIリクエストをリトライ中... (${attempt}/${maxRetries})`, 'ApiTest');
          },
        }
      );

      clearTimeout(timeoutId);

      const data = await response.json();

      // レスポンスの構造を安全にチェック
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
      
      // AbortErrorの場合はタイムアウトメッセージを表示
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
        
        // エラーログを記録
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
  };

  // Enterキーで送信
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // タイムスタンプフォーマット
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // API情報読み込み中のスケルトンローディング
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
        {/* 初回ユーザー向けガイダンス */}
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
            <h1>{apiInfo?.name || 'APIテスト'}</h1>
          </div>
          <div className="api-info-bar">
            <span className="endpoint-label">エンドポイント:</span>
            <code>{apiInfo?.endpoint || '読み込み中...'}</code>
          </div>
        </header>

        {/* LLM自動テストランナー */}
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
                      {formatTime(message.timestamp)}
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
              placeholder="メッセージを入力... (Enterで送信、Shift+Enterで改行)"
              rows={3}
              disabled={loading || !apiInfo}
            />
            <button
              className="send-button"
              onClick={() => {
                startTransition(() => {
                  handleSend();
                });
              }}
              disabled={!inputText.trim() || loading || !apiInfo || isPending}
            >
              {loading ? '送信中...' : '送信'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
