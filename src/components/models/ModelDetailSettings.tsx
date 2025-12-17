// Model Detail Settings Component
// Provides dynamic form for engine-specific parameters

import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { safeInvoke } from '../../utils/tauri';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import './ModelDetailSettings.css';

export interface EngineCapability {
  id: string;
  name: string;
  parameters?: Record<string, ParameterDefinition>;
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: unknown;
  min?: number;
  max?: number;
  enum?: unknown[];
  required?: boolean;
}

export interface ModelDetailSettingsProps {
  engineId: string;
  modelId: string;
  parameters: Record<string, unknown>;
  onChange: (parameters: Record<string, unknown>) => void;
  onError?: (error: string) => void;
}

export const ModelDetailSettings: React.FC<ModelDetailSettingsProps> = ({
  engineId,
  modelId: _modelId,
  parameters,
  onChange,
  onError,
}) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<EngineCapability | null>(
    null
  );
  const [localParameters, setLocalParameters] =
    useState<Record<string, unknown>>(parameters);

  useEffect(() => {
    setLocalParameters(parameters);
  }, [parameters]);

  const loadCapabilities = useCallback(async () => {
    if (!engineId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try to get engine capabilities from backend
      // For now, we'll use a fallback approach since the API might not be fully implemented
      const enginesResponse = await safeInvoke<{
        version?: string;
        data?: {
          engines?: Array<{ id: string; name: string; capabilities?: unknown }>;
        };
      }>('ipc_detect_engines', { fresh: false });

      let engineCapabilities: EngineCapability | null = null;

      if (
        enginesResponse &&
        'data' in enginesResponse &&
        enginesResponse.data
      ) {
        const engines = enginesResponse.data.engines;
        if (Array.isArray(engines)) {
          const engine = engines.find(e => e.id === engineId);
          if (engine && 'capabilities' in engine) {
            // Parse capabilities if available
            engineCapabilities = {
              id: engine.id,
              name: engine.name || engine.id,
              parameters: parseCapabilities(engine.capabilities),
            };
          }
        }
      }

      // If no capabilities found, use default parameter definitions based on engine type
      if (!engineCapabilities) {
        engineCapabilities = getDefaultCapabilities(engineId);
      }

      setCapabilities(engineCapabilities);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to load engine capabilities';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
      // Fallback to default capabilities
      setCapabilities(getDefaultCapabilities(engineId));
    } finally {
      setLoading(false);
    }
  }, [engineId, onError]);

  useEffect(() => {
    void loadCapabilities();
  }, [loadCapabilities]);

  const handleParameterChange = (key: string, value: unknown) => {
    const updated = { ...localParameters, [key]: value };
    setLocalParameters(updated);
    onChange(updated);
  };

  const renderParameterField = (
    key: string,
    definition: ParameterDefinition,
    value: unknown
  ): React.ReactNode => {
    const fieldId = `param-${key}`;
    const displayValue = value !== undefined ? value : definition.default;

    switch (definition.type) {
      case 'boolean':
        return (
          <div key={key} className="parameter-field">
            <label htmlFor={fieldId} className="parameter-label">
              {key}
              {definition.required && <span className="required">*</span>}
            </label>
            <input
              id={fieldId}
              type="checkbox"
              checked={displayValue === true}
              onChange={e => handleParameterChange(key, e.target.checked)}
              className="parameter-input parameter-checkbox"
            />
            {definition.description && (
              <small className="parameter-hint">{definition.description}</small>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={key} className="parameter-field">
            <label htmlFor={fieldId} className="parameter-label">
              {key}
              {definition.required && <span className="required">*</span>}
            </label>
            <input
              id={fieldId}
              type="number"
              value={displayValue as number}
              onChange={e =>
                handleParameterChange(key, parseFloat(e.target.value) || 0)
              }
              min={definition.min}
              max={definition.max}
              step="any"
              className="parameter-input parameter-number"
            />
            {definition.description && (
              <small className="parameter-hint">{definition.description}</small>
            )}
          </div>
        );

      case 'string':
        if (definition.enum && definition.enum.length > 0) {
          return (
            <div key={key} className="parameter-field">
              <label htmlFor={fieldId} className="parameter-label">
                {key}
                {definition.required && <span className="required">*</span>}
              </label>
              <select
                id={fieldId}
                value={(displayValue as string) || ''}
                onChange={e => handleParameterChange(key, e.target.value)}
                className="parameter-input parameter-select"
              >
                {definition.enum.map(option => (
                  <option key={String(option)} value={String(option)}>
                    {String(option)}
                  </option>
                ))}
              </select>
              {definition.description && (
                <small className="parameter-hint">
                  {definition.description}
                </small>
              )}
            </div>
          );
        }
        return (
          <div key={key} className="parameter-field">
            <label htmlFor={fieldId} className="parameter-label">
              {key}
              {definition.required && <span className="required">*</span>}
            </label>
            <input
              id={fieldId}
              type="text"
              value={(displayValue as string) || ''}
              onChange={e => handleParameterChange(key, e.target.value)}
              className="parameter-input parameter-text"
            />
            {definition.description && (
              <small className="parameter-hint">{definition.description}</small>
            )}
          </div>
        );

      case 'array':
      case 'object':
        return (
          <div key={key} className="parameter-field">
            <label htmlFor={fieldId} className="parameter-label">
              {key}
              {definition.required && <span className="required">*</span>}
            </label>
            <textarea
              id={fieldId}
              value={JSON.stringify(displayValue, null, 2)}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleParameterChange(key, parsed);
                } catch {
                  // Invalid JSON, keep as string for now
                }
              }}
              className="parameter-input parameter-textarea"
              rows={4}
            />
            {definition.description && (
              <small className="parameter-hint">{definition.description}</small>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="model-detail-settings">
        <LoadingSpinner
          message={
            t('modelProfiles.loadingCapabilities') || 'Loading capabilities...'
          }
        />
      </div>
    );
  }

  if (error && !capabilities) {
    return (
      <div className="model-detail-settings">
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      </div>
    );
  }

  if (!capabilities || !capabilities.parameters) {
    return (
      <div className="model-detail-settings">
        <p className="no-capabilities">
          {t('modelProfiles.noCapabilities') ||
            'No parameter definitions available for this engine.'}
        </p>
      </div>
    );
  }

  const parameterEntries = Object.entries(capabilities.parameters);

  return (
    <div className="model-detail-settings">
      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}
      <div className="capabilities-header">
        <h3>
          {t('modelProfiles.engineParameters') || 'Engine Parameters'} (
          {capabilities.name})
        </h3>
        <p className="capabilities-description">
          {t('modelProfiles.parametersDescription') ||
            'Configure engine-specific parameters for this model profile.'}
        </p>
      </div>
      <div className="parameters-form">
        {parameterEntries.length === 0 ? (
          <p className="no-parameters">
            {t('modelProfiles.noParameters') ||
              'No parameters defined for this engine.'}
          </p>
        ) : (
          parameterEntries.map(([key, definition]) =>
            renderParameterField(key, definition, localParameters[key])
          )
        )}
      </div>
    </div>
  );
};

// Helper function to parse capabilities from backend response
function parseCapabilities(
  capabilities: unknown
): Record<string, ParameterDefinition> | undefined {
  if (!capabilities || typeof capabilities !== 'object') {
    return undefined;
  }

  try {
    const parsed = capabilities as Record<string, unknown>;
    const result: Record<string, ParameterDefinition> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === 'object') {
        const def = value as Record<string, unknown>;
        result[key] = {
          type: (def.type as ParameterDefinition['type']) || 'string',
          description: def.description as string | undefined,
          default: def.default,
          min: def.min as number | undefined,
          max: def.max as number | undefined,
          enum: def.enum as unknown[] | undefined,
          required: def.required as boolean | undefined,
        };
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

// Get default parameter definitions based on engine type
function getDefaultCapabilities(engineId: string): EngineCapability {
  const commonParameters: Record<string, ParameterDefinition> = {
    temperature: {
      type: 'number',
      description: 'Sampling temperature (0.0 to 2.0)',
      default: 0.7,
      min: 0,
      max: 2,
    },
    max_tokens: {
      type: 'number',
      description: 'Maximum number of tokens to generate',
      default: 512,
      min: 1,
      max: 4096,
    },
    top_p: {
      type: 'number',
      description: 'Nucleus sampling parameter (0.0 to 1.0)',
      default: 0.9,
      min: 0,
      max: 1,
    },
    top_k: {
      type: 'number',
      description: 'Top-k sampling parameter',
      default: 40,
      min: 1,
    },
    frequency_penalty: {
      type: 'number',
      description: 'Frequency penalty (-2.0 to 2.0)',
      default: 0,
      min: -2,
      max: 2,
    },
    presence_penalty: {
      type: 'number',
      description: 'Presence penalty (-2.0 to 2.0)',
      default: 0,
      min: -2,
      max: 2,
    },
  };

  // Engine-specific parameters
  const engineSpecific: Record<string, Record<string, ParameterDefinition>> = {
    ollama: {
      num_ctx: {
        type: 'number',
        description: 'Context window size',
        default: 2048,
        min: 512,
        max: 32768,
      },
      num_predict: {
        type: 'number',
        description: 'Maximum number of tokens to predict',
        default: -1,
        min: -1,
      },
      repeat_penalty: {
        type: 'number',
        description: 'Repeat penalty',
        default: 1.1,
        min: 0,
      },
    },
    vllm: {
      max_model_len: {
        type: 'number',
        description: 'Maximum model length',
        default: 2048,
        min: 512,
      },
      gpu_memory_utilization: {
        type: 'number',
        description: 'GPU memory utilization (0.0 to 1.0)',
        default: 0.9,
        min: 0,
        max: 1,
      },
    },
    'lm-studio': {
      stop: {
        type: 'array',
        description: 'Stop sequences',
        default: [],
      },
      stream: {
        type: 'boolean',
        description: 'Enable streaming',
        default: false,
      },
    },
  };

  const engineParams = engineSpecific[engineId.toLowerCase()] || {};
  const allParameters = { ...commonParameters, ...engineParams };

  return {
    id: engineId,
    name: engineId,
    parameters: allParameters,
  };
}
