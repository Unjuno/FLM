// ApiDetails - API詳細ページ

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { generateSampleCode } from '../utils/apiCodeGenerator';
import { SAMPLE_DATA } from '../constants/config';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Tooltip } from '../components/common/Tooltip';
import { useI18n } from '../contexts/I18nContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { ApiInfo } from '../types/api';
import { logger } from '../utils/logger';
import { isDev } from '../utils/env';
import { extractErrorMessage } from '../utils/errorHandler';
import './ApiDetails.css';

/**
 * API詳細情報（ローカル定義）
 */
interface ApiDetailsLocalInfo {
  id: string;
  name: string;
  endpoint: string;
  model_name: string;
  port: number;
  enable_auth: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * API詳細ページ
 * APIの詳細情報、APIキー、サンプルコードを表示します
 */
export const ApiDetails: React.FC = () => {
  const { id: apiId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError: showErrorNotification } = useNotifications();
  const [apiInfo, setApiInfo] = useState<ApiDetailsLocalInfo | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingKey, setLoadingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('header.apiList') || 'API一覧', path: '/api/list' },
    ];
    if (apiInfo) {
      items.push({ label: apiInfo.name });
    } else {
      items.push({ label: 'API詳細' });
    }
    return items;
  }, [t, apiInfo]);

  useEffect(() => {
    if (apiId) {
      loadApiInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  /**
   * API情報を読み込む
   * API IDからAPI一覧を取得し、該当するAPI情報を設定します
   * @throws APIが見つからない場合や取得に失敗した場合にエラーを設定
   */
  const loadApiInfo = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // API一覧から該当APIを取得
      const apis = await safeInvoke<ApiDetailsLocalInfo[]>('list_apis');
      const api = apis.find((a: ApiDetailsLocalInfo) => a.id === apiId);

      if (!api) {
        setError('APIが見つかりませんでした');
        return;
      }

      // データ構造を変換
      setApiInfo({
        id: api.id,
        name: api.name,
        endpoint: api.endpoint,
        model_name: api.model_name,
        port: api.port,
        enable_auth: api.enable_auth,
        status: api.status,
        created_at: api.created_at,
        updated_at: api.updated_at,
      });
    } catch (err) {
      setError(
        extractErrorMessage(err, 'API情報の取得に失敗しました')
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * APIキーを読み込む
   * 認証が有効なAPIの場合のみAPIキーを取得します
   * @throws APIキーの取得に失敗した場合にエラーを設定
   */
  const loadApiKey = async (): Promise<void> => {
    if (!apiId || !apiInfo?.enable_auth) {
      return;
    }

    try {
      setLoadingKey(true);
      setError(null);

      // バックエンドのget_api_keyコマンドを呼び出し
      if (apiInfo.enable_auth) {
        try {
          const key = await safeInvoke<string | null>('get_api_key', {
            api_id: apiId,
          });
          setApiKey(key || '***（APIキーが見つかりませんでした）***');
        } catch (err) {
          if (isDev()) {
            logger.error(
              'APIキーの取得に失敗しました',
              err instanceof Error ? err : new Error(extractErrorMessage(err)),
              'ApiDetails'
            );
          }
          setApiKey('***（セキュリティ保護のため表示できません）***');
        }
      } else {
        setApiKey(null);
      }
    } catch (err) {
      setError(
        extractErrorMessage(err, 'APIキーの取得に失敗しました')
      );
    } finally {
      setLoadingKey(false);
    }
  };

  /**
   * テキストをクリップボードにコピー
   * @param text コピーするテキスト
   * @throws クリップボードへのアクセスが失敗した場合にアラートを表示
   */
  const handleCopy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccess('クリップボードにコピーしました', '', 3000);
    } catch (err) {
      showErrorNotification('コピーに失敗しました', extractErrorMessage(err, 'クリップボードへのアクセスに失敗しました'));
    }
  };

  /**
   * API呼び出し用のサンプルコードを生成
   * @param language 生成する言語（'curl' | 'python' | 'javascript'）
   * @returns サンプルコード文字列（apiInfoが存在しない場合は空文字列）
   */
  const getSampleCode = (
    language: 'curl' | 'python' | 'javascript'
  ): string => {
    if (!apiInfo) return '';

    // apiCodeGeneratorを使用してサンプルコードを生成
    const apiInfoForGenerator: ApiInfo = {
      id: apiInfo.id,
      name: apiInfo.name,
      endpoint: apiInfo.endpoint,
      port: apiInfo.port,
      status: apiInfo.status === 'running' ? 'running' : 'stopped',
      model_name: apiInfo.model_name,
      created_at: apiInfo.created_at,
      updated_at: apiInfo.updated_at,
    };

    return generateSampleCode(language, {
      apiInfo: apiInfoForGenerator,
      apiKey: apiInfo.enable_auth ? apiKey || undefined : undefined,
      sampleMessage: SAMPLE_DATA.MESSAGE,
    });
  };

  if (loading) {
    return (
      <div className="api-details-page">
        <div className="page-container api-details-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header api-details-header">
            <div className="header-content">
              <div>
                <SkeletonLoader type="title" width="200px" />
                <SkeletonLoader type="text" width="150px" />
              </div>
            </div>
          </header>
          <div className="api-details-content">
            <SkeletonLoader type="card" />
            <SkeletonLoader type="card" />
            <SkeletonLoader type="card" />
          </div>
        </div>
      </div>
    );
  }

  if (!apiInfo || error) {
    return (
      <div className="api-details-page">
        <div className="page-container api-details-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header api-details-header">
            <div className="header-content">
              <div>
                <h1>API詳細</h1>
              </div>
            </div>
          </header>
          <div className="api-details-content">
            <ErrorMessage
              message={error || 'APIが見つかりません'}
              type="api"
              onClose={() => navigate('/api/list')}
              onRetry={() => apiId && loadApiInfo()}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-details-page">
      <div className="page-container api-details-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="page-header api-details-header">
          <div className="header-content">
            <div>
              <h1>{apiInfo.name}</h1>
              <p className="api-subtitle">API詳細情報</p>
            </div>
            <div className="header-actions">
              <button onClick={() => navigate('/api/list')}>← API一覧</button>
              <button onClick={() => navigate(`/api/test/${apiId}`)}>
                テスト
              </button>
            </div>
          </div>
        </header>

        <div className="api-details-content">
          {/* 基本情報セクション */}
          <section className="details-section">
            <h2>基本情報</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">API名</span>
                <span className="info-value">{apiInfo.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">モデル</span>
                <span className="info-value">{apiInfo.model_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">ポート</span>
                <span className="info-value">{apiInfo.port}</span>
              </div>
              <div className="info-item">
                <span className="info-label">ステータス</span>
                <span className={`info-value status ${apiInfo.status}`}>
                  {apiInfo.status === 'running'
                    ? '実行中'
                    : apiInfo.status === 'stopped'
                      ? '停止中'
                      : 'エラー'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">認証</span>
                <span className="info-value">
                  {apiInfo.enable_auth ? '有効' : '無効'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">作成日</span>
                <span className="info-value">
                  {new Date(apiInfo.created_at).toLocaleString('ja-JP')}
                </span>
              </div>
            </div>
          </section>

          {/* エンドポイントセクション */}
          <section className="details-section">
            <h2>
              <Tooltip
                content="APIの接続先URLです。外部アプリケーションからこのURLにアクセスしてAPIを使用できます。"
                title="エンドポイントとは？"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  エンドポイント
                  <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>❓</span>
                </span>
              </Tooltip>
            </h2>
            <div className="endpoint-display">
              <code className="endpoint-url">{apiInfo.endpoint}</code>
              <button
                className="copy-button"
                onClick={() => {
                  startTransition(() => {
                    handleCopy(apiInfo.endpoint);
                  });
                }}
              >
                コピー
              </button>
            </div>
          </section>

          {/* APIキーセクション */}
          {apiInfo.enable_auth && (
            <section className="details-section">
              <h2>
                <Tooltip
                  content="APIを安全に使用するための認証キーです。外部アプリケーションからAPIを使用する際に必要です。このキーは秘密にしてください。"
                  title="APIキーとは？"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    APIキー
                    <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>❓</span>
                  </span>
                </Tooltip>
              </h2>
              <div className="api-key-display">
                {loadingKey ? (
                  <div className="loading-key">
                    <div className="spinner small"></div>
                    <span>APIキーを読み込んでいます...</span>
                  </div>
                ) : apiKey ? (
                  <>
                    <code
                      className={`api-key-value ${showApiKey ? 'visible' : 'hidden'}`}
                    >
                      {showApiKey ? apiKey : '••••••••••••••••••••••••••••••••'}
                    </code>
                    <div className="api-key-actions">
                      <button
                        className="toggle-button"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? '非表示' : '表示'}
                      </button>
                      <button
                        className="copy-button"
                        onClick={() => {
                          startTransition(() => {
                            handleCopy(showApiKey ? apiKey : '');
                          });
                        }}
                        disabled={!showApiKey}
                      >
                        コピー
                      </button>
                    </div>
                  </>
                ) : (
                  <button className="load-key-button" onClick={loadApiKey}>
                    APIキーを読み込む
                  </button>
                )}
              </div>
              <p className="api-key-warning">
                APIキーは秘密情報です。他人と共有しないでください。
              </p>
            </section>
          )}

          {/* サンプルコードセクション */}
          <section className="details-section">
            <h2>サンプルコード</h2>
            <div className="sample-code-tabs">
              {(['curl', 'python', 'javascript'] as const).map(lang => (
                <div key={lang} className="code-example">
                  <div className="code-header">
                    <span className="code-language">{lang}</span>
                    <button
                      className="copy-button"
                      onClick={() => {
                        startTransition(() => {
                          handleCopy(getSampleCode(lang));
                        });
                      }}
                    >
                      コピー
                    </button>
                  </div>
                  <pre className="code-block">
                    <code>{getSampleCode(lang)}</code>
                  </pre>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
