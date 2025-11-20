// ApiEdit - API編集ページ

import React, {
  useState,
  useEffect,
  useTransition,
  useMemo,
  useCallback,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { SecuritySettingsSection } from '../components/api/SecuritySettings';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useI18n } from '../contexts/I18nContext';
import { useNotifications } from '../contexts/NotificationContext';
import { PORT_RANGE, API_NAME } from '../constants/config';
import { extractErrorMessage } from '../utils/errorHandler';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { logger } from '../utils/logger';
import type { ApiUpdateRequest, ApiSettingsForm } from '../types/api';
import './ApiEdit.css';

/**
 * API設定変更ページ
 */
export const ApiEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError: showErrorNotification } = useNotifications();
  const [settings, setSettings] = useState<ApiSettingsForm>({
    name: '',
    port: 8080,
    enableAuth: true,
    timeout_secs: null,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
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

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('header.apiList') || 'API一覧', path: '/api/list' },
    ];
    if (settings.name) {
      items.push(
        { label: settings.name, path: `/api/details/${id}` },
        { label: t('apiEdit.edit') || '編集' }
      );
    } else {
      items.push({ label: t('apiEdit.title') || 'API編集' });
    }
    return items;
  }, [t, settings.name, id]);

  // API設定を取得する操作
  const loadApiSettingsOperation =
    useCallback(async (): Promise<ApiSettingsForm | null> => {
      if (!id) {
        return null;
      }

      // バックエンドのIPCコマンドを呼び出してAPI詳細を取得
      const apiDetails = await safeInvoke<{
        id: string;
        name: string;
        endpoint: string;
        model_name: string;
        port: number;
        enable_auth: boolean;
        status: string;
        timeout_secs?: number | null;
        created_at: string;
        updated_at: string;
      }>('get_api_details', { apiId: id });

      return {
        name: apiDetails.name,
        port: apiDetails.port,
        enableAuth: apiDetails.enable_auth,
        timeout_secs: apiDetails.timeout_secs ?? null,
      };
    }, [id]);

  // 非同期操作フックを使用
  const {
    data: loadedSettings,
    loading,
    error,
    execute: loadApiSettings,
    clearError,
  } = useAsyncOperation<ApiSettingsForm | null>(loadApiSettingsOperation, {
    autoExecute: false,
    logErrors: true,
    context: 'ApiEdit',
  });

  // 設定を反映
  useEffect(() => {
    if (loadedSettings) {
      setSettings(loadedSettings);
    }
  }, [loadedSettings]);

  // 初回読み込み
  useEffect(() => {
    if (id) {
      loadApiSettings();
    }
  }, [id, loadApiSettings]);

  // バリデーション
  const validate = useCallback((): boolean => {
    const newErrors: { [key: string]: string } = {};

    const trimmedName = settings.name.trim();
    if (!trimmedName) {
      newErrors.name = 'API名を入力してください';
    } else if (trimmedName.length < API_NAME.MIN_LENGTH) {
      newErrors.name = `API名は${API_NAME.MIN_LENGTH}文字以上で入力してください`;
    } else if (trimmedName.length > API_NAME.MAX_LENGTH) {
      newErrors.name = `API名は${API_NAME.MAX_LENGTH}文字以下で入力してください`;
    }

    if (settings.port < PORT_RANGE.MIN || settings.port > PORT_RANGE.MAX) {
      newErrors.port = `ポート番号は${PORT_RANGE.MIN}-${PORT_RANGE.MAX}の範囲で入力してください`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [settings]);

  // 設定を保存
  const handleSave = useCallback(async () => {
    if (!validate() || !id) return;

    try {
      setSaving(true);
      clearError();

      // バックエンドのupdate_apiコマンドを呼び出し
      const updateRequest: ApiUpdateRequest = {
        api_id: id,
        config: {
          name: settings.name,
          port: settings.port,
          enable_auth: settings.enableAuth,
          timeout_secs: settings.timeout_secs ?? null,
        },
      };
      await safeInvoke(
        'update_api',
        updateRequest as unknown as Record<string, unknown>
      );

      // 成功したら詳細画面に遷移
      navigate(`/api/details/${id}`);
    } catch (err) {
      const errorMessage = extractErrorMessage(err, '設定の保存に失敗しました');
      showErrorNotification('設定の保存に失敗しました', errorMessage);
      logger.error('設定の保存に失敗しました', err, 'ApiEdit');
    } finally {
      setSaving(false);
    }
  }, [id, settings, validate, navigate, clearError, showErrorNotification]);

  // APIキーを再生成
  const handleRegenerateApiKey = useCallback(async () => {
    if (!id) return;

    setConfirmDialog({
      isOpen: true,
      message:
        'APIキーを再生成すると、現在のAPIキーは無効になります。続行しますか？',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          setSaving(true);
          clearError();

          // バックエンドのregenerate_api_keyコマンドを呼び出し
          const newApiKey = await safeInvoke<string>('regenerate_api_key', {
            apiId: id,
          });

          // 新しいAPIキーを通知で表示
          showSuccess(
            'APIキーが再生成されました',
            `新しいAPIキー: ${newApiKey}\n\nこのキーは今回のみ表示されます。コピーして安全な場所に保存してください。`,
            10000
          );

          // 設定を再読み込みして反映
          loadApiSettings();
        } catch (err) {
          const errorMessage = extractErrorMessage(
            err,
            'APIキーの再生成に失敗しました'
          );
          showErrorNotification('APIキーの再生成に失敗しました', errorMessage);
          logger.error('APIキーの再生成に失敗しました', err, 'ApiEdit');
        } finally {
          setSaving(false);
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [id, loadApiSettings, showSuccess, showErrorNotification, clearError]);

  // APIを削除
  const handleDelete = useCallback(async () => {
    if (!id || !settings) return;

    const confirmMessage = 'このAPIを削除しますか？この操作は取り消せません。';

    // 最初の確認ダイアログを表示
    setConfirmDialog({
      isOpen: true,
      message: confirmMessage,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          setSaving(true);
          clearError();

          await safeInvoke('delete_api', {
            apiId: id,
          });

          // API一覧に戻る
          navigate('/api/list');
          showSuccess('APIを削除しました');
        } catch (err) {
          const errorMessage = extractErrorMessage(
            err,
            'APIの削除に失敗しました'
          );
          showErrorNotification('APIの削除に失敗しました', errorMessage);
          logger.error('APIの削除に失敗しました', err, 'ApiEdit');
        } finally {
          setSaving(false);
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [id, settings, navigate, showSuccess, showErrorNotification, clearError]);

  if (loading) {
    return (
      <div className="api-edit-page">
        <div className="page-container api-edit-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="page-header api-edit-header">
            <SkeletonLoader type="button" width="100px" />
            <SkeletonLoader type="title" width="200px" />
          </header>
          <div className="api-edit-form">
            <SkeletonLoader type="form" count={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-edit-page">
      <div className="page-container api-edit-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="page-header api-edit-header">
          <button
            className="back-button"
            onClick={() => navigate(`/api/details/${id}`)}
          >
            ← 戻る
          </button>
          <h1>API設定を変更</h1>
        </header>

        {error && (
          <ErrorMessage message={error || ''} type="api" onClose={clearError} />
        )}

        <form
          className="api-edit-form"
          onSubmit={e => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="form-section">
            <h2>基本設定</h2>

            <div className="form-group">
              <label htmlFor="api-name" className="form-label">
                API名 <span className="required">*</span>
              </label>
              <input
                id="api-name"
                type="text"
                className={`form-input ${errors.name ? 'error' : ''}`}
                value={settings.name}
                onChange={e =>
                  setSettings({ ...settings, name: e.target.value })
                }
                maxLength={API_NAME.MAX_LENGTH}
                required
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="api-port" className="form-label">
                ポート番号 <span className="required">*</span>
              </label>
              <input
                id="api-port"
                type="number"
                className={`form-input ${errors.port ? 'error' : ''}`}
                value={settings.port}
                onChange={e => {
                  const parsed = parseInt(e.target.value, 10);
                  setSettings({
                    ...settings,
                    port: isNaN(parsed) ? PORT_RANGE.DEFAULT : parsed,
                  });
                }}
                min={PORT_RANGE.MIN}
                max={PORT_RANGE.MAX}
                required
              />
              {errors.port && <span className="form-error">{errors.port}</span>}
              <small className="form-hint">
                ポート番号を変更すると、APIが再起動されます。
              </small>
            </div>

            <div className="form-group">
              <label className="form-checkbox-label">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={settings.enableAuth}
                  onChange={e =>
                    setSettings({ ...settings, enableAuth: e.target.checked })
                  }
                />
                <span className="form-checkbox-text">認証を有効にする</span>
              </label>
              <small className="form-hint">
                認証を無効にすると、APIキーなしでアクセスできるようになります（非推奨）。
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="api-timeout" className="form-label">
                タイムアウト（秒）
              </label>
              <input
                id="api-timeout"
                type="number"
                className="form-input"
                value={settings.timeout_secs ?? ''}
                onChange={e => {
                  const parsed = parseInt(e.target.value, 10);
                  setSettings({
                    ...settings,
                    timeout_secs: isNaN(parsed) || parsed <= 0 ? null : parsed,
                  });
                }}
                min={1}
                max={600}
                placeholder="未設定（グローバル設定を使用）"
              />
              <small className="form-hint">
                1-600秒の範囲で指定してください。未設定の場合は設定画面のグローバルタイムアウト設定（デフォルト:
                30秒）が使用されます。
              </small>
            </div>
          </div>

          <div className="form-section">
            <h2>セキュリティ設定</h2>

            <div className="form-group">
              <div className="form-label" role="group" aria-label="APIキー">
                APIキー
              </div>
              <div className="api-key-actions">
                <button
                  type="button"
                  className="button-warning"
                  onClick={() => {
                    startTransition(() => {
                      handleRegenerateApiKey();
                    });
                  }}
                  disabled={isPending}
                >
                  APIキーを再生成
                </button>
              </div>
              <small className="form-hint">
                APIキーを再生成すると、現在のAPIキーは無効になります。新しいAPIキーを安全に保存してください。
              </small>
            </div>

            <SecuritySettingsSection apiId={id || ''} />
          </div>

          <div className="form-section danger-zone">
            <h2>危険な操作</h2>
            <div className="danger-actions">
              <p className="section-description">
                APIを削除すると、関連するすべてのデータとプロセスが削除されます。
                この操作は取り消せません。
              </p>
              <button
                type="button"
                className="delete-button"
                onClick={() => {
                  startTransition(() => {
                    handleDelete();
                  });
                }}
                disabled={isPending || saving}
              >
                🗑️ APIを削除
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => navigate(`/api/details/${id}`)}
            >
              キャンセル
            </button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? '保存中...' : '変更を保存'}
            </button>
          </div>
        </form>
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        title={t('common.confirm') || '確認'}
        confirmLabel={t('common.confirm') || '確認'}
        cancelLabel={t('common.cancel') || 'キャンセル'}
        confirmVariant="primary"
      />
    </div>
  );
};
