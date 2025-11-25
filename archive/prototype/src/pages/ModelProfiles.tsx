// SPDX-License-Identifier: MIT
// ModelProfiles - モデルプロファイル管理ページ

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import { formatDateTime } from '../utils/formatters';
import {
  deleteModelProfile,
  fetchModelProfiles,
  ModelProfile,
  saveModelProfile,
} from '../services/modelProfiles';
import './ModelProfiles.css';

const DEFAULT_PARAMETERS = `{
  "temperature": 0.7,
  "max_tokens": 512
}`;

export const ModelProfiles: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showError, showSuccess } = useNotifications();

  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [engineFilter, setEngineFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');

  const [engineId, setEngineId] = useState('');
  const [modelId, setModelId] = useState('');
  const [label, setLabel] = useState('');
  const [parametersText, setParametersText] = useState(DEFAULT_PARAMETERS);
  const [editingId, setEditingId] = useState<string | null>(null);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('modelManagement.title') || 'モデル管理', path: '/models' },
      { label: 'モデルプロファイル' },
    ],
    [t]
  );

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchModelProfiles({
        engine: engineFilter.trim() || undefined,
        model: modelFilter.trim() || undefined,
      });
      setProfiles(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'モデルプロファイルの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  }, [engineFilter, modelFilter]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const resetForm = () => {
    setEngineId('');
    setModelId('');
    setLabel('');
    setParametersText(DEFAULT_PARAMETERS);
    setEditingId(null);
  };

  const handleEdit = (profile: ModelProfile) => {
    setEditingId(profile.id);
    setEngineId(profile.engineId);
    setModelId(profile.modelId);
    setLabel(profile.label);
    setParametersText(
      JSON.stringify(profile.parameters, null, 2) || DEFAULT_PARAMETERS
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!engineId.trim() || !modelId.trim() || !label.trim()) {
      showError('必須項目を入力してください');
      return;
    }

    let parsedParameters: unknown;
    try {
      parsedParameters = JSON.parse(parametersText);
    } catch (parseErr) {
      showError(
        'パラメータJSONを解析できません。正しいJSON形式で入力してください。'
      );
      return;
    }

    try {
      await saveModelProfile({
        engineId: engineId.trim(),
        modelId: modelId.trim(),
        label: label.trim(),
        parameters: parsedParameters,
      });
      showSuccess('モデルプロファイルを保存しました', '', 3000);
      await loadProfiles();
      resetForm();
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'モデルプロファイルの保存に失敗しました'
      );
    }
  };

  const handleDelete = async (profile: ModelProfile) => {
    const confirmed = window.confirm(
      `プロファイル「${profile.label}」を削除しますか？この操作は元に戻せません。`
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteModelProfile(profile.id);
      showSuccess('モデルプロファイルを削除しました', '', 3000);
      if (editingId === profile.id) {
        resetForm();
      }
      await loadProfiles();
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'モデルプロファイルの削除に失敗しました'
      );
    }
  };

  return (
    <div className="page-background model-profiles-page">
      <div className="page-container model-profiles-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="page-header model-profiles-header">
          <div className="header-top">
            <button className="back-button" onClick={() => navigate('/models')}>
              ← モデル管理に戻る
            </button>
            <h1>モデルプロファイル管理</h1>
          </div>
          <p className="header-description">
            モデルごとの推奨パラメータ（温度、トークン数など）を保存し、CLI / UI から再利用できます。
          </p>
        </header>

        <div className="model-profiles-layout">
          <section className="card profiles-list-card">
            <div className="section-header">
              <h2>登録済みプロファイル</h2>
              <div className="filter-row">
                <input
                  placeholder="エンジンID (例: ollama)"
                  value={engineFilter}
                  onChange={event => setEngineFilter(event.target.value)}
                />
                <input
                  placeholder="モデルID (例: flm://ollama/llama3)"
                  value={modelFilter}
                  onChange={event => setModelFilter(event.target.value)}
                />
                <button onClick={() => void loadProfiles()}>フィルター</button>
                <button
                  className="secondary"
                  onClick={() => {
                    setEngineFilter('');
                    setModelFilter('');
                    void loadProfiles();
                  }}
                >
                  クリア
                </button>
              </div>
            </div>

            {error && (
              <ErrorMessage
                message={error}
                type="api"
                onClose={() => setError(null)}
              />
            )}

            {loading ? (
              <p className="muted">読み込み中...</p>
            ) : profiles.length === 0 ? (
              <p className="muted">プロファイルはまだありません。</p>
            ) : (
              <div className="profiles-table-wrapper">
                <table className="profiles-table">
                  <thead>
                    <tr>
                      <th>エンジン</th>
                      <th>モデル</th>
                      <th>ラベル</th>
                      <th>バージョン</th>
                      <th>更新日時</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map(profile => (
                      <tr key={profile.id}>
                        <td>{profile.engineId}</td>
                        <td>{profile.modelId}</td>
                        <td>{profile.label}</td>
                        <td>{profile.version}</td>
                        <td>{formatDateTime(profile.updatedAt)}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="link-button"
                              onClick={() => handleEdit(profile)}
                            >
                              編集
                            </button>
                            <button
                              className="link-button danger"
                              onClick={() => handleDelete(profile)}
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card profiles-form-card">
            <h2>{editingId ? 'プロファイルを更新' : '新しいプロファイルを作成'}</h2>
            <form onSubmit={handleSubmit} className="profiles-form">
              <label>
                エンジンID
                <input
                  value={engineId}
                  onChange={event => setEngineId(event.target.value)}
                  placeholder="例: ollama"
                  required
                />
              </label>

              <label>
                モデルID
                <input
                  value={modelId}
                  onChange={event => setModelId(event.target.value)}
                  placeholder="例: flm://ollama/llama3"
                  required
                />
              </label>

              <label>
                ラベル
                <input
                  value={label}
                  onChange={event => setLabel(event.target.value)}
                  placeholder="例: production"
                  required
                />
              </label>

              <label>
                パラメータ (JSON)
                <textarea
                  value={parametersText}
                  onChange={event => setParametersText(event.target.value)}
                  rows={10}
                  required
                />
              </label>

              <div className="form-actions">
                <button type="submit">
                  {editingId ? '保存' : '作成'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={resetForm}
                >
                  フォームをリセット
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

