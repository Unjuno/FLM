// CertificateManagement - 証明書管理ページ
// SSL証明書の管理（Let's Encrypt証明書の取得・更新）

import React, {
  useState,
  useEffect,
  useTransition,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import { logger } from '../utils/logger';
import { copyToClipboard } from '../utils/clipboard';
import { extractErrorMessage } from '../utils/errorHandler';
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
 * ACME統合ガイドの各ステップ
 */
interface IntegrationStep {
  id: string;
  title: string;
  description: string[];
  codeTitle?: string;
  code?: string;
  checklist?: string[];
}

/**
 * 証明書管理ページ
 */
export const CertificateManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showSuccess, showError } = useNotifications();
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const [error, setError] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  // const [newDomain, setNewDomain] = useState('');

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('header.settings') || '設定', path: '/settings' },
    { label: t('certificateManagement.title') || '証明書管理' },
  ], [t]);

  /**
   * ACMEライブラリ統合ガイド
   */
  const integrationSteps: IntegrationStep[] = useMemo(
    () => [
      {
        id: 'dependencies',
        title: '1. バックエンドにacmeライブラリを追加する',
        description: [
          'まずはTauriバックエンドでacme-clientを使用できるように依存関係を追加します。以下のコマンドはPowerShellまたはターミナルで実行できます。',
          '既存の依存関係とバージョン衝突がある場合は、Cargo.tomlを確認しながら調整してください。acme-clientの最新バージョンはcrates.ioで確認してください。',
        ],
        codeTitle: 'PowerShell / Terminal',
        code: String.raw`cd src-tauri
cargo add acme-client --features tokio-rustls # 最新バージョンはcrates.ioで確認してください
cargo add tokio --features macros,rt-multi-thread
cargo add anyhow
cargo add thiserror`,
        checklist: [
          'src-tauri/Cargo.tomlにacme-clientが追記されたことを確認する',
          'tokioとserde関連のバージョンが他の依存関係と一致していることを確認する',
        ],
      },
      {
        id: 'service',
        title: '2. ACMEサービスを実装する',
        description: [
          '証明書取得ロジックを専用モジュールにまとめると保守しやすくなります。HTTP-01チャレンジを扱う場合はトークンの一時保存先と公開方法を決めてください。',
          '以下は雛形の例です。コメントに沿ってacme-clientのAPI呼び出しを実装してください。LetsEncrypt本番環境に切り替える前にステージング環境で確認することを推奨します。',
        ],
        codeTitle: 'src-tauri/src/services/acme.rs (雛形)',
        code: String.raw`use acme_client::{Directory, DirectoryUrl};
use anyhow::Result;

pub async fn request_certificate(domain: &str, contact_email: &str) -> Result<()> {
    // 1. ディレクトリを初期化します（最初はステージングを推奨します）
    let directory = Directory::from_url(DirectoryUrl::LetsEncryptStaging)?;

    // 2. アカウントを登録し、利用規約に同意します
    //    例: let account = directory.account_registration().email(contact_email).terms_of_service_agreed(true).register()?;

    // 3. 新しいオーダーを作成し、HTTP-01チャレンジを取得します
    //    トークンと検証文字列をファイルまたは一時サーバーに保存し、80番ポートから公開してください。

    // 4. チャレンジの検証を完了させ、証明書をダウンロードします
    //    証明書と秘密鍵を安全なディレクトリ（例: storage/certs/<domain>/）に保存してください。

    // 5. 保存した証明書をサーバー設定に適用し、バックアップも作成してください

    todo!("acme-clientの証明書取得処理を実装してください");
}`,
        checklist: [
          'HTTP-01チャレンジのトークンを提供する仕組み（ファイル配信やリバースプロキシ連携）が用意されている',
          '証明書ファイルと秘密鍵の保存先がアプリケーション設定と一致している',
        ],
      },
      {
        id: 'command',
        title: '3. フロントエンドと連携するためのTauriコマンドを公開する',
        description: [
          'サービスで実装した関数をTauriコマンドとして公開し、既存のスケジューラや設定画面から呼び出せるようにします。',
          'back-end側でエラーを文字列として返すと、フロントエンドの通知に流用できます。',
        ],
        codeTitle: 'src-tauri/src/commands/certificates.rs (例)',
        code: String.raw`use tauri::State;

#[tauri::command]
pub async fn issue_certificate(domain: String, email: String, app_state: State<'_, AppState>) -> Result<(), String> {
    crate::services::acme::request_certificate(&domain, &email)
        .await
        .map_err(|error| format!("証明書の取得に失敗しました: {}", error))?;

    // TODO: 証明書保存後の再読み込みや設定反映の処理を追加してください
    Ok(())
}`,
        checklist: [
          'src-tauri/src/main.rsまたはcommands/mod.rsでissue_certificateコマンドを登録した',
          'フロントエンドからsafeInvoke("issue_certificate", {...})で呼び出せることを確認した',
          'スケジューラのCertificateRenewalタスクが新しいコマンドを利用するよう更新した',
        ],
      },
      {
        id: 'verification',
        title: '4. テストと運用準備を行う',
        description: [
          'ステージング環境で証明書取得から適用までを通しで確認し、ログを記録してください。',
          'ファイアウォールやリバースプロキシがHTTP-01チャレンジの配信を妨げていないかをチェックします。',
        ],
        checklist: [
          'LetsEncryptステージングのレート制限に達していないことを確認した',
          '取得した証明書の有効期限と設定画面の監視表示が一致している',
          '自動更新ジョブが想定時間に開始されることを確認した（タスクスケジューラやcronルールの確認を含む）',
        ],
      },
    ],
    []
  );

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
      logger.warn('証明書の読み込みに失敗しました', extractErrorMessage(err), 'CertificateManagement');
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
   * コードスニペットをコピー
   */
  const handleCopyCode = useCallback(
    async (code: string, stepId: string) => {
      try {
        await copyToClipboard(code);
        setCopiedCodeId(stepId);

        if (copyTimeoutRef.current) {
          window.clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = window.setTimeout(() => {
          setCopiedCodeId(null);
          copyTimeoutRef.current = null;
        }, 3000);

        showSuccess('コードをクリップボードにコピーしました');
      } catch (err) {
        logger.warn('コードのコピーに失敗しました', extractErrorMessage(err), 'CertificateManagement');
        showError('コピーに失敗しました。ブラウザの権限を確認してください。');
      }
    },
    [showError, showSuccess]
  );

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

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

          <div className="integration-guide">
            <h3>acmeライブラリ統合ガイド</h3>
            <p>
              下記のステップを順番に実施することで、Let&apos;s Encryptの証明書取得処理をアプリケーションに組み込めます。各ステップのチェックリストを活用し、漏れがないように進めてください。
            </p>
            <ol className="integration-step-list">
              {integrationSteps.map(step => (
                <li key={step.id} className="integration-step">
                  <div className="integration-step-header">
                    <span className="integration-step-title">{step.title}</span>
                    {step.code && (
                      <button
                        type="button"
                        className="integration-copy-button"
                        onClick={() => handleCopyCode(step.code || '', step.id)}
                      >
                        {copiedCodeId === step.id ? 'コピー済み' : 'コードをコピー'}
                      </button>
                    )}
                  </div>
                  <div className="integration-step-body">
                    {step.description.map((text, index) => (
                      <p key={`${step.id}-desc-${index}`} className="integration-step-description">
                        {text}
                      </p>
                    ))}
                    {step.code && (
                      <div className="integration-step-code">
                        {step.codeTitle && (
                          <span className="integration-step-code-title">{step.codeTitle}</span>
                        )}
                        <pre>
                          <code>{step.code}</code>
                        </pre>
                      </div>
                    )}
                    {step.checklist && (
                      <ul className="integration-step-checklist">
                        {step.checklist.map((item, index) => (
                          <li key={`${step.id}-check-${index}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
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
