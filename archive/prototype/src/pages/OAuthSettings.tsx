// OAuthSettings - OAuth認証設定ページ
// OAuth 2.0認証の設定と管理

import React, { useState, useTransition, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useI18n } from '../contexts/I18nContext';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './OAuthSettings.css';

/**
 * OAuth設定情報
 */
interface OAuthConfig {
  client_id: string;
  client_secret: string;
  authorization_endpoint: string;
  token_endpoint: string;
  redirect_uri: string;
  scope: string[];
}

/**
 * OAuth認証設定ページ
 */
export const OAuthSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError } = useNotifications();
  const [config, setConfig] = useState<OAuthConfig>({
    client_id: '',
    client_secret: '',
    authorization_endpoint: '',
    token_endpoint: '',
    redirect_uri: 'http://localhost:3000/callback',
    scope: ['read', 'write'],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [authState, setAuthState] = useState('');
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const [savedToken, setSavedToken] = useState<{
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
  } | null>(null);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: t('oauthSettings.title') || 'OAuth認証設定' },
  ], [t]);

  /**
   * OAuth認証フローを開始
   */
  const handleStartOAuthFlow = useCallback(async () => {
    if (!config.client_id || !config.authorization_endpoint) {
      showError('Client IDと認証エンドポイントを入力してください');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const result = await safeInvoke<{
        auth_url: string;
        state: string;
      }>('start_oauth_flow_command', {
        config: {
          client_id: config.client_id,
          client_secret: config.client_secret,
          authorization_endpoint: config.authorization_endpoint,
          token_endpoint: config.token_endpoint,
          redirect_uri: config.redirect_uri,
          scope: config.scope,
        },
      });

      setAuthUrl(result.auth_url);
      setAuthState(result.state); // stateを保存（CSRF対策）
      showSuccess('認証URLを生成しました。ブラウザで開きます');

      // ブラウザで認証URLを開く
      window.open(result.auth_url, '_blank');
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'OAuth認証フローの開始に失敗しました'
      );
    } finally {
      setSaving(false);
    }
  }, [config, showSuccess, showError]);

  /**
   * OAuth認証コードをトークンに交換
   */
  const handleExchangeCode = useCallback(async () => {
    if (!authCode || !authState) {
      showError('認証コードとステートを入力してください');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const token = await safeInvoke<{
        access_token: string;
        refresh_token?: string;
        expires_at?: string;
      }>('exchange_oauth_code', {
        config: {
          client_id: config.client_id,
          client_secret: config.client_secret,
          authorization_endpoint: config.authorization_endpoint,
          token_endpoint: config.token_endpoint,
          redirect_uri: config.redirect_uri,
          scope: config.scope,
        },
        code: authCode,
        state: authState,
      });

      showSuccess('認証が完了しました');
      setSavedToken(token);
      setAuthCode('');
      setAuthState('');
      setAuthUrl(null);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'トークン交換に失敗しました'
      );
    } finally {
      setSaving(false);
    }
  }, [authCode, authState, config, showSuccess, showError]);

  /**
   * スコープを追加
   */
  const handleAddScope = () => {
    const newScope = prompt('新しいスコープを入力してください:');
    if (newScope && newScope.trim()) {
      setConfig({
        ...config,
        scope: [...config.scope, newScope.trim()],
      });
    }
  };

  /**
   * スコープを削除
   */
  const handleRemoveScope = (index: number) => {
    setConfig({
      ...config,
      scope: config.scope.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="oauth-settings-page">
      <div className="oauth-settings-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="oauth-settings-header">
          <button className="back-button" onClick={() => navigate('/settings')}>
            ← 戻る
          </button>
          <h1>OAuth認証設定</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="oauth-settings-content">
          <div className="oauth-info-banner">
            <h2>OAuth 2.0認証機能</h2>
            <p>
              OAuth
              2.0を使用して外部サービスと連携できます。認証フローを開始し、アクセストークンを取得・管理できます。
            </p>
            <ul className="oauth-features-list">
              <li>OAuth 2.0認証フローのサポート</li>
              <li>外部サービス（GitHub、Google等）との連携</li>
              <li>アクセストークン・リフレッシュトークンの管理</li>
              <li>セキュアな認証情報の保存</li>
            </ul>
          </div>

          <div className="oauth-config-section">
            <h2>OAuth設定</h2>

            <div className="form-group">
              <label className="form-label" htmlFor="client-id">
                Client ID <span className="required">*</span>
              </label>
              <input
                id="client-id"
                type="text"
                className="form-input"
                value={config.client_id}
                onChange={e =>
                  setConfig({ ...config, client_id: e.target.value })
                }
                placeholder="OAuth Client IDを入力"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="client-secret">
                Client Secret <span className="required">*</span>
              </label>
              <input
                id="client-secret"
                type="password"
                className="form-input"
                value={config.client_secret}
                onChange={e =>
                  setConfig({ ...config, client_secret: e.target.value })
                }
                placeholder="OAuth Client Secretを入力"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="authorization-endpoint">
                認証エンドポイント <span className="required">*</span>
              </label>
              <input
                id="authorization-endpoint"
                type="url"
                className="form-input"
                value={config.authorization_endpoint}
                onChange={e =>
                  setConfig({
                    ...config,
                    authorization_endpoint: e.target.value,
                  })
                }
                placeholder="https://example.com/oauth/authorize"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="token-endpoint">
                トークンエンドポイント <span className="required">*</span>
              </label>
              <input
                id="token-endpoint"
                type="url"
                className="form-input"
                value={config.token_endpoint}
                onChange={e =>
                  setConfig({ ...config, token_endpoint: e.target.value })
                }
                placeholder="https://example.com/oauth/token"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="redirect-uri">
                リダイレクトURI
              </label>
              <input
                id="redirect-uri"
                type="url"
                className="form-input"
                value={config.redirect_uri}
                onChange={e =>
                  setConfig({ ...config, redirect_uri: e.target.value })
                }
                placeholder="http://localhost:3000/callback"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="oauth-scope">
                スコープ
              </label>
              <div className="scope-list">
                {config.scope.map((scope, index) => (
                  <div key={index} className="scope-item">
                    <span className="scope-name">{scope}</span>
                    <button
                      type="button"
                      className="button-danger-small"
                      onClick={() => {
                        startTransition(() => {
                          handleRemoveScope(index);
                        });
                      }}
                      disabled={saving || isPending}
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={handleAddScope}
                disabled={saving}
              >
                + スコープを追加
              </button>
            </div>

            <div className="oauth-actions">
              <button
                type="button"
                className="button-primary"
                onClick={handleStartOAuthFlow}
                disabled={
                  saving || !config.client_id || !config.authorization_endpoint
                }
              >
                {saving ? '処理中...' : 'OAuth認証を開始'}
              </button>
            </div>

            {authUrl && (
              <div className="oauth-auth-section">
                <h3>認証情報</h3>
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-url">
                    認証URL
                  </label>
                  <input
                    id="auth-url"
                    type="url"
                    className="form-input"
                    value={authUrl}
                    readOnly
                  />
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      if (authUrl) {
                        window.open(authUrl, '_blank');
                      }
                    }}
                  >
                    ブラウザで開く
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="auth-code">
                    認証コード
                  </label>
                  <input
                    id="auth-code"
                    type="text"
                    className="form-input"
                    value={authCode}
                    onChange={e => setAuthCode(e.target.value)}
                    placeholder="認証後に取得したコードを入力"
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="auth-state">
                    ステート
                  </label>
                  <input
                    id="auth-state"
                    type="text"
                    className="form-input"
                    value={authState}
                    onChange={e => setAuthState(e.target.value)}
                    placeholder="認証フローで取得したステートを入力"
                    disabled={saving}
                  />
                </div>

                <div className="oauth-actions">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleExchangeCode}
                    disabled={saving || !authCode || !authState}
                  >
                    {saving ? '処理中...' : 'コードをトークンに交換'}
                  </button>
                </div>
              </div>
            )}

            {savedToken && (
              <div className="oauth-token-section">
                <h3>保存されたトークン</h3>
                <div className="token-info">
                  <div className="token-field">
                    <span className="token-label">アクセストークン:</span>
                    <code className="token-value">
                      {savedToken.access_token.substring(0, 20)}...
                    </code>
                  </div>
                  {savedToken.refresh_token && (
                    <div className="token-field">
                      <span className="token-label">リフレッシュトークン:</span>
                      <code className="token-value">
                        {savedToken.refresh_token.substring(0, 20)}...
                      </code>
                    </div>
                  )}
                  {savedToken.expires_at && (
                    <div className="token-field">
                      <span className="token-label">有効期限:</span>
                      <span>
                        {new Date(savedToken.expires_at).toLocaleString(
                          'ja-JP'
                        )}
                      </span>
                    </div>
                  )}
                </div>
                {savedToken.refresh_token && (
                  <div className="oauth-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={async () => {
                        try {
                          startTransition(() => {
                            setSaving(true);
                            setError(null);
                          });

                          const token = await safeInvoke<{
                            access_token: string;
                            refresh_token?: string;
                            expires_at?: string;
                          }>('refresh_oauth_token', {
                            config: {
                              client_id: config.client_id,
                              client_secret: config.client_secret,
                              authorization_endpoint:
                                config.authorization_endpoint,
                              token_endpoint: config.token_endpoint,
                              redirect_uri: config.redirect_uri,
                              scope: config.scope,
                            },
                            refresh_token: savedToken.refresh_token!,
                          });

                          startTransition(() => {
                            setSavedToken(token);
                          });
                          showSuccess('トークンをリフレッシュしました');
                        } catch (err) {
                          showError(
                            err instanceof Error
                              ? err.message
                              : 'トークンリフレッシュに失敗しました'
                          );
                        } finally {
                          startTransition(() => {
                            setSaving(false);
                          });
                        }
                      }}
                      disabled={saving || !savedToken.refresh_token || isPending}
                    >
                      {saving ? '処理中...' : 'トークンをリフレッシュ'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
