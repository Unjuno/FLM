// FLM - APIテストページ
// フロントエンドエージェント (FE) 実装
// F002: API利用機能 - APIテスト画面

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { InfoBanner } from '../components/common/InfoBanner';
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiInfo, setApiInfo] = useState<{
    endpoint: string;
    apiKey?: string;
    name: string;
    model_name: string;
  } | null>(null);

  useEffect(() => {
    if (apiId) {
      loadApiInfo();
    }
  }, [apiId]);

  // API情報を取得
  const loadApiInfo = async () => {
    if (!apiId) return;

    try {
      // バックエンドのIPCコマンドを呼び出してAPI詳細を取得（APIキーを含む）
      const apiDetails = await invoke<{
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
      }>('get_api_details', { api_id: apiId });

      setApiInfo({
        endpoint: apiDetails.endpoint,
        apiKey: apiDetails.api_key || undefined,
        name: apiDetails.name,
        model_name: apiDetails.model_name,
      });
    } catch (err) {
      console.error('API情報の取得に失敗しました:', err);
    }
  };

  // メッセージ送信
  const handleSend = async () => {
    if (!inputText.trim() || !apiInfo || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // APIリクエスト送信
      const response = await fetch(`${apiInfo.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiInfo.apiKey && {
            'Authorization': `Bearer ${apiInfo.apiKey}`,
          }),
        },
        body: JSON.stringify({
          model: apiInfo.model_name, // API作成時に指定されたモデル名を使用
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage.content },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`APIエラー: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.choices[0]?.message?.content || 'レスポンスが空です',
        timestamp: new Date(),
        tokens: data.usage?.total_tokens,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `エラー: ${err instanceof Error ? err.message : 'APIへのリクエストに失敗しました'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
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
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="api-test-page">
      <div className="api-test-container">
        {/* 初回ユーザー向けガイダンス */}
        {apiInfo && messages.length === 0 && (
          <InfoBanner
            type="info"
            title="APIテストについて"
            message="この画面でAPIをテストできます。メッセージを入力して送信すると、AIモデルが応答を返します。"
            dismissible
          />
        )}

        <header className="api-test-header">
          <div className="header-top">
            <button className="back-button" onClick={() => navigate('/api/list')}>
              ← API一覧に戻る
            </button>
            <h1>{apiInfo?.name || 'APIテスト'}</h1>
          </div>
          <div className="api-info-bar">
            <span className="endpoint-label">エンドポイント:</span>
            <code>{apiInfo?.endpoint || '読み込み中...'}</code>
          </div>
        </header>

        <div className="chat-container">
          <div className="messages-area">
            {messages.length === 0 ? (
              <div className="empty-messages">
                <p>メッセージを入力してAPIをテストしてください</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <div className="message-header">
                    <span className="message-role">
                      {message.role === 'user' ? '👤 あなた' : '🤖 アシスタント'}
                    </span>
                    <span className="message-time">{formatTime(message.timestamp)}</span>
                    {message.tokens && (
                      <span className="message-tokens">{message.tokens} トークン</span>
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
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="メッセージを入力... (Enterで送信、Shift+Enterで改行)"
              rows={3}
              disabled={loading || !apiInfo}
            />
            <button
              className="send-button"
              onClick={handleSend}
              disabled={!inputText.trim() || loading || !apiInfo}
            >
              {loading ? '送信中...' : '送信'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
