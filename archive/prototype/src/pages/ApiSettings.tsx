// ApiSettings - API設定変更ページ

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
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useI18n } from '../contexts/I18nContext';
import { useNotifications } from '../contexts/NotificationContext';
import { PORT_RANGE, API_NAME } from '../constants/config';
import { extractErrorMessage } from '../utils/errorHandler';
import type { ApiSettingsForm } from '../types/api';
import './ApiSettings.css';

/**
 * API設定情報（ApiSettingsページ用 - idとmodelNameを含む）
 */
interface ApiSettingsWithId extends ApiSettingsForm {
  id: string;
  modelName?: string;
}

/**
 * API設定変更ページ
 * APIの設定を変更します
 */
export const ApiSettings: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError: showErrorNotification } = useNotifications();
  const [settings, setSettings] = useState<ApiSettingsWithId | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (settings) {
      items.push(
        { label: settings.name, path: `/api/details/${id}` },
        { label: t('apiSettings.settings') || '設定' }
      );
    } else {
      items.push({ label: t('apiSettings.title') || 'API設定' });
    }
    return items;
  }, [t, settings, id]);

  // 設定を読み込む
  const loadSettings = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      // バックエンドのIPCコマンドを呼び出し（list_apisから該当APIを取得）
      interface ApiListItem {
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
      const apis = await safeInvoke<ApiListItem[]>('list_apis');

      const api = apis.find((a: ApiListItem) => a.id === id);

      if (!api) {
        setError('APIが見つかりませんでした');
        return;
      }

      setSettings({
        id: api.id,
        name: api.name,
        port: api.port,
        enableAuth: api.enable_auth,
        modelName: api.model_name,
      });
    } catch (err) {
      setError(extractErrorMessage(err, '設定の読み込みに失敗しました'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // バリデーション
  const validate = useCallback((): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!settings) {
      setError('設定が読み込まれていません');
      return false;
    }

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
    if (!settings || !validate()) return;

    try {
      setSaving(true);
      setError(null);

      // バックエンドのupdate_apiコマンドを呼び出し
      // ポート番号や認証設定が変更された場合、バックエンド側で自動的に再起動が行われます
      await safeInvoke('update_api', {
        api_id: id,
        config: {
          name: settings.name,
          port: settings.port,
          enable_auth: settings.enableAuth,
        },
      });

      navigate('/api/list');
    } catch (err) {
      setError(extractErrorMessage(err, '設定の保存に失敗しました'));
    } finally {
      setSaving(false);
    }
  }, [settings, validate, id, navigate]);

  // APIキーを再生成
  const handleRegenerateApiKey = useCallback(async () => {
    if (!id) return;

    setConfirmDialog({
      isOpen: true,
      message: 'APIキーを再生成しますか？現在のAPIキーは無効になります。',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          setSaving(true);
          setError(null);

          // バックエンドのregenerate_api_keyコマンドを呼び出し
          const newKey = await safeInvoke<string>('regenerate_api_key', {
            apiId: id,
          });

          // 新しいAPIキーを通知で表示
          showSuccess(
            'APIキーが再生成されました',
            `新しいAPIキー: ${newKey}\n\nこのキーは今回のみ表示されます。コピーして安全な場所に保存してください。`,
            10000
          );

          // 設定を再読み込みして反映
          loadSettings();
        } catch (err) {
          const errorMessage = extractErrorMessage(
            err,
            'APIキーの再生成に失敗しました'
          );
          setError(errorMessage);
          showErrorNotification('APIキーの再生成に失敗しました', errorMessage);
        } finally {
          setSaving(false);
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [id, loadSettings, showSuccess, showErrorNotification]);

  // APIを削除
  const handleDelete = useCallback(async () => {
    if (!id || !settings) return;

    let confirmMessage = 'このAPIを削除しますか？この操作は取り消せません。';
    if (settings.modelName) {
      confirmMessage += `\n\nこのAPIが使用しているモデル "${settings.modelName}" も削除しますか？\n（他のAPIで使用されていない場合のみ削除されます）`;
    }

    // 最初の確認ダイアログを表示
    setConfirmDialog({
      isOpen: true,
      message: confirmMessage,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));

        // モデル削除オプションを確認（2回目の確認ダイアログ）
        if (settings.modelName) {
          setConfirmDialog({
            isOpen: true,
            message: `モデル "${settings.modelName}" も削除しますか？\n（他のAPIで使用されていない場合のみ削除されます）`,
            onConfirm: async () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              try {
                setSaving(true);
                setError(null);

                await safeInvoke('delete_api', {
                  api_id: id,
                  delete_model: true,
                });

                // API一覧に戻る
                navigate('/api/list');
                showSuccess('APIを削除しました');
              } catch (err) {
                setError(extractErrorMessage(err, 'APIの削除に失敗しました'));
              } finally {
                setSaving(false);
              }
            },
            onCancel: () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));

              // モデル削除なしで削除を実行
              (async () => {
                try {
                  setSaving(true);
                  setError(null);

                  await safeInvoke('delete_api', {
                    api_id: id,
                    delete_model: false,
                  });

                  // API一覧に戻る
                  navigate('/api/list');
                  showSuccess('APIを削除しました');
                } catch (err) {
                  setError(extractErrorMessage(err, 'APIの削除に失敗しました'));
                } finally {
                  setSaving(false);
                }
              })();
            },
          });
        } else {
          // モデル削除オプションがない場合、直接削除
          (async () => {
            try {
              setSaving(true);
              setError(null);

              await safeInvoke('delete_api', {
                api_id: id,
                delete_model: false,
              });

              // API一覧に戻る
              navigate('/api/list');
              showSuccess('APIを削除しました');
            } catch (err) {
              setError(extractErrorMessage(err, 'APIの削除に失敗しました'));
            } finally {
              setSaving(false);
            }
          })();
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [id, settings, navigate, showSuccess]);

  if (loading) {
    return (
      <div className="api-settings-page">
        <div className="api-settings-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="api-settings-header">
            <div className="header-top">
              <SkeletonLoader type="button" width="150px" />
              <SkeletonLoader type="title" width="200px" />
            </div>
          </header>
          <div className="api-settings-content">
            <SkeletonLoader type="form" count={3} />
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="api-settings-page">
        <div className="api-settings-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="api-settings-header">
            <div className="header-top">
              <button
                className="back-button"
                onClick={() => navigate('/api/list')}
              >
                ← API一覧に戻る
              </button>
              <h1>API設定変更</h1>
            </div>
          </header>
          <div className="api-settings-content">
            <ErrorMessage
              message="APIが見つかりませんでした"
              type="api"
              onClose={() => navigate('/api/list')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-settings-page">
      <div className="api-settings-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="api-settings-header">
          <div className="header-top">
            <button
              className="back-button"
              onClick={() => navigate('/api/list')}
            >
              ← API一覧に戻る
            </button>
            <h1>{t('apiSettings.title') || 'API設定変更'}</h1>
          </div>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="api-settings-content">
          <section className="settings-section">
            <h2>基本設定</h2>
            <div className="form-group">
              <label htmlFor="api-name">
                API名 <span className="required">*</span>
              </label>
              <input
                id="api-name"
                type="text"
                value={settings.name}
                onChange={e =>
                  setSettings({ ...settings, name: e.target.value })
                }
                className={errors.name ? 'error' : ''}
                maxLength={API_NAME.MAX_LENGTH}
              />
              {errors.name && (
                <span className="error-message-text">{errors.name}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="api-port">
                ポート番号 <span className="required">*</span>
              </label>
              <input
                id="api-port"
                type="number"
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
                className={errors.port ? 'error' : ''}
              />
              {errors.port && (
                <span className="error-message-text">{errors.port}</span>
              )}
              <small className="form-hint">
                ポート番号を変更する場合、APIが停止されます。
              </small>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.enableAuth}
                  onChange={e =>
                    setSettings({ ...settings, enableAuth: e.target.checked })
                  }
                />
                <span>認証を有効にする</span>
              </label>
              <small className="form-hint">
                認証を無効にすると、APIキーなしでアクセス可能になります。
              </small>
            </div>
          </section>

          {settings.enableAuth && (
            <section className="settings-section">
              <h2>APIキー管理</h2>
              <div className="api-key-management">
                <p className="section-description">
                  現在のAPIキーを再生成することができます。
                </p>
                <button
                  className="regenerate-button"
                  onClick={() => {
                    startTransition(() => {
                      handleRegenerateApiKey();
                    });
                  }}
                  disabled={isPending}
                >
                  🔄 APIキーを再生成
                </button>
                <small className="warning-text">
                  ⚠️ APIキーを再生成すると、現在のAPIキーは無効になります。
                  新しいAPIキーは詳細画面で確認できます。
                </small>
              </div>
            </section>
          )}

          <section className="settings-section danger-zone">
            <h2>危険な操作</h2>
            <div className="danger-actions">
              <p className="section-description">
                APIを削除すると、関連するすべてのデータとプロセスが削除されます。
                この操作は取り消せません。
              </p>
              <button
                className="delete-button"
                onClick={() => {
                  startTransition(() => {
                    handleDelete();
                  });
                }}
                disabled={isPending}
              >
                🗑️ APIを削除
              </button>
            </div>
          </section>

          <div className="action-buttons">
            <button
              className="button-secondary"
              onClick={() => navigate('/api/list')}
              disabled={saving}
            >
              キャンセル
            </button>
            <button
              className="button-primary"
              onClick={() => {
                startTransition(() => {
                  handleSave();
                });
              }}
              disabled={saving || isPending}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
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
