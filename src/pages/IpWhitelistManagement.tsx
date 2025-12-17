// IP Whitelist Management page

import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import {
  fetchWhitelistedIps,
  addWhitelistedIp,
  removeWhitelistedIp,
  WhitelistedIp,
} from '../services/security';
import { formatDateTime } from '../utils/formatters';
import { createErrorHandler } from '../utils/errorHandler';
import { TIMING } from '@/config/constants';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { SuccessMessage } from '../components/common/SuccessMessage';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import './IpWhitelistManagement.css';

export const IpWhitelistManagement: React.FC = () => {
  const { t } = useI18n();
  const [whitelistedIps, setWhitelistedIps] = useState<WhitelistedIp[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newIp, setNewIp] = useState<string>('');
  const [adding, setAdding] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const handleLoadError = useCallback(
    (err: unknown) => {
      const handler = createErrorHandler({
        defaultMessage:
          t('security.fetchError') || 'Failed to fetch whitelisted IPs',
      });
      return handler(err);
    },
    [t]
  );

  const handleAddError = useCallback(
    (err: unknown) => {
      const handler = createErrorHandler({
        defaultMessage:
          t('security.addWhitelistError') || 'Failed to add IP to whitelist',
      });
      return handler(err);
    },
    [t]
  );

  const handleRemoveError = useCallback(
    (err: unknown) => {
      const handler = createErrorHandler({
        defaultMessage:
          t('security.removeWhitelistError') ||
          'Failed to remove IP from whitelist',
      });
      return handler(err);
    },
    [t]
  );

  const loadWhitelistedIps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWhitelistedIps();
      setWhitelistedIps(data);
    } catch (err) {
      const result = handleLoadError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
    } finally {
      setLoading(false);
    }
  }, [handleLoadError]);

  useEffect(() => {
    void loadWhitelistedIps();
  }, [loadWhitelistedIps]);

  const validateIpAddress = useCallback((ip: string): boolean => {
    // IPv4 regex
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    // IPv6 regex (simplified)
    const ipv6Regex =
      /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:)*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }, []);

  const validateIpOrCidr = useCallback(
    (input: string): boolean => {
      const trimmed = input.trim();
      if (!trimmed) {
        return false;
      }

      // Check if it's a CIDR notation (e.g., 192.168.1.0/24)
      if (trimmed.includes('/')) {
        const [ip, prefix] = trimmed.split('/');
        const prefixNum = parseInt(prefix, 10);
        if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 128) {
          return false;
        }
        // Validate IP part
        return validateIpAddress(ip);
      }

      // Validate as regular IP address
      return validateIpAddress(trimmed);
    },
    [validateIpAddress]
  );

  const handleAdd = useCallback(async () => {
    const trimmedIp = newIp.trim();
    if (!trimmedIp) {
      setError(t('security.ipRequired') || 'IP address or CIDR is required');
      return;
    }

    if (!validateIpOrCidr(trimmedIp)) {
      setError(
        t('security.invalidIpFormat') ||
          'Invalid IP address or CIDR format. Please enter a valid IPv4/IPv6 address or CIDR notation (e.g., 192.168.1.0/24)'
      );
      return;
    }

    setAdding(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await addWhitelistedIp(trimmedIp);
      setSuccessMessage(
        t('security.addWhitelistSuccess', { ip: trimmedIp }) ||
          `IP ${trimmedIp} added to whitelist successfully`
      );
      setNewIp('');
      await loadWhitelistedIps();
    } catch (err) {
      const result = handleAddError(err);
      if (result.shouldShow) {
        setError(result.message);
      }
    } finally {
      setAdding(false);
    }
  }, [newIp, loadWhitelistedIps, handleAddError, t, validateIpOrCidr]);

  const handleRemove = useCallback(
    (ip: string) => {
      setConfirmDialog({
        message:
          t('security.removeWhitelistConfirm', { ip }) ||
          `Remove ${ip} from whitelist?`,
        onConfirm: async () => {
          setConfirmDialog(null);
          setError(null);
          setSuccessMessage(null);
          try {
            await removeWhitelistedIp(ip);
            setSuccessMessage(
              t('security.removeWhitelistSuccess', { ip }) ||
                `IP ${ip} removed from whitelist successfully`
            );
            await loadWhitelistedIps();
          } catch (err) {
            const result = handleRemoveError(err);
            if (result.shouldShow) {
              setError(result.message);
            }
          }
        },
        danger: true,
      });
    },
    [loadWhitelistedIps, handleRemoveError, t]
  );

  if (loading && whitelistedIps.length === 0) {
    return (
      <div className="ip-whitelist-management">
        <LoadingSpinner
          size="medium"
          message={t('common.loading') || '読み込み中...'}
        />
      </div>
    );
  }

  return (
    <div className="ip-whitelist-management">
      <div className="page-header">
        <h1>
          {t('security.ipWhitelistManagement') || 'IP Whitelist Management'}
        </h1>
        <div className="page-actions">
          <button className="button-primary" onClick={loadWhitelistedIps}>
            {t('security.refresh') || 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      {successMessage && (
        <SuccessMessage
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          autoDismiss={TIMING.MESSAGE_AUTO_DISMISS_MS}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          danger={confirmDialog.danger}
        />
      )}

      <div className="whitelist-summary">
        <div className="summary-item">
          <span className="summary-label">
            {t('security.totalWhitelisted') || 'Total Whitelisted'}:
          </span>
          <span className="summary-value">{whitelistedIps.length}</span>
        </div>
      </div>

      <div className="add-ip-section">
        <h2>{t('security.addIpToWhitelist') || 'Add IP to Whitelist'}</h2>
        <div className="add-ip-form">
          <input
            type="text"
            value={newIp}
            onChange={e => setNewIp(e.target.value)}
            placeholder={
              t('security.ipOrCidrPlaceholder') ||
              'e.g., 192.168.1.0/24 or 10.0.0.1'
            }
            className="ip-input"
            disabled={adding}
            onKeyPress={e => {
              if (e.key === 'Enter') {
                void handleAdd();
              }
            }}
          />
          <button
            className="button-primary"
            onClick={handleAdd}
            disabled={adding || !newIp.trim()}
          >
            {adding
              ? t('common.adding') || 'Adding...'
              : t('security.add') || 'Add'}
          </button>
        </div>
        <small className="form-hint">
          {t('security.ipWhitelistHint') ||
            'Enter an IP address (IPv4 or IPv6) or CIDR notation (e.g., 192.168.1.0/24)'}
        </small>
      </div>

      {whitelistedIps.length === 0 ? (
        <div className="empty-state">
          <p>{t('security.noWhitelistedIps') || 'No IPs in whitelist'}</p>
        </div>
      ) : (
        <div className="whitelist-table">
          <table>
            <thead>
              <tr>
                <th>{t('security.ipAddress') || 'IP Address / CIDR'}</th>
                <th>{t('security.addedAt') || 'Added At'}</th>
                <th>{t('common.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {whitelistedIps.map(ip => (
                <tr key={ip.ip}>
                  <td>
                    <code>{ip.ip}</code>
                  </td>
                  <td>{formatDateTime(ip.addedAt)}</td>
                  <td>
                    <button
                      className="button-danger-small"
                      onClick={() => handleRemove(ip.ip)}
                      disabled={loading}
                    >
                      {t('security.remove') || 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
