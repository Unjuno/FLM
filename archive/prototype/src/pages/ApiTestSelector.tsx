// ApiTestSelector - APIテスト選択ページ
// 作成済みのAPIから選択してテストを開始

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Tooltip } from '../components/common/Tooltip';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import './ApiTestSelector.css';

/**
 * API情報（簡易版）
 */
interface ApiInfoSimple {
  id: string;
  name: string;
  model_name: string;
  port: number;
  status: 'running' | 'stopped' | 'error';
  endpoint: string;
}

/**
 * APIテスト選択ページ
 * 作成済みのAPIから選択してテストを開始します
 */
export const ApiTestSelector: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // API一覧を取得する非同期操作
  const loadApisOperation = useCallback(async (): Promise<ApiInfoSimple[]> => {
    const result = await safeInvoke<
      Array<{
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        enable_auth: boolean;
        status: string;
        created_at: string;
        updated_at: string;
      }>
    >('list_apis');

    return result.map(api => ({
      id: api.id,
      name: api.name,
      model_name: api.model_name,
      port: api.port,
      status: (api.status === 'running'
        ? 'running'
        : api.status === 'stopped'
          ? 'stopped'
          : 'error') as 'running' | 'stopped' | 'error',
      endpoint: api.endpoint,
    }));
  }, []);

  // 非同期操作フックを使用
  const {
    data: apisData,
    loading,
    error,
    execute: loadApis,
    clearError,
  } = useAsyncOperation<ApiInfoSimple[]>(loadApisOperation, {
    autoExecute: true,
    logErrors: true,
    context: 'ApiTestSelector',
  });

  // APIデータ（デフォルトは空配列）
  const apis = useMemo(() => apisData || [], [apisData]);

  useEffect(() => {
    loadApis();

    // ステータスを定期的に更新
    const interval = setInterval(() => {
      loadApis();
    }, 5000); // 5秒ごとに更新

    return () => clearInterval(interval);
  }, [loadApis]);

  // フィルタリングされたAPI一覧
  const filteredApis = apis.filter(api => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      api.name.toLowerCase().includes(query) ||
      api.model_name.toLowerCase().includes(query) ||
      api.endpoint.toLowerCase().includes(query)
    );
  });

  // APIを選択してテストページに遷移
  const handleSelectApi = (apiId: string) => {
    navigate(`/api/test/${apiId}`);
  };

  // ステータス表示用のアイコンと色
  const getStatusDisplay = (status: ApiInfoSimple['status']) => {
    switch (status) {
      case 'running':
        return {
          icon: '🟢',
          label: t('apiTestSelector.status.running'),
          className: 'status-running',
        };
      case 'stopped':
        return {
          icon: '⚫',
          label: t('apiTestSelector.status.stopped'),
          className: 'status-stopped',
        };
      case 'error':
        return {
          icon: '🔴',
          label: t('apiTestSelector.status.error'),
          className: 'status-error',
        };
      default:
        return {
          icon: '⚪',
          label: t('apiTestSelector.status.unknown'),
          className: 'status-unknown',
        };
    }
  };

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('apiTestSelector.title') || 'APIテスト選択' },
    ],
    [t]
  );

  if (loading) {
    return (
      <div className="api-test-selector-page">
        <div className="api-test-selector-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header">
            <SkeletonLoader type="title" width="200px" />
            <SkeletonLoader type="paragraph" count={1} />
          </header>
          <div className="search-section">
            <SkeletonLoader type="text" width="100%" height="40px" />
          </div>
          <div className="api-list-container">
            <SkeletonLoader type="api-list" count={5} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-test-selector-page">
      <div className="api-test-selector-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="page-header">
          <h1>{t('apiTestSelector.title')}</h1>
          <p className="page-description">{t('apiTestSelector.description')}</p>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={clearError}
            onRetry={loadApis}
          />
        )}

        {/* 検索バー */}
        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder={t('apiTestSelector.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="clear-search-button"
              onClick={() => setSearchQuery('')}
              aria-label={t('apiTestSelector.clearSearch')}
            >
              ✕
            </button>
          )}
        </div>

        {/* API一覧 */}
        {filteredApis.length === 0 ? (
          <div className="empty-state">
            {apis.length === 0 ? (
              <>
                <div className="empty-icon"></div>
                <h2>{t('apiTestSelector.empty.noApis.title')}</h2>
                <p>{t('apiTestSelector.empty.noApis.message')}</p>
                <button
                  className="create-api-button"
                  onClick={() => navigate('/api/create')}
                >
                  {t('apiTestSelector.empty.noApis.createButton')}
                </button>
              </>
            ) : (
              <>
                <div className="empty-icon"></div>
                <h2>{t('apiTestSelector.empty.noSearchResults.title')}</h2>
                <p>{t('apiTestSelector.empty.noSearchResults.message')}</p>
                <button
                  className="clear-search-button-large"
                  onClick={() => setSearchQuery('')}
                >
                  {t('apiTestSelector.empty.noSearchResults.clearButton')}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="api-grid">
            {filteredApis.map(api => {
              const statusDisplay = getStatusDisplay(api.status);
              return (
                <div
                  key={api.id}
                  className={`api-card ${api.status === 'running' ? 'available' : 'unavailable'}`}
                  onClick={() => {
                    if (api.status === 'running') {
                      handleSelectApi(api.id);
                    }
                  }}
                  onKeyDown={e => {
                    if (
                      (e.key === 'Enter' || e.key === ' ') &&
                      api.status === 'running'
                    ) {
                      e.preventDefault();
                      handleSelectApi(api.id);
                    }
                  }}
                  role="button"
                  tabIndex={api.status === 'running' ? 0 : -1}
                  aria-label={`${api.name}をテストする`}
                >
                  <div className="api-card-header">
                    <h3 className="api-name">{api.name}</h3>
                    <span className={`status-badge ${statusDisplay.className}`}>
                      {statusDisplay.icon} {statusDisplay.label}
                    </span>
                  </div>

                  <div className="api-card-body">
                    <div className="api-info-row">
                      <span className="info-label">モデル:</span>
                      <span className="info-value">{api.model_name}</span>
                    </div>
                    <div className="api-info-row">
                      <span className="info-label">エンドポイント:</span>
                      <code className="info-value endpoint-code">
                        {api.endpoint}
                      </code>
                    </div>
                    <div className="api-info-row">
                      <span className="info-label">ポート:</span>
                      <span className="info-value">{api.port}</span>
                    </div>
                  </div>

                  <div className="api-card-footer">
                    {api.status === 'running' ? (
                      <button
                        className="test-button"
                        onClick={e => {
                          e.stopPropagation();
                          handleSelectApi(api.id);
                        }}
                      >
                        テストを開始
                      </button>
                    ) : (
                      <div className="unavailable-message">
                        {api.status === 'stopped' ? (
                          <>
                            <span>APIが停止中です</span>
                            <Tooltip content="API一覧ページでAPIを起動してから、テストを実行してください。">
                              <button
                                className="goto-list-button"
                                onClick={e => {
                                  e.stopPropagation();
                                  navigate('/api/list');
                                }}
                              >
                                API一覧へ
                              </button>
                            </Tooltip>
                          </>
                        ) : (
                          <span>APIにエラーがあります</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ヘルプセクション */}
        <div className="help-section">
          <h3>使い方</h3>
          <ol>
            <li>実行中のAPIを選択して「テストを開始」をクリック</li>
            <li>チャット画面でメッセージを入力して送信</li>
            <li>AIモデルの応答を確認して、APIの動作をテスト</li>
          </ol>
          <p className="help-note">
            <strong>注意:</strong>{' '}
            テストを実行するには、APIが起動している必要があります。
            停止中のAPIは、API一覧ページから起動してください。
          </p>
        </div>
      </div>
    </div>
  );
};
