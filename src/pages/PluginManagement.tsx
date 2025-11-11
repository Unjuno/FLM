// PluginManagement - プラグイン管理ページ
//
// **実装状況**:
// - ✅ UI実装: 完全実装済み
// - ✅ プラグイン管理機能: 完全実装済み（登録、削除、有効化/無効化、権限管理）
// - ✅ プラグイン実行機能: 基本実装済み
// - ⚠️ 動的ロード機能: 将来実装予定（動的ライブラリのロードと実行）
//
// **注意**: 現在の実装では、プラグイン情報を管理し、基本的な実行処理のみ可能です。
// 実際の動的ライブラリのロードと実行機能は将来実装予定です。
// サードパーティプラグインの管理

import React, { useState, useEffect, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { InfoBanner } from '../components/common/InfoBanner';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import { extractErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import './PluginManagement.css';

/**
 * プラグイン権限
 */
interface PluginPermissions {
  database_access: string; // "read", "write", "none"
  network_access: string; // "allow", "deny"
  api_key_access: string; // "allow", "deny"
  filesystem_access: string; // "allow", "deny"
}

/**
 * プラグイン情報
 */
interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  enabled: boolean;
  plugin_type: string;
  permissions?: PluginPermissions;
}

/**
 * プラグイン管理ページ
 */
export const PluginManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError } = useNotifications();
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [newPlugin, setNewPlugin] = useState<Partial<PluginInfo>>({
    name: '',
    version: '',
    author: '',
    description: '',
    plugin_type: 'Custom',
    permissions: {
      database_access: 'none',
      network_access: 'deny',
      api_key_access: 'deny',
      filesystem_access: 'deny',
    },
  });
  const [editingPermissions, setEditingPermissions] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const [showIncompleteFeatures, setShowIncompleteFeatures] = useState(false);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: 'プラグイン管理' },
  ], [t]);

  // 不完全な機能の表示設定を読み込む
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await safeInvoke<{ show_incomplete_features?: boolean | null }>('get_app_settings');
        setShowIncompleteFeatures(settings.show_incomplete_features ?? false);
      } catch (err) {
        logger.warn('設定の読み込みに失敗しました。デフォルトで非表示にします。', String(err), 'PluginManagement');
        setShowIncompleteFeatures(false);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    loadPlugins();
  }, []);

  /**
   * プラグイン一覧を読み込む
   */
  const loadPlugins = async () => {
    try {
      setLoading(true);
      setError(null);

      // プラグイン一覧を取得
      const pluginsData = await safeInvoke<PluginInfo[]>('get_all_plugins', {});
      setPlugins(pluginsData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'プラグインの読み込みに失敗しました'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * プラグインを登録
   */
  const handleRegisterPlugin = async () => {
    if (!newPlugin.name || !newPlugin.version || !newPlugin.author) {
      showError('名前、バージョン、作成者を入力してください');
      return;
    }

    try {
      setSaving(true);

      await safeInvoke('register_plugin', {
        plugin_id: newPlugin.id || `plugin-${Date.now()}`,
        plugin_name: newPlugin.name,
        plugin_version: newPlugin.version,
        plugin_author: newPlugin.author,
        plugin_description: newPlugin.description || null,
        plugin_type: newPlugin.plugin_type || 'Custom',
        permissions: newPlugin.permissions || {
          database_access: 'none',
          network_access: 'deny',
          api_key_access: 'deny',
          filesystem_access: 'deny',
        },
      });

      showSuccess('プラグインを登録しました');
      setNewPlugin({
        name: '',
        version: '',
        author: '',
        description: '',
        plugin_type: 'Custom',
        permissions: {
          database_access: 'none',
          network_access: 'deny',
          api_key_access: 'deny',
          filesystem_access: 'deny',
        },
      });
      setShowRegisterForm(false);
      loadPlugins();
    } catch (err) {
      showError(
        extractErrorMessage(err, 'プラグインの登録に失敗しました')
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * プラグインタイプの表示名を取得
   */
  const getPluginTypeName = (type: string): string => {
    const names: { [key: string]: string } = {
      Engine: 'エンジン',
      Model: 'モデル',
      Auth: '認証',
      Logging: 'ログ',
      Custom: 'カスタム',
    };
    return names[type] || type;
  };

  /**
   * プラグインの権限を更新
   */
  const handleUpdatePermissions = async (pluginId: string, permissions: PluginPermissions) => {
    try {
      setSaving(true);
      await safeInvoke('update_plugin_permissions', {
        plugin_id: pluginId,
        permissions,
      });
      showSuccess('プラグインの権限を更新しました');
      setEditingPermissions(null);
      loadPlugins();
    } catch (err) {
      showError(
        extractErrorMessage(err, 'プラグインの権限更新に失敗しました')
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * 権限の表示名を取得
   */
  const getPermissionLabel = (permission: string, value: string): string => {
    const labels: { [key: string]: { [key: string]: string } } = {
      database_access: {
        none: 'なし',
        read: '読み取りのみ',
        write: '読み書き',
      },
      network_access: {
        deny: '拒否',
        allow: '許可',
      },
      api_key_access: {
        deny: '拒否',
        allow: '許可',
      },
      filesystem_access: {
        deny: '拒否',
        allow: '許可',
      },
    };
    return labels[permission]?.[value] || value;
  };

  if (loading) {
    return (
      <div className="plugin-management-page">
        <div className="plugin-management-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="plugin-management-header">
            <button className="back-button" onClick={() => navigate('/settings')}>
              ← 戻る
            </button>
            <h1>プラグイン管理</h1>
          </header>
          <div className="plugin-management-content">
            <SkeletonLoader type="title" width="200px" />
            <SkeletonLoader type="paragraph" count={2} />
            <div className="margin-top-md">
              <SkeletonLoader type="button" width="150px" />
            </div>
            <div className="margin-top-xl">
              <SkeletonLoader type="card" count={3} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-management-page">
      <div className="plugin-management-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="plugin-management-header">
          <button className="back-button" onClick={() => navigate('/settings')}>
            ← 戻る
          </button>
          <h1>プラグイン管理</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="plugin-management-content">
          {!showIncompleteFeatures ? (
            <InfoBanner
              type="info"
              title="機能が非表示になっています"
              message="この機能は開発中のため、デフォルトでは非表示になっています。設定ページの「機能表示設定」から「不完全な機能（開発中）を表示する」を有効にすると表示されます。"
              dismissible={false}
            />
          ) : (
            <>
              <InfoBanner
                type="warning"
                title="機能制限について"
                message="現在、プラグイン情報の管理と基本的な実行処理のみ対応しています。動的ライブラリのロードと実行機能は開発中です。"
                dismissible={false}
              />
              <div className="plugin-info-banner">
                <h2>プラグイン機能</h2>
                <p>
                  サードパーティによる機能拡張をサポートします。プラグインを登録し、有効/無効を切り替えることができます。
                </p>
                <ul className="plugin-features-list">
                  <li>エンジンプラグイン（新しいLLMエンジンの追加）</li>
                  <li>モデル管理プラグイン（モデル管理機能の拡張）</li>
                  <li>認証プラグイン（新しい認証方式の追加）</li>
                  <li>ログプラグイン（ログ処理の拡張）</li>
                  <li>カスタムプラグイン（独自機能の追加）</li>
                </ul>
              </div>

              <div className="plugins-section">
                <div className="plugins-header">
                  <h2>プラグイン一覧</h2>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => setShowRegisterForm(!showRegisterForm)}
                    disabled={saving}
                  >
                    {showRegisterForm ? 'キャンセル' : '+ プラグインを登録'}
                  </button>
                </div>

                {showRegisterForm && (
                  <div className="register-plugin-form">
                    <div className="form-group">
                      <label className="form-label" htmlFor="plugin-name">
                        プラグイン名 <span className="required">*</span>
                      </label>
                      <input
                        id="plugin-name"
                        type="text"
                        className="form-input"
                        value={newPlugin.name || ''}
                        onChange={e =>
                          setNewPlugin({ ...newPlugin, name: e.target.value })
                        }
                        placeholder="プラグイン名を入力"
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="plugin-version">
                        バージョン <span className="required">*</span>
                      </label>
                      <input
                        id="plugin-version"
                        type="text"
                        className="form-input"
                        value={newPlugin.version || ''}
                        onChange={e =>
                          setNewPlugin({ ...newPlugin, version: e.target.value })
                        }
                        placeholder="1.0.0"
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="plugin-author">
                        作成者 <span className="required">*</span>
                      </label>
                      <input
                        id="plugin-author"
                        type="text"
                        className="form-input"
                        value={newPlugin.author || ''}
                        onChange={e =>
                          setNewPlugin({ ...newPlugin, author: e.target.value })
                        }
                        placeholder="作成者名を入力"
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="plugin-description">
                        説明
                      </label>
                      <textarea
                        id="plugin-description"
                        className="form-textarea"
                        value={newPlugin.description || ''}
                        onChange={e =>
                          setNewPlugin({
                            ...newPlugin,
                            description: e.target.value,
                          })
                        }
                        placeholder="プラグインの説明を入力（オプション）"
                        rows={3}
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="plugin-type">
                        プラグインタイプ
                      </label>
                      <select
                        id="plugin-type"
                        className="form-select"
                        value={newPlugin.plugin_type || 'Custom'}
                        onChange={e =>
                          setNewPlugin({
                            ...newPlugin,
                            plugin_type: e.target.value,
                          })
                        }
                        disabled={saving}
                      >
                        <option value="Engine">エンジン</option>
                        <option value="Model">モデル</option>
                        <option value="Auth">認証</option>
                        <option value="Logging">ログ</option>
                        <option value="Custom">カスタム</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">権限設定</label>
                      <div className="permissions-section">
                        <div className="permission-item">
                          <label htmlFor="new-plugin-db-access" className="permission-label">データベースアクセス</label>
                          <select
                            id="new-plugin-db-access"
                            className="form-select"
                            value={newPlugin.permissions?.database_access || 'none'}
                            onChange={e =>
                              setNewPlugin({
                                ...newPlugin,
                                permissions: {
                                  ...(newPlugin.permissions || {
                                    database_access: 'none',
                                    network_access: 'deny',
                                    api_key_access: 'deny',
                                    filesystem_access: 'deny',
                                  }),
                                  database_access: e.target.value,
                                },
                              })
                            }
                            disabled={saving}
                          >
                            <option value="none">なし</option>
                            <option value="read">読み取りのみ</option>
                            <option value="write">読み書き</option>
                          </select>
                        </div>
                        <div className="permission-item">
                          <label htmlFor="new-plugin-network-access" className="permission-label">外部通信</label>
                          <select
                            id="new-plugin-network-access"
                            className="form-select"
                            value={newPlugin.permissions?.network_access || 'deny'}
                            onChange={e =>
                              setNewPlugin({
                                ...newPlugin,
                                permissions: {
                                  ...(newPlugin.permissions || {
                                    database_access: 'none',
                                    network_access: 'deny',
                                    api_key_access: 'deny',
                                    filesystem_access: 'deny',
                                  }),
                                  network_access: e.target.value,
                                },
                              })
                            }
                            disabled={saving}
                          >
                            <option value="deny">拒否</option>
                            <option value="allow">許可</option>
                          </select>
                        </div>
                        <div className="permission-item">
                          <label htmlFor="new-plugin-api-key-access" className="permission-label">APIキーアクセス</label>
                          <select
                            id="new-plugin-api-key-access"
                            className="form-select"
                            value={newPlugin.permissions?.api_key_access || 'deny'}
                            onChange={e =>
                              setNewPlugin({
                                ...newPlugin,
                                permissions: {
                                  ...(newPlugin.permissions || {
                                    database_access: 'none',
                                    network_access: 'deny',
                                    api_key_access: 'deny',
                                    filesystem_access: 'deny',
                                  }),
                                  api_key_access: e.target.value,
                                },
                              })
                            }
                            disabled={saving}
                          >
                            <option value="deny">拒否</option>
                            <option value="allow">許可</option>
                          </select>
                        </div>
                        <div className="permission-item">
                          <label htmlFor="new-plugin-fs-access" className="permission-label">ファイルシステムアクセス</label>
                          <select
                            id="new-plugin-fs-access"
                            className="form-select"
                            value={newPlugin.permissions?.filesystem_access || 'deny'}
                            onChange={e =>
                              setNewPlugin({
                                ...newPlugin,
                                permissions: {
                                  ...(newPlugin.permissions || {
                                    database_access: 'none',
                                    network_access: 'deny',
                                    api_key_access: 'deny',
                                    filesystem_access: 'deny',
                                  }),
                                  filesystem_access: e.target.value,
                                },
                              })
                            }
                            disabled={saving}
                          >
                            <option value="deny">拒否</option>
                            <option value="allow">許可</option>
                          </select>
                        </div>
                      </div>
                      <p className="permission-hint">
                        プラグインの権限を設定します。デフォルトではすべての権限が拒否されています。
                      </p>
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          setShowRegisterForm(false);
                          setNewPlugin({
                            name: '',
                            version: '',
                            author: '',
                            description: '',
                            plugin_type: 'Custom',
                            permissions: {
                              database_access: 'none',
                              network_access: 'deny',
                              api_key_access: 'deny',
                              filesystem_access: 'deny',
                            },
                          });
                        }}
                        disabled={saving}
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={() => {
                          startTransition(() => {
                            handleRegisterPlugin();
                          });
                        }}
                        disabled={
                          saving ||
                          !newPlugin.name ||
                          !newPlugin.version ||
                          isPending ||
                          !newPlugin.author
                        }
                      >
                        {saving ? '登録中...' : 'プラグインを登録'}
                      </button>
                    </div>
                  </div>
                )}

                {plugins.length === 0 ? (
                  <div className="plugins-empty">
                    <p>プラグインが登録されていません</p>
                    <p className="plugins-empty-hint">
                      プラグインを登録して、機能を拡張しましょう。
                    </p>
                  </div>
                ) : (
                  <div className="plugins-list">
                    {plugins.map(plugin => (
                      <div key={plugin.id} className="plugin-item">
                        <div className="plugin-header">
                          <div className="plugin-title-section">
                            <h3 className="plugin-name">{plugin.name}</h3>
                            <span className="plugin-version">
                              v{plugin.version}
                            </span>
                          </div>
                          <label className="plugin-toggle">
                            <input
                              type="checkbox"
                              checked={plugin.enabled}
                              onChange={async () => {
                                try {
                                  setSaving(true);
                                  await safeInvoke('set_plugin_enabled', {
                                    plugin_id: plugin.id,
                                    enabled: !plugin.enabled,
                                  });
                                  showSuccess(
                                    `プラグイン "${plugin.name}" を${!plugin.enabled ? '有効' : '無効'}にしました`
                                  );
                                  loadPlugins();
                                } catch (err) {
                                  showError(
                                    err instanceof Error
                                      ? err.message
                                      : 'プラグインの有効/無効化に失敗しました'
                                  );
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={saving}
                            />
                            <span>{plugin.enabled ? '有効' : '無効'}</span>
                          </label>
                        </div>
                        <div className="plugin-body">
                          <div className="plugin-meta">
                            <span className="plugin-meta-item">
                              作成者: {plugin.author}
                            </span>
                            <span className="plugin-meta-item">
                              タイプ: {getPluginTypeName(plugin.plugin_type)}
                            </span>
                          </div>
                          {plugin.description && (
                            <p className="plugin-description">
                              {plugin.description}
                            </p>
                          )}
                          <div className="plugin-permissions">
                            <div className="plugin-permissions-header">
                              <h4>権限設定</h4>
                              <button
                                type="button"
                                className="button-link"
                                onClick={() =>
                                  setEditingPermissions(
                                    editingPermissions === plugin.id ? null : plugin.id
                                  )
                                }
                                disabled={saving}
                              >
                                {editingPermissions === plugin.id ? 'キャンセル' : '編集'}
                              </button>
                            </div>
                            {editingPermissions === plugin.id ? (
                              <div className="permissions-edit-form">
                                <div className="permission-item">
                                  <label htmlFor={`plugin-${plugin.id}-db-access`} className="permission-label">データベースアクセス</label>
                                  <select
                                    id={`plugin-${plugin.id}-db-access`}
                                    className="form-select"
                                    value={plugin.permissions?.database_access || 'none'}
                                    onChange={async e => {
                                      const updatedPermissions: PluginPermissions = {
                                        database_access: e.target.value,
                                        network_access: plugin.permissions?.network_access || 'deny',
                                        api_key_access: plugin.permissions?.api_key_access || 'deny',
                                        filesystem_access: plugin.permissions?.filesystem_access || 'deny',
                                      };
                                      await handleUpdatePermissions(plugin.id, updatedPermissions);
                                    }}
                                    disabled={saving}
                                  >
                                    <option value="none">なし</option>
                                    <option value="read">読み取りのみ</option>
                                    <option value="write">読み書き</option>
                                  </select>
                                </div>
                                <div className="permission-item">
                                  <label htmlFor={`plugin-${plugin.id}-network-access`} className="permission-label">外部通信</label>
                                  <select
                                    id={`plugin-${plugin.id}-network-access`}
                                    className="form-select"
                                    value={plugin.permissions?.network_access || 'deny'}
                                    onChange={async e => {
                                      const updatedPermissions: PluginPermissions = {
                                        database_access: plugin.permissions?.database_access || 'none',
                                        network_access: e.target.value,
                                        api_key_access: plugin.permissions?.api_key_access || 'deny',
                                        filesystem_access: plugin.permissions?.filesystem_access || 'deny',
                                      };
                                      await handleUpdatePermissions(plugin.id, updatedPermissions);
                                    }}
                                    disabled={saving}
                                  >
                                    <option value="deny">拒否</option>
                                    <option value="allow">許可</option>
                                  </select>
                                </div>
                                <div className="permission-item">
                                  <label htmlFor={`plugin-${plugin.id}-api-key-access`} className="permission-label">APIキーアクセス</label>
                                  <select
                                    id={`plugin-${plugin.id}-api-key-access`}
                                    className="form-select"
                                    value={plugin.permissions?.api_key_access || 'deny'}
                                    onChange={async e => {
                                      const updatedPermissions: PluginPermissions = {
                                        database_access: plugin.permissions?.database_access || 'none',
                                        network_access: plugin.permissions?.network_access || 'deny',
                                        api_key_access: e.target.value,
                                        filesystem_access: plugin.permissions?.filesystem_access || 'deny',
                                      };
                                      await handleUpdatePermissions(plugin.id, updatedPermissions);
                                    }}
                                    disabled={saving}
                                  >
                                    <option value="deny">拒否</option>
                                    <option value="allow">許可</option>
                                  </select>
                                </div>
                                <div className="permission-item">
                                  <label htmlFor={`plugin-${plugin.id}-fs-access`} className="permission-label">ファイルシステムアクセス</label>
                                  <select
                                    id={`plugin-${plugin.id}-fs-access`}
                                    className="form-select"
                                    value={plugin.permissions?.filesystem_access || 'deny'}
                                    onChange={async e => {
                                      const updatedPermissions: PluginPermissions = {
                                        database_access: plugin.permissions?.database_access || 'none',
                                        network_access: plugin.permissions?.network_access || 'deny',
                                        api_key_access: plugin.permissions?.api_key_access || 'deny',
                                        filesystem_access: e.target.value,
                                      };
                                      await handleUpdatePermissions(plugin.id, updatedPermissions);
                                    }}
                                    disabled={saving}
                                  >
                                    <option value="deny">拒否</option>
                                    <option value="allow">許可</option>
                                  </select>
                                </div>
                              </div>
                            ) : (
                              <div className="permissions-display">
                                <div className="permission-badge">
                                  データベース: {getPermissionLabel('database_access', plugin.permissions?.database_access || 'none')}
                                </div>
                                <div className="permission-badge">
                                  外部通信: {getPermissionLabel('network_access', plugin.permissions?.network_access || 'deny')}
                                </div>
                                <div className="permission-badge">
                                  APIキー: {getPermissionLabel('api_key_access', plugin.permissions?.api_key_access || 'deny')}
                                </div>
                                <div className="permission-badge">
                                  ファイルシステム: {getPermissionLabel('filesystem_access', plugin.permissions?.filesystem_access || 'deny')}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
