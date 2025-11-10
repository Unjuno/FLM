// ApiList - API一覧ページ

import React, { useState, useEffect, useCallback, useRef, useTransition, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AppLayout } from '../components/layout/AppLayout';
import { safeInvoke, clearInvokeCache } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { SettingsExport } from '../components/api/SettingsExport';
import { Tooltip } from '../components/common/Tooltip';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import type { ApiInfo as BaseApiInfo } from '../types/api';
import { REFRESH_INTERVALS } from '../constants/config';
import { logger } from '../utils/logger';
import { extractErrorMessage } from '../utils/errorHandler';
import './ApiList.css';

/**
 * API情報（拡張版 - errorステータスを含む）
 */
interface ApiInfoExtended extends Omit<BaseApiInfo, 'status'> {
  status: 'running' | 'stopped' | 'error';
}

/**
 * API一覧ページ
 * 作成済みのAPIを表示・管理します
 */
export const ApiList: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [apis, setApis] = useState<ApiInfoExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const [error, setError] = useState<string | null>(null);
  const [selectedApiIds, setSelectedApiIds] = useState<Set<string>>(new Set());
  // 確認ダイアログの状態
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });
  
  // コンポーネントのマウント状態を追跡（アンマウント後の状態更新を防ぐ）
  const isMountedRef = useRef(true);
  
  // 仮想スクロール用のref
  const parentRef = useRef<HTMLDivElement | null>(null);
  
  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // ESCキーで確認ダイアログを閉じる
  useEffect(() => {
    if (!confirmDialog.isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [confirmDialog.isOpen]);

  // コンポーネントのアンマウント時にフラグを更新
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // API一覧を取得（useCallbackでメモ化してパフォーマンス最適化）
  const loadApis = useCallback(async () => {
    // アンマウントチェック
    if (!isMountedRef.current) return;
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      // バックエンドのIPCコマンドを呼び出し
      const result = await safeInvoke<Array<{
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        enable_auth: boolean;
        status: string;
        created_at: string;
        updated_at: string;
      }>>('list_apis');

      // 結果が配列でない場合の処理
      if (!Array.isArray(result)) {
        logger.warn('list_apisの結果が配列ではありません', 'ApiList');
        if (isMountedRef.current) {
          setApis([]);
        }
        return;
      }

      // レスポンスをApiInfo形式に変換
      const apiInfos: ApiInfoExtended[] = result.map(api => ({
        id: api.id,
        name: api.name,
        model_name: api.model_name,
        port: api.port,
        status: (api.status === 'running' ? 'running' : 
                 api.status === 'stopped' ? 'stopped' : 'error') as 'running' | 'stopped' | 'error',
        endpoint: api.endpoint,
        created_at: api.created_at,
        updated_at: api.updated_at,
      }));

      // アンマウントチェック
      if (isMountedRef.current) {
        setApis(apiInfos);
      }
    } catch (err) {
      const errorMessage = extractErrorMessage(err, t('apiList.messages.loadError'));
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      logger.error(t('apiList.messages.loadError'), err instanceof Error ? err : new Error(extractErrorMessage(err)), 'ApiList');
    } finally {
      // アンマウントチェック
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    loadApis();
    
    // ステータスを定期的に更新
    const interval = setInterval(() => {
      // ページが非表示の場合は更新をスキップ
      if (!document.hidden) {
        loadApis();
      }
    }, REFRESH_INTERVALS.API_LIST);

    return () => clearInterval(interval);
  }, [loadApis]);

  // ページが非表示の場合は自動更新を停止
  useEffect(() => {
    const handleVisibilityChange = () => {
      // ページが表示された時に一度更新
      if (!document.hidden) {
        loadApis();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadApis]);

  // APIの起動/停止（useCallbackでメモ化）
  const handleToggleStatus = useCallback(async (apiId: string, currentStatus: 'running' | 'stopped' | 'error') => {
    // アンマウントチェック
    if (!isMountedRef.current) return;
    
    try {
      if (isMountedRef.current) {
        setError(null);
      }
      
      // バックエンドのIPCコマンドを呼び出し
      if (currentStatus === 'running') {
        await safeInvoke('stop_api', { apiId });
      } else {
        await safeInvoke('start_api', { apiId });
      }
      
      // キャッシュをクリアして最新データを取得
      clearInvokeCache('list_apis');
      
      // アンマウントチェック
      if (!isMountedRef.current) return;
      
      // 一覧を再読み込み
      await loadApis();
    } catch (err) {
      const errorMessage = extractErrorMessage(err, t('apiList.messages.statusChangeError'));
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      logger.error(t('apiList.messages.statusChangeError'), err instanceof Error ? err : new Error(extractErrorMessage(err)), 'ApiList');
    }
  }, [loadApis, t]);

  // APIの削除（useCallbackでメモ化）
  const handleDelete = useCallback(async (apiId: string, apiName: string, modelName?: string) => {
    // アンマウントチェック
    if (!isMountedRef.current) return;
    
    // モデル削除オプションを含む確認メッセージ
    let confirmMessage = t('apiList.messages.deleteConfirm', { name: apiName });
    
    if (modelName) {
      confirmMessage += t('apiList.messages.deleteModelConfirm', { modelName });
    }
    
    // 最初の確認ダイアログを表示
    setConfirmDialog({
      isOpen: true,
      message: confirmMessage,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        // モデル削除オプションを確認（2回目の確認ダイアログ）
        if (modelName) {
          setConfirmDialog({
            isOpen: true,
            message: t('apiList.messages.deleteModelQuestion', { modelName }),
            onConfirm: async () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              
              // アンマウントチェック
              if (!isMountedRef.current) return;

              try {
                if (isMountedRef.current) {
                  setError(null);
                }
                
                // バックエンドIPCコマンドを呼び出し（モデル削除オプションを含む）
                await safeInvoke('delete_api', { 
                  apiId,
                });
                
                // キャッシュをクリアして最新データを取得
                clearInvokeCache('list_apis');
                
                // アンマウントチェック
                if (!isMountedRef.current) return;
                
                // 一覧を再読み込み
                await loadApis();
              } catch (err) {
                const errorMessage = extractErrorMessage(err, t('apiList.messages.deleteError'));
                if (isMountedRef.current) {
                  setError(errorMessage);
                }
                logger.error(t('apiList.messages.deleteError'), err instanceof Error ? err : new Error(extractErrorMessage(err)), 'ApiList');
              }
            },
            onCancel: () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              
              // モデル削除なしで削除を実行
              (async () => {
                if (!isMountedRef.current) return;

                try {
                  if (isMountedRef.current) {
                    setError(null);
                  }
                  
                  await safeInvoke('delete_api', { 
                    apiId,
                  });
                  
                  clearInvokeCache('list_apis');
                  
                  if (!isMountedRef.current) return;
                  
                  await loadApis();
                } catch (err) {
                  const errorMessage = extractErrorMessage(err, t('apiList.messages.deleteError'));
                  if (isMountedRef.current) {
                    setError(errorMessage);
                  }
                  logger.error(t('apiList.messages.deleteError'), err instanceof Error ? err : new Error(extractErrorMessage(err)), 'ApiList');
                }
              })();
            },
          });
        } else {
          // モデル削除オプションがない場合、直接削除
          (async () => {
            // アンマウントチェック
            if (!isMountedRef.current) return;

            try {
              if (isMountedRef.current) {
                setError(null);
              }
              
              await safeInvoke('delete_api', { 
                apiId,
              });
              
              clearInvokeCache('list_apis');
              
              if (!isMountedRef.current) return;
              
              await loadApis();
            } catch (err) {
              const errorMessage = extractErrorMessage(err, t('apiList.messages.deleteError'));
              if (isMountedRef.current) {
                setError(errorMessage);
              }
              logger.error(t('apiList.messages.deleteError'), err instanceof Error ? err : new Error(extractErrorMessage(err)), 'ApiList');
            }
          })();
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [loadApis, t]);

  // API選択のトグル
  const handleToggleSelection = useCallback((apiId: string) => {
    setSelectedApiIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(apiId)) {
        newSet.delete(apiId);
      } else {
        newSet.add(apiId);
      }
      return newSet;
    });
  }, []);

  // 全選択/全解除
  const handleSelectAll = useCallback(() => {
    setSelectedApiIds(prev => {
      // 現在のapisの長さを取得（最新の状態を参照）
      const currentApisLength = apis.length;
      if (prev.size === currentApisLength && currentApisLength > 0) {
        return new Set();
      } else {
        return new Set(apis.map(api => api.id));
      }
    });
  }, [apis]);

  // インポート完了時のコールバック（useCallbackでメモ化）
  const handleImportComplete = useCallback((result: {
    imported: number;
    skipped: number;
    renamed: number;
    errors: string[];
  }) => {
    // アンマウントチェック
    if (!isMountedRef.current) return;
    
    // インポート完了後、API一覧を再読み込み
    loadApis();
    // 選択をクリア
    if (isMountedRef.current) {
      setSelectedApiIds(new Set());
    }
    logger.info(t('apiList.messages.importComplete', { imported: result.imported, skipped: result.skipped, renamed: result.renamed }), 'ApiList');
  }, [loadApis, t]);

  // ステータステキストを取得（useCallbackでメモ化してパフォーマンス最適化）
  const getStatusText = useCallback((status: 'running' | 'stopped' | 'error'): string => {
    switch (status) {
      case 'running':
        return t('apiList.status.running');
      case 'stopped':
        return t('apiList.status.stopped');
      case 'error':
        return t('apiList.status.error');
      default:
        // TypeScriptの型チェックでは到達不可能だが、実行時の安全性のため残す
        return t('apiList.status.unknown');
    }
  }, [t]);

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('apiList.title') || 'API一覧' },
  ], [t]);

  // 仮想スクロールの設定（100件以上の場合に有効化）
  const shouldUseVirtualScroll = apis.length >= 100;
  const rowVirtualizer = useVirtualizer({
    count: apis.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // APIカードの高さの推定値（px）
    overscan: 3, // 表示領域外のレンダリング数
    enabled: shouldUseVirtualScroll,
  });

  // APIカードのレンダリング関数（useCallbackでメモ化）
  const renderApiCard = useCallback((api: ApiInfoExtended) => (
    <div key={api.id} className="api-card">
      <div className="api-card-header">
        <label className="api-select-checkbox">
          <input
            type="checkbox"
            checked={selectedApiIds.has(api.id)}
            onChange={() => handleToggleSelection(api.id)}
            aria-label={t('apiList.selectApiAria', { name: api.name })}
          />
        </label>
        <h3 className="api-name">{api.name}</h3>
        <div className={`status-badge status-${api.status}`}>
          {getStatusText(api.status)}
        </div>
      </div>

      <div className="api-info">
        <div className="info-row">
          <span className="info-label">{t('apiList.info.model')}</span>
          <span className="info-value">{api.model_name}</span>
        </div>
        <div className="info-row">
          <span className="info-label">
            <Tooltip
              content="APIの接続先URLです。外部アプリケーションからこのURLにアクセスしてAPIを使用できます。"
              title="エンドポイントとは？"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                {t('apiList.info.endpoint')}
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>❓</span>
              </span>
            </Tooltip>
          </span>
          <code className="info-value">{api.endpoint}</code>
        </div>
        <div className="info-row">
          <span className="info-label">
            <Tooltip
              content="APIが使用する通信ポート番号です。通常は自動的に設定されます。"
              title="ポート番号とは？"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                {t('apiList.info.port')}
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>❓</span>
              </span>
            </Tooltip>
          </span>
          <span className="info-value">{api.port}</span>
        </div>
      </div>

      <div className="api-actions">
        <Tooltip 
          content={api.status === 'running' 
            ? t('apiList.actions.stopTooltip')
            : t('apiList.actions.startTooltip')}
          position="top"
        >
          <button
            className={`action-button ${api.status === 'running' ? 'stop' : 'start'}`}
            onClick={() => {
              startTransition(() => {
                handleToggleStatus(api.id, api.status);
              });
            }}
          >
            {api.status === 'running' ? t('apiList.actions.stop') : t('apiList.actions.start')}
          </button>
        </Tooltip>
        <Tooltip content={t('apiList.actions.testTooltip')} position="top">
          <button
            className="action-button test"
            onClick={() => navigate(`/api/test/${api.id}`)}
          >
            {t('apiList.actions.test')}
          </button>
        </Tooltip>
        <Tooltip content={t('apiList.actions.detailsTooltip')} position="top">
          <button
            className="action-button details"
            onClick={() => navigate(`/api/details/${api.id}`)}
          >
            {t('apiList.actions.details')}
          </button>
        </Tooltip>
        <Tooltip content={t('apiList.actions.editTooltip') || 'API設定を変更'} position="top">
          <button
            className="action-button edit"
            onClick={() => navigate(`/api/edit/${api.id}`)}
          >
            {t('apiList.actions.edit') || '設定変更'}
          </button>
        </Tooltip>
        <Tooltip content={t('apiList.actions.deleteTooltip')} position="top">
          <button
            className="action-button delete"
            onClick={() => {
              startTransition(() => {
                handleDelete(api.id, api.name, api.model_name);
              });
            }}
          >
            {t('apiList.actions.delete')}
          </button>
        </Tooltip>
      </div>
    </div>
  ), [selectedApiIds, handleToggleSelection, handleToggleStatus, handleDelete, getStatusText, navigate, t, startTransition]);

  if (loading) {
    return (
      <AppLayout>
        <div className="api-list-page">
          <div className="page-container api-list-container">
            <Breadcrumb items={breadcrumbItems} />
            <header className="page-header api-list-header">
              <div className="header-top">
                <Tooltip content={t('apiList.backToHomeTooltip')}>
                  <button className="back-button" onClick={() => navigate('/')}>
                    {t('apiList.backToHome')}
                  </button>
                </Tooltip>
                <h1>{t('apiList.title')}</h1>
              </div>
            </header>
            <div className="api-list-content">
              <SkeletonLoader type="api-list" count={3} />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="api-list-page">
        <div className="page-container api-list-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header api-list-header">
            <div className="header-top">
              <Tooltip content={t('apiList.backToHomeTooltip')}>
                <button className="back-button" onClick={() => navigate('/')}>
                  {t('apiList.backToHome')}
                </button>
              </Tooltip>
              <h1>{t('apiList.title')}</h1>
            </div>
            <div className="header-actions">
              <Tooltip content={t('apiList.createApiTooltip')}>
                <button className="create-button" onClick={() => navigate('/api/create')}>
                  {t('apiList.createApi')}
                </button>
              </Tooltip>
              <Tooltip content={t('apiList.refreshTooltip')}>
                <button className="refresh-button" onClick={loadApis}>
                  {t('apiList.refresh')}
                </button>
              </Tooltip>
            </div>
          </header>

          <div className="api-list-content">
            {error && (
              <ErrorMessage
                message={error}
                type="api"
                onClose={() => setError(null)}
              />
            )}

            {/* 設定エクスポート・インポート */}
            {apis.length > 0 && (
              <div className="settings-export-section">
                <SettingsExport
                  selectedApiIds={selectedApiIds.size > 0 ? Array.from(selectedApiIds) : undefined}
                  onImportComplete={handleImportComplete}
                />
              </div>
            )}

            {apis.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h2>{t('apiList.empty.title')}</h2>
                <p>{t('apiList.empty.message')}</p>
                <Tooltip content={t('apiList.empty.createTooltip')}>
                  <button className="create-button primary" onClick={() => navigate('/api/create')}>
                    {t('apiList.createApi')}
                  </button>
                </Tooltip>
              </div>
            ) : (
              <div 
                className="api-list virtual-scroll-container"
                ref={(el) => {
                  parentRef.current = el;
                  if (el) {
                    el.style.setProperty('--virtual-height', shouldUseVirtualScroll ? '600px' : 'auto');
                    el.style.setProperty('--virtual-overflow', shouldUseVirtualScroll ? 'auto' : 'visible');
                  }
                }}
              >
                {/* 全選択/全解除ボタン */}
                <div className="api-list-controls">
                  <label className="select-all-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedApiIds.size === apis.length && apis.length > 0}
                      onChange={handleSelectAll}
                      aria-label={t('apiList.selectAllAria')}
                    />
                    <span>{t('apiList.selectAll', { count: selectedApiIds.size })}</span>
                  </label>
                </div>
                <div
                  ref={(el) => {
                    if (el && shouldUseVirtualScroll) {
                      el.style.setProperty('--virtual-height', `${rowVirtualizer.getTotalSize()}px`);
                      el.style.setProperty('--virtual-position', 'relative');
                    }
                  }}
                  className={shouldUseVirtualScroll ? 'virtual-scroll-container' : ''}
                >
                  {shouldUseVirtualScroll
                    ? rowVirtualizer.getVirtualItems().map(virtualRow => {
                        const api = apis[virtualRow.index];
                        return (
                          <div
                            key={api.id}
                            className="virtual-scroll-item"
                            ref={(el) => {
                              if (el) {
                                el.style.setProperty('--virtual-top', '0');
                                el.style.setProperty('--virtual-left', '0');
                                el.style.setProperty('--virtual-width', '100%');
                                el.style.setProperty('--virtual-transform', `translateY(${virtualRow.start}px)`);
                              }
                            }}
                          >
                            {renderApiCard(api)}
                          </div>
                        );
                      })
                    : apis.map((api) => renderApiCard(api))}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* 確認ダイアログ */}
        {confirmDialog.isOpen && (
          <div
            className="confirm-dialog-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div
              className="confirm-dialog"
              role="document"
            >
              <h3 id="confirm-dialog-title">確認</h3>
              <p>{confirmDialog.message}</p>
              <div className="confirm-dialog-actions">
                <button
                  className="confirm-button cancel"
                  onClick={confirmDialog.onCancel}
                  type="button"
                >
                  キャンセル
                </button>
                <button
                  className="confirm-button confirm"
                  onClick={confirmDialog.onConfirm}
                  type="button"
                >
                  確認
                </button>
              </div>
            </div>
          </div>
        )}
      </AppLayout>
    );
  };
