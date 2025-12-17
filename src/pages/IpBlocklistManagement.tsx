// IP Blocklist Management page

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import {
  fetchBlockedIps,
  unblockIp,
  clearTemporaryBlocks,
  BlockedIp,
} from '../services/security';
import { formatDateTime } from '../utils/formatters';
import { createErrorHandler } from '../utils/errorHandler';
import { TIMING } from '@/config/constants';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { SuccessMessage } from '../components/common/SuccessMessage';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import './IpBlocklistManagement.css';

export const IpBlocklistManagement: React.FC = () => {
  const { t } = useI18n();
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const handleLoadError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: t('security.fetchError'),
      }),
    [t]
  );

  const handleUnblockError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: t('security.unblockError'),
      }),
    [t]
  );

  const handleClearError = useMemo(
    () =>
      createErrorHandler({
        defaultMessage: t('security.clearTemporaryError'),
      }),
    [t]
  );

  const loadBlockedIps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBlockedIps();
      setBlockedIps(data);
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
    void loadBlockedIps();
  }, [loadBlockedIps]);

  const handleUnblock = useCallback(
    async (ip: string) => {
      setConfirmDialog({
        message: t('security.unblockConfirm', { ip }),
        onConfirm: async () => {
          setConfirmDialog(null);
          setError(null);
          setSuccessMessage(null);
          try {
            await unblockIp(ip);
            setSuccessMessage(t('security.unblockSuccess', { ip }));
            await loadBlockedIps();
          } catch (err) {
            const result = handleUnblockError(err);
            if (result.shouldShow) {
              setError(result.message);
            }
          }
        },
      });
    },
    [loadBlockedIps, handleUnblockError, t]
  );

  const handleClearTemporary = useCallback(() => {
    setConfirmDialog({
      message: t('security.clearTemporaryConfirm'),
      onConfirm: async () => {
        setConfirmDialog(null);
        setError(null);
        setSuccessMessage(null);
        try {
          await clearTemporaryBlocks();
          setSuccessMessage(t('security.clearTemporarySuccess'));
          await loadBlockedIps();
        } catch (err) {
          const result = handleClearError(err);
          if (result.shouldShow) {
            setError(result.message);
          }
        }
      },
    });
  }, [loadBlockedIps, handleClearError, t]);

  /**
   * Memoize filtered blocks to avoid recalculating on every render
   * why: ブロックリストのフィルタリングは計算コストが低いが、頻繁に再レンダリングされる可能性があるため
   * alt: 毎回計算（パフォーマンスへの影響は小さいが、最適化として実施）
   * evidence: Reactパフォーマンスベストプラクティス
   */
  const permanentBlocks = useMemo(
    () => blockedIps.filter(ip => ip.permanentBlock),
    [blockedIps]
  );
  const temporaryBlocks = useMemo(
    () => blockedIps.filter(ip => !ip.permanentBlock),
    [blockedIps]
  );

  if (loading) {
    return (
      <div className="ip-blocklist-management">
        <LoadingSpinner size="medium" message="読み込み中..." />
      </div>
    );
  }

  return (
    <div className="ip-blocklist-management">
      <div className="page-header">
        <h1>{t('security.ipBlocklistManagement')}</h1>
        <div className="page-actions">
          {temporaryBlocks.length > 0 && (
            <button className="button-secondary" onClick={handleClearTemporary}>
              {t('security.clearAllTemporary')}
            </button>
          )}
          <button className="button-primary" onClick={loadBlockedIps}>
            {t('security.refresh')}
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

      <div className="blocklist-summary">
        <div className="summary-item">
          <span className="summary-label">{t('security.totalBlocks')}:</span>
          <span className="summary-value">{blockedIps.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">
            {t('security.permanentBlocks')}:
          </span>
          <span className="summary-value">{permanentBlocks.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">
            {t('security.temporaryBlocks')}:
          </span>
          <span className="summary-value">{temporaryBlocks.length}</span>
        </div>
      </div>

      {blockedIps.length === 0 ? (
        <div className="empty-state">
          <p>{t('security.noBlockedIps')}</p>
        </div>
      ) : (
        <div className="blocklist-table">
          <table>
            <thead>
              <tr>
                <th>{t('security.ipAddress')}</th>
                <th>{t('security.failureCount')}</th>
                <th>{t('security.firstFailureAt')}</th>
                <th>{t('security.blockedUntil')}</th>
                <th>{t('security.lastAttempt')}</th>
                <th>{t('security.type')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {blockedIps.map(ip => (
                <tr key={ip.ip}>
                  <td>
                    <code>{ip.ip}</code>
                  </td>
                  <td>{ip.failureCount}</td>
                  <td>{formatDateTime(ip.firstFailureAt)}</td>
                  <td>
                    {ip.blockedUntil
                      ? formatDateTime(ip.blockedUntil)
                      : t('security.permanent')}
                  </td>
                  <td>{formatDateTime(ip.lastAttempt)}</td>
                  <td>
                    <span
                      className={`block-type ${
                        ip.permanentBlock ? 'permanent' : 'temporary'
                      }`}
                    >
                      {ip.permanentBlock
                        ? t('security.permanent')
                        : t('security.temporary')}
                    </span>
                  </td>
                  <td>
                    <button
                      className="button-danger-small"
                      onClick={() => handleUnblock(ip.ip)}
                      disabled={ip.permanentBlock}
                      title={
                        ip.permanentBlock
                          ? t('security.cannotUnblockPermanent')
                          : t('security.unblock')
                      }
                    >
                      {t('security.unblock')}
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
