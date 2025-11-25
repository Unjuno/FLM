// SPDX-License-Identifier: MIT
// ApiSetup - API Setup page for model selection, API keys, security policy, and config

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import { formatDateTime } from '../utils/formatters';
import {
  fetchModelOptions,
  refreshEngines,
  ModelOption,
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  ApiKey,
  CreateApiKeyResult,
  fetchSecurityPolicy,
  saveSecurityPolicy,
  SecurityPolicy,
  SecurityPolicyInput,
  fetchConfigList,
  getConfigValue,
  setConfigValue,
  ConfigEntry,
} from '../services/apiSetup';
import './ApiSetup.css';

export const ApiSetup: React.FC = () => {
  const { t } = useI18n();
  const { showError, showSuccess } = useNotifications();

  const [activeTab, setActiveTab] = useState<
    'models' | 'api-keys' | 'security' | 'config'
  >('models');

  // Model Selection
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [refreshingEngines, setRefreshingEngines] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResult | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  // Security Policy
  const [securityPolicy, setSecurityPolicy] = useState<SecurityPolicy | null>(null);
  const [policyForm, setPolicyForm] = useState<SecurityPolicyInput>({});
  const [advancedMode, setAdvancedMode] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Config
  const [configEntries, setConfigEntries] = useState<ConfigEntry[]>([]);
  const [editingConfigKey, setEditingConfigKey] = useState<string | null>(null);
  const [editingConfigValue, setEditingConfigValue] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'API設定' },
    ],
    [t]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [models, keys, policy, config] = await Promise.all([
        fetchModelOptions(),
        fetchApiKeys(),
        fetchSecurityPolicy(),
        fetchConfigList(),
      ]);
      setModelOptions(models);
      setApiKeys(keys);
      setSecurityPolicy(policy);
      setPolicyForm({
        ipWhitelist: policy.ipWhitelist,
        cors: policy.cors,
        rateLimit: policy.rateLimit,
      });
      setConfigEntries(config);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'データの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefreshEngines = async () => {
    setRefreshingEngines(true);
    try {
      await refreshEngines(true);
      const models = await fetchModelOptions();
      setModelOptions(models);
      showSuccess('エンジンを再検出しました');
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'エンジンの再検出に失敗しました'
      );
    } finally {
      setRefreshingEngines(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyLabel.trim()) {
      showError('ラベルを入力してください');
      return;
    }
    setCreatingKey(true);
    try {
      const result = await createApiKey(newKeyLabel.trim());
      setCreatedKey(result);
      setNewKeyLabel('');
      await loadData();
      showSuccess('APIキーを作成しました');
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'APIキーの作成に失敗しました'
      );
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm('このAPIキーを失効させますか？')) {
      return;
    }
    setRevokingKeyId(id);
    try {
      await revokeApiKey(id);
      await loadData();
      showSuccess('APIキーを失効させました');
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'APIキーの失効に失敗しました'
      );
    } finally {
      setRevokingKeyId(null);
    }
  };

  const handleSaveSecurityPolicy = async () => {
    setSavingPolicy(true);
    try {
      await saveSecurityPolicy(advancedMode ? { rawJson: policyForm.rawJson } : policyForm);
      await loadData();
      showSuccess('セキュリティポリシーを保存しました');
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'セキュリティポリシーの保存に失敗しました'
      );
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleEditConfig = async (key: string) => {
    try {
      const value = await getConfigValue(key);
      setEditingConfigKey(key);
      setEditingConfigValue(value || '');
    } catch (err) {
      showError(
        err instanceof Error ? err.message : '設定値の取得に失敗しました'
      );
    }
  };

  const handleSaveConfig = async () => {
    if (editingConfigKey === null) return;
    try {
      await setConfigValue(editingConfigKey, editingConfigValue);
      setEditingConfigKey(null);
      await loadData();
      showSuccess('設定を保存しました');
    } catch (err) {
      showError(err instanceof Error ? err.message : '設定の保存に失敗しました');
    }
  };

  if (loading && !securityPolicy && apiKeys.length === 0) {
    return (
      <div className="api-setup">
        <Breadcrumb items={breadcrumbItems} />
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="api-setup">
      <Breadcrumb items={breadcrumbItems} />
      <div className="page-header">
        <h1>API設定</h1>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="api-setup-tabs">
        <button
          className={`tab-button ${activeTab === 'models' ? 'active' : ''}`}
          onClick={() => setActiveTab('models')}
        >
          モデル選択
        </button>
        <button
          className={`tab-button ${activeTab === 'api-keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('api-keys')}
        >
          APIキー管理
        </button>
        <button
          className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          セキュリティポリシー
        </button>
        <button
          className={`tab-button ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          設定値
        </button>
      </div>

      <div className="api-setup-content">
        {/* Model Selection Tab */}
        {activeTab === 'models' && (
          <div className="setup-section">
            <div className="section-header">
              <h2>モデル選択</h2>
              <button
                className="button-secondary"
                onClick={handleRefreshEngines}
                disabled={refreshingEngines}
              >
                {refreshingEngines ? '検出中...' : 'エンジン再検出'}
              </button>
            </div>
            <div className="section-content">
              <label>
                モデル:
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="model-select"
                >
                  <option value="">選択してください</option>
                  {modelOptions.map((opt) => (
                    <option key={opt.displayName} value={opt.displayName}>
                      {opt.displayName}
                    </option>
                  ))}
                </select>
              </label>
              {selectedModel && (
                <div className="selected-model-info">
                  <p>選択されたモデル: <code>{selectedModel}</code></p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'api-keys' && (
          <div className="setup-section">
            <div className="section-header">
              <h2>APIキー管理</h2>
            </div>
            <div className="section-content">
              {createdKey && (
                <div className="created-key-alert">
                  <h3>APIキーが作成されました</h3>
                  <p>
                    <strong>ID:</strong> {createdKey.id}
                  </p>
                  <p>
                    <strong>ラベル:</strong> {createdKey.label}
                  </p>
                  <p>
                    <strong>APIキー:</strong>
                  </p>
                  <code className="api-key-display">{createdKey.apiKey}</code>
                  <p className="warning">
                    このキーは一度だけ表示されます。必ずコピーして安全な場所に保存してください。
                  </p>
                  <button
                    className="button-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(createdKey.apiKey);
                      showSuccess('APIキーをクリップボードにコピーしました');
                    }}
                  >
                    コピー
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => setCreatedKey(null)}
                  >
                    閉じる
                  </button>
                </div>
              )}

              <div className="create-key-form">
                <h3>新規APIキー作成</h3>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="ラベル"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    className="input-text"
                  />
                  <button
                    className="button-primary"
                    onClick={handleCreateApiKey}
                    disabled={creatingKey || !newKeyLabel.trim()}
                  >
                    {creatingKey ? '作成中...' : '作成'}
                  </button>
                </div>
              </div>

              <div className="api-keys-list">
                <h3>APIキー一覧</h3>
                {apiKeys.length === 0 ? (
                  <div className="empty-state">APIキーがありません</div>
                ) : (
                  <table className="api-keys-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>ラベル</th>
                        <th>作成日時</th>
                        <th>状態</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.map((key) => (
                        <tr key={key.id}>
                          <td>
                            <code>{key.id}</code>
                          </td>
                          <td>{key.label}</td>
                          <td>{formatDateTime(key.createdAt)}</td>
                          <td>
                            {key.revokedAt ? (
                              <span className="status-badge status-revoked">失効</span>
                            ) : (
                              <span className="status-badge status-active">有効</span>
                            )}
                          </td>
                          <td>
                            {!key.revokedAt && (
                              <button
                                className="button-danger button-small"
                                onClick={() => handleRevokeApiKey(key.id)}
                                disabled={revokingKeyId === key.id}
                              >
                                {revokingKeyId === key.id ? '失効中...' : '失効'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Security Policy Tab */}
        {activeTab === 'security' && securityPolicy && (
          <div className="setup-section">
            <div className="section-header">
              <h2>セキュリティポリシー</h2>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={advancedMode}
                  onChange={(e) => setAdvancedMode(e.target.checked)}
                />
                <span>Advanced (JSON編集)</span>
              </label>
            </div>
            <div className="section-content">
              {advancedMode ? (
                <div className="policy-json-editor">
                  <label>
                    JSON:
                    <textarea
                      value={policyForm.rawJson || securityPolicy.rawJson}
                      onChange={(e) =>
                        setPolicyForm({ ...policyForm, rawJson: e.target.value })
                      }
                      className="json-textarea"
                      rows={20}
                    />
                  </label>
                </div>
              ) : (
                <div className="policy-form">
                  <div className="form-group">
                    <label>
                      IPホワイトリスト (1行に1つのIPまたはCIDR):
                      <textarea
                        value={
                          (policyForm.ipWhitelist || securityPolicy.ipWhitelist).join(
                            '\n'
                          )
                        }
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            ipWhitelist: e.target.value
                              .split('\n')
                              .map((s) => s.trim())
                              .filter((s) => s.length > 0),
                          })
                        }
                        className="textarea"
                        rows={5}
                      />
                    </label>
                  </div>

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={policyForm.cors !== null}
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            cors: e.target.checked
                              ? {
                                  allowedOrigins: [],
                                  allowedMethods: ['GET', 'POST'],
                                  allowedHeaders: ['Content-Type', 'Authorization'],
                                }
                              : null,
                          })
                        }
                      />
                      CORSを有効化
                    </label>
                    {policyForm.cors !== null && (
                      <div className="nested-form">
                        <label>
                          許可されたオリジン (1行に1つ):
                          <textarea
                            value={policyForm.cors.allowedOrigins.join('\n')}
                            onChange={(e) =>
                              setPolicyForm({
                                ...policyForm,
                                cors: {
                                  ...policyForm.cors!,
                                  allowedOrigins: e.target.value
                                    .split('\n')
                                    .map((s) => s.trim())
                                    .filter((s) => s.length > 0),
                                },
                              })
                            }
                            className="textarea"
                            rows={3}
                          />
                        </label>
                        <label>
                          許可されたメソッド (カンマ区切り):
                          <input
                            type="text"
                            value={policyForm.cors.allowedMethods.join(', ')}
                            onChange={(e) =>
                              setPolicyForm({
                                ...policyForm,
                                cors: {
                                  ...policyForm.cors!,
                                  allowedMethods: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter((s) => s.length > 0),
                                },
                              })
                            }
                            className="input-text"
                          />
                        </label>
                        <label>
                          許可されたヘッダー (カンマ区切り):
                          <input
                            type="text"
                            value={policyForm.cors.allowedHeaders.join(', ')}
                            onChange={(e) =>
                              setPolicyForm({
                                ...policyForm,
                                cors: {
                                  ...policyForm.cors!,
                                  allowedHeaders: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter((s) => s.length > 0),
                                },
                              })
                            }
                            className="input-text"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={policyForm.rateLimit !== null}
                        onChange={(e) =>
                          setPolicyForm({
                            ...policyForm,
                            rateLimit: e.target.checked
                              ? {
                                  requestsPerMinute: 60,
                                  burstSize: 10,
                                }
                              : null,
                          })
                        }
                      />
                      レート制限を有効化
                    </label>
                    {policyForm.rateLimit !== null && (
                      <div className="nested-form">
                        <label>
                          1分あたりのリクエスト数:
                          <input
                            type="number"
                            value={policyForm.rateLimit.requestsPerMinute}
                            onChange={(e) =>
                              setPolicyForm({
                                ...policyForm,
                                rateLimit: {
                                  ...policyForm.rateLimit!,
                                  requestsPerMinute: parseInt(e.target.value, 10) || 60,
                                },
                              })
                            }
                            className="input-number"
                            min="1"
                          />
                        </label>
                        <label>
                          バーストサイズ:
                          <input
                            type="number"
                            value={policyForm.rateLimit.burstSize}
                            onChange={(e) =>
                              setPolicyForm({
                                ...policyForm,
                                rateLimit: {
                                  ...policyForm.rateLimit!,
                                  burstSize: parseInt(e.target.value, 10) || 10,
                                },
                              })
                            }
                            className="input-number"
                            min="1"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button
                  className="button-primary"
                  onClick={handleSaveSecurityPolicy}
                  disabled={savingPolicy}
                >
                  {savingPolicy ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Config Tab */}
        {activeTab === 'config' && (
          <div className="setup-section">
            <div className="section-header">
              <h2>設定値</h2>
            </div>
            <div className="section-content">
              {configEntries.length === 0 ? (
                <div className="empty-state">設定値がありません</div>
              ) : (
                <table className="config-table">
                  <thead>
                    <tr>
                      <th>キー</th>
                      <th>値</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configEntries.map((entry) => (
                      <tr key={entry.key}>
                        <td>
                          <code>{entry.key}</code>
                        </td>
                        <td>
                          {editingConfigKey === entry.key ? (
                            <input
                              type="text"
                              value={editingConfigValue}
                              onChange={(e) => setEditingConfigValue(e.target.value)}
                              className="input-text"
                            />
                          ) : (
                            <code>{entry.value}</code>
                          )}
                        </td>
                        <td>
                          {editingConfigKey === entry.key ? (
                            <>
                              <button
                                className="button-primary button-small"
                                onClick={handleSaveConfig}
                              >
                                保存
                              </button>
                              <button
                                className="button-secondary button-small"
                                onClick={() => {
                                  setEditingConfigKey(null);
                                  setEditingConfigValue('');
                                }}
                              >
                                キャンセル
                              </button>
                            </>
                          ) : (
                            <button
                              className="button-secondary button-small"
                              onClick={() => handleEditConfig(entry.key)}
                            >
                              編集
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

