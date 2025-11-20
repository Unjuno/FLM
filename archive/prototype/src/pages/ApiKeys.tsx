// SPDX-License-Identifier: MIT
// ApiKeys - APIキー管理ページ

import React, {
  useState,
  useEffect,
  useTransition,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { API_KEY, DISPLAY_LIMITS, TIMEOUT } from '../constants/config';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { formatDateTime } from '../utils/formatters';
import { logger } from '../utils/logger';
import { isDev } from '../utils/env';
import { extractErrorMessage } from '../utils/errorHandler';
import { useI18n } from '../contexts/I18nContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useIsMounted } from '../hooks/useIsMounted';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { copyToClipboard } from '../utils/clipboard';
import './ApiKeys.css';

/**
 * APIキー情報
 */
interface ApiKeyInfo {
  apiId: string;
  apiName: string;
  apiEndpoint: string;
  apiKey: string | null;
  hasKey: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

/**
 * APIキー管理ページ
 * すべてのAPIとそのAPIキーを一覧表示・管理します
 *
 * @remarks
 * - セキュリティ上の理由で、APIキーは表示時のみ取得
 * - メモリリーク対策として、setTimeoutのクリーンアップを実装
 * - アンマウント後の状態更新を防ぐため、各非同期処理でisMountedチェックを実施
 */
export const ApiKeys: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError: showErrorNotification } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  // メモリリーク対策: setTimeoutのクリーンアップ用
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmVariant?: 'primary' | 'danger';
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    confirmVariant: 'primary',
  });

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('header.settings') || '設定', path: '/settings' },
      { label: t('apiKeys.title') || 'APIキー管理' },
    ],
    [t]
  );

  const isMounted = useIsMounted();

  // メモリリーク対策: コンポーネントアンマウント時にsetTimeoutをクリーンアップ
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  /**
   * APIキー一覧を取得
   * 認証が有効なAPIのみをフィルタリングし、セキュリティ上の理由でAPIキーは別途取得が必要
   */
  const loadApiKeysOperation = useCallback(async (): Promise<ApiKeyInfo[]> => {
    const apis = await safeInvoke<
      Array<{
        id: string;
        name: string;
        endpoint: string;
        enable_auth: boolean;
        created_at: string;
      }>
    >('list_apis');

    return apis
      .filter(api => api.enable_auth)
      .map(api => ({
        apiId: api.id,
        apiName: api.name,
        apiEndpoint: api.endpoint,
        // セキュリティ上の理由で、APIキーは表示時のみ別途取得
        apiKey: null,
        hasKey: true,
        createdAt: api.created_at,
      }));
  }, []);

  const {
    data: apiKeysData,
    loading,
    error,
    execute: loadApiKeys,
    clearError,
  } = useAsyncOperation<ApiKeyInfo[]>(loadApiKeysOperation, {
    autoExecute: true,
    logErrors: true,
    context: 'ApiKeys',
  });

  useEffect(() => {
    if (apiKeysData) {
      setApiKeys(apiKeysData);
    } else {
      setApiKeys([]);
    }
  }, [apiKeysData]);

  /**
   * 特定のAPIキーを取得（表示時のみ）
   * セキュリティ上の理由で、APIキーは必要時のみ取得する
   */
  const loadApiKey = useCallback(
    async (apiId: string) => {
      if (!isMounted()) return null;

      try {
        const key = await safeInvoke<string | null>('get_api_key', {
          api_id: apiId,
        });

        if (!isMounted()) return null;

        return key;
      } catch (err) {
        if (isDev()) {
          logger.error(
            'APIキーの取得に失敗しました',
            err instanceof Error ? err : new Error(extractErrorMessage(err)),
            'ApiKeys'
          );
        }
        return null;
      }
    },
    [isMounted]
  );

  /**
   * APIキーの表示/非表示を切り替え
   * 表示時はAPIキーを取得し、非表示時は表示状態のみを更新
   */
  const toggleKeyVisibility = useCallback(
    async (apiId: string) => {
      if (!isMounted()) return;

      if (visibleKeys.has(apiId)) {
        if (isMounted()) {
          setVisibleKeys(prev => {
            const newSet = new Set(prev);
            newSet.delete(apiId);
            return newSet;
          });
        }
      } else {
        const key = await loadApiKey(apiId);

        if (!isMounted()) return;

        if (key) {
          setApiKeys(prev =>
            prev.map(info =>
              info.apiId === apiId ? { ...info, apiKey: key } : info
            )
          );
          setVisibleKeys(prev => new Set(prev).add(apiId));
        } else {
          showErrorNotification(
            'APIキーの取得に失敗しました',
            'セキュリティ上の理由で、APIキーは作成時のみ表示されます。'
          );
        }
      }
    },
    [visibleKeys, loadApiKey, isMounted, showErrorNotification]
  );

  /**
   * クリップボードにコピー
   * コピー成功後、一定時間後に「コピー済み」表示を自動で解除
   */
  const handleCopyToClipboard = useCallback(
    async (text: string, apiId: string) => {
      if (!isMounted()) return;

      try {
        await copyToClipboard(text);

        if (!isMounted()) return;

        setCopied(apiId);

        // 既存のタイマーをクリアしてから新しいタイマーを設定（メモリリーク対策）
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }

        copyTimeoutRef.current = setTimeout(() => {
          if (!isMounted()) return;
          setCopied(null);
          copyTimeoutRef.current = null;
        }, TIMEOUT.COPY_NOTIFICATION);
      } catch (err) {
        if (!isMounted()) return;
        showErrorNotification(
          'クリップボードへのコピーに失敗しました',
          extractErrorMessage(err)
        );
      }
    },
    [isMounted, showErrorNotification]
  );

  /**
   * APIキーを再生成
   * 現在のAPIキーは無効化され、新しいAPIキーが生成される
   */
  const handleRegenerateKey = useCallback(
    async (apiId: string) => {
      if (!isMounted()) return;

      setConfirmDialog({
        isOpen: true,
        message: 'APIキーを再生成しますか？現在のAPIキーは無効になります。',
        confirmVariant: 'primary',
        onConfirm: async () => {
          if (!isMounted()) return;
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          try {
            const newKey = await safeInvoke<string>('regenerate_api_key', {
              api_id: apiId,
            });

            if (!isMounted()) return;

            if (newKey) {
              setApiKeys(prev =>
                prev.map(info =>
                  info.apiId === apiId ? { ...info, apiKey: newKey } : info
                )
              );
              setVisibleKeys(prev => new Set(prev).add(apiId));
            }

            showSuccess(
              'APIキーを再生成しました',
              '新しいAPIキーは下記に表示されます。安全に保存してください。',
              5000
            );

            await loadApiKeys();
          } catch (err) {
            if (!isMounted()) return;
            const errorMessage = extractErrorMessage(
              err,
              'APIキーの再生成に失敗しました'
            );
            showErrorNotification(
              'APIキーの再生成に失敗しました',
              errorMessage
            );
          }
        },
        onCancel: () => {
          if (isMounted()) {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
        },
      });
    },
    [loadApiKeys, showSuccess, showErrorNotification, isMounted]
  );

  /**
   * APIキーを削除
   * 削除操作は取り消せないため、確認ダイアログを表示
   */
  const handleDeleteKey = useCallback(
    async (apiId: string) => {
      if (!isMounted()) return;

      setConfirmDialog({
        isOpen: true,
        message: 'このAPIキーを削除しますか？この操作は取り消せません。',
        confirmVariant: 'danger',
        onConfirm: async () => {
          if (!isMounted()) return;
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          try {
            await safeInvoke('delete_api_key', { apiId });

            if (!isMounted()) return;

            showSuccess('APIキーを削除しました', '', 3000);

            await loadApiKeys();
          } catch (err) {
            if (!isMounted()) return;
            const errorMessage = extractErrorMessage(
              err,
              'APIキーの削除に失敗しました'
            );
            showErrorNotification('APIキーの削除に失敗しました', errorMessage);
          }
        },
        onCancel: () => {
          if (isMounted()) {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
        },
      });
    },
    [loadApiKeys, showSuccess, showErrorNotification, isMounted]
  );

  /**
   * APIキーを部分的にマスク
   * セキュリティ上の理由で、最初と最後の数文字のみ表示し、中間部分をマスク
   */
  const maskApiKey = (key: string | null): string => {
    if (!key) return '•'.repeat(API_KEY.DEFAULT_LENGTH);
    if (key.length <= DISPLAY_LIMITS.API_KEY_SHORT_LENGTH)
      return '•'.repeat(DISPLAY_LIMITS.API_KEY_SHORT_LENGTH);
    return `${key.substring(0, DISPLAY_LIMITS.API_KEY_VISIBLE_START)}••••••••${key.substring(key.length - DISPLAY_LIMITS.API_KEY_VISIBLE_END)}`;
  };

  if (loading) {
    return (
      <div className="api-keys-page">
        <div className="page-container api-keys-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header">
            <SkeletonLoader type="title" width="200px" />
            <SkeletonLoader type="paragraph" count={1} />
          </header>
          <div className="api-keys-content">
            <SkeletonLoader type="table" count={5} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-keys-page">
      <div className="page-container api-keys-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="page-header api-keys-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← ホームに戻る
          </button>
          <h1>{t('apiKeys.title') || 'APIキー管理'}</h1>
          <button
            className="refresh-button"
            onClick={loadApiKeys}
            aria-label={t('apiKeys.refresh') || '更新'}
          >
            {t('apiKeys.refresh') || '更新'}
          </button>
        </header>

        {error && (
          <ErrorMessage message={error} type="api" onClose={clearError} />
        )}

        <div className="api-keys-content">
          <section className="info-section">
            <h2>APIキーについて</h2>
            <div className="info-box">
              <p>
                APIキーは認証が有効になっているAPIに対して自動的に生成されます。
                セキュリティ上の理由から、APIキーは作成時に一度だけ表示されます。
              </p>
              <p className="warning-text">
                APIキーは秘密にしてください。他人に共有したり、公開の場に投稿しないでください。
              </p>
            </div>
          </section>

          {apiKeys.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"></div>
              <h2>APIキーがありません</h2>
              <p>認証が有効になっているAPIがまだ作成されていません。</p>
              <button
                className="primary-button"
                onClick={() => navigate('/api/create')}
              >
                新しいAPIを作成
              </button>
            </div>
          ) : (
            <section className="keys-section">
              <h2>APIキー一覧</h2>
              <div className="keys-list">
                {apiKeys.map(keyInfo => (
                  <div key={keyInfo.apiId} className="key-card">
                    <div className="key-card-header">
                      <div className="key-info">
                        <h3>{keyInfo.apiName}</h3>
                        <code className="api-endpoint">
                          {keyInfo.apiEndpoint}
                        </code>
                      </div>
                      <div className="key-status">
                        {keyInfo.hasKey ? (
                          <span className="status-badge active">有効</span>
                        ) : (
                          <span className="status-badge inactive">なし</span>
                        )}
                      </div>
                    </div>

                    {keyInfo.hasKey && (
                      <div className="key-card-body">
                        <div className="key-display">
                          <div className="key-value-container">
                            <code
                              className={`key-value ${visibleKeys.has(keyInfo.apiId) ? 'visible' : 'hidden'}`}
                            >
                              {visibleKeys.has(keyInfo.apiId) && keyInfo.apiKey
                                ? keyInfo.apiKey
                                : maskApiKey(keyInfo.apiKey)}
                            </code>
                            <button
                              className="toggle-button"
                              onClick={() => toggleKeyVisibility(keyInfo.apiId)}
                              disabled={
                                !keyInfo.apiKey &&
                                !visibleKeys.has(keyInfo.apiId)
                              }
                            >
                              {visibleKeys.has(keyInfo.apiId)
                                ? '非表示'
                                : '表示'}
                            </button>
                          </div>
                          {visibleKeys.has(keyInfo.apiId) && keyInfo.apiKey && (
                            <button
                              className="copy-button"
                              onClick={() =>
                                handleCopyToClipboard(
                                  keyInfo.apiKey!,
                                  keyInfo.apiId
                                )
                              }
                            >
                              {copied === keyInfo.apiId
                                ? 'コピー済み'
                                : 'コピー'}
                            </button>
                          )}
                        </div>
                        <div className="key-meta">
                          <span className="meta-item">
                            作成日: {formatDateTime(keyInfo.createdAt)}
                          </span>
                          {keyInfo.lastUsedAt && (
                            <span className="meta-item">
                              最終使用: {formatDateTime(keyInfo.lastUsedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="key-card-actions">
                      <button
                        className="action-button"
                        onClick={() =>
                          navigate(`/api/details/${keyInfo.apiId}`)
                        }
                      >
                        詳細を見る
                      </button>
                      <button
                        className="action-button regenerate"
                        onClick={() => {
                          startTransition(() => {
                            handleRegenerateKey(keyInfo.apiId);
                          });
                        }}
                        disabled={isPending}
                      >
                        キーを再生成
                      </button>
                      <button
                        className="action-button danger"
                        onClick={() => {
                          startTransition(() => {
                            handleDeleteKey(keyInfo.apiId);
                          });
                        }}
                        disabled={isPending}
                      >
                        キーを削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        confirmVariant={confirmDialog.confirmVariant || 'primary'}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
