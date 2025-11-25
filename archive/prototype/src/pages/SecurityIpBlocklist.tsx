// SPDX-License-Identifier: MIT
// SecurityIpBlocklist - IPブロックリスト管理ページ

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import { formatDateTime } from '../utils/formatters';
import {
  fetchBlockedIps,
  unblockIp,
  clearTemporaryBlocks,
  BlockedIp,
} from '../services/security';
import './SecurityIpBlocklist.css';

export const SecurityIpBlocklist: React.FC = () => {
  const { t } = useI18n();
  const { showError, showSuccess } = useNotifications();

  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'セキュリティ', path: '/security' },
      { label: 'IPブロックリスト' },
    ],
    [t]
  );

  const loadBlockedIps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBlockedIps();
      setBlockedIps(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'IPブロックリストの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlockedIps();
  }, [loadBlockedIps]);

  const handleUnblock = useCallback(
    async (ip: string) => {
      try {
        await unblockIp(ip);
        showSuccess(`IP ${ip} のブロックを解除しました`);
        await loadBlockedIps();
      } catch (err) {
        showError(
          err instanceof Error
            ? err.message
            : 'IPブロックの解除に失敗しました'
        );
      }
    },
    [loadBlockedIps, showError, showSuccess]
  );

  const handleClearTemporary = useCallback(async () => {
    if (
      !window.confirm(
        'すべての一時ブロックを解除しますか？永続ブロックは残ります。'
      )
    ) {
      return;
    }

    try {
      await clearTemporaryBlocks();
      showSuccess('すべての一時ブロックを解除しました');
      await loadBlockedIps();
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : '一時ブロックの解除に失敗しました'
      );
    }
  }, [loadBlockedIps, showError, showSuccess]);

  const permanentBlocks = blockedIps.filter((ip) => ip.permanentBlock);
  const temporaryBlocks = blockedIps.filter((ip) => !ip.permanentBlock);

  if (loading) {
    return (
      <div className="security-ip-blocklist">
        <Breadcrumb items={breadcrumbItems} />
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="security-ip-blocklist">
        <Breadcrumb items={breadcrumbItems} />
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="security-ip-blocklist">
      <Breadcrumb items={breadcrumbItems} />
      <div className="page-header">
        <h1>IPブロックリスト</h1>
        <div className="page-actions">
          {temporaryBlocks.length > 0 && (
            <button
              className="button-secondary"
              onClick={handleClearTemporary}
            >
              一時ブロックをすべて解除
            </button>
          )}
          <button className="button-primary" onClick={loadBlockedIps}>
            更新
          </button>
        </div>
      </div>

      <div className="blocklist-summary">
        <div className="summary-item">
          <span className="summary-label">総ブロック数:</span>
          <span className="summary-value">{blockedIps.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">永続ブロック:</span>
          <span className="summary-value">{permanentBlocks.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">一時ブロック:</span>
          <span className="summary-value">{temporaryBlocks.length}</span>
        </div>
      </div>

      {blockedIps.length === 0 ? (
        <div className="empty-state">
          <p>ブロックされたIPアドレスはありません</p>
        </div>
      ) : (
        <div className="blocklist-table">
          <table>
            <thead>
              <tr>
                <th>IPアドレス</th>
                <th>失敗回数</th>
                <th>初回失敗日時</th>
                <th>ブロック期限</th>
                <th>最終試行日時</th>
                <th>種類</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {blockedIps.map((ip) => (
                <tr key={ip.ip}>
                  <td>
                    <code>{ip.ip}</code>
                  </td>
                  <td>{ip.failureCount}</td>
                  <td>{formatDateTime(ip.firstFailureAt)}</td>
                  <td>
                    {ip.blockedUntil
                      ? formatDateTime(ip.blockedUntil)
                      : '永続'}
                  </td>
                  <td>{formatDateTime(ip.lastAttempt)}</td>
                  <td>
                    <span
                      className={`block-type ${
                        ip.permanentBlock ? 'permanent' : 'temporary'
                      }`}
                    >
                      {ip.permanentBlock ? '永続' : '一時'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="button-danger-small"
                      onClick={() => handleUnblock(ip.ip)}
                      disabled={ip.permanentBlock}
                      title={
                        ip.permanentBlock
                          ? '永続ブロックは解除できません'
                          : 'ブロックを解除'
                      }
                    >
                      解除
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

