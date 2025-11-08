// CertificateManagement - 証明書管理ページ
// SSL証明書の管理（Let's Encrypt証明書の取得・更新）

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { logger } from '../utils/logger';
import './CertificateManagement.css';

/**
 * 証明書情報
 */
interface CertificateInfo {
  domain: string;
  issuer: string;
  valid_from: string;
  valid_to: string;
  status: string; // 'valid' | 'expiring' | 'expired'
}

/**
 * 証明書管理ページ
 */
export const CertificateManagement: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const [error, setError] = useState<string | null>(null);
  // const [newDomain, setNewDomain] = useState('');

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: 'ホーム', path: '/' },
    { label: '設定', path: '/settings' },
    { label: '証明書管理' },
  ], []);

  useEffect(() => {
    loadCertificates();
  }, []);

  /**
   * 証明書一覧を読み込む
   */
  const loadCertificates = async () => {
    try {
      setLoading(true);
      setError(null);

      // 証明書一覧を取得
      const certificatesData = await safeInvoke<CertificateInfo[]>(
        'get_all_certificates',
        {}
      );
      setCertificates(certificatesData);
    } catch (err) {
      // エラーは静かに処理（基盤実装のため）
      logger.warn('証明書の読み込みに失敗しました', err instanceof Error ? err.message : String(err), 'CertificateManagement');
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 証明書を更新
   */
  const handleRenewCertificate = async (_domain: string) => {
    try {
      setRenewing(true);

      // スケジューラで証明書更新タスクを実行
      await safeInvoke('start_schedule_task', {
        task_type: 'CertificateRenewal',
      });

      showSuccess('証明書の更新を開始しました');
      loadCertificates();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : '証明書の更新に失敗しました'
      );
    } finally {
      setRenewing(false);
    }
  };

  /**
   * 証明書のステータスを取得
   */
  const getCertificateStatus = (cert: CertificateInfo): string => {
    switch (cert.status) {
      case 'valid':
        return '有効';
      case 'expiring':
        return '期限切れ間近';
      case 'expired':
        return '期限切れ';
      default:
        return '不明';
    }
  };

  /**
   * 証明書のステータスクラスを取得
   */
  const getCertificateStatusClass = (cert: CertificateInfo): string => {
    switch (cert.status) {
      case 'valid':
        return 'cert-status-valid';
      case 'expiring':
        return 'cert-status-expiring';
      case 'expired':
        return 'cert-status-expired';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="certificate-management-page">
        <div className="certificate-management-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="certificate-management-header">
            <SkeletonLoader type="button" width="100px" />
            <SkeletonLoader type="title" width="200px" />
          </header>
          <div className="certificate-management-content">
            <SkeletonLoader type="card" count={1} />
            <SkeletonLoader type="list" count={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="certificate-management-page">
      <div className="certificate-management-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="certificate-management-header">
          <button className="back-button" onClick={() => navigate('/settings')}>
            ← 戻る
          </button>
          <h1>証明書管理</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="certificate-management-content">
          <div className="certificate-info-banner">
            <h2>Let&apos;s Encrypt証明書管理</h2>
            <p>
              SSL証明書の管理ができます。Let&apos;s
              Encryptを使用した証明書の自動取得・更新機能の基盤が実装されています。
            </p>
            <ul className="certificate-features-list">
              <li>Let&apos;s Encryptによる無料SSL証明書の自動取得</li>
              <li>証明書の自動更新（期限切れ前に自動更新）</li>
              <li>複数ドメインの証明書管理</li>
              <li>証明書の有効期限監視</li>
            </ul>
          </div>

          <div className="certificates-list">
            {certificates.length === 0 ? (
              <div className="certificates-empty">
                <p>証明書が登録されていません</p>
                <p className="certificates-empty-hint">
                  証明書の自動取得機能の基盤が実装されています。実際の証明書取得には、acmeライブラリの統合が必要です。
                </p>
              </div>
            ) : (
              certificates.map((cert, index) => (
                <div key={index} className="certificate-item">
                  <div className="certificate-header">
                    <h3 className="certificate-domain">{cert.domain}</h3>
                    <span
                      className={`certificate-status ${getCertificateStatusClass(cert)}`}
                    >
                      {getCertificateStatus(cert)}
                    </span>
                  </div>
                  <div className="certificate-details">
                    <div className="certificate-detail-row">
                      <span className="certificate-detail-label">発行者:</span>
                      <span className="certificate-detail-value">
                        {cert.issuer}
                      </span>
                    </div>
                    <div className="certificate-detail-row">
                      <span className="certificate-detail-label">
                        有効期限開始:
                      </span>
                      <span className="certificate-detail-value">
                        {cert.valid_from}
                      </span>
                    </div>
                    <div className="certificate-detail-row">
                      <span className="certificate-detail-label">
                        有効期限終了:
                      </span>
                      <span className="certificate-detail-value">
                        {cert.valid_to}
                      </span>
                    </div>
                  </div>
                  <div className="certificate-actions">
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => {
                        startTransition(() => {
                          handleRenewCertificate(cert.domain);
                        });
                      }}
                      disabled={renewing || isPending}
                    >
                      {renewing ? '更新中...' : '証明書を更新'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
