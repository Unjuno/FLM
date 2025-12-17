// Model Profiles page

import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import {
  deleteModelProfile,
  fetchModelProfiles,
  ModelProfile,
  saveModelProfile,
} from '../services/modelProfiles';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ModelDetailSettings } from '../components/models/ModelDetailSettings';
import { formatDateTime } from '../utils/formatters';
import './ModelProfiles.css';

const DEFAULT_PARAMETERS = `{
  "temperature": 0.7,
  "max_tokens": 512
}`;

export const ModelProfiles: React.FC = () => {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [engineFilter, setEngineFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');

  const [engineId, setEngineId] = useState('');
  const [modelId, setModelId] = useState('');
  const [label, setLabel] = useState('');
  const [parametersText, setParametersText] = useState(DEFAULT_PARAMETERS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetailSettings, setShowDetailSettings] = useState(false);

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
        err instanceof Error
          ? err.message
          : t('modelProfiles.fetchError') || 'Failed to fetch model profiles'
      );
    } finally {
      setLoading(false);
    }
  }, [engineFilter, modelFilter, t]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const resetForm = () => {
    setEngineId('');
    setModelId('');
    setLabel('');
    setParametersText(DEFAULT_PARAMETERS);
    setEditingId(null);
    setShowForm(false);
    setShowDetailSettings(false);
  };

  const handleEdit = (profile: ModelProfile) => {
    setEditingId(profile.id);
    setEngineId(profile.engineId);
    setModelId(profile.modelId);
    setLabel(profile.label);
    setParametersText(
      JSON.stringify(profile.parameters, null, 2) || DEFAULT_PARAMETERS
    );
    setShowForm(true);
  };

  const handleParametersChange = (newParameters: Record<string, unknown>) => {
    setParametersText(JSON.stringify(newParameters, null, 2));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!engineId.trim() || !modelId.trim() || !label.trim()) {
      setError(
        t('modelProfiles.requiredFields') || 'Required fields are missing'
      );
      return;
    }

    let parsedParameters: Record<string, unknown>;
    try {
      parsedParameters = JSON.parse(parametersText) as Record<string, unknown>;
    } catch (parseErr) {
      setError(
        t('modelProfiles.invalidJson') ||
          'Invalid JSON format. Please enter valid JSON.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await saveModelProfile({
        engineId: engineId.trim(),
        modelId: modelId.trim(),
        label: label.trim(),
        parameters: parsedParameters,
      });
      setSuccessMessage(
        editingId
          ? t('modelProfiles.updateSuccess') ||
              'Model profile updated successfully'
          : t('modelProfiles.createSuccess') ||
              'Model profile created successfully'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadProfiles();
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('modelProfiles.saveError') || 'Failed to save model profile'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (profile: ModelProfile) => {
    const confirmed = window.confirm(
      t('modelProfiles.deleteConfirm', { label: profile.label }) ||
        `Delete profile "${profile.label}"? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await deleteModelProfile(profile.id);
      setSuccessMessage(
        t('modelProfiles.deleteSuccess') || 'Model profile deleted successfully'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      if (editingId === profile.id) {
        resetForm();
      }
      await loadProfiles();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('modelProfiles.deleteError') || 'Failed to delete model profile'
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(profile => {
    if (
      engineFilter &&
      !profile.engineId.toLowerCase().includes(engineFilter.toLowerCase())
    ) {
      return false;
    }
    if (
      modelFilter &&
      !profile.modelId.toLowerCase().includes(modelFilter.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="model-profiles-page">
      <h1>{t('modelProfiles.title') || 'Model Profiles'}</h1>
      <p className="page-description">
        {t('modelProfiles.description') ||
          'Manage model-specific parameter profiles for different engines.'}
      </p>

      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      {successMessage && (
        <div className="success-message">
          {successMessage}
          <button
            className="success-dismiss"
            onClick={() => setSuccessMessage(null)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      <div className="model-profiles-content">
        <div className="model-profiles-filters">
          <div className="filter-group">
            <label htmlFor="engine-filter">
              {t('modelProfiles.filterByEngine') || 'Filter by Engine'}
            </label>
            <input
              id="engine-filter"
              type="text"
              value={engineFilter}
              onChange={e => setEngineFilter(e.target.value)}
              placeholder={
                t('modelProfiles.enginePlaceholder') || 'e.g., ollama'
              }
            />
          </div>
          <div className="filter-group">
            <label htmlFor="model-filter">
              {t('modelProfiles.filterByModel') || 'Filter by Model'}
            </label>
            <input
              id="model-filter"
              type="text"
              value={modelFilter}
              onChange={e => setModelFilter(e.target.value)}
              placeholder={
                t('modelProfiles.modelPlaceholder') || 'e.g., llama3'
              }
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowForm(!showForm)}
            disabled={loading}
          >
            {showForm
              ? t('common.cancel') || 'Cancel'
              : t('modelProfiles.createNew') || 'Create New Profile'}
          </button>
        </div>

        {showForm && (
          <div className="model-profiles-form">
            <h2>
              {editingId
                ? t('modelProfiles.editProfile') || 'Edit Profile'
                : t('modelProfiles.createProfile') || 'Create Profile'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="engine-id">
                  {t('modelProfiles.engineId') || 'Engine ID'} *
                </label>
                <input
                  id="engine-id"
                  type="text"
                  value={engineId}
                  onChange={e => setEngineId(e.target.value)}
                  placeholder="e.g., ollama"
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="model-id">
                  {t('modelProfiles.modelId') || 'Model ID'} *
                </label>
                <input
                  id="model-id"
                  type="text"
                  value={modelId}
                  onChange={e => setModelId(e.target.value)}
                  placeholder="e.g., flm://ollama/llama3"
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="label">
                  {t('modelProfiles.label') || 'Label'} *
                </label>
                <input
                  id="label"
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder={
                    t('modelProfiles.labelPlaceholder') || 'Profile name'
                  }
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <label htmlFor="parameters">
                    {t('modelProfiles.parameters') || 'Parameters (JSON)'} *
                  </label>
                  {engineId && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowDetailSettings(!showDetailSettings)}
                      disabled={loading}
                      style={{
                        fontSize: '0.875rem',
                        padding: '0.25rem 0.75rem',
                      }}
                    >
                      {showDetailSettings
                        ? t('modelProfiles.hideAdvanced') || 'Hide Advanced'
                        : t('modelProfiles.showAdvanced') ||
                          'Show Advanced Settings'}
                    </button>
                  )}
                </div>
                {showDetailSettings && engineId && modelId ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <ModelDetailSettings
                      engineId={engineId}
                      modelId={modelId}
                      parameters={(() => {
                        try {
                          return JSON.parse(parametersText) as Record<
                            string,
                            unknown
                          >;
                        } catch {
                          return {};
                        }
                      })()}
                      onChange={handleParametersChange}
                      onError={err => setError(err)}
                    />
                  </div>
                ) : null}
                <textarea
                  id="parameters"
                  value={parametersText}
                  onChange={e => setParametersText(e.target.value)}
                  rows={showDetailSettings ? 6 : 10}
                  required
                  disabled={loading}
                  placeholder={DEFAULT_PARAMETERS}
                />
                <small className="form-hint">
                  {t('modelProfiles.parametersHint') ||
                    'Enter parameters as JSON. Example: {"temperature": 0.7, "max_tokens": 512}'}
                </small>
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="small" />{' '}
                      {t('common.loading') || 'Loading...'}
                    </>
                  ) : (
                    t('common.save') || 'Save'
                  )}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetForm}
                  disabled={loading}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="model-profiles-list">
          <h2>{t('modelProfiles.profilesList') || 'Profiles'}</h2>
          {loading && !showForm ? (
            <LoadingSpinner message={t('common.loading') || 'Loading...'} />
          ) : filteredProfiles.length === 0 ? (
            <p className="empty-message">
              {t('modelProfiles.noProfiles') || 'No profiles found'}
            </p>
          ) : (
            <div className="profiles-table">
              <table>
                <thead>
                  <tr>
                    <th>{t('modelProfiles.label') || 'Label'}</th>
                    <th>{t('modelProfiles.engineId') || 'Engine'}</th>
                    <th>{t('modelProfiles.modelId') || 'Model'}</th>
                    <th>{t('modelProfiles.updatedAt') || 'Updated'}</th>
                    <th>{t('common.actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map(profile => (
                    <tr key={profile.id}>
                      <td>{profile.label}</td>
                      <td>{profile.engineId}</td>
                      <td>{profile.modelId}</td>
                      <td>{formatDateTime(profile.updatedAt)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-edit"
                            onClick={() => handleEdit(profile)}
                            disabled={loading}
                            aria-label={t('common.edit') || 'Edit'}
                          >
                            {t('common.edit') || 'Edit'}
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(profile)}
                            disabled={loading}
                            aria-label={t('common.delete') || 'Delete'}
                          >
                            {t('common.delete') || 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
