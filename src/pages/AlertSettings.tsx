// Alert Settings page

import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useNotifications } from '../components/common/NotificationSystem';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { SuccessMessage } from '../components/common/SuccessMessage';
import { safeInvoke } from '../utils/tauri';
import './AlertSettings.css';

export interface AlertRule {
  id: string;
  eventType: string;
  severity: string;
  threshold?: number;
  enabled: boolean;
  notifyUI: boolean;
  notifyLog: boolean;
}

export const AlertSettings: React.FC = () => {
  const { t } = useI18n();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rules, setRules] = useState<AlertRule[]>([]);

  const eventTypes = [
    { value: 'intrusion', label: t('security.intrusion') || 'Intrusion Detection' },
    { value: 'anomaly', label: t('security.anomaly') || 'Anomaly Detection' },
    { value: 'rate_limit', label: t('security.rateLimit') || 'Rate Limit Exceeded' },
    { value: 'api_error', label: t('security.apiError') || 'API Error' },
  ];

  const severities = [
    { value: 'critical', label: t('security.critical') || 'Critical' },
    { value: 'high', label: t('security.high') || 'High' },
    { value: 'medium', label: t('security.medium') || 'Medium' },
    { value: 'low', label: t('security.low') || 'Low' },
  ];

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to load from config
      const response = await safeInvoke<{
        version?: string;
        data?: { rules?: AlertRule[] };
      }>('ipc_config_get', { key: 'alert_rules' });

      if (response && 'data' in response && response.data) {
        const rulesData = response.data.rules;
        if (Array.isArray(rulesData)) {
          setRules(rulesData);
        } else {
          // Initialize with default rules
          setRules(getDefaultRules());
        }
      } else {
        setRules(getDefaultRules());
      }
    } catch (err) {
      // If config doesn't exist, use defaults
      setRules(getDefaultRules());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const getDefaultRules = (): AlertRule[] => {
    return [
      {
        id: 'intrusion-critical',
        eventType: 'intrusion',
        severity: 'critical',
        threshold: 90,
        enabled: true,
        notifyUI: true,
        notifyLog: true,
      },
      {
        id: 'intrusion-high',
        eventType: 'intrusion',
        severity: 'high',
        threshold: 70,
        enabled: true,
        notifyUI: true,
        notifyLog: true,
      },
      {
        id: 'anomaly-critical',
        eventType: 'anomaly',
        severity: 'critical',
        enabled: true,
        notifyUI: true,
        notifyLog: true,
      },
    ];
  };

  const handleRuleChange = (id: string, field: keyof AlertRule, value: unknown) => {
    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule))
    );
  };

  const handleAddRule = () => {
    const newRule: AlertRule = {
      id: `rule-${Date.now()}`,
      eventType: 'intrusion',
      severity: 'medium',
      enabled: true,
      notifyUI: true,
      notifyLog: true,
    };
    setRules((prev) => [...prev, newRule]);
  };

  const handleRemoveRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await safeInvoke('ipc_config_set', {
        key: 'alert_rules',
        value: JSON.stringify(rules),
      });

      setSuccessMessage(t('alertSettings.saveSuccess') || 'Alert settings saved successfully');
      addNotification({
        message: t('alertSettings.saveSuccess') || 'Alert settings saved successfully',
        severity: 'success',
      });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t('alertSettings.saveError') || 'Failed to save alert settings';
      setError(errorMessage);
      addNotification({
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="alert-settings">
        <LoadingSpinner message={t('common.loading') || 'Loading...'} />
      </div>
    );
  }

  return (
    <div className="alert-settings">
      <div className="page-header">
        <h1>{t('alertSettings.title') || 'Alert Settings'}</h1>
        <div className="page-actions">
          <button className="button-secondary" onClick={handleAddRule}>
            {t('alertSettings.addRule') || 'Add Rule'}
          </button>
          <button className="button-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') || 'Saving...' : t('common.save') || 'Save'}
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {successMessage && (
        <SuccessMessage
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
        />
      )}

      <div className="alert-settings-content">
        <p className="page-description">
          {t('alertSettings.description') ||
            'Configure alert rules for security events. Alerts can be displayed as UI notifications or logged to the audit log.'}
        </p>

        {rules.length === 0 ? (
          <div className="empty-state">
            <p>{t('alertSettings.noRules') || 'No alert rules configured'}</p>
            <button className="button-primary" onClick={handleAddRule}>
              {t('alertSettings.addFirstRule') || 'Add First Rule'}
            </button>
          </div>
        ) : (
          <div className="rules-list">
            {rules.map((rule) => (
              <div key={rule.id} className="rule-card">
                <div className="rule-header">
                  <h3>
                    {eventTypes.find((e) => e.value === rule.eventType)?.label || rule.eventType} -{' '}
                    {severities.find((s) => s.value === rule.severity)?.label || rule.severity}
                  </h3>
                  <button
                    className="button-danger-small"
                    onClick={() => handleRemoveRule(rule.id)}
                  >
                    {t('common.delete') || 'Delete'}
                  </button>
                </div>
                <div className="rule-fields">
                  <div className="form-field">
                    <label>
                      {t('alertSettings.eventType') || 'Event Type'}
                      <select
                        value={rule.eventType}
                        onChange={(e) =>
                          handleRuleChange(rule.id, 'eventType', e.target.value)
                        }
                      >
                        {eventTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-field">
                    <label>
                      {t('alertSettings.severity') || 'Severity'}
                      <select
                        value={rule.severity}
                        onChange={(e) =>
                          handleRuleChange(rule.id, 'severity', e.target.value)
                        }
                      >
                        {severities.map((sev) => (
                          <option key={sev.value} value={sev.value}>
                            {sev.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {rule.eventType === 'intrusion' && (
                    <div className="form-field">
                      <label>
                        {t('alertSettings.threshold') || 'Threshold'}
                        <input
                          type="number"
                          value={rule.threshold || ''}
                          onChange={(e) =>
                            handleRuleChange(
                              rule.id,
                              'threshold',
                              parseInt(e.target.value, 10) || undefined
                            )
                          }
                          min={0}
                          max={100}
                        />
                      </label>
                    </div>
                  )}
                  <div className="form-field checkbox-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) =>
                          handleRuleChange(rule.id, 'enabled', e.target.checked)
                        }
                      />
                      {t('alertSettings.enabled') || 'Enabled'}
                    </label>
                  </div>
                  <div className="form-field checkbox-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.notifyUI}
                        onChange={(e) =>
                          handleRuleChange(rule.id, 'notifyUI', e.target.checked)
                        }
                      />
                      {t('alertSettings.notifyUI') || 'Show UI Notification'}
                    </label>
                  </div>
                  <div className="form-field checkbox-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={rule.notifyLog}
                        onChange={(e) =>
                          handleRuleChange(rule.id, 'notifyLog', e.target.checked)
                        }
                      />
                      {t('alertSettings.notifyLog') || 'Log to Audit Log'}
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

