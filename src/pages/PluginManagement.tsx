// PluginManagement - プラグイン管理ページ
// サードパーティプラグインの管理

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './PluginManagement.css';

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
}

/**
 * プラグイン管理ページ
 */
export const PluginManagement: React.FC = () => {
  const navigate = useNavigate();
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
  });

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

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
      setError(err instanceof Error ? err.message : 'プラグインの読み込みに失敗しました');
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
      });

      showSuccess('プラグインを登録しました');
      setNewPlugin({
        name: '',
        version: '',
        author: '',
        description: '',
        plugin_type: 'Custom',
      });
      setShowRegisterForm(false);
      loadPlugins();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'プラグインの登録に失敗しました');
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

  if (loading) {
    return (
      <div className="plugin-management-page">
        <div className="plugin-management-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>プラグインを読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-management-page">
      <div className="plugin-management-container">
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
                    onChange={(e) => setNewPlugin({ ...newPlugin, name: e.target.value })}
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
                    onChange={(e) => setNewPlugin({ ...newPlugin, version: e.target.value })}
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
                    onChange={(e) => setNewPlugin({ ...newPlugin, author: e.target.value })}
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
                    onChange={(e) => setNewPlugin({ ...newPlugin, description: e.target.value })}
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
                    onChange={(e) => setNewPlugin({ ...newPlugin, plugin_type: e.target.value })}
                    disabled={saving}
                  >
                    <option value="Engine">エンジン</option>
                    <option value="Model">モデル</option>
                    <option value="Auth">認証</option>
                    <option value="Logging">ログ</option>
                    <option value="Custom">カスタム</option>
                  </select>
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
                      });
                    }}
                    disabled={saving}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleRegisterPlugin}
                    disabled={saving || !newPlugin.name || !newPlugin.version || !newPlugin.author}
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
                {plugins.map((plugin) => (
                  <div key={plugin.id} className="plugin-item">
                    <div className="plugin-header">
                      <div className="plugin-title-section">
                        <h3 className="plugin-name">{plugin.name}</h3>
                        <span className="plugin-version">v{plugin.version}</span>
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
                              showSuccess(`プラグイン "${plugin.name}" を${!plugin.enabled ? '有効' : '無効'}にしました`);
                              loadPlugins();
                            } catch (err) {
                              showError(err instanceof Error ? err.message : 'プラグインの有効/無効化に失敗しました');
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
                        <p className="plugin-description">{plugin.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

