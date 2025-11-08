// ApiKeys - APIキー管理ページ

import React, { useState, useEffect, useTransition, useMemo, useRef, useCallback } from 'react';
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
 */
export const ApiKeys: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError: showErrorNotification } = useNotifications();
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const [error, setError] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  
  // メモリリーク対策: コンポーネントのマウント状態を追跡（アンマウント後の状態更新を防ぐ）
  const isMountedRef = useRef(true);
  
  // メモリリーク対策: setTimeoutのクリーンアップ用
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 確認ダイアログの状態（共通コンポーネントを使用）
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

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: 'APIキー管理' },
  ], [t]);

  // コンポーネントのアンマウント時にフラグを更新
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // setTimeoutのクリーンアップ
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  // ESCキーでのダイアログ閉じる処理はConfirmDialogコンポーネント内で処理

  // APIキー一覧を取得（useCallbackでメモ化してパフォーマンス最適化）
  const loadApiKeys = useCallback(async () => {
    // アンマウントチェック
    if (!isMountedRef.current) return;
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      // バックエンドのIPCコマンドを呼び出し
      // list_apisコマンドでAPI一覧を取得し、認証が有効なAPIに対して
      // 必要に応じてget_api_keyコマンドで個別にAPIキーを取得します
      const apis = await safeInvoke<
        Array<{
          id: string;
          name: string;
          endpoint: string;
          enable_auth: boolean;
          created_at: string;
        }>
      >('list_apis');

      // アンマウントチェック
      if (!isMountedRef.current) return;

      const apiKeyInfos: ApiKeyInfo[] = apis
        .filter(api => api.enable_auth)
        .map(api => ({
          apiId: api.id,
          apiName: api.name,
          apiEndpoint: api.endpoint,
          apiKey: null, // セキュリティ上の理由で、APIキーは別途取得コマンドが必要
          hasKey: true, // enable_authがtrueの場合はAPIキーが存在すると仮定
          createdAt: api.created_at,
        }));

      if (isMountedRef.current) {
        setApiKeys(apiKeyInfos);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(extractErrorMessage(err, 'APIキー一覧の取得に失敗しました'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // 特定のAPIキーを取得（表示時のみ）（useCallbackでメモ化）
  const loadApiKey = useCallback(async (apiId: string) => {
    // アンマウントチェック
    if (!isMountedRef.current) return null;
    
    try {
      // バックエンドのget_api_keyコマンドを呼び出し
      const key = await safeInvoke<string | null>('get_api_key', {
        api_id: apiId,
      });
      
      // アンマウントチェック
      if (!isMountedRef.current) return null;
      
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
  }, []);

  // APIキーの表示/非表示を切り替え（useCallbackでメモ化）
  const toggleKeyVisibility = useCallback(async (apiId: string) => {
    // アンマウントチェック
    if (!isMountedRef.current) return;
    
    if (visibleKeys.has(apiId)) {
      if (isMountedRef.current) {
        setVisibleKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(apiId);
          return newSet;
        });
      }
    } else {
      // 表示する場合、APIキーを取得
      const key = await loadApiKey(apiId);
      
      // アンマウントチェック
      if (!isMountedRef.current) return;
      
      if (key) {
        setApiKeys(prev =>
          prev.map(info =>
            info.apiId === apiId ? { ...info, apiKey: key } : info
          )
        );
        setVisibleKeys(prev => new Set(prev).add(apiId));
      } else {
        setError(
          'APIキーの取得に失敗しました。セキュリティ上の理由で、APIキーは作成時のみ表示されます。'
        );
      }
    }
  }, [visibleKeys, loadApiKey]);

  // クリップボードにコピー（useCallbackでメモ化、setTimeoutのクリーンアップ実装）
  const copyToClipboard = useCallback(async (text: string, apiId: string) => {
    // アンマウントチェック
    if (!isMountedRef.current) return;
    
    try {
      await navigator.clipboard.writeText(text);
      
      // アンマウントチェック
      if (!isMountedRef.current) return;
      
      setCopied(apiId);
      
      // 既存のタイマーをクリア
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      
      copyTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setCopied(null);
        copyTimeoutRef.current = null;
      }, TIMEOUT.COPY_NOTIFICATION);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError('クリップボードへのコピーに失敗しました');
    }
  }, []);

  // APIキーを再生成
  const handleRegenerateKey = useCallback(async (apiId: string) => {
    // アンマウントチェック
    if (!isMountedRef.current) return;
    
    // 確認ダイアログを表示（共通コンポーネントを使用）
    setConfirmDialog({
      isOpen: true,
      message: 'APIキーを再生成しますか？現在のAPIキーは無効になります。',
      confirmVariant: 'primary',
      onConfirm: async () => {
        if (!isMountedRef.current) return;
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          if (isMountedRef.current) {
            setError(null);
          }

          // バックエンドのregenerate_api_keyコマンドを呼び出し
          const newKey = await safeInvoke<string>('regenerate_api_key', { api_id: apiId });

          // アンマウントチェック
          if (!isMountedRef.current) return;

          // 新しいAPIキーを取得して表示
          if (newKey) {
            setApiKeys(prev =>
              prev.map(info =>
                info.apiId === apiId ? { ...info, apiKey: newKey } : info
              )
            );
            setVisibleKeys(prev => new Set(prev).add(apiId));
          }

          // 通知を表示
          showSuccess(
            'APIキーを再生成しました',
            '新しいAPIキーは下記に表示されます。安全に保存してください。',
            5000
          );

          // 一覧を更新
          await loadApiKeys();
          if (isMountedRef.current) {
            setError(null);
          }
        } catch (err) {
          if (!isMountedRef.current) return;
          const errorMessage = extractErrorMessage(err, 'APIキーの再生成に失敗しました');
          setError(errorMessage);
          showErrorNotification('APIキーの再生成に失敗しました', errorMessage);
        }
      },
      onCancel: () => {
        if (isMountedRef.current) {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  }, [loadApiKeys, showSuccess, showErrorNotification]);

  // APIキーを削除
  const handleDeleteKey = useCallback(async (apiId: string) => {
    // アンマウントチェック
    if (!isMountedRef.current) return;
    
    // 確認ダイアログを表示（共通コンポーネントを使用）
    setConfirmDialog({
      isOpen: true,
      message: 'このAPIキーを削除しますか？この操作は取り消せません。',
      confirmVariant: 'danger',
      onConfirm: async () => {
        if (!isMountedRef.current) return;
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          if (isMountedRef.current) {
            setError(null);
          }

          // バックエンドのdelete_api_keyコマンドを呼び出し
          await safeInvoke('delete_api_key', { api_id: apiId });

          // アンマウントチェック
          if (!isMountedRef.current) return;

          // 通知を表示
          showSuccess('APIキーを削除しました', '', 3000);

          // 一覧を更新
          await loadApiKeys();
        } catch (err) {
          if (!isMountedRef.current) return;
          const errorMessage = extractErrorMessage(err, 'APIキーの削除に失敗しました');
          setError(errorMessage);
          showErrorNotification('APIキーの削除に失敗しました', errorMessage);
        }
      },
      onCancel: () => {
        if (isMountedRef.current) {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  }, [loadApiKeys, showSuccess, showErrorNotification]);

  // formatDateTimeはutils/formattersからインポート

  // APIキーを部分的にマスク
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
          <h1>APIキー管理</h1>
          <button className="refresh-button" onClick={loadApiKeys}>
            更新
          </button>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
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
                                copyToClipboard(keyInfo.apiKey!, keyInfo.apiId)
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

      {/* 確認ダイアログ（共通コンポーネントを使用） */}
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
